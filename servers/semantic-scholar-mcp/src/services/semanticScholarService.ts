export interface S2Author {
  authorId?: string;
  name?: string;
}

export interface S2ExternalIds {
  DOI?: string;
  ArXiv?: string;
  PubMed?: string;
  CorpusId?: number;
}

export interface S2OpenAccessPdf {
  url?: string;
  status?: string;
}

export interface S2Paper {
  paperId?: string;
  title?: string;
  year?: number;
  authors?: S2Author[];
  abstract?: string;
  citationCount?: number;
  referenceCount?: number;
  influentialCitationCount?: number;
  venue?: string;
  externalIds?: S2ExternalIds;
  url?: string;
  openAccessPdf?: S2OpenAccessPdf;
  isOpenAccess?: boolean;
}

export interface S2PaperSearchResponse {
  total?: number;
  offset?: number;
  next?: number;
  data?: S2Paper[];
}

export interface S2CitationEntry {
  contexts?: string[];
  intents?: string[];
  isInfluential?: boolean;
  citingPaper?: S2Paper;
}

export interface S2CitationsResponse {
  offset?: number;
  next?: number;
  data?: S2CitationEntry[];
}

export const DEFAULT_PAPER_FIELDS =
  'paperId,title,year,authors,abstract,citationCount,referenceCount,influentialCitationCount,venue,externalIds,url,openAccessPdf,isOpenAccess';

export const CITING_PAPER_FIELDS =
  'paperId,title,year,authors,citationCount,venue,externalIds,url';

export class SemanticScholarService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly apiKey: string;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    apiKey?: string;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.semanticscholar.org/graph/v1').replace(
      /\/$/,
      ''
    );
    this.timeout = options?.timeout ?? 20000;
    this.apiKey = options?.apiKey ?? '';
  }

  async searchPapers(params: {
    query: string;
    limit?: number;
    fields?: string;
  }): Promise<S2PaperSearchResponse> {
    const url = this.buildUrl('/paper/search', {
      query: params.query,
      limit: String(params.limit ?? 10),
      fields: params.fields ?? DEFAULT_PAPER_FIELDS,
    });
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw await this.errorFromResponse(res);
    }
    return (await res.json()) as S2PaperSearchResponse;
  }

  async getPaper(paperId: string, fields?: string): Promise<S2Paper> {
    const encoded = encodeURIComponent(paperId.trim());
    const url = this.buildUrl(`/paper/${encoded}`, {
      fields: fields ?? DEFAULT_PAPER_FIELDS,
    });
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw await this.errorFromResponse(res);
    }
    return (await res.json()) as S2Paper;
  }

  async getPapersBatch(ids: string[], fields?: string): Promise<(S2Paper | null)[]> {
    const url = this.buildUrl('/paper/batch', {
      fields: fields ?? DEFAULT_PAPER_FIELDS,
    });
    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids.map((id) => id.trim()) }),
    });
    if (!res.ok) {
      throw await this.errorFromResponse(res);
    }
    return (await res.json()) as (S2Paper | null)[];
  }

  async getPaperCitations(params: {
    paperId: string;
    limit?: number;
    fields?: string;
  }): Promise<S2CitationsResponse> {
    const encoded = encodeURIComponent(params.paperId.trim());
    const citingFields = (params.fields ?? CITING_PAPER_FIELDS)
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => `citingPaper.${f}`)
      .join(',');
    const url = this.buildUrl(`/paper/${encoded}/citations`, {
      limit: String(params.limit ?? 10),
      fields: `contexts,intents,isInfluential,${citingFields}`,
    });
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw await this.errorFromResponse(res);
    }
    return (await res.json()) as S2CitationsResponse;
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'semantic-scholar-mcp/1.0 (https://github.com/awesome-mcp-servers)',
    };
    if (this.apiKey) {
      h['x-api-key'] = this.apiKey;
    }
    return h;
  }

  private async errorFromResponse(res: Response): Promise<Error> {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string; code?: string };
      if (body.message) {
        detail = body.message;
        if (body.code) detail = `[${body.code}] ${detail}`;
      }
    } catch {
      // ignore parse errors
    }
    return new Error(`Semantic Scholar API: ${detail}`);
  }

  private async fetchWithTimeout(
    url: string,
    init?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...this.headers(),
          ...(init?.headers as Record<string, string> | undefined),
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Semantic Scholar API request timed out after ${this.timeout}ms`);
      }
      throw err;
    }
  }
}
