import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  SwapiService,
  type SwapiFilm,
  type SwapiListResponse,
  type SwapiPerson,
  type SwapiPlanet,
} from '../../services/swapiService.js';

export const SEARCH_FILMS_DEF = {
  name: 'search_films',
  description:
    "🎬 I'm searching Star Wars films on SWAPI\n\nSearch SWAPI films by title or other text. Returns matching films with episode number, director, release date, and resource URL.",
  keywords: ['swapi', 'star-wars', 'films', 'movies', 'search', 'episode'],
};

export const GET_PERSON_DEF = {
  name: 'get_person',
  description:
    "👤 I'm loading a Star Wars character from SWAPI\n\nGet a person (character) by numeric SWAPI id (e.g. `1` for Luke Skywalker) or full resource URL. Returns physical traits, homeworld link, and related films.",
  keywords: ['swapi', 'star-wars', 'person', 'character', 'people', 'lookup'],
};

export const GET_PLANET_DEF = {
  name: 'get_planet',
  description:
    "🪐 I'm loading a Star Wars planet from SWAPI\n\nGet a planet by numeric SWAPI id (e.g. `1` for Tatooine) or full resource URL. Returns climate, terrain, population, and related films.",
  keywords: ['swapi', 'star-wars', 'planet', 'world', 'lookup'],
};

export const SEARCH_PEOPLE_DEF = {
  name: 'search_people',
  description:
    "👥 I'm searching Star Wars characters on SWAPI\n\nSearch SWAPI people by name or other text. Returns matching characters with gender, birth year, and resource URL.",
  keywords: ['swapi', 'star-wars', 'people', 'characters', 'search', 'name'],
};

export interface SearchFilmsInput {
  search: string;
}

export interface GetPersonInput {
  id: string | string[];
}

export interface GetPlanetInput {
  id: string | string[];
}

export interface SearchPeopleInput {
  search: string;
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

export class SwapiTools {
  private service: SwapiService;

  constructor(service?: SwapiService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new SwapiService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchFilmsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          search: {
            type: 'string',
            description: 'Case-insensitive search string (film title, etc.)',
          },
        },
        required: ['search'],
      },
    };
  }

  static getGetPersonSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: stringOrArraySchema('SWAPI people id (e.g. "1") or resource URL.'),
        },
        required: ['id'],
      },
    };
  }

  static getGetPlanetSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: stringOrArraySchema('SWAPI planets id (e.g. "1") or resource URL.'),
        },
        required: ['id'],
      },
    };
  }

  static getSearchPeopleSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          search: {
            type: 'string',
            description: 'Case-insensitive search string (character name, etc.)',
          },
        },
        required: ['search'],
      },
    };
  }

  async executeSearchFilms(args: SearchFilmsInput): Promise<MCPToolCallResult> {
    const search = args.search;
    if (typeof search !== 'string' || !search.trim()) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'search must be a non-empty string');
    }

    try {
      const data = await this.service.searchFilms(search);
      return { content: [{ type: 'text', text: this.formatFilmSearch(data, search) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('timed out')) {
        return createMCPErrorResult(MCPErrorCode.TIMEOUT, message);
      }
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to search films: ${message}`);
    }
  }

  async executeSearchPeople(args: SearchPeopleInput): Promise<MCPToolCallResult> {
    const search = args.search;
    if (typeof search !== 'string' || !search.trim()) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'search must be a non-empty string');
    }

    try {
      const data = await this.service.searchPeople(search);
      return { content: [{ type: 'text', text: this.formatPeopleSearch(data, search) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('timed out')) {
        return createMCPErrorResult(MCPErrorCode.TIMEOUT, message);
      }
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to search people: ${message}`);
    }
  }

  async executeGetPerson(args: GetPersonInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.id);
    if (items.length === 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'id must be a non-empty string or array');
    }

    const sections: string[] = [];
    for (const rawId of items) {
      if (typeof rawId !== 'string' || !rawId.trim()) {
        sections.push('Error: each id must be a non-empty string');
        continue;
      }
      try {
        const person = await this.service.getPerson(rawId);
        if (!person) {
          sections.push(`No person found for id: ${rawId}`);
        } else {
          sections.push(this.formatPerson(person));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        sections.push(`Error fetching person ${rawId}: ${message}`);
      }
    }

    const text = isBatch ? sections.join(BATCH_SEPARATOR) : sections[0] ?? '';
    return { content: [{ type: 'text', text }] };
  }

  async executeGetPlanet(args: GetPlanetInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.id);
    if (items.length === 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'id must be a non-empty string or array');
    }

    const sections: string[] = [];
    for (const rawId of items) {
      if (typeof rawId !== 'string' || !rawId.trim()) {
        sections.push('Error: each id must be a non-empty string');
        continue;
      }
      try {
        const planet = await this.service.getPlanet(rawId);
        if (!planet) {
          sections.push(`No planet found for id: ${rawId}`);
        } else {
          sections.push(this.formatPlanet(planet));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        sections.push(`Error fetching planet ${rawId}: ${message}`);
      }
    }

    const text = isBatch ? sections.join(BATCH_SEPARATOR) : sections[0] ?? '';
    return { content: [{ type: 'text', text }] };
  }

  private formatFilmSearch(data: SwapiListResponse<SwapiFilm>, query: string): string {
    const count = data.count ?? data.results?.length ?? 0;
    const results = data.results ?? [];
    const lines: string[] = [
      `# SWAPI film search: "${query}"`,
      `Matches: ${count}`,
    ];
    if (data.next) {
      lines.push(`More results available: ${data.next}`);
    }
    if (results.length === 0) {
      lines.push('', 'No films matched your search.');
      return lines.join('\n');
    }
    lines.push('');
    results.forEach((film, i) => {
      lines.push(`## ${i + 1}. ${film.title ?? 'Unknown title'}`);
      lines.push(this.formatFilmSummary(film));
      lines.push('');
    });
    return lines.join('\n').trimEnd();
  }

  private formatPeopleSearch(data: SwapiListResponse<SwapiPerson>, query: string): string {
    const count = data.count ?? data.results?.length ?? 0;
    const results = data.results ?? [];
    const lines: string[] = [
      `# SWAPI people search: "${query}"`,
      `Matches: ${count}`,
    ];
    if (data.next) {
      lines.push(`More results available: ${data.next}`);
    }
    if (results.length === 0) {
      lines.push('', 'No people matched your search.');
      return lines.join('\n');
    }
    lines.push('');
    results.forEach((person, i) => {
      const id = this.service.extractIdFromUrl(person.url);
      lines.push(`## ${i + 1}. ${person.name ?? 'Unknown'}`);
      if (id) lines.push(`- ID: ${id}`);
      if (person.gender) lines.push(`- Gender: ${person.gender}`);
      if (person.birth_year) lines.push(`- Birth year: ${person.birth_year}`);
      if (person.url) lines.push(`- URL: ${person.url}`);
      lines.push('');
    });
    return lines.join('\n').trimEnd();
  }

  private formatFilmSummary(film: SwapiFilm): string {
    const lines: string[] = [];
    const id = this.service.extractIdFromUrl(film.url);
    if (id) lines.push(`- ID: ${id}`);
    if (film.episode_id != null) lines.push(`- Episode: ${film.episode_id}`);
    if (film.director) lines.push(`- Director: ${film.director}`);
    if (film.producer) lines.push(`- Producer: ${film.producer}`);
    if (film.release_date) lines.push(`- Release date: ${film.release_date}`);
    if (film.url) lines.push(`- URL: ${film.url}`);
    if (film.opening_crawl) {
      const crawl = film.opening_crawl.replace(/\r\n/g, '\n').trim();
      lines.push(`- Opening crawl: ${crawl.slice(0, 280)}${crawl.length > 280 ? '…' : ''}`);
    }
    return lines.join('\n');
  }

  private formatPerson(person: SwapiPerson): string {
    const lines: string[] = [`# ${person.name ?? 'Unknown person'}`];
    const id = this.service.extractIdFromUrl(person.url);
    if (id) lines.push(`- ID: ${id}`);
    if (person.gender) lines.push(`- Gender: ${person.gender}`);
    if (person.birth_year) lines.push(`- Birth year: ${person.birth_year}`);
    if (person.height) lines.push(`- Height: ${person.height} cm`);
    if (person.mass) lines.push(`- Mass: ${person.mass} kg`);
    if (person.hair_color) lines.push(`- Hair: ${person.hair_color}`);
    if (person.skin_color) lines.push(`- Skin: ${person.skin_color}`);
    if (person.eye_color) lines.push(`- Eyes: ${person.eye_color}`);
    if (person.homeworld) {
      const hwId = this.service.extractIdFromUrl(person.homeworld);
      lines.push(`- Homeworld: ${person.homeworld}${hwId ? ` (planet id ${hwId})` : ''}`);
    }
    if (person.films?.length) {
      lines.push(`- Films: ${person.films.length} linked`);
    }
    if (person.url) lines.push(`- URL: ${person.url}`);
    return lines.join('\n');
  }

  private formatPlanet(planet: SwapiPlanet): string {
    const lines: string[] = [`# ${planet.name ?? 'Unknown planet'}`];
    const id = this.service.extractIdFromUrl(planet.url);
    if (id) lines.push(`- ID: ${id}`);
    if (planet.climate) lines.push(`- Climate: ${planet.climate}`);
    if (planet.terrain) lines.push(`- Terrain: ${planet.terrain}`);
    if (planet.gravity) lines.push(`- Gravity: ${planet.gravity}`);
    if (planet.diameter) lines.push(`- Diameter: ${planet.diameter} km`);
    if (planet.rotation_period) lines.push(`- Rotation period: ${planet.rotation_period} hours`);
    if (planet.orbital_period) lines.push(`- Orbital period: ${planet.orbital_period} days`);
    if (planet.surface_water) lines.push(`- Surface water: ${planet.surface_water}%`);
    if (planet.population) lines.push(`- Population: ${planet.population}`);
    if (planet.residents?.length) {
      lines.push(`- Residents: ${planet.residents.length} linked`);
    }
    if (planet.films?.length) {
      lines.push(`- Films: ${planet.films.length} linked`);
    }
    if (planet.url) lines.push(`- URL: ${planet.url}`);
    return lines.join('\n');
  }
}
