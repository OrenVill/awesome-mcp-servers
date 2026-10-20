export interface TvmazeRating {
  average?: number | null;
}

export interface TvmazeImage {
  medium?: string;
  original?: string;
}

export interface TvmazeNetwork {
  name?: string;
  country?: { name?: string; code?: string };
}

export interface TvmazeShow {
  id: number;
  url?: string;
  name: string;
  type?: string;
  language?: string | null;
  genres?: string[];
  status?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  premiered?: string | null;
  ended?: string | null;
  officialSite?: string | null;
  schedule?: { time?: string; days?: string[] };
  rating?: TvmazeRating;
  network?: TvmazeNetwork | null;
  webChannel?: TvmazeNetwork | null;
  externals?: { imdb?: string; thetvdb?: number; tvrage?: number | null };
  image?: TvmazeImage | null;
  summary?: string | null;
  updated?: number;
}

export interface TvmazeSearchResult {
  score: number;
  show: TvmazeShow;
}

export interface TvmazeEpisode {
  id: number;
  url?: string;
  name: string;
  season: number;
  number: number | null;
  type?: string;
  airdate?: string | null;
  airtime?: string | null;
  runtime?: number | null;
  rating?: TvmazeRating;
  summary?: string | null;
}

export class TvmazeService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://api.tvmaze.com';
    this.timeout = options?.timeout ?? 15000;
  }

  async searchShows(query: string): Promise<TvmazeSearchResult[]> {
    const url = new URL(`${this.baseUrl}/search/shows`);
    url.searchParams.set('q', query);
    const res = await this.fetchJson<TvmazeSearchResult[]>(url.toString());
    return res ?? [];
  }

  async getShow(tvmazeId: number): Promise<TvmazeShow> {
    const url = `${this.baseUrl}/shows/${tvmazeId}`;
    return this.fetchJson<TvmazeShow>(url);
  }

  async getShowEpisodes(tvmazeId: number): Promise<TvmazeEpisode[]> {
    const url = `${this.baseUrl}/shows/${tvmazeId}/episodes`;
    const res = await this.fetchJson<TvmazeEpisode[]>(url);
    return res ?? [];
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) {
      throw new Error('Not found (404)');
    }
    if (!res.ok) {
      throw new Error(`TVMaze API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'tvmaze-mcp/1.0 (https://github.com/awesome-mcp-servers)',
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
