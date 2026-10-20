import {
  PokeapiTools,
  SEARCH_POKEMON_DEF,
  GET_POKEMON_DEF,
  GET_TYPE_DEF,
  LIST_POKEMON_DEF,
  type SearchPokemonInput,
  type GetPokemonInput,
  type GetTypeInput,
  type ListPokemonInput,
} from './pokeapiTools.js';
import { PokeapiService } from '../../services/pokeapiService.js';
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

export function getPokeapiToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new PokeapiService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new PokeapiTools(service);
  return [
    {
      ...SEARCH_POKEMON_DEF,
      inputSchema: PokeapiTools.getSearchPokemonSchema().inputSchema,
      execute: (args) => tools.executeSearchPokemon(args as unknown as SearchPokemonInput),
    },
    {
      ...GET_POKEMON_DEF,
      inputSchema: PokeapiTools.getGetPokemonSchema().inputSchema,
      execute: (args) => tools.executeGetPokemon(args as unknown as GetPokemonInput),
    },
    {
      ...GET_TYPE_DEF,
      inputSchema: PokeapiTools.getGetTypeSchema().inputSchema,
      execute: (args) => tools.executeGetType(args as unknown as GetTypeInput),
    },
    {
      ...LIST_POKEMON_DEF,
      inputSchema: PokeapiTools.getListPokemonSchema().inputSchema,
      execute: (args) => tools.executeListPokemon(args as unknown as ListPokemonInput),
    },
  ];
}
