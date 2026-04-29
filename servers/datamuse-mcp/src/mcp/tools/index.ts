import {
  DatamuseTools,
  FIND_RHYMES_DEF,
  FIND_SYNONYMS_DEF,
  MEANS_LIKE_DEF,
  SOUNDS_LIKE_DEF,
  SUGGEST_DEF,
  type FindRhymesInput,
  type FindSynonymsInput,
  type MeansLikeInput,
  type SoundsLikeInput,
  type SuggestInput,
} from './datamuseTools.js';
import { DatamuseService } from '../../services/datamuseService.js';
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

export function getDatamuseToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new DatamuseService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new DatamuseTools(service);
  return [
    {
      ...FIND_RHYMES_DEF,
      inputSchema: DatamuseTools.getFindRhymesSchema().inputSchema,
      execute: (args) => tools.executeFindRhymes(args as unknown as FindRhymesInput),
    },
    {
      ...FIND_SYNONYMS_DEF,
      inputSchema: DatamuseTools.getFindSynonymsSchema().inputSchema,
      execute: (args) => tools.executeFindSynonyms(args as unknown as FindSynonymsInput),
    },
    {
      ...MEANS_LIKE_DEF,
      inputSchema: DatamuseTools.getMeansLikeSchema().inputSchema,
      execute: (args) => tools.executeMeansLike(args as unknown as MeansLikeInput),
    },
    {
      ...SOUNDS_LIKE_DEF,
      inputSchema: DatamuseTools.getSoundsLikeSchema().inputSchema,
      execute: (args) => tools.executeSoundsLike(args as unknown as SoundsLikeInput),
    },
    {
      ...SUGGEST_DEF,
      inputSchema: DatamuseTools.getSuggestSchema().inputSchema,
      execute: (args) => tools.executeSuggest(args as unknown as SuggestInput),
    },
  ];
}
