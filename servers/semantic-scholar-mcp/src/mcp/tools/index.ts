import {
  SemanticScholarTools,
  SEARCH_PAPERS_DEF,
  GET_PAPER_DEF,
  GET_PAPER_CITATIONS_DEF,
  type SearchPapersInput,
  type GetPaperInput,
  type GetPaperCitationsInput,
} from './semanticScholarTools.js';
import { SemanticScholarService } from '../../services/semanticScholarService.js';
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

export function getSemanticScholarToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
  apiKey?: string;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new SemanticScholarService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    apiKey: config.apiKey,
  });
  const tools = new SemanticScholarTools(service);
  return [
    {
      ...SEARCH_PAPERS_DEF,
      inputSchema: SemanticScholarTools.getSearchPapersSchema().inputSchema,
      execute: (args) => tools.executeSearchPapers(args as unknown as SearchPapersInput),
    },
    {
      ...GET_PAPER_DEF,
      inputSchema: SemanticScholarTools.getGetPaperSchema().inputSchema,
      execute: (args) => tools.executeGetPaper(args as unknown as GetPaperInput),
    },
    {
      ...GET_PAPER_CITATIONS_DEF,
      inputSchema: SemanticScholarTools.getGetPaperCitationsSchema().inputSchema,
      execute: (args) =>
        tools.executeGetPaperCitations(args as unknown as GetPaperCitationsInput),
    },
  ];
}
