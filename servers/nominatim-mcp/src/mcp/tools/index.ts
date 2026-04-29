import {
  NominatimTools,
  GEOCODE_DEF,
  REVERSE_GEOCODE_DEF,
  LOOKUP_DEF,
  type GeocodeInput,
  type ReverseGeocodeInput,
  type LookupInput,
} from './nominatimTools.js';
import { NominatimService } from '../../services/nominatimService.js';
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

export function getNominatimToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
  userAgent?: string;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new NominatimService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    userAgent: config.userAgent,
  });
  const tools = new NominatimTools(service);
  return [
    {
      ...GEOCODE_DEF,
      inputSchema: NominatimTools.getGeocodeSchema().inputSchema,
      execute: (args) => tools.executeGeocode(args as unknown as GeocodeInput),
    },
    {
      ...REVERSE_GEOCODE_DEF,
      inputSchema: NominatimTools.getReverseGeocodeSchema().inputSchema,
      execute: (args) => tools.executeReverseGeocode(args as unknown as ReverseGeocodeInput),
    },
    {
      ...LOOKUP_DEF,
      inputSchema: NominatimTools.getLookupSchema().inputSchema,
      execute: (args) => tools.executeLookup(args as unknown as LookupInput),
    },
  ];
}
