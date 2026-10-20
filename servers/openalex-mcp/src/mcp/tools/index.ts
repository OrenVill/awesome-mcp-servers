import {
  OpenAlexTools,
  SEARCH_WORKS_DEF,
  GET_WORK_DEF,
  SEARCH_AUTHORS_DEF,
  GET_AUTHOR_DEF,
  type SearchWorksInput,
  type GetWorkInput,
  type SearchAuthorsInput,
  type GetAuthorInput,
} from './openalexTools.js';
import { OpenAlexService } from '../../services/openalexService.js';
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

export function getOpenalexToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
  mailto?: string;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new OpenAlexService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    mailto: config.mailto,
  });
  const tools = new OpenAlexTools(service);
  return [
    {
      ...SEARCH_WORKS_DEF,
      inputSchema: OpenAlexTools.getSearchWorksSchema().inputSchema,
      execute: (args) => tools.executeSearchWorks(args as unknown as SearchWorksInput),
    },
    {
      ...GET_WORK_DEF,
      inputSchema: OpenAlexTools.getGetWorkSchema().inputSchema,
      execute: (args) => tools.executeGetWork(args as unknown as GetWorkInput),
    },
    {
      ...SEARCH_AUTHORS_DEF,
      inputSchema: OpenAlexTools.getSearchAuthorsSchema().inputSchema,
      execute: (args) => tools.executeSearchAuthors(args as unknown as SearchAuthorsInput),
    },
    {
      ...GET_AUTHOR_DEF,
      inputSchema: OpenAlexTools.getGetAuthorSchema().inputSchema,
      execute: (args) => tools.executeGetAuthor(args as unknown as GetAuthorInput),
    },
  ];
}
