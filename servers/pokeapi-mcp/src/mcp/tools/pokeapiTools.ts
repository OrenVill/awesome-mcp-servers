import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  PokeapiService,
  type PokeapiPokemon,
  type PokeapiType,
  type PokeapiNamedResource,
  type PokeapiListResponse,
  type PokeapiTypeDamageRelation,
} from '../../services/pokeapiService.js';

export const SEARCH_POKEMON_DEF = {
  name: 'search_pokemon',
  description:
    "⚡ I'm searching Pokémon\n\nSearch PokéAPI for Pokémon by name. Tries an exact match via /pokemon/{name} first, then filters the full species list for partial name matches. Pass an array of queries to run several searches at once.",
  keywords: ['pokeapi', 'pokemon', 'search', 'find', 'name', 'species', 'pokedex'],
};

export const GET_POKEMON_DEF = {
  name: 'get_pokemon',
  description:
    "⚡ I'm looking up a Pokémon\n\nGet full Pokémon details from PokéAPI by name or national dex ID (e.g. pikachu or 25). Returns types, base stats, abilities, height, and weight. Pass an array of names or IDs to fetch several Pokémon at once.",
  keywords: ['pokeapi', 'pokemon', 'get', 'stats', 'types', 'abilities', 'pokedex', 'dex'],
};

export const GET_TYPE_DEF = {
  name: 'get_type',
  description:
    "⚡ I'm looking up a Pokémon type\n\nGet type details from PokéAPI including damage relations (weaknesses, resistances, immunities) and a sample of Pokémon with that type. Pass an array of type names for batch lookup.",
  keywords: ['pokeapi', 'pokemon', 'type', 'weakness', 'resistance', 'damage', 'electric', 'fire'],
};

export const LIST_POKEMON_DEF = {
  name: 'list_pokemon',
  description:
    "⚡ I'm listing Pokémon\n\nList Pokémon species from PokéAPI with pagination (limit and offset). Returns names and resource URLs for each entry in the page.",
  keywords: ['pokeapi', 'pokemon', 'list', 'pagination', 'offset', 'pokedex', 'all'],
};

export interface SearchPokemonInput {
  query: string | string[];
  limit?: number;
}

export interface GetPokemonInput {
  name: string | string[];
}

export interface GetTypeInput {
  type: string | string[];
}

export interface ListPokemonInput {
  limit?: number;
  offset?: number;
}

function normalizeToArray<T>(value: T | T[]): { items: T[]; isBatch: boolean } {
  if (Array.isArray(value)) return { items: value, isBatch: true };
  return { items: [value], isBatch: false };
}

function stringOrArraySchema(description: string): object {
  return {
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' }, minItems: 1 },
    ],
    description: `${description} Accepts a single value or an array of values for batch requests.`,
  };
}

const BATCH_SEPARATOR = '\n\n---\n\n';

export class PokeapiTools {
  private service: PokeapiService;

  constructor(service?: PokeapiService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new PokeapiService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchPokemonSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Name or partial name to search for (e.g. "char" or "pikachu").'),
          limit: {
            type: 'number',
            description: 'Maximum partial matches to return when no exact hit (1-100)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetPokemonSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: stringOrArraySchema('Pokémon name or national dex ID (e.g. "bulbasaur" or "1").'),
        },
        required: ['name'],
      },
    };
  }

  static getGetTypeSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          type: stringOrArraySchema('Type name (e.g. "water", "fairy").'),
        },
        required: ['type'],
      },
    };
  }

  static getListPokemonSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          limit: {
            type: 'number',
            description: 'Number of Pokémon to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          offset: {
            type: 'number',
            description: 'Index to start from (0-based)',
            minimum: 0,
            default: 0,
          },
        },
      },
    };
  }

  async executeSearchPokemon(args: SearchPokemonInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }

    const limit = args.limit ?? 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'limit must be a number between 1 and 100');
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const result = await this.service.searchPokemon({ query, limit });
          if (result.exact) {
            return `# Exact match: ${result.exact.name}\n\n${this.formatPokemonAsText(result.exact)}`;
          }
          return this.formatSearchResultsAsText(query, result.matches, result.totalMatches);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Pokémon search failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetPokemon(args: GetPokemonInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.name);
    if (items.length === 0 || items.some((n) => !n || typeof n !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'name is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (name) => {
        try {
          const pokemon = await this.service.getPokemon(name);
          return this.formatPokemonAsText(pokemon);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${name}\n\nFailed to get Pokémon: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetType(args: GetTypeInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.type);
    if (items.length === 0 || items.some((t) => !t || typeof t !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'type is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (typeName) => {
        try {
          const typeInfo = await this.service.getType(typeName);
          return this.formatTypeAsText(typeInfo);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${typeName}\n\nFailed to get type: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeListPokemon(args: ListPokemonInput): Promise<MCPToolCallResult> {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'limit must be a number between 1 and 100');
    }
    if (typeof offset !== 'number' || offset < 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'offset must be a non-negative number');
    }

    try {
      const list = await this.service.listPokemon({ limit, offset });
      return { content: [{ type: 'text', text: this.formatListAsText(list) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  private formatPokemonAsText(pokemon: PokeapiPokemon): string {
    const title = `# ${this.capitalize(pokemon.name)} (#${pokemon.id})\n\n`;
    const types = pokemon.types.map((t) => t.type.name).join(', ');
    const heightM = (pokemon.height / 10).toFixed(1);
    const weightKg = (pokemon.weight / 10).toFixed(1);

    let text = title;
    text += `**Types:** ${types}\n`;
    text += `**Height:** ${heightM} m\n`;
    text += `**Weight:** ${weightKg} kg\n`;
    if (pokemon.base_experience != null) {
      text += `**Base experience:** ${pokemon.base_experience}\n`;
    }

    text += `\n## Base stats\n\n`;
    for (const s of pokemon.stats) {
      text += `- **${s.stat.name}:** ${s.base_stat}\n`;
    }

    text += `\n## Abilities\n\n`;
    for (const a of pokemon.abilities) {
      const hidden = a.is_hidden ? ' (hidden)' : '';
      text += `- ${a.ability.name.replace(/-/g, ' ')}${hidden}\n`;
    }

    return text.trim();
  }

  private formatSearchResultsAsText(
    query: string,
    matches: PokeapiNamedResource[],
    totalMatches: number
  ): string {
    if (matches.length === 0) {
      return `No Pokémon found matching "${query}".`;
    }

    let text = `Found ${totalMatches} match(es) for "${query}"`;
    if (totalMatches > matches.length) {
      text += ` (showing ${matches.length})`;
    }
    text += ':\n\n';

    matches.forEach((m, i) => {
      text += `${i + 1}. **${this.capitalize(m.name)}**\n`;
    });

    text += '\nUse get_pokemon with a name or ID for full stats.';
    return text.trim();
  }

  private formatTypeAsText(typeInfo: PokeapiType): string {
    const dr = typeInfo.damage_relations;
    let text = `# ${this.capitalize(typeInfo.name)} type\n\n`;
    text += `**Pokémon with this type:** ${typeInfo.pokemon.length}\n`;

    const section = (label: string, items: PokeapiTypeDamageRelation[]) => {
      if (items.length === 0) return '';
      return `**${label}:** ${items.map((t) => t.name).join(', ')}\n`;
    };

    text += '\n## Damage relations\n\n';
    text += section('Weak to (2×)', dr.double_damage_from);
    text += section('Resists (½×)', dr.half_damage_from);
    text += section('Immune to (0×)', dr.no_damage_from);
    text += section('Super effective on (2×)', dr.double_damage_to);
    text += section('Not very effective on (½×)', dr.half_damage_to);
    text += section('No effect on (0×)', dr.no_damage_to);

    const sample = typeInfo.pokemon.slice(0, 15);
    if (sample.length > 0) {
      text += `\n## Sample Pokémon\n\n`;
      text += sample.map((p) => `- ${this.capitalize(p.pokemon.name)}`).join('\n');
      if (typeInfo.pokemon.length > sample.length) {
        text += `\n- … and ${typeInfo.pokemon.length - sample.length} more`;
      }
    }

    return text.trim();
  }

  private formatListAsText(list: PokeapiListResponse): string {
    let text = `# Pokémon list\n\n`;
    text += `**Total species:** ${list.count}\n`;
    text += `**This page:** ${list.results.length} entries\n\n`;

    list.results.forEach((p, i) => {
      text += `${i + 1}. **${this.capitalize(p.name)}**\n`;
    });

    if (list.next) {
      text += `\nMore results available — increase offset or use search_pokemon for name lookup.`;
    }

    return text.trim();
  }

  private capitalize(name: string): string {
    return name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-');
  }
}
