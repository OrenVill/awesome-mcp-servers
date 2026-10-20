import {
  PubmedTools,
  SEARCH_ARTICLES_DEF,
  GET_ARTICLE_SUMMARY_DEF,
  GET_ARTICLE_ABSTRACT_DEF,
  type SearchArticlesInput,
  type GetArticleSummaryInput,
  type GetArticleAbstractInput,
} from './pubmedTools.js';
import { PubmedService } from '../../services/pubmedService.js';
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

export function getPubmedToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
  toolName?: string;
  email?: string;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new PubmedService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    toolName: config.toolName,
    email: config.email,
  });
  const tools = new PubmedTools(service);
  return [
    {
      ...SEARCH_ARTICLES_DEF,
      inputSchema: PubmedTools.getSearchArticlesSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchArticles(args as unknown as SearchArticlesInput),
    },
    {
      ...GET_ARTICLE_SUMMARY_DEF,
      inputSchema: PubmedTools.getGetArticleSummarySchema().inputSchema,
      execute: (args) =>
        tools.executeGetArticleSummary(args as unknown as GetArticleSummaryInput),
    },
    {
      ...GET_ARTICLE_ABSTRACT_DEF,
      inputSchema: PubmedTools.getGetArticleAbstractSchema().inputSchema,
      execute: (args) =>
        tools.executeGetArticleAbstract(args as unknown as GetArticleAbstractInput),
    },
  ];
}
