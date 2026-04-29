import {
  CrossrefTools,
  GET_WORK_DEF,
  SEARCH_WORKS_DEF,
  SEARCH_JOURNALS_DEF,
  GET_JOURNAL_DEF,
  type GetWorkInput,
  type SearchWorksInput,
  type SearchJournalsInput,
  type GetJournalInput,
} from './crossrefTools.js';
import { CrossrefService } from '../../services/crossrefService.js';
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

export function getCrossrefToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
  mailto?: string;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new CrossrefService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    mailto: config.mailto,
  });
  const tools = new CrossrefTools(service);
  return [
    {
      ...GET_WORK_DEF,
      inputSchema: CrossrefTools.getGetWorkSchema().inputSchema,
      execute: (args) => tools.executeGetWork(args as unknown as GetWorkInput),
    },
    {
      ...SEARCH_WORKS_DEF,
      inputSchema: CrossrefTools.getSearchWorksSchema().inputSchema,
      execute: (args) => tools.executeSearchWorks(args as unknown as SearchWorksInput),
    },
    {
      ...SEARCH_JOURNALS_DEF,
      inputSchema: CrossrefTools.getSearchJournalsSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchJournals(args as unknown as SearchJournalsInput),
    },
    {
      ...GET_JOURNAL_DEF,
      inputSchema: CrossrefTools.getGetJournalSchema().inputSchema,
      execute: (args) => tools.executeGetJournal(args as unknown as GetJournalInput),
    },
  ];
}
