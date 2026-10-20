import {
  OpennotifyTools,
  GET_ISS_LOCATION_DEF,
  GET_PEOPLE_IN_SPACE_DEF,
  GET_ISS_PASS_TIMES_DEF,
  type GetIssLocationInput,
  type GetPeopleInSpaceInput,
  type GetIssPassTimesInput,
} from './opennotifyTools.js';
import { OpennotifyService } from '../../services/opennotifyService.js';
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

export function getOpennotifyToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new OpennotifyService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new OpennotifyTools(service);
  return [
    {
      ...GET_ISS_LOCATION_DEF,
      inputSchema: OpennotifyTools.getGetIssLocationSchema().inputSchema,
      execute: (args) =>
        tools.executeGetIssLocation(args as unknown as GetIssLocationInput),
    },
    {
      ...GET_PEOPLE_IN_SPACE_DEF,
      inputSchema: OpennotifyTools.getGetPeopleInSpaceSchema().inputSchema,
      execute: (args) =>
        tools.executeGetPeopleInSpace(args as unknown as GetPeopleInSpaceInput),
    },
    {
      ...GET_ISS_PASS_TIMES_DEF,
      inputSchema: OpennotifyTools.getGetIssPassTimesSchema().inputSchema,
      execute: (args) =>
        tools.executeGetIssPassTimes(args as unknown as GetIssPassTimesInput),
    },
  ];
}
