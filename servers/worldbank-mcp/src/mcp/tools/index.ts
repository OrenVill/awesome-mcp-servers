import {
  WorldbankTools,
  LIST_COUNTRIES_DEF,
  SEARCH_INDICATORS_DEF,
  GET_COUNTRY_INDICATOR_DEF,
  type ListCountriesInput,
  type SearchIndicatorsInput,
  type GetCountryIndicatorInput,
} from './worldbankTools.js';
import { WorldbankService } from '../../services/worldbankService.js';
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

export function getWorldbankToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
  defaultSourceId?: string;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new WorldbankService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    defaultSourceId: config.defaultSourceId,
  });
  const tools = new WorldbankTools(service);
  return [
    {
      ...LIST_COUNTRIES_DEF,
      inputSchema: WorldbankTools.getListCountriesSchema().inputSchema,
      execute: (args) =>
        tools.executeListCountries(args as unknown as ListCountriesInput),
    },
    {
      ...SEARCH_INDICATORS_DEF,
      inputSchema: WorldbankTools.getSearchIndicatorsSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchIndicators(args as unknown as SearchIndicatorsInput),
    },
    {
      ...GET_COUNTRY_INDICATOR_DEF,
      inputSchema: WorldbankTools.getGetCountryIndicatorSchema().inputSchema,
      execute: (args) =>
        tools.executeGetCountryIndicator(args as unknown as GetCountryIndicatorInput),
    },
  ];
}
