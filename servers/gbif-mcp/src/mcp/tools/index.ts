import {
  GbifTools,
  SEARCH_SPECIES_DEF,
  GET_SPECIES_DEF,
  SEARCH_OCCURRENCES_DEF,
  type SearchSpeciesInput,
  type GetSpeciesInput,
  type SearchOccurrencesInput,
} from './gbifTools.js';
import { GbifService } from '../../services/gbifService.js';
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

export function getGbifToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new GbifService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new GbifTools(service);
  return [
    {
      ...SEARCH_SPECIES_DEF,
      inputSchema: GbifTools.getSearchSpeciesSchema().inputSchema,
      execute: (args) => tools.executeSearchSpecies(args as unknown as SearchSpeciesInput),
    },
    {
      ...GET_SPECIES_DEF,
      inputSchema: GbifTools.getGetSpeciesSchema().inputSchema,
      execute: (args) => tools.executeGetSpecies(args as unknown as GetSpeciesInput),
    },
    {
      ...SEARCH_OCCURRENCES_DEF,
      inputSchema: GbifTools.getSearchOccurrencesSchema().inputSchema,
      execute: (args) => tools.executeSearchOccurrences(args as unknown as SearchOccurrencesInput),
    },
  ];
}
