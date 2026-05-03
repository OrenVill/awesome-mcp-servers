import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

import type { MCPServerConfig } from '../config.js';
import { buildToolRegistry, type RegistryToolDefinition } from '../registry/toolRegistry.js';
import { UsageTracker } from '../registry/usageTracker.js';

const SEARCH_TOOLS_DEF: Tool = {
  name: 'search_tools',
  description:
    "🔧 I'm searching tools to run\n\nThis server bundles tools across many free, no-key APIs: weather (Open-Meteo), countries (REST Countries), Wikipedia, Hacker News, arXiv, Open Library, OpenStreetMap geocoding (Nominatim), dictionary, FX rates (Frankfurter), USGS earthquakes, SpaceX, public GitHub, MDN docs, Datamuse word-finding, trivia, and Crossref scholarly metadata. Search by keywords; returns up to 10 matching tools. Use execute_tools to run any of them.",
  inputSchema: {
    type: 'object',
    properties: {
      keywords: {
        type: 'string',
        description:
          'Keywords to match tool names and descriptions (e.g. "weather forecast", "country capital", "wikipedia article", "hacker news comments").',
      },
    },
    required: ['keywords'],
  },
};

const EXECUTE_TOOLS_DEF: Tool = {
  name: 'execute_tools',
  description:
    '⚡ Execute one or more bundled tools in a single call. Tools run in parallel; each result is returned in the same order with the tool name and either its content or an error message. Use search_tools first to discover tool names and argument schemas.',
  inputSchema: {
    type: 'object',
    properties: {
      tools: {
        type: 'array',
        description:
          'Tools to execute in parallel. Each entry is { name, arguments? }.',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Tool name as returned by search_tools.',
            },
            arguments: {
              type: 'object',
              description: 'Arguments matching the tool\'s inputSchema.',
            },
          },
          required: ['name'],
        },
      },
    },
    required: ['tools'],
  },
};

type ExecuteToolsCall = { name: string; arguments?: Record<string, unknown> };

function log(server: string, event: string, data?: Record<string, unknown>): void {
  const prefix = `[${server}]`;
  const msg = data ? `${prefix} ${event} ${JSON.stringify(data)}` : `${prefix} ${event}`;
  console.error(msg);
}

function searchToolsByKeywords(
  registry: Map<string, RegistryToolDefinition>,
  keywords: string,
  limit: number
): RegistryToolDefinition[] {
  const terms = keywords
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
  if (terms.length === 0) {
    return [];
  }

  const scored = Array.from(registry.values()).map((tool) => {
    const searchable = `${tool.name} ${tool.description} ${(tool.keywords ?? []).join(' ')}`.toLowerCase();
    let matches = 0;
    for (const term of terms) {
      if (searchable.includes(term)) {
        matches++;
      }
    }
    return { tool, matches };
  });

  return scored
    .filter((s) => s.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .slice(0, limit)
    .map((s) => s.tool);
}

export class MCPServer {
  private config: MCPServerConfig;
  private registry: Map<string, RegistryToolDefinition>;
  private usageTracker: UsageTracker;
  private server?: Server;
  private httpApp?: express.Application;
  private httpServer?: ReturnType<express.Application['listen']>;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.registry = buildToolRegistry();
    this.usageTracker = new UsageTracker(config.usageFile);
    this.usageTracker.load();
  }

  private getPopularToolNames(): string[] {
    const limit = this.config.popularToolsCount;
    const seen = new Set<string>();
    const ordered: string[] = [];
    const push = (name: string): void => {
      if (ordered.length >= limit) return;
      if (seen.has(name)) return;
      if (!this.registry.has(name)) return;
      seen.add(name);
      ordered.push(name);
    };
    for (const name of this.usageTracker.getTopN(limit)) push(name);
    for (const name of this.config.popularTools) push(name);
    return ordered;
  }

  private popularToolsToMCP(): Tool[] {
    const names = this.getPopularToolNames();
    return names.map((name) => {
      const def = this.registry.get(name)!;
      return {
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema as Tool['inputSchema'],
      };
    });
  }

  private createServerWithHandlers(): Server {
    const server = new Server(
      {
        name: this.config.serverName,
        version: this.config.serverVersion,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      log(this.config.serverName, 'request', { method: 'tools/list' });
      const tools: Tool[] = [
        ...this.popularToolsToMCP(),
        SEARCH_TOOLS_DEF,
        EXECUTE_TOOLS_DEF,
      ];
      return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const safeArgs = (args ?? {}) as Record<string, unknown>;
      const argsPreview = JSON.stringify(safeArgs).slice(0, 200);
      log(this.config.serverName, 'tool', { name, args: argsPreview });

      try {
        if (name === 'search_tools') {
          const keywords = String(safeArgs.keywords ?? '');
          const matches = searchToolsByKeywords(this.registry, keywords, 10);
          const toolList = matches.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          }));
          const text = JSON.stringify({ tools: toolList }, null, 2);
          log(this.config.serverName, 'tool', { name: 'search_tools', matches: matches.length });
          return { content: [{ type: 'text', text }] };
        }

        if (name === 'execute_tools') {
          const calls = Array.isArray(safeArgs.tools)
            ? (safeArgs.tools as ExecuteToolsCall[])
            : [];
          if (calls.length === 0) {
            throw new Error('execute_tools requires a non-empty `tools` array');
          }

          const settled = await Promise.all(
            calls.map(async (call) => {
              const toolName = String(call?.name ?? '');
              const toolArgs = (call?.arguments ?? {}) as Record<string, unknown>;
              const def = this.registry.get(toolName);
              if (!def) {
                return { name: toolName, ok: false, error: `Unknown tool: ${toolName}` };
              }
              try {
                const result = await def.execute(toolArgs);
                this.usageTracker.increment(toolName);
                return { name: toolName, ok: true, content: result.content };
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { name: toolName, ok: false, error: message };
              }
            })
          );

          const okCount = settled.filter((r) => r.ok).length;
          log(this.config.serverName, 'tool', {
            name: 'execute_tools',
            count: settled.length,
            ok: okCount,
            failed: settled.length - okCount,
          });
          const text = JSON.stringify({ results: settled }, null, 2);
          return { content: [{ type: 'text', text }] };
        }

        const def = this.registry.get(name);
        if (!def) {
          throw new Error(`Unknown tool: ${name}`);
        }
        const result = await def.execute(safeArgs);
        this.usageTracker.increment(name);
        log(this.config.serverName, 'tool', { name, status: 'ok' });
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(this.config.serverName, 'tool', { name, status: 'error', message: msg });
        throw error;
      }
    });

    return server;
  }

  async initialize(): Promise<void> {
    // No async init needed
  }

  async startStdio(): Promise<void> {
    if (!this.config.transports.stdio) {
      return;
    }

    log(this.config.serverName, 'transport starting', { transport: 'stdio' });
    this.server = this.createServerWithHandlers();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    log(this.config.serverName, 'transport ready', { transport: 'stdio' });
  }

  async startHttp(): Promise<void> {
    if (!this.config.transports.http) {
      return;
    }

    const port = this.config.httpPort ?? 3000;
    log(this.config.serverName, 'transport starting', { transport: 'http', port });

    this.httpApp = express();

    this.httpApp.use(
      cors({
        origin: true,
        credentials: false,
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'Accept', 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
        exposedHeaders: ['Mcp-Session-Id'],
      })
    );

    this.httpApp.use(express.json({ limit: '10mb' }));

    this.httpApp.get('/health', (_req, res) => {
      log(this.config.serverName, 'request', { method: 'GET', path: '/health' });
      res.json({
        status: 'healthy',
        server: this.config.serverName,
        version: this.config.serverVersion,
        timestamp: new Date().toISOString(),
      });
    });

    this.httpApp.all('/mcp', async (req, res) => {
      try {
        if (req.method === 'POST' && req.headers.accept) {
          const accept = req.headers.accept;
          if (!accept.includes('text/event-stream') || !accept.includes('application/json')) {
            req.headers.accept = 'application/json, text/event-stream';
          }
        }

        let transport: StreamableHTTPServerTransport;
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        if (req.method === 'POST' && (req.body as { method?: string })?.method === 'initialize') {
          log(this.config.serverName, 'request', {
            method: req.method,
            path: '/mcp',
            body: 'initialize',
          });
          const sessionServer = this.createServerWithHandlers();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              this.transports.set(sid, transport);
              log(this.config.serverName, 'session initialized', { sessionId: sid });
            },
            onsessionclosed: (sid) => {
              this.transports.delete(sid);
              log(this.config.serverName, 'session closed', { sessionId: sid });
            },
          });
          await sessionServer.connect(transport);
        } else if (sessionId && this.transports.has(sessionId)) {
          const bodyMethod = (req.body as { method?: string })?.method ?? 'unknown';
          log(this.config.serverName, 'request', {
            method: req.method,
            path: '/mcp',
            sessionId,
            bodyMethod,
          });
          transport = this.transports.get(sessionId)!;
        } else {
          log(this.config.serverName, 'request rejected', {
            reason: sessionId ? 'session not found' : 'missing session id',
            sessionId,
          });
          if (!res.headersSent) {
            res.status(400).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: sessionId
                  ? `Session not found: ${sessionId}`
                  : 'Mcp-Session-Id header required for non-initialize requests',
              },
              id: null,
            });
          }
          return;
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(this.config.serverName, 'request error', { error: msg });
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal error',
              data: error instanceof Error ? error.message : 'Unknown error',
            },
            id: null,
          });
        }
      }
    });

    this.httpServer = this.httpApp.listen(port, () => {
      log(this.config.serverName, 'transport ready', {
        transport: 'http',
        port,
        mcp: `http://localhost:${port}/mcp`,
        health: `http://localhost:${port}/health`,
      });
    });
  }

  async start(): Promise<void> {
    await this.initialize();

    const startPromises: Promise<void>[] = [];
    if (this.config.transports.stdio) startPromises.push(this.startStdio());
    if (this.config.transports.http) startPromises.push(this.startHttp());

    if (startPromises.length === 0) {
      console.warn('MCP Server: No transports enabled');
      return;
    }

    await Promise.all(startPromises);
    log(this.config.serverName, 'ready');
  }

  async stop(): Promise<void> {
    log(this.config.serverName, 'shutting down', { activeSessions: this.transports.size });
    this.usageTracker.flushSync();

    for (const [sid, transport] of this.transports) {
      await transport.close();
      log(this.config.serverName, 'session closed', { sessionId: sid });
    }
    this.transports.clear();

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }
  }
}

export async function createMCPServer(config: MCPServerConfig): Promise<MCPServer> {
  const server = new MCPServer(config);
  await server.start();
  return server;
}
