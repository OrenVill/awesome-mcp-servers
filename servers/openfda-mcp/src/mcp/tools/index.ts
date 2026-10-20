import {
  OpenFdaTools,
  SEARCH_DRUG_LABELS_DEF,
  SEARCH_DEVICE_EVENTS_DEF,
  SEARCH_FOOD_ENFORCEMENT_DEF,
  type SearchInput,
} from './openfdaTools.js';
import { OpenFdaService } from '../../services/openfdaService.js';
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

export function getOpenfdaToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new OpenFdaService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new OpenFdaTools(service);
  const schema = OpenFdaTools.getSearchSchema().inputSchema;

  return [
    {
      ...SEARCH_DRUG_LABELS_DEF,
      inputSchema: schema,
      execute: (args) => tools.executeSearchDrugLabels(args as unknown as SearchInput),
    },
    {
      ...SEARCH_DEVICE_EVENTS_DEF,
      inputSchema: schema,
      execute: (args) => tools.executeSearchDeviceEvents(args as unknown as SearchInput),
    },
    {
      ...SEARCH_FOOD_ENFORCEMENT_DEF,
      inputSchema: schema,
      execute: (args) => tools.executeSearchFoodEnforcement(args as unknown as SearchInput),
    },
  ];
}
