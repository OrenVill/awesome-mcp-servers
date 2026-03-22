import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import {
  WikipediaTools,
  type SearchWikipediaInput,
  type GetArticleInput,
  type GetSummaryInput,
} from './tools/wikipediaTools.js';
import type { MCPServerConfig } from './types/mcpTypes.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

export class MCPServer {
  private wikipediaTools: WikipediaTools;
  private config: MCPServerConfig;
  private server?: Server;
  private httpApp?: express.Application;
  private httpServer?: ReturnType<express.Application['listen']>;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.wikipediaTools = new WikipediaTools();
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
          name: 'search_wikipedia',
          description:
            'Search for Wikipedia articles by query. Returns article titles and snippets. Use before get_article or get_summary when you need to find articles by topic.',
          inputSchema: WikipediaTools.getSearchWikipediaSchema().inputSchema as Tool['inputSchema'],
        },
        {
          name: 'get_article',
          description:
            'Get full extract/summary of a Wikipedia article by exact title. Returns introductory and extended content.',
          inputSchema: WikipediaTools.getGetArticleSchema().inputSchema as Tool['inputSchema'],
        },
        {
          name: 'get_summary',
          description:
            'Get a brief summary of a Wikipedia article by exact title. Uses REST summary when available, otherwise intro extract.',
          inputSchema: WikipediaTools.getGetSummarySchema().inputSchema as Tool['inputSchema'],
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
          case 'search_wikipedia':
            result = await this.wikipediaTools.executeSearchWikipedia(
              safeArgs as unknown as SearchWikipediaInput
            );
            break;
          case 'get_article':
            result = await this.wikipediaTools.executeGetArticle(
              safeArgs as unknown as GetArticleInput
            );
            break;
          case 'get_summary':
            result = await this.wikipediaTools.executeGetSummary(
              safeArgs as unknown as GetSummaryInput
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
    // No async init needed for Wikipedia API (stateless HTTP)
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

    const port = this.config.httpPort ?? 3003;
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
    console.error('MCP Server: Wikipedia MCP ready');
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
