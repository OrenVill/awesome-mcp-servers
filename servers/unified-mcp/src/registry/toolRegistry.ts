import { getOpenMeteoToolDefinitions } from '../../../open-meteo-mcp/dist/mcp/tools/index.js';
import { getRestCountriesToolDefinitions } from '../../../rest-countries-mcp/dist/mcp/tools/index.js';
import { getWikipediaToolDefinitions } from '../../../wikipedia-mcp/dist/mcp/tools/index.js';
import { getHackerNewsToolDefinitions } from '../../../hacker-news-mcp/dist/mcp/tools/index.js';
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
  ];
  return new Map(all.map((t) => [t.name, t]));
}
