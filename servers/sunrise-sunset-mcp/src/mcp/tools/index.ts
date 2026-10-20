import {
  SunriseSunsetTools,
  GET_SUN_TIMES_DEF,
  type GetSunTimesInput,
} from './sunriseSunsetTools.js';
import { SunriseSunsetService } from '../../services/sunriseSunsetService.js';
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

export function getSunriseSunsetToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new SunriseSunsetService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new SunriseSunsetTools(service);
  return [
    {
      ...GET_SUN_TIMES_DEF,
      inputSchema: SunriseSunsetTools.getGetSunTimesSchema().inputSchema,
      execute: (args) => tools.executeGetSunTimes(args as unknown as GetSunTimesInput),
    },
  ];
}
