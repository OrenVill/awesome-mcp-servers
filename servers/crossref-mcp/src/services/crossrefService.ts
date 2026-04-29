export interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
  ORCID?: string;
  affiliation?: Array<{ name?: string }>;
}

export interface CrossrefDateParts {
  'date-parts'?: number[][];
}

export interface CrossrefWork {
  DOI: string;
  title?: string[];
  'container-title'?: string[];
  'short-container-title'?: string[];
  author?: CrossrefAuthor[];
  type?: string;
  publisher?: string;
  URL?: string;
  abstract?: string;
  issued?: CrossrefDateParts;
  published?: CrossrefDateParts;
  'published-print'?: CrossrefDateParts;
  'published-online'?: CrossrefDateParts;
  created?: CrossrefDateParts;
  volume?: string;
  issue?: string;
  page?: string;
  ISSN?: string[];
  'is-referenced-by-count'?: number;
  'references-count'?: number;
  language?: string;
}

export interface CrossrefJournal {
  title: string;
  publisher?: string;
  ISSN?: string[];
  'issn-type'?: Array<{ value: string; type: string }>;
  subjects?: Array<{ name: string; ASJC?: number }>;
  counts?: {
    'total-dois'?: number;
    'current-dois'?: number;
    'backfile-dois'?: number;
  };
  flags?: Record<string, boolean>;
  'last-status-check-time'?: number;
}

export interface CrossrefSingleResponse<T> {
  status: string;
  'message-type': string;
  'message-version': string;
  message: T;
}

export interface CrossrefListMessage<T> {
  'total-results'?: number;
  'items-per-page'?: number;
  query?: { 'search-terms'?: string };
  items: T[];
}

export interface CrossrefListResponse<T> {
  status: string;
  'message-type': string;
  'message-version': string;
  message: CrossrefListMessage<T>;
}

export class CrossrefService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly mailto: string;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    mailto?: string;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.crossref.org').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
    this.mailto = options?.mailto ?? '';
  }

  async getWork(doi: string): Promise<CrossrefWork> {
    const encoded = encodeURIComponent(doi);
    const url = this.buildUrl(`/works/${encoded}`);
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Crossref returned ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as CrossrefSingleResponse<CrossrefWork>;
    return json.message;
  }

  async searchWorks(params: {
    query: string;
    limit?: number;
    filter?: string;
  }): Promise<CrossrefListMessage<CrossrefWork>> {
    const url = this.buildUrl('/works', {
      query: params.query,
      rows: String(params.limit ?? 10),
      ...(params.filter ? { filter: params.filter } : {}),
    });
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Crossref returned ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as CrossrefListResponse<CrossrefWork>;
    return json.message;
  }

  async searchJournals(params: {
    query: string;
    limit?: number;
  }): Promise<CrossrefListMessage<CrossrefJournal>> {
    const url = this.buildUrl('/journals', {
      query: params.query,
      rows: String(params.limit ?? 10),
    });
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Crossref returned ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as CrossrefListResponse<CrossrefJournal>;
    return json.message;
  }

  async getJournal(issn: string): Promise<CrossrefJournal> {
    const encoded = encodeURIComponent(issn);
    const url = this.buildUrl(`/journals/${encoded}`);
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Crossref returned ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as CrossrefSingleResponse<CrossrefJournal>;
    return json.message;
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    if (this.mailto) {
      url.searchParams.set('mailto', this.mailto);
    }
    return url.toString();
  }

  private userAgent(): string {
    if (this.mailto) {
      return `crossref-mcp/1.0 (https://github.com/awesome-mcp-servers; mailto:${this.mailto})`;
    }
    return 'crossref-mcp/1.0 (https://github.com/awesome-mcp-servers)';
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
      throw err;
    }
  }
}
