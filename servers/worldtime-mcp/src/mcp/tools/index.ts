import {
  WorldtimeTools,
  GET_TIME_BY_TIMEZONE_DEF,
  GET_TIME_BY_IP_DEF,
  LIST_TIMEZONES_DEF,
  type GetTimeByTimezoneInput,
  type GetTimeByIpInput,
  type ListTimezonesInput,
} from './worldtimeTools.js';
import { WorldTimeService } from '../../services/worldtimeService.js';
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

export function getWorldtimeToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new WorldTimeService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new WorldtimeTools(service);
  return [
    {
      ...GET_TIME_BY_TIMEZONE_DEF,
      inputSchema: WorldtimeTools.getGetTimeByTimezoneSchema().inputSchema,
      execute: (args) =>
        tools.executeGetTimeByTimezone(args as unknown as GetTimeByTimezoneInput),
    },
    {
      ...GET_TIME_BY_IP_DEF,
      inputSchema: WorldtimeTools.getGetTimeByIpSchema().inputSchema,
      execute: (args) =>
        tools.executeGetTimeByIp(args as unknown as GetTimeByIpInput),
    },
    {
      ...LIST_TIMEZONES_DEF,
      inputSchema: WorldtimeTools.getListTimezonesSchema().inputSchema,
      execute: (args) =>
        tools.executeListTimezones(args as unknown as ListTimezonesInput),
    },
  ];
}
