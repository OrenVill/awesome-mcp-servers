import {
  CountriesTools,
  GET_COUNTRY_DEF,
  SEARCH_COUNTRIES_DEF,
  LIST_ALL_COUNTRIES_DEF,
  type GetCountryInput,
  type SearchCountriesInput,
  type ListAllCountriesInput,
} from './countriesTools.js';
import { RestCountriesService } from '../../services/restCountriesService.js';
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

export function getRestCountriesToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new RestCountriesService({
    baseUrl: config.baseUrl ?? 'https://restcountries.com/v3.1',
    timeout: config.timeoutMs ?? 15000,
  });
  const tools = new CountriesTools(service);
  return [
    {
      ...GET_COUNTRY_DEF,
      inputSchema: CountriesTools.getGetCountrySchema().inputSchema,
      execute: (args) =>
        tools.executeGetCountry(args as unknown as GetCountryInput),
    },
    {
      ...SEARCH_COUNTRIES_DEF,
      inputSchema: CountriesTools.getSearchCountriesSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchCountries(args as unknown as SearchCountriesInput),
    },
    {
      ...LIST_ALL_COUNTRIES_DEF,
      inputSchema: CountriesTools.getListAllCountriesSchema().inputSchema,
      execute: (args) =>
        tools.executeListAllCountries(args as unknown as ListAllCountriesInput),
    },
  ];
}
