import { getOpenMeteoToolDefinitions } from '../../../open-meteo-mcp/dist/mcp/tools/index.js';
import { getRestCountriesToolDefinitions } from '../../../rest-countries-mcp/dist/mcp/tools/index.js';
import { getWikipediaToolDefinitions } from '../../../wikipedia-mcp/dist/mcp/tools/index.js';
import { getHackerNewsToolDefinitions } from '../../../hacker-news-mcp/dist/mcp/tools/index.js';
import { getArxivToolDefinitions } from '../../../arxiv-mcp/dist/mcp/tools/index.js';
import { getOpenLibraryToolDefinitions } from '../../../open-library-mcp/dist/mcp/tools/index.js';
import { getNominatimToolDefinitions } from '../../../nominatim-mcp/dist/mcp/tools/index.js';
import { getDictionaryToolDefinitions } from '../../../dictionary-mcp/dist/mcp/tools/index.js';
import { getFrankfurterToolDefinitions } from '../../../frankfurter-mcp/dist/mcp/tools/index.js';
import { getUsgsToolDefinitions } from '../../../usgs-earthquake-mcp/dist/mcp/tools/index.js';
import { getSpacexToolDefinitions } from '../../../spacex-mcp/dist/mcp/tools/index.js';
import { getGithubToolDefinitions } from '../../../github-public-mcp/dist/mcp/tools/index.js';
import { getMdnToolDefinitions } from '../../../mdn-compat-mcp/dist/mcp/tools/index.js';
import { getDatamuseToolDefinitions } from '../../../datamuse-mcp/dist/mcp/tools/index.js';
import { getTriviaToolDefinitions } from '../../../trivia-mcp/dist/mcp/tools/index.js';
import { getCrossrefToolDefinitions } from '../../../crossref-mcp/dist/mcp/tools/index.js';
import { getConfig } from '../config.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
};

export function buildToolRegistry(): Map<string, RegistryToolDefinition> {
  const config = getConfig();
  const all = [
    ...getOpenMeteoToolDefinitions(config.api.openMeteo),
    ...getRestCountriesToolDefinitions(config.api.restCountries),
    ...getWikipediaToolDefinitions(config.api.wikipedia),
    ...getHackerNewsToolDefinitions(config.api.hackerNews),
    ...getArxivToolDefinitions(config.api.arxiv),
    ...getOpenLibraryToolDefinitions(config.api.openLibrary),
    ...getNominatimToolDefinitions(config.api.nominatim),
    ...getDictionaryToolDefinitions(config.api.dictionary),
    ...getFrankfurterToolDefinitions(config.api.frankfurter),
    ...getUsgsToolDefinitions(config.api.usgs),
    ...getSpacexToolDefinitions(config.api.spacex),
    ...getGithubToolDefinitions(config.api.githubPublic),
    ...getMdnToolDefinitions(config.api.mdn),
    ...getDatamuseToolDefinitions(config.api.datamuse),
    ...getTriviaToolDefinitions(config.api.trivia),
    ...getCrossrefToolDefinitions(config.api.crossref),
  ];
  return new Map(all.map((t) => [t.name, t]));
}
