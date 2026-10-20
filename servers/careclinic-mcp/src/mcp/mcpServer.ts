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

import { getConfig } from '../config.js';
import { CareClinicProxyService } from '../services/careclinicProxyService.js';
import { CareClinicTools } from './tools/careclinicTools.js';
import type { MCPServerConfig } from './types/mcpTypes.js';

function log(server: string, event: string, data?: Record<string, unknown>): void {
  const prefix = `[${server}]`;
  const msg = data ? `${prefix} ${event} ${JSON.stringify(data)}` : `${prefix} ${event}`;
  console.error(msg);
}

export class MCPServer {
  private proxy: CareClinicProxyService;
  private tools: CareClinicTools;
  private config: MCPServerConfig;
  private server?: Server;
  private httpApp?: express.Application;
  private httpServer?: ReturnType<express.Application['listen']>;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    const apiConfig = getConfig().api;
    this.proxy = new CareClinicProxyService(apiConfig);
    this.tools = new CareClinicTools(this.proxy);
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
      const remoteTools = await this.proxy.listTools();
      const tools: Tool[] = remoteTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
      return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const safeArgs = (args ?? {}) as Record<string, unknown>;
      const argsPreview = JSON.stringify(safeArgs).slice(0, 200);
      log(this.config.serverName, 'tool', { name, args: argsPreview });

      if (!this.proxy.hasBearerToken()) {
        log(this.config.serverName, 'tool', { name, status: 'auth_required' });
        const result = await this.tools.executeTool(name, safeArgs);
        return result as { content: Array<{ type: string; text: string }> };
      }

      try {
        const result = await this.tools.executeTool(name, safeArgs);
        const isError = result.content[0]?.text.startsWith('Error (');
        log(this.config.serverName, 'tool', { name, status: isError ? 'error' : 'ok' });
        return result as { content: Array<{ type: string; text: string }> };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log(this.config.serverName, 'tool', { name, status: 'error', message: msg });
        throw error;
      }
    });

    return server;
  }

  async initialize(): Promise<void> {
    if (!this.proxy.hasBearerToken()) {
      log(this.config.serverName, 'startup', {
        auth: 'missing',
        hint: 'Set CARECLINIC_BEARER_TOKEN before calling CareClinic tools',
      });
    } else {
      log(this.config.serverName, 'startup', { auth: 'bearer_token_configured' });
    }
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

    const port = this.config.httpPort ?? 3516;
    log(this.config.serverName, 'transport starting', { transport: 'http', port });

    this.httpApp = express();

    this.httpApp.use(
      cors({
        origin: true,
        credentials: false,
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Session-Id',
          'Accept',
          'Mcp-Session-Id',
          'Mcp-Protocol-Version',
        ],
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
        careclinicBearerTokenConfigured: this.proxy.hasBearerToken(),
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
          log(this.config.serverName, 'request', { method: req.method, path: '/mcp', body: 'initialize' });
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
    for (const [, transport] of this.transports) {
      await transport.close();
    }
    this.transports.clear();

    await this.proxy.cleanup();

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
