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

export interface OpenalexApiConfig {
  baseUrl: string;
  timeoutMs: number;
  mailto: string;
}

export interface PubmedApiConfig {
  baseUrl: string;
  timeoutMs: number;
  toolName: string;
  email: string;
}

export interface WikidataApiConfig {
  mediaWikiBaseUrl: string;
  defaultLanguage: string;
  timeoutMs: number;
}

export interface StackexchangeApiConfig {
  baseUrl: string;
  defaultSite: string;
  timeoutMs: number;
}

export interface WorldbankApiConfig {
  baseUrl: string;
  timeoutMs: number;
  defaultSourceId: string;
}

export interface OpenfdaApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface MusicbrainzApiConfig {
  baseUrl: string;
  timeoutMs: number;
  userAgent: string;
  minRequestIntervalMs: number;
}

export interface TvmazeApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface NpmRegistryApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface OpenskyApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface BaseUrlTimeoutApiConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface SemanticScholarApiConfig {
  baseUrl: string;
  timeoutMs: number;
  apiKey: string;
}

export interface JikanApiConfig {
  baseUrl: string;
  timeoutMs: number;
  minRequestIntervalMs: number;
}

export interface PypiApiConfig {
  baseUrl: string;
  simpleIndexUrl: string;
  timeoutMs: number;
  searchMaxResults: number;
}

export interface CareclinicApiConfig {
  remoteMcpUrl: string;
  timeoutMs: number;
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
  openalex: OpenalexApiConfig;
  pubmed: PubmedApiConfig;
  wikidata: WikidataApiConfig;
  stackexchange: StackexchangeApiConfig;
  worldbank: WorldbankApiConfig;
  openfda: OpenfdaApiConfig;
  musicbrainz: MusicbrainzApiConfig;
  tvmaze: TvmazeApiConfig;
  npmRegistry: NpmRegistryApiConfig;
  opensky: OpenskyApiConfig;
  pokeapi: BaseUrlTimeoutApiConfig;
  opennotify: BaseUrlTimeoutApiConfig;
  worldtime: BaseUrlTimeoutApiConfig;
  sunriseSunset: BaseUrlTimeoutApiConfig;
  semanticScholar: SemanticScholarApiConfig;
  openfoodfacts: BaseUrlTimeoutApiConfig;
  jikan: JikanApiConfig;
  swapi: BaseUrlTimeoutApiConfig;
  pypi: PypiApiConfig;
  gbif: BaseUrlTimeoutApiConfig;
  careclinic: CareclinicApiConfig;
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
    openalex: {
      baseUrl: 'https://api.openalex.org',
      timeoutMs: 15000,
      mailto: '',
    },
    pubmed: {
      baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
      timeoutMs: 20000,
      toolName: 'unified-mcp',
      email: '',
    },
    wikidata: {
      mediaWikiBaseUrl: 'https://www.wikidata.org/w/api.php',
      defaultLanguage: 'en',
      timeoutMs: 15000,
    },
    stackexchange: {
      baseUrl: 'https://api.stackexchange.com/2.3',
      defaultSite: 'stackoverflow',
      timeoutMs: 15000,
    },
    worldbank: {
      baseUrl: 'https://api.worldbank.org/v2',
      timeoutMs: 20000,
      defaultSourceId: '2',
    },
    openfda: {
      baseUrl: 'https://api.fda.gov',
      timeoutMs: 15000,
    },
    musicbrainz: {
      baseUrl: 'https://musicbrainz.org/ws/2',
      timeoutMs: 15000,
      userAgent: 'awesome-mcp-servers/1.0',
      minRequestIntervalMs: 1000,
    },
    tvmaze: {
      baseUrl: 'https://api.tvmaze.com',
      timeoutMs: 15000,
    },
    npmRegistry: {
      baseUrl: 'https://registry.npmjs.org',
      timeoutMs: 15000,
    },
    opensky: {
      baseUrl: 'https://opensky-network.org/api',
      timeoutMs: 20000,
    },
    pokeapi: {
      baseUrl: 'https://pokeapi.co/api/v2',
      timeoutMs: 15000,
    },
    opennotify: {
      baseUrl: 'http://api.open-notify.org',
      timeoutMs: 15000,
    },
    worldtime: {
      baseUrl: 'http://worldtimeapi.org/api',
      timeoutMs: 15000,
    },
    sunriseSunset: {
      baseUrl: 'https://api.sunrise-sunset.org/json',
      timeoutMs: 15000,
    },
    semanticScholar: {
      baseUrl: 'https://api.semanticscholar.org/graph/v1',
      timeoutMs: 20000,
      apiKey: '',
    },
    openfoodfacts: {
      baseUrl: 'https://world.openfoodfacts.org/api/v2',
      timeoutMs: 15000,
    },
    jikan: {
      baseUrl: 'https://api.jikan.moe/v4',
      timeoutMs: 15000,
      minRequestIntervalMs: 334,
    },
    swapi: {
      baseUrl: 'https://swapi.dev/api',
      timeoutMs: 15000,
    },
    pypi: {
      baseUrl: 'https://pypi.org',
      simpleIndexUrl: 'https://pypi.org/simple/',
      timeoutMs: 30000,
      searchMaxResults: 20,
    },
    gbif: {
      baseUrl: 'https://api.gbif.org/v1',
      timeoutMs: 15000,
    },
    careclinic: {
      remoteMcpUrl: 'https://mcp.careclinic.io/mcp',
      timeoutMs: 60000,
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
      openalex: {
        baseUrl: process.env.OPENALEX_BASE_URL ?? fileConfig.api.openalex.baseUrl,
        timeoutMs: intEnv('OPENALEX_TIMEOUT_MS', fileConfig.api.openalex.timeoutMs),
        mailto: process.env.OPENALEX_MAILTO ?? fileConfig.api.openalex.mailto,
      },
      pubmed: {
        baseUrl: process.env.PUBMED_BASE_URL ?? fileConfig.api.pubmed.baseUrl,
        timeoutMs: intEnv('PUBMED_TIMEOUT_MS', fileConfig.api.pubmed.timeoutMs),
        toolName: process.env.PUBMED_TOOL_NAME ?? fileConfig.api.pubmed.toolName,
        email: process.env.PUBMED_EMAIL ?? fileConfig.api.pubmed.email,
      },
      wikidata: {
        mediaWikiBaseUrl:
          process.env.WIKIDATA_API_URL ?? fileConfig.api.wikidata.mediaWikiBaseUrl,
        defaultLanguage:
          process.env.WIKIDATA_DEFAULT_LANGUAGE ?? fileConfig.api.wikidata.defaultLanguage,
        timeoutMs: intEnv('WIKIDATA_TIMEOUT_MS', fileConfig.api.wikidata.timeoutMs),
      },
      stackexchange: {
        baseUrl:
          process.env.STACKEXCHANGE_BASE_URL ?? fileConfig.api.stackexchange.baseUrl,
        defaultSite:
          process.env.STACKEXCHANGE_SITE ?? fileConfig.api.stackexchange.defaultSite,
        timeoutMs: intEnv(
          'STACKEXCHANGE_TIMEOUT_MS',
          fileConfig.api.stackexchange.timeoutMs
        ),
      },
      worldbank: {
        baseUrl: process.env.WORLDBANK_BASE_URL ?? fileConfig.api.worldbank.baseUrl,
        timeoutMs: intEnv('WORLDBANK_TIMEOUT_MS', fileConfig.api.worldbank.timeoutMs),
        defaultSourceId:
          process.env.WORLDBANK_DEFAULT_SOURCE_ID ??
          fileConfig.api.worldbank.defaultSourceId,
      },
      openfda: {
        baseUrl: process.env.OPENFDA_BASE_URL ?? fileConfig.api.openfda.baseUrl,
        timeoutMs: intEnv('OPENFDA_TIMEOUT_MS', fileConfig.api.openfda.timeoutMs),
      },
      musicbrainz: {
        baseUrl:
          process.env.MUSICBRAINZ_BASE_URL ?? fileConfig.api.musicbrainz.baseUrl,
        timeoutMs: intEnv('MUSICBRAINZ_TIMEOUT_MS', fileConfig.api.musicbrainz.timeoutMs),
        userAgent:
          process.env.MUSICBRAINZ_USER_AGENT ?? fileConfig.api.musicbrainz.userAgent,
        minRequestIntervalMs: intEnv(
          'MUSICBRAINZ_MIN_REQUEST_INTERVAL_MS',
          fileConfig.api.musicbrainz.minRequestIntervalMs
        ),
      },
      tvmaze: {
        baseUrl: process.env.TVMAZE_BASE_URL ?? fileConfig.api.tvmaze.baseUrl,
        timeoutMs: intEnv('TVMAZE_TIMEOUT_MS', fileConfig.api.tvmaze.timeoutMs),
      },
      npmRegistry: {
        baseUrl:
          process.env.NPM_REGISTRY_BASE_URL ?? fileConfig.api.npmRegistry.baseUrl,
        timeoutMs: intEnv('NPM_REGISTRY_TIMEOUT_MS', fileConfig.api.npmRegistry.timeoutMs),
      },
      opensky: {
        baseUrl: process.env.OPENSKY_BASE_URL ?? fileConfig.api.opensky.baseUrl,
        timeoutMs: intEnv('OPENSKY_TIMEOUT_MS', fileConfig.api.opensky.timeoutMs),
      },
      pokeapi: {
        baseUrl: process.env.POKEAPI_BASE_URL ?? fileConfig.api.pokeapi.baseUrl,
        timeoutMs: intEnv('POKEAPI_TIMEOUT_MS', fileConfig.api.pokeapi.timeoutMs),
      },
      opennotify: {
        baseUrl:
          process.env.OPENNOTIFY_BASE_URL ?? fileConfig.api.opennotify.baseUrl,
        timeoutMs: intEnv('OPENNOTIFY_TIMEOUT_MS', fileConfig.api.opennotify.timeoutMs),
      },
      worldtime: {
        baseUrl:
          process.env.WORLDTIME_BASE_URL ?? fileConfig.api.worldtime.baseUrl,
        timeoutMs: intEnv('WORLDTIME_TIMEOUT_MS', fileConfig.api.worldtime.timeoutMs),
      },
      sunriseSunset: {
        baseUrl:
          process.env.SUNRISE_SUNSET_BASE_URL ?? fileConfig.api.sunriseSunset.baseUrl,
        timeoutMs: intEnv(
          'SUNRISE_SUNSET_TIMEOUT_MS',
          fileConfig.api.sunriseSunset.timeoutMs
        ),
      },
      semanticScholar: {
        baseUrl:
          process.env.SEMANTIC_SCHOLAR_BASE_URL ??
          fileConfig.api.semanticScholar.baseUrl,
        timeoutMs: intEnv(
          'SEMANTIC_SCHOLAR_TIMEOUT_MS',
          fileConfig.api.semanticScholar.timeoutMs
        ),
        apiKey:
          process.env.SEMANTIC_SCHOLAR_API_KEY ?? fileConfig.api.semanticScholar.apiKey,
      },
      openfoodfacts: {
        baseUrl:
          process.env.OPENFOODFACTS_BASE_URL ?? fileConfig.api.openfoodfacts.baseUrl,
        timeoutMs: intEnv(
          'OPENFOODFACTS_TIMEOUT_MS',
          fileConfig.api.openfoodfacts.timeoutMs
        ),
      },
      jikan: {
        baseUrl: process.env.JIKAN_BASE_URL ?? fileConfig.api.jikan.baseUrl,
        timeoutMs: intEnv('JIKAN_TIMEOUT_MS', fileConfig.api.jikan.timeoutMs),
        minRequestIntervalMs: intEnv(
          'JIKAN_MIN_REQUEST_INTERVAL_MS',
          fileConfig.api.jikan.minRequestIntervalMs
        ),
      },
      swapi: {
        baseUrl: process.env.SWAPI_BASE_URL ?? fileConfig.api.swapi.baseUrl,
        timeoutMs: intEnv('SWAPI_TIMEOUT_MS', fileConfig.api.swapi.timeoutMs),
      },
      pypi: {
        baseUrl: process.env.PYPI_BASE_URL ?? fileConfig.api.pypi.baseUrl,
        simpleIndexUrl:
          process.env.PYPI_SIMPLE_INDEX_URL ?? fileConfig.api.pypi.simpleIndexUrl,
        timeoutMs: intEnv('PYPI_TIMEOUT_MS', fileConfig.api.pypi.timeoutMs),
        searchMaxResults: intEnv(
          'PYPI_SEARCH_MAX_RESULTS',
          fileConfig.api.pypi.searchMaxResults
        ),
      },
      gbif: {
        baseUrl: process.env.GBIF_BASE_URL ?? fileConfig.api.gbif.baseUrl,
        timeoutMs: intEnv('GBIF_TIMEOUT_MS', fileConfig.api.gbif.timeoutMs),
      },
      careclinic: {
        remoteMcpUrl:
          process.env.CARECLINIC_MCP_URL ?? fileConfig.api.careclinic.remoteMcpUrl,
        timeoutMs: intEnv(
          'CARECLINIC_TIMEOUT_MS',
          fileConfig.api.careclinic.timeoutMs
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
    apiKeys: config.mcp.apiKeys,
  };
}
