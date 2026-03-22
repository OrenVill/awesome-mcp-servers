import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface OpenMeteoApiConfig {
  geocodingBaseUrl: string;
  forecastBaseUrl: string;
  timeoutMs: number;
}

export interface RestCountriesApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface WikipediaApiConfig {
  restBaseUrl: string;
  mediaWikiBaseUrl: string;
  timeoutMs: number;
}

export interface HackerNewsApiConfig {
  firebaseBaseUrl: string;
  algoliaBaseUrl: string;
  timeoutMs: number;
}

export interface ApiConfig {
  openMeteo: OpenMeteoApiConfig;
  restCountries: RestCountriesApiConfig;
  wikipedia: WikipediaApiConfig;
  hackerNews: HackerNewsApiConfig;
}

export interface MCPConfig {
  enabled: boolean;
  transport: 'stdio' | 'http' | 'both';
  httpPort: number;
  serverName: string;
  serverVersion: string;
  popularTools: string[];
  popularToolsCount: number;
  usageFile: string;
}

export interface MCPServerConfig {
  enabled: boolean;
  transports: {
    stdio: boolean;
    http: boolean;
  };
  httpPort?: number;
  serverName: string;
  serverVersion: string;
  popularTools: string[];
  popularToolsCount: number;
  usageFile: string;
}

export interface ServiceConfig {
  mcp: MCPConfig;
  api: ApiConfig;
}

const CONFIG_PATH = resolve(__dirname, '../config.json');

const DEFAULT_CONFIG: ServiceConfig = {
  mcp: {
    enabled: true,
    transport: 'both',
    httpPort: 3000,
    serverName: 'unified-mcp',
    serverVersion: '1.0.0',
    popularTools: ['get_current_weather', 'search_wikipedia', 'get_top_stories'],
    popularToolsCount: 5,
    usageFile: '~/.config/awesome-mcp-servers/unified-usage.json',
  },
  api: {
    openMeteo: {
      geocodingBaseUrl: 'https://geocoding-api.open-meteo.com/v1',
      forecastBaseUrl: 'https://api.open-meteo.com/v1',
      timeoutMs: 15000,
    },
    restCountries: {
      baseUrl: 'https://restcountries.com/v3.1',
      timeoutMs: 15000,
    },
    wikipedia: {
      restBaseUrl: 'https://en.wikipedia.org/api/rest_v1',
      mediaWikiBaseUrl: 'https://en.wikipedia.org/w/api.php',
      timeoutMs: 15000,
    },
    hackerNews: {
      firebaseBaseUrl: 'https://hacker-news.firebaseio.com/v0',
      algoliaBaseUrl: 'https://hn.algolia.com/api/v1',
      timeoutMs: 15000,
    },
  },
};

function loadConfig(): ServiceConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as ServiceConfig;
  } catch {
    return DEFAULT_CONFIG;
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
      popularTools: fileConfig.mcp.popularTools,
      popularToolsCount: fileConfig.mcp.popularToolsCount,
      usageFile:
        process.env.UNIFIED_MCP_USAGE_FILE ?? fileConfig.mcp.usageFile,
    },
    api: {
      openMeteo: {
        geocodingBaseUrl:
          process.env.OPEN_METEO_GEOCODING_URL ??
          fileConfig.api.openMeteo.geocodingBaseUrl,
        forecastBaseUrl:
          process.env.OPEN_METEO_FORECAST_URL ??
          fileConfig.api.openMeteo.forecastBaseUrl,
        timeoutMs: parseInt(
          process.env.OPEN_METEO_TIMEOUT_MS ??
            String(fileConfig.api.openMeteo.timeoutMs),
          10
        ),
      },
      restCountries: {
        baseUrl:
          process.env.REST_COUNTRIES_BASE_URL ??
          fileConfig.api.restCountries.baseUrl,
        timeoutMs: parseInt(
          process.env.REST_COUNTRIES_TIMEOUT_MS ??
            String(fileConfig.api.restCountries.timeoutMs),
          10
        ),
      },
      wikipedia: {
        restBaseUrl:
          process.env.WIKIPEDIA_REST_BASE_URL ??
          fileConfig.api.wikipedia.restBaseUrl,
        mediaWikiBaseUrl:
          process.env.WIKIPEDIA_MEDIAWIKI_BASE_URL ??
          fileConfig.api.wikipedia.mediaWikiBaseUrl,
        timeoutMs: parseInt(
          process.env.WIKIPEDIA_TIMEOUT_MS ??
            String(fileConfig.api.wikipedia.timeoutMs),
          10
        ),
      },
      hackerNews: {
        firebaseBaseUrl:
          process.env.HACKER_NEWS_FIREBASE_URL ??
          fileConfig.api.hackerNews.firebaseBaseUrl,
        algoliaBaseUrl:
          process.env.HACKER_NEWS_ALGOLIA_URL ??
          fileConfig.api.hackerNews.algoliaBaseUrl,
        timeoutMs: parseInt(
          process.env.HACKER_NEWS_TIMEOUT_MS ??
            String(fileConfig.api.hackerNews.timeoutMs),
          10
        ),
      },
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
    popularTools: config.mcp.popularTools,
    popularToolsCount: config.mcp.popularToolsCount,
    usageFile: config.mcp.usageFile,
  };
}
