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
    "🔧 I'm searching the tool registry by keywords and optionally running a tool\n\nSearch for bla bla tools by keywords. Returns matching tools. Optionally execute a tool by name with arguments.",
  inputSchema: {
    type: 'object',
    properties: {
      keywords: {
        type: 'string',
        description:
          'One or more keywords to search for relevant tools (e.g. "weather paris", "countries")',
      },
      execute: {
        type: 'object',
        description:
          'Optional. If provided, execute the specified tool and return its result.',
        properties: {
          name: { type: 'string' },
          arguments: { type: 'object' },
        },
      },
    },
    required: ['keywords'],
  },
};

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
    const top = this.usageTracker.getTopN(5);
    if (top.length > 0) {
      return top.filter((name) => this.registry.has(name));
    }
    return this.config.popularTools
      .slice(0, this.config.popularToolsCount)
      .filter((name) => this.registry.has(name));
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
      const tools: Tool[] = [...this.popularToolsToMCP(), SEARCH_TOOLS_DEF];
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
          const execute = safeArgs.execute as
            | { name?: string; arguments?: Record<string, unknown> }
            | undefined;

          if (execute !== undefined && execute !== null && execute.name) {
            const toolName = String(execute.name);
            const toolArgs = (execute.arguments ?? {}) as Record<string, unknown>;
            const def = this.registry.get(toolName);
            if (!def) {
              throw new Error(`Unknown tool: ${toolName}`);
            }
            const result = await def.execute(toolArgs);
            this.usageTracker.increment(toolName);
            log(this.config.serverName, 'tool', { name: 'search_tools', execute: toolName, status: 'ok' });
            return result;
          }

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
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'Accept', 'Mcp-Session-Id'],
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
