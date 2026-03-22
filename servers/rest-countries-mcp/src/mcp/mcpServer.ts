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
  type GetCountryInput,
  type SearchCountriesInput,
  type ListAllCountriesInput,
} from './tools/countriesTools.js';
import type { MCPServerConfig } from './types/mcpTypes.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

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
      const tools: Tool[] = [
        {
          name: 'get_country',
          description:
            'Get country info by name or alpha code (e.g. "peru", "pe", "PER"). Returns name, capital, region, population, currencies, languages, etc.',
          inputSchema: CountriesTools.getGetCountrySchema().inputSchema as Tool['inputSchema'],
        },
        {
          name: 'search_countries',
          description:
            'Search countries by region, subregion, or capital. Returns a list of matching countries with name and codes.',
          inputSchema: CountriesTools.getSearchCountriesSchema().inputSchema as Tool['inputSchema'],
        },
        {
          name: 'list_all_countries',
          description:
            'List all countries with optional fields filter. Use fields param to limit response (max 10 fields, e.g. name,cca2,cca3,capital,region).',
          inputSchema: CountriesTools.getListAllCountriesSchema().inputSchema as Tool['inputSchema'],
        },
      ];

      return { tools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const safeArgs = (args ?? {}) as Record<string, unknown>;

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
        return result as { content: Array<{ type: string; text: string }> };
      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
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

    console.error('MCP Server: Starting stdio transport...');
    this.server = this.createServerWithHandlers();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Server: stdio transport ready');
  }

  async startHttp(): Promise<void> {
    if (!this.config.transports.http) {
      return;
    }

    const port = this.config.httpPort ?? 3002;
    console.error(`MCP Server: Starting HTTP transport on port ${port}...`);

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
          const sessionServer = this.createServerWithHandlers();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              this.transports.set(sid, transport);
            },
            onsessionclosed: (sid) => {
              this.transports.delete(sid);
            },
          });
          await sessionServer.connect(transport);
        } else if (sessionId && this.transports.has(sessionId)) {
          transport = this.transports.get(sessionId)!;
        } else {
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
        console.error('MCP Server: HTTP request error', error);
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
      console.error(`MCP Server: HTTP at http://localhost:${port}/mcp`);
      console.error(`MCP Server: Health at http://localhost:${port}/health`);
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
    console.error('MCP Server: REST Countries MCP ready');
  }

  async stop(): Promise<void> {
    for (const [, transport] of this.transports) {
      await transport.close();
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
