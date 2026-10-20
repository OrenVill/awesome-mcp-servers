export interface MusicBrainzLifeSpan {
  begin?: string;
  end?: string;
  ended?: boolean;
}

export interface MusicBrainzArtist {
  id: string;
  name: string;
  'sort-name'?: string;
  disambiguation?: string;
  type?: string;
  country?: string;
  'life-span'?: MusicBrainzLifeSpan;
  gender?: string;
  tags?: Array<{ name: string; count: number }>;
  aliases?: Array<{ name: string; 'sort-name'?: string; locale?: string }>;
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  disambiguation?: string;
  status?: string;
  date?: string;
  country?: string;
  'artist-credit'?: Array<{
    name?: string;
    artist?: { id: string; name: string };
  }>;
  'release-group'?: {
    id?: string;
    title?: string;
    'primary-type'?: string;
    'secondary-types'?: string[];
  };
  'label-info'?: Array<{ label?: { name?: string }; 'catalog-number'?: string }>;
}

export interface MusicBrainzArtistSearchResult {
  created?: string;
  count?: number;
  offset?: number;
  artists: MusicBrainzArtist[];
}

export interface MusicBrainzReleaseSearchResult {
  created?: string;
  count?: number;
  offset?: number;
  releases: MusicBrainzRelease[];
}

export class MusicBrainzService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly minRequestIntervalMs: number;
  private lastRequestAt = 0;
  private requestChain: Promise<void> = Promise.resolve();

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    userAgent?: string;
    minRequestIntervalMs?: number;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://musicbrainz.org/ws/2').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
    this.userAgent = options?.userAgent ?? 'awesome-mcp-servers/1.0';
    this.minRequestIntervalMs = options?.minRequestIntervalMs ?? 1000;
  }

  async searchArtists(params: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<MusicBrainzArtistSearchResult> {
    const url = this.buildUrl('/artist', {
      query: params.query,
      limit: String(params.limit ?? 25),
      offset: String(params.offset ?? 0),
    });
    return this.fetchJson<MusicBrainzArtistSearchResult>(url);
  }

  async searchReleases(params: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<MusicBrainzReleaseSearchResult> {
    const url = this.buildUrl('/release', {
      query: params.query,
      limit: String(params.limit ?? 25),
      offset: String(params.offset ?? 0),
    });
    return this.fetchJson<MusicBrainzReleaseSearchResult>(url);
  }

  async lookupArtist(mbid: string): Promise<MusicBrainzArtist> {
    const encoded = encodeURIComponent(mbid.trim());
    const url = this.buildUrl(`/artist/${encoded}`, {
      inc: 'aliases+tags',
    });
    return this.fetchJson<MusicBrainzArtist>(url);
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('fmt', 'json');
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await this.rateLimitedFetch(url);
    if (res.status === 404) {
      throw new Error('Not found (invalid MBID or resource missing)');
    }
    if (!res.ok) {
      throw new Error(`MusicBrainz returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  /** Serialize requests and enforce at least minRequestIntervalMs between calls. */
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
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    }
  }
}
