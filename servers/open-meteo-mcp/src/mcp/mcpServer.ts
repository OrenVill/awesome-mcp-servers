import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { GeocodingTools } from './tools/geocodingTools.js';
import {
  WeatherTools,
  type GetCurrentWeatherInput,
  type GetForecastInput,
} from './tools/weatherTools.js';
import type { MCPServerConfig } from './types/mcpTypes.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

export class MCPServer {
  private geocodingTools: GeocodingTools;
  private weatherTools: WeatherTools;
  private config: MCPServerConfig;
  private server?: Server;
  private httpApp?: express.Application;
  private httpServer?: ReturnType<express.Application['listen']>;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.geocodingTools = new GeocodingTools();
    this.weatherTools = new WeatherTools();
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
          name: 'search_locations',
          description:
            'Search for locations by name or postal code. Returns coordinates and timezone for use with weather tools. Use before get_current_weather or get_forecast when you only have a place name.',
          inputSchema: GeocodingTools.getSearchLocationsSchema().inputSchema as Tool['inputSchema'],
        },
        {
          name: 'get_current_weather',
          description:
            'Get current weather conditions for a location by latitude and longitude. Returns temperature, humidity, wind, precipitation, and weather conditions.',
          inputSchema: WeatherTools.getCurrentWeatherSchema().inputSchema as Tool['inputSchema'],
        },
        {
          name: 'get_forecast',
          description:
            'Get multi-day weather forecast for a location. Returns daily highs/lows, precipitation, and conditions for up to 16 days.',
          inputSchema: WeatherTools.getForecastSchema().inputSchema as Tool['inputSchema'],
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
          case 'search_locations':
            result = await this.geocodingTools.executeSearchLocations(
              safeArgs as { name: string; count?: number; language?: string; countryCode?: string }
            );
            break;
          case 'get_current_weather':
            result = await this.weatherTools.executeGetCurrentWeather(
              safeArgs as unknown as GetCurrentWeatherInput
            );
            break;
          case 'get_forecast':
            result = await this.weatherTools.executeGetForecast(
              safeArgs as unknown as GetForecastInput
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
    // No async init needed for Open-Meteo API (stateless HTTP)
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

    const port = this.config.httpPort ?? 3001;
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
    console.error('MCP Server: Open-Meteo MCP ready');
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
