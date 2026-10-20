export interface JikanGenre {
  mal_id: number;
  name: string;
}

export interface JikanAnime {
  mal_id: number;
  url?: string;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  type?: string;
  source?: string;
  episodes?: number | null;
  status?: string;
  airing?: boolean;
  aired?: { from?: string | null; to?: string | null; string?: string };
  score?: number | null;
  scored_by?: number | null;
  rank?: number | null;
  popularity?: number | null;
  members?: number | null;
  favorites?: number | null;
  synopsis?: string | null;
  background?: string | null;
  season?: string | null;
  year?: number | null;
  genres?: JikanGenre[];
  studios?: Array<{ mal_id: number; name: string }>;
  rating?: string | null;
  duration?: string | null;
}

export interface JikanPagination {
  last_visible_page?: number;
  has_next_page?: boolean;
  current_page?: number;
  items?: { count: number; total: number; per_page: number };
}

export interface JikanAnimeSearchResponse {
  pagination?: JikanPagination;
  data: JikanAnime[];
}

export interface JikanAnimeResponse {
  data: JikanAnime;
}

export type JikanTopAnimeFilter = 'airing' | 'upcoming' | 'bypopularity' | 'favorite';

export class JikanService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly minRequestIntervalMs: number;
  private lastRequestAt = 0;
  private requestChain: Promise<void> = Promise.resolve();

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    minRequestIntervalMs?: number;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.jikan.moe/v4').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
    this.minRequestIntervalMs = options?.minRequestIntervalMs ?? 334;
  }

  async searchAnime(params: {
    query: string;
    limit?: number;
    page?: number;
  }): Promise<JikanAnimeSearchResponse> {
    const url = new URL(`${this.baseUrl}/anime`);
    url.searchParams.set('q', params.query);
    url.searchParams.set('limit', String(params.limit ?? 10));
    url.searchParams.set('page', String(params.page ?? 1));
    return this.fetchJson<JikanAnimeSearchResponse>(url.toString());
  }

  async getAnime(malId: number): Promise<JikanAnime> {
    const url = `${this.baseUrl}/anime/${malId}/full`;
    const res = await this.fetchJson<JikanAnimeResponse>(url);
    return res.data;
  }

  async getTopAnime(params?: {
    filter?: JikanTopAnimeFilter;
    page?: number;
    limit?: number;
  }): Promise<JikanAnimeSearchResponse> {
    const url = new URL(`${this.baseUrl}/top/anime`);
    if (params?.filter) {
      url.searchParams.set('filter', params.filter);
    }
    url.searchParams.set('page', String(params?.page ?? 1));
    url.searchParams.set('limit', String(params?.limit ?? 10));
    return this.fetchJson<JikanAnimeSearchResponse>(url.toString());
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await this.rateLimitedFetch(url);
    if (res.status === 404) {
      throw new Error('Not found (404)');
    }
    if (res.status === 429) {
      throw new Error('Jikan rate limit exceeded (429). Wait and retry.');
    }
    if (!res.ok) {
      throw new Error(`Jikan API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  /** Serialize requests and enforce at least minRequestIntervalMs between calls (~3 req/s). */
  private rateLimitedFetch(url: string): Promise<Response> {
    const run = async (): Promise<Response> => {
      const now = Date.now();
      const waitMs = Math.max(0, this.lastRequestAt + this.minRequestIntervalMs - now);
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      const response = await this.fetchWithTimeout(url);
      this.lastRequestAt = Date.now();
      return response;
    };

    const result = this.requestChain.then(run, run);
    this.requestChain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'jikan-mcp/1.0 (https://github.com/awesome-mcp-servers)',
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
