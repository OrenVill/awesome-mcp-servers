import {
  DictionaryTools,
  DEFINE_WORD_DEF,
  GET_SYNONYMS_DEF,
  GET_PHONETICS_DEF,
  type DefineWordInput,
  type GetSynonymsInput,
  type GetPhoneticsInput,
} from './dictionaryTools.js';
import { DictionaryService } from '../../services/dictionaryService.js';
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

export function getDictionaryToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new DictionaryService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new DictionaryTools(service);
  return [
    {
      ...DEFINE_WORD_DEF,
      inputSchema: DictionaryTools.getDefineWordSchema().inputSchema,
      execute: (args) => tools.executeDefineWord(args as unknown as DefineWordInput),
    },
    {
      ...GET_SYNONYMS_DEF,
      inputSchema: DictionaryTools.getGetSynonymsSchema().inputSchema,
      execute: (args) => tools.executeGetSynonyms(args as unknown as GetSynonymsInput),
    },
    {
      ...GET_PHONETICS_DEF,
      inputSchema: DictionaryTools.getGetPhoneticsSchema().inputSchema,
      execute: (args) => tools.executeGetPhonetics(args as unknown as GetPhoneticsInput),
    },
  ];
}
