import {
  UsgsTools,
  QUERY_EARTHQUAKES_DEF,
  GET_RECENT_SIGNIFICANT_DEF,
  GET_EVENT_DEF,
  type QueryEarthquakesInput,
  type GetRecentSignificantInput,
  type GetEventInput,
} from './usgsTools.js';
import { UsgsService } from '../../services/usgsService.js';
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

export function getUsgsToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new UsgsService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new UsgsTools(service);
  return [
    {
      ...QUERY_EARTHQUAKES_DEF,
      inputSchema: UsgsTools.getQueryEarthquakesSchema().inputSchema,
      execute: (args) =>
        tools.executeQueryEarthquakes(args as unknown as QueryEarthquakesInput),
    },
    {
      ...GET_RECENT_SIGNIFICANT_DEF,
      inputSchema: UsgsTools.getGetRecentSignificantSchema().inputSchema,
      execute: (args) =>
        tools.executeGetRecentSignificant(
          args as unknown as GetRecentSignificantInput
        ),
    },
    {
      ...GET_EVENT_DEF,
      inputSchema: UsgsTools.getGetEventSchema().inputSchema,
      execute: (args) => tools.executeGetEvent(args as unknown as GetEventInput),
    },
  ];
}
