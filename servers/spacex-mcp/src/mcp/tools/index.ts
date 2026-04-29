import {
  SpacexTools,
  GET_LATEST_LAUNCH_DEF,
  GET_NEXT_LAUNCH_DEF,
  LIST_LAUNCHES_DEF,
  GET_LAUNCH_DEF,
  GET_ROCKET_DEF,
  type GetLatestLaunchInput,
  type GetNextLaunchInput,
  type ListLaunchesInput,
  type GetLaunchInput,
  type GetRocketInput,
} from './spacexTools.js';
import { SpaceXService } from '../../services/spacexService.js';
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

export function getSpacexToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new SpaceXService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new SpacexTools(service);
  return [
    {
      ...GET_LATEST_LAUNCH_DEF,
      inputSchema: SpacexTools.getGetLatestLaunchSchema().inputSchema,
      execute: (args) =>
        tools.executeGetLatestLaunch(args as unknown as GetLatestLaunchInput),
    },
    {
      ...GET_NEXT_LAUNCH_DEF,
      inputSchema: SpacexTools.getGetNextLaunchSchema().inputSchema,
      execute: (args) =>
        tools.executeGetNextLaunch(args as unknown as GetNextLaunchInput),
    },
    {
      ...LIST_LAUNCHES_DEF,
      inputSchema: SpacexTools.getListLaunchesSchema().inputSchema,
      execute: (args) =>
        tools.executeListLaunches(args as unknown as ListLaunchesInput),
    },
    {
      ...GET_LAUNCH_DEF,
      inputSchema: SpacexTools.getGetLaunchSchema().inputSchema,
      execute: (args) => tools.executeGetLaunch(args as unknown as GetLaunchInput),
    },
    {
      ...GET_ROCKET_DEF,
      inputSchema: SpacexTools.getGetRocketSchema().inputSchema,
      execute: (args) => tools.executeGetRocket(args as unknown as GetRocketInput),
    },
  ];
}
