import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import {
  CountriesTools,
  GET_COUNTRY_DEF,
  SEARCH_COUNTRIES_DEF,
  LIST_ALL_COUNTRIES_DEF,
  type GetCountryInput,
  type SearchCountriesInput,
  type ListAllCountriesInput,
} from './tools/countriesTools.js';
import type { MCPServerConfig } from './types/mcpTypes.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

function log(server: string, event: string, data?: Record<string, unknown>): void {
  const prefix = `[${server}]`;
  const msg = data ? `${prefix} ${event} ${JSON.stringify(data)}` : `${prefix} ${event}`;
  console.error(msg);
}

export class MCPServer {
  private countriesTools: CountriesTools;
  private config: MCPServerConfig;
  private server?: Server;
  private httpApp?: express.Application;
  private httpServer?: ReturnType<express.Application['listen']>;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.countriesTools = new CountriesTools();
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
        {
          ...GET_COUNTRY_DEF,
          inputSchema: CountriesTools.getGetCountrySchema().inputSchema as Tool['inputSchema'],
        },
        {
          ...SEARCH_COUNTRIES_DEF,
          inputSchema: CountriesTools.getSearchCountriesSchema().inputSchema as Tool['inputSchema'],
        },
        {
          ...LIST_ALL_COUNTRIES_DEF,
          inputSchema: CountriesTools.getListAllCountriesSchema().inputSchema as Tool['inputSchema'],
        },
      ];

      return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const safeArgs = (args ?? {}) as Record<string, unknown>;
      const argsPreview = JSON.stringify(safeArgs).slice(0, 200);
      log(this.config.serverName, 'tool', { name, args: argsPreview });

      try {
        let result;
        switch (name) {
          case 'get_country':
            result = await this.countriesTools.executeGetCountry(
              safeArgs as unknown as GetCountryInput
            );
            break;
          case 'search_countries':
            result = await this.countriesTools.executeSearchCountries(
              safeArgs as unknown as SearchCountriesInput
            );
            break;
          case 'list_all_countries':
            result = await this.countriesTools.executeListAllCountries(
              safeArgs as unknown as ListAllCountriesInput
            );
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        log(this.config.serverName, 'tool', { name, status: 'ok' });
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
    // No async init needed for REST Countries API (stateless HTTP)
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

    const port = this.config.httpPort ?? 3002;
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
          log(this.config.serverName, 'request', { method: req.method, path: '/mcp', sessionId, bodyMethod });
          transport = this.transports.get(sessionId)!;
        } else {
          log(this.config.serverName, 'request rejected', { reason: sessionId ? 'session not found' : 'missing session id', sessionId });
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
      log(this.config.serverName, 'transport ready', { transport: 'http', port, mcp: `http://localhost:${port}/mcp`, health: `http://localhost:${port}/health` });
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
