export interface WikipediaSearchResult {
  pageid: number;
  title: string;
  snippet: string;
  size?: number;
  wordcount?: number;
}

export interface WikipediaSearchResponse {
  query?: {
    search?: WikipediaSearchResult[];
    searchinfo?: { totalhits?: number };
  };
}

export interface WikipediaRestSummary {
  type?: string;
  title: string;
  extract?: string;
  extract_html?: string;
  description?: string;
  thumbnail?: { source: string; width?: number; height?: number };
  content_urls?: {
    desktop?: { page?: string };
    mobile?: { page?: string };
  };
}

export interface MediaWikiExtractPage {
  pageid: number;
  ns: number;
  title: string;
  extract?: string;
}

export interface MediaWikiExtractResponse {
  query?: {
    pages?: Record<string, MediaWikiExtractPage>;
  };
}

export class WikipediaService {
  private readonly restBase: string;
  private readonly mediaWikiBase: string;
  private readonly timeout: number;

  constructor(options?: {
    restBase?: string;
    mediaWikiBase?: string;
    timeout?: number;
  }) {
    this.restBase = options?.restBase ?? 'https://en.wikipedia.org/api/rest_v1';
    this.mediaWikiBase = options?.mediaWikiBase ?? 'https://en.wikipedia.org/w/api.php';
    this.timeout = options?.timeout ?? 15000;
  }

  async search(params: { query: string; limit?: number }): Promise<WikipediaSearchResponse> {
    const url = new URL(this.mediaWikiBase);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', params.query);
    url.searchParams.set('srlimit', String(params.limit ?? 10));
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const res = await this.fetchWithTimeout(url.toString());
    return (await res.json()) as WikipediaSearchResponse;
  }

  async getRestSummary(title: string): Promise<WikipediaRestSummary | null> {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `${this.restBase}/page/summary/${encoded}`;

    const res = await this.fetchWithTimeout(url);
    if (!res.ok) return null;
    return (await res.json()) as WikipediaRestSummary;
  }

  async getExtract(params: {
    title: string;
    introOnly?: boolean;
    maxChars?: number;
  }): Promise<MediaWikiExtractResponse> {
    const url = new URL(this.mediaWikiBase);
    url.searchParams.set('action', 'query');
    url.searchParams.set('prop', 'extracts');
    url.searchParams.set('explaintext', '1');
    url.searchParams.set('titles', params.title);
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    if (params.introOnly !== false) {
      url.searchParams.set('exintro', '1');
    }
    if (params.maxChars != null) {
      url.searchParams.set('exchars', String(params.maxChars));
    }

    const res = await this.fetchWithTimeout(url.toString());
    return (await res.json()) as MediaWikiExtractResponse;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Wikipedia-MCP-Server/1.0 (https://github.com/awesome-mcp-servers)',
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
