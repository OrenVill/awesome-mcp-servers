import {
  TriviaTools,
  GET_QUESTIONS_DEF,
  LIST_CATEGORIES_DEF,
  GET_CATEGORY_COUNT_DEF,
  type GetQuestionsInput,
  type ListCategoriesInput,
  type GetCategoryCountInput,
} from './triviaTools.js';
import { TriviaService } from '../../services/triviaService.js';
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

export function getTriviaToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new TriviaService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new TriviaTools(service);
  return [
    {
      ...GET_QUESTIONS_DEF,
      inputSchema: TriviaTools.getGetQuestionsSchema().inputSchema,
      execute: (args) =>
        tools.executeGetQuestions(args as unknown as GetQuestionsInput),
    },
    {
      ...LIST_CATEGORIES_DEF,
      inputSchema: TriviaTools.getListCategoriesSchema().inputSchema,
      execute: (args) =>
        tools.executeListCategories(args as unknown as ListCategoriesInput),
    },
    {
      ...GET_CATEGORY_COUNT_DEF,
      inputSchema: TriviaTools.getGetCategoryCountSchema().inputSchema,
      execute: (args) =>
        tools.executeGetCategoryCount(args as unknown as GetCategoryCountInput),
    },
  ];
}
