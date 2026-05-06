import {
  GeocodingTools,
  SEARCH_LOCATIONS_DEF,
  type SearchLocationsInput,
} from './geocodingTools.js';
import {
  WeatherTools,
  GET_CURRENT_WEATHER_DEF,
  GET_FORECAST_DEF,
  type GetCurrentWeatherInput,
  type GetForecastInput,
} from './weatherTools.js';
import { OpenMeteoService } from '../../services/openMeteoService.js';
import { getConfig } from '../../config.js';
import type { MCPToolCallResult } from '../types/mcpTypes.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<MCPToolCallResult>;
};

export function getOpenMeteoToolDefinitions(apiConfig?: {
  geocodingBaseUrl?: string;
  forecastBaseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new OpenMeteoService({
    geocodingBase: config.geocodingBaseUrl ?? 'https://geocoding-api.open-meteo.com/v1',
    forecastBase: config.forecastBaseUrl ?? 'https://api.open-meteo.com/v1',
    timeout: config.timeoutMs ?? 15000,
  });
  const geocoding = new GeocodingTools(service);
  const weather = new WeatherTools(service);
  return [
    {
      ...SEARCH_LOCATIONS_DEF,
      inputSchema: GeocodingTools.getSearchLocationsSchema().inputSchema,
      execute: (args) =>
        geocoding.executeSearchLocations(args as unknown as SearchLocationsInput),
    },
    {
      ...GET_CURRENT_WEATHER_DEF,
      inputSchema: WeatherTools.getCurrentWeatherSchema().inputSchema,
      execute: (args) =>
        weather.executeGetCurrentWeather(args as unknown as GetCurrentWeatherInput),
    },
    {
      ...GET_FORECAST_DEF,
      inputSchema: WeatherTools.getForecastSchema().inputSchema,
      execute: (args) =>
        weather.executeGetForecast(args as unknown as GetForecastInput),
    },
  ];
}
