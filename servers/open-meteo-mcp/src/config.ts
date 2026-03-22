import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { MCPServerConfig } from './mcp/types/mcpTypes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ApiConfig {
  geocodingBaseUrl: string;
  forecastBaseUrl: string;
  timeoutMs: number;
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
        httpPort: 3001,
        serverName: 'open-meteo-mcp',
        serverVersion: '1.0.0',
      },
      api: {
        geocodingBaseUrl: 'https://geocoding-api.open-meteo.com/v1',
        forecastBaseUrl: 'https://api.open-meteo.com/v1',
        timeoutMs: 15000,
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
      geocodingBaseUrl:
        process.env.OPEN_METEO_GEOCODING_URL ?? fileConfig.api.geocodingBaseUrl,
      forecastBaseUrl:
        process.env.OPEN_METEO_FORECAST_URL ?? fileConfig.api.forecastBaseUrl,
      timeoutMs: parseInt(
        process.env.OPEN_METEO_TIMEOUT_MS ?? String(fileConfig.api.timeoutMs),
        10
      ),
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
