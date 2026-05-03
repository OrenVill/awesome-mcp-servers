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

export interface ArxivApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface OpenLibraryApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface NominatimApiConfig {
  baseUrl: string;
  timeoutMs: number;
  userAgent: string;
}

export interface DictionaryApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface FrankfurterApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface UsgsApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface SpacexApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface GithubPublicApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface MdnApiConfig {
  searchBaseUrl: string;
  docsBaseUrl: string;
  timeoutMs: number;
}

export interface DatamuseApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface TriviaApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface CrossrefApiConfig {
  baseUrl: string;
  timeoutMs: number;
  mailto: string;
}

export interface ApiConfig {
  openMeteo: OpenMeteoApiConfig;
  restCountries: RestCountriesApiConfig;
  wikipedia: WikipediaApiConfig;
  hackerNews: HackerNewsApiConfig;
  arxiv: ArxivApiConfig;
  openLibrary: OpenLibraryApiConfig;
  nominatim: NominatimApiConfig;
  dictionary: DictionaryApiConfig;
  frankfurter: FrankfurterApiConfig;
  usgs: UsgsApiConfig;
  spacex: SpacexApiConfig;
  githubPublic: GithubPublicApiConfig;
  mdn: MdnApiConfig;
  datamuse: DatamuseApiConfig;
  trivia: TriviaApiConfig;
  crossref: CrossrefApiConfig;
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
  apiKeys: Record<string, string>;
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
  apiKeys: Record<string, string>;
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
    httpPort: 8000,
    serverName: 'unified-mcp',
    serverVersion: '1.0.0',
    popularTools: ['get_current_weather', 'search_wikipedia', 'get_top_stories'],
    popularToolsCount: 5,
    usageFile: '~/.config/awesome-mcp-servers/unified-usage.json',
    apiKeys: {},
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
    arxiv: {
      baseUrl: 'http://export.arxiv.org/api/query',
      timeoutMs: 15000,
    },
    openLibrary: {
      baseUrl: 'https://openlibrary.org',
      timeoutMs: 15000,
    },
    nominatim: {
      baseUrl: 'https://nominatim.openstreetmap.org',
      timeoutMs: 15000,
      userAgent: 'unified-mcp/1.0 (https://github.com/awesome-mcp-servers)',
    },
    dictionary: {
      baseUrl: 'https://api.dictionaryapi.dev/api/v2',
      timeoutMs: 15000,
    },
    frankfurter: {
      baseUrl: 'https://api.frankfurter.app',
      timeoutMs: 15000,
    },
    usgs: {
      baseUrl: 'https://earthquake.usgs.gov/fdsnws/event/1',
      timeoutMs: 15000,
    },
    spacex: {
      baseUrl: 'https://api.spacexdata.com/v4',
      timeoutMs: 15000,
    },
    githubPublic: {
      baseUrl: 'https://api.github.com',
      timeoutMs: 15000,
    },
    mdn: {
      searchBaseUrl: 'https://developer.mozilla.org/api/v1/search',
      docsBaseUrl: 'https://developer.mozilla.org',
      timeoutMs: 15000,
    },
    datamuse: {
      baseUrl: 'https://api.datamuse.com',
      timeoutMs: 15000,
    },
    trivia: {
      baseUrl: 'https://opentdb.com',
      timeoutMs: 15000,
    },
    crossref: {
      baseUrl: 'https://api.crossref.org',
      timeoutMs: 15000,
      mailto: '',
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

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? parseInt(v, 10) : fallback;
}

function parseApiKeys(
  raw: string | undefined,
  fallback: Record<string, string>
): Record<string, string> {
  if (!raw || !raw.trim()) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `UNIFIED_MCP_API_KEYS is not valid JSON (${msg}). Expected a {"name":"key"} object.`
    );
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.values(parsed).some((v) => typeof v !== 'string' || !v)
  ) {
    throw new Error(
      'UNIFIED_MCP_API_KEYS must be a JSON object of {"name":"key"} pairs with non-empty string values.'
    );
  }
  return parsed as Record<string, string>;
}

export function getConfig(): ServiceConfig {
  const transport =
    (process.env.MCP_TRANSPORT as 'stdio' | 'http' | 'both') ??
    fileConfig.mcp.transport;

  return {
    mcp: {
      enabled: process.env.ENABLE_MCP_SERVER !== 'false' && fileConfig.mcp.enabled,
      transport,
      httpPort: intEnv('MCP_HTTP_PORT', fileConfig.mcp.httpPort),
      serverName: process.env.MCP_SERVER_NAME ?? fileConfig.mcp.serverName,
      serverVersion: process.env.MCP_SERVER_VERSION ?? fileConfig.mcp.serverVersion,
      popularTools: fileConfig.mcp.popularTools,
      popularToolsCount: fileConfig.mcp.popularToolsCount,
      usageFile:
        process.env.UNIFIED_MCP_USAGE_FILE ?? fileConfig.mcp.usageFile,
      apiKeys: parseApiKeys(
        process.env.UNIFIED_MCP_API_KEYS,
        fileConfig.mcp.apiKeys ?? {}
      ),
    },
    api: {
      openMeteo: {
        geocodingBaseUrl:
          process.env.OPEN_METEO_GEOCODING_URL ??
          fileConfig.api.openMeteo.geocodingBaseUrl,
        forecastBaseUrl:
          process.env.OPEN_METEO_FORECAST_URL ??
          fileConfig.api.openMeteo.forecastBaseUrl,
        timeoutMs: intEnv('OPEN_METEO_TIMEOUT_MS', fileConfig.api.openMeteo.timeoutMs),
      },
      restCountries: {
        baseUrl:
          process.env.REST_COUNTRIES_BASE_URL ??
          fileConfig.api.restCountries.baseUrl,
        timeoutMs: intEnv('REST_COUNTRIES_TIMEOUT_MS', fileConfig.api.restCountries.timeoutMs),
      },
      wikipedia: {
        restBaseUrl:
          process.env.WIKIPEDIA_REST_BASE_URL ??
          fileConfig.api.wikipedia.restBaseUrl,
        mediaWikiBaseUrl:
          process.env.WIKIPEDIA_MEDIAWIKI_BASE_URL ??
          fileConfig.api.wikipedia.mediaWikiBaseUrl,
        timeoutMs: intEnv('WIKIPEDIA_TIMEOUT_MS', fileConfig.api.wikipedia.timeoutMs),
      },
      hackerNews: {
        firebaseBaseUrl:
          process.env.HACKER_NEWS_FIREBASE_URL ??
          fileConfig.api.hackerNews.firebaseBaseUrl,
        algoliaBaseUrl:
          process.env.HACKER_NEWS_ALGOLIA_URL ??
          fileConfig.api.hackerNews.algoliaBaseUrl,
        timeoutMs: intEnv('HACKER_NEWS_TIMEOUT_MS', fileConfig.api.hackerNews.timeoutMs),
      },
      arxiv: {
        baseUrl: process.env.ARXIV_BASE_URL ?? fileConfig.api.arxiv.baseUrl,
        timeoutMs: intEnv('ARXIV_TIMEOUT_MS', fileConfig.api.arxiv.timeoutMs),
      },
      openLibrary: {
        baseUrl:
          process.env.OPEN_LIBRARY_BASE_URL ?? fileConfig.api.openLibrary.baseUrl,
        timeoutMs: intEnv('OPEN_LIBRARY_TIMEOUT_MS', fileConfig.api.openLibrary.timeoutMs),
      },
      nominatim: {
        baseUrl: process.env.NOMINATIM_BASE_URL ?? fileConfig.api.nominatim.baseUrl,
        timeoutMs: intEnv('NOMINATIM_TIMEOUT_MS', fileConfig.api.nominatim.timeoutMs),
        userAgent:
          process.env.NOMINATIM_USER_AGENT ?? fileConfig.api.nominatim.userAgent,
      },
      dictionary: {
        baseUrl:
          process.env.DICTIONARY_BASE_URL ?? fileConfig.api.dictionary.baseUrl,
        timeoutMs: intEnv('DICTIONARY_TIMEOUT_MS', fileConfig.api.dictionary.timeoutMs),
      },
      frankfurter: {
        baseUrl:
          process.env.FRANKFURTER_BASE_URL ?? fileConfig.api.frankfurter.baseUrl,
        timeoutMs: intEnv('FRANKFURTER_TIMEOUT_MS', fileConfig.api.frankfurter.timeoutMs),
      },
      usgs: {
        baseUrl: process.env.USGS_BASE_URL ?? fileConfig.api.usgs.baseUrl,
        timeoutMs: intEnv('USGS_TIMEOUT_MS', fileConfig.api.usgs.timeoutMs),
      },
      spacex: {
        baseUrl: process.env.SPACEX_BASE_URL ?? fileConfig.api.spacex.baseUrl,
        timeoutMs: intEnv('SPACEX_TIMEOUT_MS', fileConfig.api.spacex.timeoutMs),
      },
      githubPublic: {
        baseUrl:
          process.env.GITHUB_PUBLIC_BASE_URL ?? fileConfig.api.githubPublic.baseUrl,
        timeoutMs: intEnv('GITHUB_PUBLIC_TIMEOUT_MS', fileConfig.api.githubPublic.timeoutMs),
      },
      mdn: {
        searchBaseUrl:
          process.env.MDN_SEARCH_BASE_URL ?? fileConfig.api.mdn.searchBaseUrl,
        docsBaseUrl:
          process.env.MDN_DOCS_BASE_URL ?? fileConfig.api.mdn.docsBaseUrl,
        timeoutMs: intEnv('MDN_TIMEOUT_MS', fileConfig.api.mdn.timeoutMs),
      },
      datamuse: {
        baseUrl: process.env.DATAMUSE_BASE_URL ?? fileConfig.api.datamuse.baseUrl,
        timeoutMs: intEnv('DATAMUSE_TIMEOUT_MS', fileConfig.api.datamuse.timeoutMs),
      },
      trivia: {
        baseUrl: process.env.TRIVIA_BASE_URL ?? fileConfig.api.trivia.baseUrl,
        timeoutMs: intEnv('TRIVIA_TIMEOUT_MS', fileConfig.api.trivia.timeoutMs),
      },
      crossref: {
        baseUrl: process.env.CROSSREF_BASE_URL ?? fileConfig.api.crossref.baseUrl,
        timeoutMs: intEnv('CROSSREF_TIMEOUT_MS', fileConfig.api.crossref.timeoutMs),
        mailto: process.env.CROSSREF_MAILTO ?? fileConfig.api.crossref.mailto,
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
    apiKeys: config.mcp.apiKeys,
  };
}
