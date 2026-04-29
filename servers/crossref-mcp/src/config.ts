import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { MCPServerConfig } from './mcp/types/mcpTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
  mailto: string;
}

export interface ServiceConfig {
  mcp: {
    enabled: boolean;
    transport: 'stdio' | 'http' | 'both';
    httpPort: number;
    serverName: string;
    serverVersion: string;
  };
  api: ApiConfig;
}

const CONFIG_PATH = resolve(__dirname, '../config.json');

function loadConfig(): ServiceConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as ServiceConfig;
  } catch {
    return {
      mcp: {
        enabled: true,
        transport: 'both',
        httpPort: 3515,
        serverName: 'crossref-mcp',
        serverVersion: '1.0.0',
      },
      api: {
        baseUrl: 'https://api.crossref.org',
        timeoutMs: 15000,
        mailto: '',
      },
    };
  }
}

const fileConfig = loadConfig();

export function getConfig(): ServiceConfig {
  const transport =
    (process.env.MCP_TRANSPORT as 'stdio' | 'http' | 'both') ??
    fileConfig.mcp.transport;

  return {
    mcp: {
      enabled: process.env.ENABLE_MCP_SERVER !== 'false' && fileConfig.mcp.enabled,
      transport,
      httpPort: parseInt(
        process.env.MCP_HTTP_PORT ?? String(fileConfig.mcp.httpPort),
        10
      ),
      serverName: process.env.MCP_SERVER_NAME ?? fileConfig.mcp.serverName,
      serverVersion: process.env.MCP_SERVER_VERSION ?? fileConfig.mcp.serverVersion,
    },
    api: {
      baseUrl: process.env.CROSSREF_BASE_URL ?? fileConfig.api.baseUrl,
      timeoutMs: parseInt(
        process.env.CROSSREF_TIMEOUT_MS ?? String(fileConfig.api.timeoutMs),
        10
      ),
      mailto: process.env.CROSSREF_MAILTO ?? fileConfig.api.mailto ?? '',
    },
  };
}

export function getMCPConfig(): MCPServerConfig {
  const config = getConfig();
  const transport = config.mcp.transport;

  return {
    enabled: config.mcp.enabled,
    transports: {
      stdio: transport === 'stdio' || transport === 'both',
      http: transport === 'http' || transport === 'both',
    },
    httpPort: config.mcp.httpPort,
    serverName: config.mcp.serverName,
    serverVersion: config.mcp.serverVersion,
  };
}
