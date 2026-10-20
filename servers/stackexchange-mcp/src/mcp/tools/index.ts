import {
  StackExchangeTools,
  SEARCH_QUESTIONS_DEF,
  GET_QUESTION_DEF,
  SEARCH_TAGS_DEF,
  type SearchQuestionsInput,
  type GetQuestionInput,
  type SearchTagsInput,
} from './stackexchangeTools.js';
import { StackExchangeService } from '../../services/stackexchangeService.js';
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

export function getStackexchangeToolDefinitions(apiConfig?: {
  baseUrl?: string;
  defaultSite?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new StackExchangeService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    defaultSite: config.defaultSite,
  });
  const tools = new StackExchangeTools(service);
  return [
    {
      ...SEARCH_QUESTIONS_DEF,
      inputSchema: StackExchangeTools.getSearchQuestionsSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchQuestions(args as unknown as SearchQuestionsInput),
    },
    {
      ...GET_QUESTION_DEF,
      inputSchema: StackExchangeTools.getGetQuestionSchema().inputSchema,
      execute: (args) => tools.executeGetQuestion(args as unknown as GetQuestionInput),
    },
    {
      ...SEARCH_TAGS_DEF,
      inputSchema: StackExchangeTools.getSearchTagsSchema().inputSchema,
      execute: (args) => tools.executeSearchTags(args as unknown as SearchTagsInput),
    },
  ];
}

export {
  StackExchangeTools,
  SEARCH_QUESTIONS_DEF,
  GET_QUESTION_DEF,
  SEARCH_TAGS_DEF,
};
