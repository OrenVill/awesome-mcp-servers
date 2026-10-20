export interface SwapiListResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
}

export interface SwapiFilm {
  title?: string;
  episode_id?: number;
  opening_crawl?: string;
  director?: string;
  producer?: string;
  release_date?: string;
  characters?: string[];
  planets?: string[];
  starships?: string[];
  vehicles?: string[];
  species?: string[];
  url?: string;
  created?: string;
  edited?: string;
}

export interface SwapiPerson {
  name?: string;
  height?: string;
  mass?: string;
  hair_color?: string;
  skin_color?: string;
  eye_color?: string;
  birth_year?: string;
  gender?: string;
  homeworld?: string;
  films?: string[];
  species?: string[];
  vehicles?: string[];
  starships?: string[];
  url?: string;
  created?: string;
  edited?: string;
}

export interface SwapiPlanet {
  name?: string;
  rotation_period?: string;
  orbital_period?: string;
  diameter?: string;
  climate?: string;
  gravity?: string;
  terrain?: string;
  surface_water?: string;
  population?: string;
  residents?: string[];
  films?: string[];
  url?: string;
  created?: string;
  edited?: string;
}

export class SwapiService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://swapi.dev/api').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async searchFilms(search: string): Promise<SwapiListResponse<SwapiFilm>> {
    const q = search.trim();
    if (!q) {
      return { count: 0, next: null, previous: null, results: [] };
    }
    const url = `${this.baseUrl}/films/?search=${encodeURIComponent(q)}`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`SWAPI film search failed (HTTP ${res.status})`);
    }
    return (await res.json()) as SwapiListResponse<SwapiFilm>;
  }

  async searchPeople(search: string): Promise<SwapiListResponse<SwapiPerson>> {
    const q = search.trim();
    if (!q) {
      return { count: 0, next: null, previous: null, results: [] };
    }
    const url = `${this.baseUrl}/people/?search=${encodeURIComponent(q)}`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`SWAPI people search failed (HTTP ${res.status})`);
    }
    return (await res.json()) as SwapiListResponse<SwapiPerson>;
  }

  async getPerson(id: string): Promise<SwapiPerson | null> {
    const cleaned = this.normalizeResourceId(id, 'people');
    if (!cleaned) return null;
    const url = `${this.baseUrl}/people/${encodeURIComponent(cleaned)}/`;
    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`SWAPI person lookup failed (HTTP ${res.status})`);
    }
    return (await res.json()) as SwapiPerson;
  }

  async getPlanet(id: string): Promise<SwapiPlanet | null> {
    const cleaned = this.normalizeResourceId(id, 'planets');
    if (!cleaned) return null;
    const url = `${this.baseUrl}/planets/${encodeURIComponent(cleaned)}/`;
    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`SWAPI planet lookup failed (HTTP ${res.status})`);
    }
    return (await res.json()) as SwapiPlanet;
  }

  /** Accept numeric id or full SWAPI resource URL. */
  normalizeResourceId(id: string, resource: 'people' | 'planets'): string | null {
    const trimmed = id.trim();
    if (!trimmed) return null;

    const urlMatch = trimmed.match(new RegExp(`/${resource}/(\\d+)/?$`, 'i'));
    if (urlMatch) return urlMatch[1];

    const digits = trimmed.replace(/\D/g, '');
    if (digits) return digits;

    return trimmed;
  }

  extractIdFromUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const match = url.match(/\/(\d+)\/?$/);
    return match?.[1];
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'swapi-mcp/1.0 (https://github.com/awesome-mcp-servers)',
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
