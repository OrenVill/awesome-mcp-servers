import {
  WikidataTools,
  SEARCH_ENTITIES_DEF,
  GET_ENTITY_DEF,
  GET_ENTITY_DESCRIPTION_DEF,
  type SearchEntitiesInput,
  type GetEntityInput,
  type GetEntityDescriptionInput,
} from './wikidataTools.js';
import { WikidataService } from '../../services/wikidataService.js';
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

export function getWikidataToolDefinitions(apiConfig?: {
  mediaWikiBaseUrl?: string;
  defaultLanguage?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new WikidataService({
    mediaWikiBase: config.mediaWikiBaseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new WikidataTools(service, config.defaultLanguage);
  return [
    {
      ...SEARCH_ENTITIES_DEF,
      inputSchema: WikidataTools.getSearchEntitiesSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchEntities(args as unknown as SearchEntitiesInput),
    },
    {
      ...GET_ENTITY_DEF,
      inputSchema: WikidataTools.getGetEntitySchema().inputSchema,
      execute: (args) => tools.executeGetEntity(args as unknown as GetEntityInput),
    },
    {
      ...GET_ENTITY_DESCRIPTION_DEF,
      inputSchema: WikidataTools.getGetEntityDescriptionSchema().inputSchema,
      execute: (args) =>
        tools.executeGetEntityDescription(args as unknown as GetEntityDescriptionInput),
    },
  ];
}
