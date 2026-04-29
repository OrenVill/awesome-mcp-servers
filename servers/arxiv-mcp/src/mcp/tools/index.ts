import {
  ArxivTools,
  SEARCH_ARXIV_DEF,
  GET_PAPER_DEF,
  LIST_RECENT_DEF,
  type SearchArxivInput,
  type GetPaperInput,
  type ListRecentInput,
} from './arxivTools.js';
import { ArxivService } from '../../services/arxivService.js';
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

export function getArxivToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new ArxivService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new ArxivTools(service);
  return [
    {
      ...SEARCH_ARXIV_DEF,
      inputSchema: ArxivTools.getSearchArxivSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchArxiv(args as unknown as SearchArxivInput),
    },
    {
      ...GET_PAPER_DEF,
      inputSchema: ArxivTools.getGetPaperSchema().inputSchema,
      execute: (args) => tools.executeGetPaper(args as unknown as GetPaperInput),
    },
    {
      ...LIST_RECENT_DEF,
      inputSchema: ArxivTools.getListRecentSchema().inputSchema,
      execute: (args) =>
        tools.executeListRecent(args as unknown as ListRecentInput),
    },
  ];
}
