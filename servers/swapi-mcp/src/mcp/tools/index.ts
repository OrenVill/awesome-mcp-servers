import {
  SwapiTools,
  SEARCH_FILMS_DEF,
  GET_PERSON_DEF,
  GET_PLANET_DEF,
  SEARCH_PEOPLE_DEF,
  type SearchFilmsInput,
  type GetPersonInput,
  type GetPlanetInput,
  type SearchPeopleInput,
} from './swapiTools.js';
import { SwapiService } from '../../services/swapiService.js';
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

export function getSwapiToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new SwapiService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new SwapiTools(service);
  return [
    {
      ...SEARCH_FILMS_DEF,
      inputSchema: SwapiTools.getSearchFilmsSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchFilms(args as unknown as SearchFilmsInput),
    },
    {
      ...GET_PERSON_DEF,
      inputSchema: SwapiTools.getGetPersonSchema().inputSchema,
      execute: (args) => tools.executeGetPerson(args as unknown as GetPersonInput),
    },
    {
      ...GET_PLANET_DEF,
      inputSchema: SwapiTools.getGetPlanetSchema().inputSchema,
      execute: (args) => tools.executeGetPlanet(args as unknown as GetPlanetInput),
    },
    {
      ...SEARCH_PEOPLE_DEF,
      inputSchema: SwapiTools.getSearchPeopleSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchPeople(args as unknown as SearchPeopleInput),
    },
  ];
}
