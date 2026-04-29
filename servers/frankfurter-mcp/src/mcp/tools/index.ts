import {
  FrankfurterTools,
  GET_LATEST_RATES_DEF,
  CONVERT_CURRENCY_DEF,
  GET_HISTORICAL_RATES_DEF,
  GET_TIME_SERIES_DEF,
  LIST_CURRENCIES_DEF,
  type GetLatestRatesInput,
  type ConvertCurrencyInput,
  type GetHistoricalRatesInput,
  type GetTimeSeriesInput,
  type ListCurrenciesInput,
} from './frankfurterTools.js';
import { FrankfurterService } from '../../services/frankfurterService.js';
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

export function getFrankfurterToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new FrankfurterService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new FrankfurterTools(service);
  return [
    {
      ...GET_LATEST_RATES_DEF,
      inputSchema: FrankfurterTools.getGetLatestRatesSchema().inputSchema,
      execute: (args) =>
        tools.executeGetLatestRates(args as unknown as GetLatestRatesInput),
    },
    {
      ...CONVERT_CURRENCY_DEF,
      inputSchema: FrankfurterTools.getConvertCurrencySchema().inputSchema,
      execute: (args) =>
        tools.executeConvertCurrency(args as unknown as ConvertCurrencyInput),
    },
    {
      ...GET_HISTORICAL_RATES_DEF,
      inputSchema: FrankfurterTools.getGetHistoricalRatesSchema().inputSchema,
      execute: (args) =>
        tools.executeGetHistoricalRates(args as unknown as GetHistoricalRatesInput),
    },
    {
      ...GET_TIME_SERIES_DEF,
      inputSchema: FrankfurterTools.getGetTimeSeriesSchema().inputSchema,
      execute: (args) =>
        tools.executeGetTimeSeries(args as unknown as GetTimeSeriesInput),
    },
    {
      ...LIST_CURRENCIES_DEF,
      inputSchema: FrankfurterTools.getListCurrenciesSchema().inputSchema,
      execute: (args) =>
        tools.executeListCurrencies(args as unknown as ListCurrenciesInput),
    },
  ];
}
