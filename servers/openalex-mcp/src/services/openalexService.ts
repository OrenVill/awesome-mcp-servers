export interface OpenAlexAuthorRef {
  id?: string;
  display_name?: string;
  orcid?: string | null;
}

export interface OpenAlexInstitution {
  display_name?: string;
  country_code?: string;
}

export interface OpenAlexAuthorship {
  author?: OpenAlexAuthorRef;
  institutions?: OpenAlexInstitution[];
  is_corresponding?: boolean;
}

export interface OpenAlexSource {
  id?: string;
  display_name?: string;
  issn_l?: string | null;
  type?: string;
}

export interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string;
  publication_year?: number | null;
  publication_date?: string | null;
  type?: string;
  cited_by_count?: number;
  is_retracted?: boolean;
  is_paratext?: boolean;
  open_access?: {
    is_oa?: boolean;
    oa_status?: string | null;
    oa_url?: string | null;
  };
  primary_location?: {
    source?: OpenAlexSource | null;
    landing_page_url?: string | null;
    pdf_url?: string | null;
  };
  authorships?: OpenAlexAuthorship[];
  abstract_inverted_index?: Record<string, number[]> | null;
  ids?: {
    openalex?: string;
    doi?: string;
    pmid?: string;
    pmcid?: string;
  };
}

export interface OpenAlexAuthor {
  id: string;
  display_name?: string;
  orcid?: string | null;
  works_count?: number;
  cited_by_count?: number;
  h_index?: number;
  i10_index?: number;
  last_known_institutions?: OpenAlexInstitution[];
  ids?: {
    openalex?: string;
    orcid?: string;
    scopus?: string;
    twitter?: string;
    wikipedia?: string;
  };
  summary_stats?: {
    h_index?: number;
    i10_index?: number;
    '2yr_mean_citedness'?: number;
  };
}

export interface OpenAlexListMeta {
  count?: number;
  per_page?: number;
  page?: number;
}

export interface OpenAlexListResponse<T> {
  meta?: OpenAlexListMeta;
  results: T[];
}

export class OpenAlexService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly mailto: string;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    mailto?: string;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.openalex.org').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
    this.mailto = options?.mailto ?? '';
  }

  async getWork(id: string): Promise<OpenAlexWork> {
    const workId = normalizeWorkId(id);
    const url = this.buildUrl(`/works/${encodeOpenAlexPathSegment(workId)}`);
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`OpenAlex returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as OpenAlexWork;
  }

  async searchWorks(params: {
    query: string;
    perPage?: number;
  }): Promise<OpenAlexListResponse<OpenAlexWork>> {
    const perPage = params.perPage ?? 10;
    const url = this.buildUrl('/works', {
      search: params.query,
      per_page: String(perPage),
    });
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`OpenAlex returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as OpenAlexListResponse<OpenAlexWork>;
  }

  async getAuthor(id: string): Promise<OpenAlexAuthor> {
    const authorId = normalizeAuthorId(id);
    const url = this.buildUrl(`/authors/${encodeOpenAlexPathSegment(authorId)}`);
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`OpenAlex returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as OpenAlexAuthor;
  }

  async searchAuthors(params: {
    query: string;
    perPage?: number;
  }): Promise<OpenAlexListResponse<OpenAlexAuthor>> {
    const perPage = params.perPage ?? 10;
    const url = this.buildUrl('/authors', {
      search: params.query,
      per_page: String(perPage),
    });
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`OpenAlex returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as OpenAlexListResponse<OpenAlexAuthor>;
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
      return `openalex-mcp/1.0 (https://github.com/awesome-mcp-servers; mailto:${this.mailto})`;
    }
    return 'openalex-mcp/1.0 (https://github.com/awesome-mcp-servers)';
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

/** Encode a path segment that may contain slashes (e.g. https://doi.org/...) */
function encodeOpenAlexPathSegment(id: string): string {
  if (id.includes('://')) {
    return encodeURIComponent(id);
  }
  return encodeURIComponent(id);
}

export function normalizeWorkId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (/^10\.\d{4,}\/\S+/i.test(trimmed)) {
    return `https://doi.org/${trimmed}`;
  }

  if (/^W\d+$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return trimmed;
}

export function normalizeAuthorId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (/^A\d+$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return trimmed;
}

export function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null | undefined
): string | undefined {
  if (!invertedIndex || Object.keys(invertedIndex).length === 0) {
    return undefined;
  }

  const positions: Array<{ word: string; pos: number }> = [];
  for (const [word, indices] of Object.entries(invertedIndex)) {
    for (const pos of indices) {
      positions.push({ word, pos });
    }
  }
  positions.sort((a, b) => a.pos - b.pos);
  const text = positions.map((p) => p.word).join(' ').trim();
  return text.length > 0 ? text : undefined;
}
