import type { ApiConfig } from '../config.js';
import type { RegistryToolDefinition } from './toolRegistry.js';

export type ProviderSpec = {
  /** Stable id for UNIFIED_MCP_PROVIDERS (e.g. open-meteo, pubmed). */
  id: string;
  /**
   * When set, every name must be non-empty in `process.env` (MCP client `env` or shell).
   * Providers missing required vars are omitted from search_tools / execute_tools.
   */
  requiredProcessEnv?: string[];
  loadTools: (api: ApiConfig) => Promise<RegistryToolDefinition[]>;
};

export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'open-meteo',
    loadTools: async (api) => {
      const m = await import('../../../open-meteo-mcp/dist/mcp/tools/index.js');
      return m.getOpenMeteoToolDefinitions(api.openMeteo);
    },
  },
  {
    id: 'rest-countries',
    loadTools: async (api) => {
      const m = await import('../../../rest-countries-mcp/dist/mcp/tools/index.js');
      return m.getRestCountriesToolDefinitions(api.restCountries);
    },
  },
  {
    id: 'wikipedia',
    loadTools: async (api) => {
      const m = await import('../../../wikipedia-mcp/dist/mcp/tools/index.js');
      return m.getWikipediaToolDefinitions(api.wikipedia);
    },
  },
  {
    id: 'hacker-news',
    loadTools: async (api) => {
      const m = await import('../../../hacker-news-mcp/dist/mcp/tools/index.js');
      return m.getHackerNewsToolDefinitions(api.hackerNews);
    },
  },
  {
    id: 'arxiv',
    loadTools: async (api) => {
      const m = await import('../../../arxiv-mcp/dist/mcp/tools/index.js');
      return m.getArxivToolDefinitions(api.arxiv);
    },
  },
  {
    id: 'open-library',
    loadTools: async (api) => {
      const m = await import('../../../open-library-mcp/dist/mcp/tools/index.js');
      return m.getOpenLibraryToolDefinitions(api.openLibrary);
    },
  },
  {
    id: 'nominatim',
    loadTools: async (api) => {
      const m = await import('../../../nominatim-mcp/dist/mcp/tools/index.js');
      return m.getNominatimToolDefinitions(api.nominatim);
    },
  },
  {
    id: 'dictionary',
    loadTools: async (api) => {
      const m = await import('../../../dictionary-mcp/dist/mcp/tools/index.js');
      return m.getDictionaryToolDefinitions(api.dictionary);
    },
  },
  {
    id: 'frankfurter',
    loadTools: async (api) => {
      const m = await import('../../../frankfurter-mcp/dist/mcp/tools/index.js');
      return m.getFrankfurterToolDefinitions(api.frankfurter);
    },
  },
  {
    id: 'usgs-earthquake',
    loadTools: async (api) => {
      const m = await import('../../../usgs-earthquake-mcp/dist/mcp/tools/index.js');
      return m.getUsgsToolDefinitions(api.usgs);
    },
  },
  {
    id: 'spacex',
    loadTools: async (api) => {
      const m = await import('../../../spacex-mcp/dist/mcp/tools/index.js');
      return m.getSpacexToolDefinitions(api.spacex);
    },
  },
  {
    id: 'github-public',
    loadTools: async (api) => {
      const m = await import('../../../github-public-mcp/dist/mcp/tools/index.js');
      return m.getGithubToolDefinitions(api.githubPublic);
    },
  },
  {
    id: 'mdn',
    loadTools: async (api) => {
      const m = await import('../../../mdn-compat-mcp/dist/mcp/tools/index.js');
      return m.getMdnToolDefinitions(api.mdn);
    },
  },
  {
    id: 'datamuse',
    loadTools: async (api) => {
      const m = await import('../../../datamuse-mcp/dist/mcp/tools/index.js');
      return m.getDatamuseToolDefinitions(api.datamuse);
    },
  },
  {
    id: 'trivia',
    loadTools: async (api) => {
      const m = await import('../../../trivia-mcp/dist/mcp/tools/index.js');
      return m.getTriviaToolDefinitions(api.trivia);
    },
  },
  {
    id: 'crossref',
    loadTools: async (api) => {
      const m = await import('../../../crossref-mcp/dist/mcp/tools/index.js');
      return m.getCrossrefToolDefinitions(api.crossref);
    },
  },
  {
    id: 'openalex',
    loadTools: async (api) => {
      const m = await import('../../../openalex-mcp/dist/mcp/tools/index.js');
      return m.getOpenalexToolDefinitions(api.openalex);
    },
  },
  {
    id: 'pubmed',
    loadTools: async (api) => {
      const m = await import('../../../pubmed-mcp/dist/mcp/tools/index.js');
      return m.getPubmedToolDefinitions(api.pubmed);
    },
  },
  {
    id: 'wikidata',
    loadTools: async (api) => {
      const m = await import('../../../wikidata-mcp/dist/mcp/tools/index.js');
      return m.getWikidataToolDefinitions(api.wikidata);
    },
  },
  {
    id: 'stackexchange',
    loadTools: async (api) => {
      const m = await import('../../../stackexchange-mcp/dist/mcp/tools/index.js');
      return m.getStackexchangeToolDefinitions(api.stackexchange);
    },
  },
  {
    id: 'worldbank',
    loadTools: async (api) => {
      const m = await import('../../../worldbank-mcp/dist/mcp/tools/index.js');
      return m.getWorldbankToolDefinitions(api.worldbank);
    },
  },
  {
    id: 'openfda',
    loadTools: async (api) => {
      const m = await import('../../../openfda-mcp/dist/mcp/tools/index.js');
      return m.getOpenfdaToolDefinitions(api.openfda);
    },
  },
  {
    id: 'musicbrainz',
    loadTools: async (api) => {
      const m = await import('../../../musicbrainz-mcp/dist/mcp/tools/index.js');
      return m.getMusicbrainzToolDefinitions(api.musicbrainz);
    },
  },
  {
    id: 'tvmaze',
    loadTools: async (api) => {
      const m = await import('../../../tvmaze-mcp/dist/mcp/tools/index.js');
      return m.getTvmazeToolDefinitions(api.tvmaze);
    },
  },
  {
    id: 'npm-registry',
    loadTools: async (api) => {
      const m = await import('../../../npm-registry-mcp/dist/mcp/tools/index.js');
      return m.getNpmRegistryToolDefinitions(api.npmRegistry);
    },
  },
  {
    id: 'opensky',
    loadTools: async (api) => {
      const m = await import('../../../opensky-mcp/dist/mcp/tools/index.js');
      return m.getOpenskyToolDefinitions(api.opensky);
    },
  },
  {
    id: 'pokeapi',
    loadTools: async (api) => {
      const m = await import('../../../pokeapi-mcp/dist/mcp/tools/index.js');
      return m.getPokeapiToolDefinitions(api.pokeapi);
    },
  },
  {
    id: 'opennotify',
    loadTools: async (api) => {
      const m = await import('../../../opennotify-mcp/dist/mcp/tools/index.js');
      return m.getOpennotifyToolDefinitions(api.opennotify);
    },
  },
  {
    id: 'worldtime',
    loadTools: async (api) => {
      const m = await import('../../../worldtime-mcp/dist/mcp/tools/index.js');
      return m.getWorldtimeToolDefinitions(api.worldtime);
    },
  },
  {
    id: 'sunrise-sunset',
    loadTools: async (api) => {
      const m = await import('../../../sunrise-sunset-mcp/dist/mcp/tools/index.js');
      return m.getSunriseSunsetToolDefinitions(api.sunriseSunset);
    },
  },
  {
    id: 'semantic-scholar',
    loadTools: async (api) => {
      const m = await import('../../../semantic-scholar-mcp/dist/mcp/tools/index.js');
      return m.getSemanticScholarToolDefinitions(api.semanticScholar);
    },
  },
  {
    id: 'openfoodfacts',
    loadTools: async (api) => {
      const m = await import('../../../openfoodfacts-mcp/dist/mcp/tools/index.js');
      return m.getOpenfoodfactsToolDefinitions(api.openfoodfacts);
    },
  },
  {
    id: 'jikan',
    loadTools: async (api) => {
      const m = await import('../../../jikan-mcp/dist/mcp/tools/index.js');
      return m.getJikanToolDefinitions(api.jikan);
    },
  },
  {
    id: 'swapi',
    loadTools: async (api) => {
      const m = await import('../../../swapi-mcp/dist/mcp/tools/index.js');
      return m.getSwapiToolDefinitions(api.swapi);
    },
  },
  {
    id: 'pypi',
    loadTools: async (api) => {
      const m = await import('../../../pypi-mcp/dist/mcp/tools/index.js');
      return m.getPypiToolDefinitions(api.pypi);
    },
  },
  {
    id: 'gbif',
    loadTools: async (api) => {
      const m = await import('../../../gbif-mcp/dist/mcp/tools/index.js');
      return m.getGbifToolDefinitions(api.gbif);
    },
  },
  {
    id: 'careclinic',
    requiredProcessEnv: ['CARECLINIC_BEARER_TOKEN'],
    loadTools: async (api) => {
      const m = await import('../../../careclinic-mcp/dist/mcp/tools/index.js');
      return m.getCareclinicToolDefinitions(api.careclinic);
    },
  },
];

export const ALL_PROVIDER_IDS = PROVIDERS.map((p) => p.id);
