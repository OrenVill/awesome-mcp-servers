import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import {
  HackerNewsTools,
  type GetTopStoriesInput,
  type GetStoryInput,
  type GetCommentsInput,
  type SearchHNInput,
} from './tools/hackerNewsTools.js';
import type { MCPServerConfig } from './types/mcpTypes.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

export class MCPServer {
  private hackerNewsTools: HackerNewsTools;
  private config: MCPServerConfig;
  private server?: Server;
  private httpApp?: express.Application;
  private httpServer?: ReturnType<express.Application['listen']>;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.hackerNewsTools = new HackerNewsTools();
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
          name: 'get_top_stories',
          description:
            'Fetch top, new, or best stories from Hacker News. Returns title, URL, score, author, and comment count for each story.',
          inputSchema: HackerNewsTools.getTopStoriesSchema()
            .inputSchema as Tool['inputSchema'],
        },
        {
          name: 'get_story',
          description:
            'Get a single story or item by ID. Returns title, URL, score, author, kids count, and optional text.',
          inputSchema: HackerNewsTools.getStorySchema()
            .inputSchema as Tool['inputSchema'],
        },
        {
          name: 'get_comments',
          description:
            'Get the comment tree for a story. Returns the story and nested comments with configurable depth and limit.',
          inputSchema: HackerNewsTools.getCommentsSchema()
            .inputSchema as Tool['inputSchema'],
        },
        {
          name: 'search_hn',
          description:
            'Search Hacker News via Algolia API. Returns matching stories with title, URL, author, points, and comment count.',
          inputSchema: HackerNewsTools.getSearchHNSchema()
            .inputSchema as Tool['inputSchema'],
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
          case 'get_top_stories':
            result = await this.hackerNewsTools.executeGetTopStories(
              safeArgs as unknown as GetTopStoriesInput
            );
            break;
          case 'get_story':
            result = await this.hackerNewsTools.executeGetStory(
              safeArgs as unknown as GetStoryInput
            );
            break;
          case 'get_comments':
            result = await this.hackerNewsTools.executeGetComments(
              safeArgs as unknown as GetCommentsInput
            );
            break;
          case 'search_hn':
            result = await this.hackerNewsTools.executeSearchHN(
              safeArgs as unknown as SearchHNInput
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
    // No async init needed for HN API (stateless HTTP)
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

    const port = this.config.httpPort ?? 3004;
    console.error(`MCP Server: Starting HTTP transport on port ${port}...`);

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
        ],
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
          if (
            !accept.includes('text/event-stream') ||
            !accept.includes('application/json')
          ) {
            req.headers.accept = 'application/json, text/event-stream';
          }
        }

        let transport: StreamableHTTPServerTransport;
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        if (
          req.method === 'POST' &&
          (req.body as { method?: string })?.method === 'initialize'
        ) {
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
    console.error('MCP Server: Hacker News MCP ready');
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

export async function createMCPServer(
  config: MCPServerConfig
): Promise<MCPServer> {
  const server = new MCPServer(config);
  await server.start();
  return server;
}
