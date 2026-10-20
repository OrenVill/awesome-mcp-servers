export interface PokeapiNamedResource {
  name: string;
  url: string;
}

export interface PokeapiListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PokeapiNamedResource[];
}

export interface PokeapiPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number | null;
  types: Array<{
    slot: number;
    type: PokeapiNamedResource;
  }>;
  stats: Array<{
    base_stat: number;
    effort: number;
    stat: PokeapiNamedResource;
  }>;
  abilities: Array<{
    is_hidden: boolean;
    slot: number;
    ability: PokeapiNamedResource;
  }>;
}

export interface PokeapiTypeDamageRelation {
  name: string;
  url: string;
}

export interface PokeapiType {
  id: number;
  name: string;
  damage_relations: {
    double_damage_from: PokeapiTypeDamageRelation[];
    double_damage_to: PokeapiTypeDamageRelation[];
    half_damage_from: PokeapiTypeDamageRelation[];
    half_damage_to: PokeapiTypeDamageRelation[];
    no_damage_from: PokeapiTypeDamageRelation[];
    no_damage_to: PokeapiTypeDamageRelation[];
  };
  pokemon: Array<{
    slot: number;
    pokemon: PokeapiNamedResource;
  }>;
}

export class PokeapiService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private pokemonNameCache: PokeapiNamedResource[] | null = null;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://pokeapi.co/api/v2').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async getPokemon(nameOrId: string): Promise<PokeapiPokemon> {
    const encoded = encodeURIComponent(nameOrId.trim().toLowerCase());
    const url = `${this.baseUrl}/pokemon/${encoded}`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`PokéAPI returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as PokeapiPokemon;
  }

  async getType(typeName: string): Promise<PokeapiType> {
    const encoded = encodeURIComponent(typeName.trim().toLowerCase());
    const url = `${this.baseUrl}/type/${encoded}`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`PokéAPI returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as PokeapiType;
  }

  async listPokemon(params: {
    limit?: number;
    offset?: number;
  }): Promise<PokeapiListResponse> {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const url = `${this.baseUrl}/pokemon?limit=${limit}&offset=${offset}`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`PokéAPI returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as PokeapiListResponse;
  }

  async searchPokemon(params: {
    query: string;
    limit?: number;
  }): Promise<{ matches: PokeapiNamedResource[]; totalMatches: number; exact?: PokeapiPokemon }> {
    const query = params.query.trim().toLowerCase();
    const limit = params.limit ?? 10;

    if (!query) {
      throw new Error('query is required');
    }

    try {
      const exact = await this.getPokemon(query);
      return { matches: [{ name: exact.name, url: `${this.baseUrl}/pokemon/${exact.id}/` }], totalMatches: 1, exact };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('404')) {
        throw err;
      }
    }

    const allNames = await this.loadAllPokemonNames();
    const partial = allNames.filter((p) => p.name.includes(query));
    return {
      matches: partial.slice(0, limit),
      totalMatches: partial.length,
    };
  }

  private async loadAllPokemonNames(): Promise<PokeapiNamedResource[]> {
    if (this.pokemonNameCache) {
      return this.pokemonNameCache;
    }

    const first = await this.listPokemon({ limit: 1, offset: 0 });
    const full = await this.listPokemon({ limit: first.count, offset: 0 });
    this.pokemonNameCache = full.results;
    return full.results;
  }

  private userAgent(): string {
    return 'pokeapi-mcp/1.0 (https://github.com/awesome-mcp-servers)';
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent(),
          Accept: 'application/json',
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw err;
    }
  }
}
