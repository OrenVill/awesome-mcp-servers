import {
  WikipediaTools,
  SEARCH_WIKIPEDIA_DEF,
  GET_ARTICLE_DEF,
  GET_SUMMARY_DEF,
  type SearchWikipediaInput,
  type GetArticleInput,
  type GetSummaryInput,
} from './wikipediaTools.js';
import { WikipediaService } from '../../services/wikipediaService.js';
import { getConfig } from '../../config.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
};

export function getWikipediaToolDefinitions(apiConfig?: {
  restBaseUrl?: string;
  mediaWikiBaseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new WikipediaService({
    restBase: config.restBaseUrl,
    mediaWikiBase: config.mediaWikiBaseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new WikipediaTools(service);
  return [
    {
      ...SEARCH_WIKIPEDIA_DEF,
      inputSchema: WikipediaTools.getSearchWikipediaSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchWikipedia(args as unknown as SearchWikipediaInput),
    },
    {
      ...GET_ARTICLE_DEF,
      inputSchema: WikipediaTools.getGetArticleSchema().inputSchema,
      execute: (args) => tools.executeGetArticle(args as unknown as GetArticleInput),
    },
    {
      ...GET_SUMMARY_DEF,
      inputSchema: WikipediaTools.getGetSummarySchema().inputSchema,
      execute: (args) => tools.executeGetSummary(args as unknown as GetSummaryInput),
    },
  ];
}
