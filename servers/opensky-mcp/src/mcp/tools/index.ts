import {
  OpenSkyTools,
  GET_ALL_STATES_DEF,
  GET_FLIGHT_TRACK_DEF,
  GET_AIRPORT_ARRIVALS_DEF,
  type GetAllStatesInput,
  type GetFlightTrackInput,
  type GetAirportArrivalsInput,
} from './openskyTools.js';
import { OpenSkyService } from '../../services/openskyService.js';
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

export function getOpenskyToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new OpenSkyService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new OpenSkyTools(service);
  return [
    {
      ...GET_ALL_STATES_DEF,
      inputSchema: OpenSkyTools.getGetAllStatesSchema().inputSchema,
      execute: (args) => tools.executeGetAllStates(args as unknown as GetAllStatesInput),
    },
    {
      ...GET_FLIGHT_TRACK_DEF,
      inputSchema: OpenSkyTools.getGetFlightTrackSchema().inputSchema,
      execute: (args) => tools.executeGetFlightTrack(args as unknown as GetFlightTrackInput),
    },
    {
      ...GET_AIRPORT_ARRIVALS_DEF,
      inputSchema: OpenSkyTools.getGetAirportArrivalsSchema().inputSchema,
      execute: (args) =>
        tools.executeGetAirportArrivals(args as unknown as GetAirportArrivalsInput),
    },
  ];
}
