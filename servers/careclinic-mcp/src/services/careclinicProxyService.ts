import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getConfig, type ApiConfig } from '../config.js';
import {
  CARECLINIC_MISSING_BEARER_MESSAGE,
  createMCPErrorResult,
  MCPErrorCode,
  type MCPToolCallResult,
} from '../mcp/types/mcpTypes.js';

const CARECLINIC_KEYWORDS = [
  'careclinic',
  'health',
  'wellness',
  'symptoms',
  'mood',
  'medication',
  'sleep',
  'tracker',
];

function log(event: string, data?: Record<string, unknown>): void {
  const msg = data ? `[careclinic-mcp] ${event} ${JSON.stringify(data)}` : `[careclinic-mcp] ${event}`;
  console.error(msg);
}

function sanitizeTool(tool: Tool): Tool {
  return {
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema as Tool['inputSchema'],
  };
}

function callResultToText(result: unknown): MCPToolCallResult {
  const r = result as {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  if (!r.content?.length) {
    return {
      content: [{ type: 'text', text: r.isError ? 'CareClinic returned an error with no content.' : '(empty response)' }],
    };
  }

  const parts: string[] = [];
  for (const item of r.content) {
    if (item.type === 'text' && item.text) {
      parts.push(item.text);
    } else {
      parts.push(JSON.stringify(item, null, 2));
    }
  }

  const text = parts.join('\n\n');
  if (r.isError) {
    return createMCPErrorResult(MCPErrorCode.API_ERROR, text);
  }
  return { content: [{ type: 'text', text }] };
}

export class CareClinicProxyService {
  private config: ApiConfig;
  private listClient?: Client;
  private listTransport?: StreamableHTTPClientTransport;
  private authClient?: Client;
  private authTransport?: StreamableHTTPClientTransport;
  private toolsCache: Tool[] | null = null;
  private cachedToken?: string;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  private currentBearerToken(): string | undefined {
    return getConfig().api.bearerToken?.trim();
  }

  hasBearerToken(): boolean {
    return Boolean(this.currentBearerToken());
  }

  private getRemoteUrl(): URL {
    return new URL(this.config.remoteMcpUrl);
  }

  private async connectListClient(): Promise<Client> {
    if (this.listClient) {
      return this.listClient;
    }

    const client = new Client({
      name: 'careclinic-mcp-proxy',
      version: '1.0.0',
    });
    client.onerror = (error) => {
      log('upstream client error', { error: String(error) });
    };

    const transport = new StreamableHTTPClientTransport(this.getRemoteUrl());
    await client.connect(transport);
    this.listClient = client;
    this.listTransport = transport;
    return client;
  }

  private async connectAuthClient(token: string): Promise<Client> {
    if (this.authClient && this.cachedToken === token) {
      return this.authClient;
    }

    if (this.authTransport) {
      await this.authTransport.close();
    }
    this.authClient = undefined;
    this.authTransport = undefined;

    const client = new Client({
      name: 'careclinic-mcp-proxy',
      version: '1.0.0',
    });
    client.onerror = (error) => {
      log('upstream auth client error', { error: String(error) });
    };

    const transport = new StreamableHTTPClientTransport(this.getRemoteUrl(), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
    await client.connect(transport);
    this.authClient = client;
    this.authTransport = transport;
    this.cachedToken = token;
    return client;
  }

  async listTools(): Promise<Tool[]> {
    if (this.toolsCache) {
      return this.toolsCache;
    }

    const client = await this.connectListClient();
    const { tools } = await client.listTools();
    this.toolsCache = tools.map(sanitizeTool);
    log('upstream tools listed', { count: this.toolsCache.length });
    return this.toolsCache;
  }

  toolKeywords(toolName: string): string[] {
    return [...CARECLINIC_KEYWORDS, toolName.replace(/^careclinic_/, '')];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    const token = this.currentBearerToken();
    if (!token) {
      return createMCPErrorResult(MCPErrorCode.AUTH_REQUIRED, CARECLINIC_MISSING_BEARER_MESSAGE);
    }

    try {
      const client = await this.connectAuthClient(token);
      const result = await client.callTool({
        name,
        arguments: args,
      });
      return callResultToText(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/401|unauthorized/i.test(msg)) {
        return createMCPErrorResult(
          MCPErrorCode.AUTH_REQUIRED,
          `CareClinic rejected the bearer token (${msg}). Obtain a fresh OAuth access token for your account and update CARECLINIC_BEARER_TOKEN.`
        );
      }
      return createMCPErrorResult(MCPErrorCode.API_ERROR, msg);
    }
  }

  async cleanup(): Promise<void> {
    if (this.listTransport) {
      await this.listTransport.close();
    }
    if (this.authTransport) {
      await this.authTransport.close();
    }
    this.listClient = undefined;
    this.listTransport = undefined;
    this.authClient = undefined;
    this.authTransport = undefined;
    this.toolsCache = null;
    this.cachedToken = undefined;
  }
}
