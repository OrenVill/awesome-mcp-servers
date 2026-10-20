export interface WikidataSearchHit {
  id: string;
  title?: string;
  label?: string;
  description?: string;
  url?: string;
  concepturi?: string;
  display?: {
    label?: { value: string; language: string };
    description?: { value: string; language: string };
  };
}

export interface WbSearchEntitiesResponse {
  search?: WikidataSearchHit[];
  'search-continue'?: number;
  success?: number;
  error?: { code: string; info: string };
}

export interface WikidataTermValue {
  language: string;
  value: string;
}

export interface WikidataEntity {
  id: string;
  type?: string;
  labels?: Record<string, WikidataTermValue>;
  descriptions?: Record<string, WikidataTermValue>;
  aliases?: Record<string, WikidataTermValue[]>;
  claims?: Record<string, unknown[]>;
  sitelinks?: Record<string, { site: string; title: string; url?: string }>;
  missing?: '';
}

export interface WbGetEntitiesResponse {
  entities?: Record<string, WikidataEntity>;
  success?: number;
  error?: { code: string; info: string };
}

const MAX_IDS_PER_REQUEST = 50;

export class WikidataService {
  private readonly mediaWikiBase: string;
  private readonly timeout: number;

  constructor(options?: { mediaWikiBase?: string; timeout?: number }) {
    this.mediaWikiBase =
      options?.mediaWikiBase ?? 'https://www.wikidata.org/w/api.php';
    this.timeout = options?.timeout ?? 15000;
  }

  async searchEntities(params: {
    search: string;
    language?: string;
    limit?: number;
  }): Promise<WbSearchEntitiesResponse> {
    const url = new URL(this.mediaWikiBase);
    url.searchParams.set('action', 'wbsearchentities');
    url.searchParams.set('search', params.search);
    url.searchParams.set('language', params.language ?? 'en');
    url.searchParams.set('limit', String(params.limit ?? 10));
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const res = await this.fetchWithTimeout(url.toString());
    const body = (await res.json()) as WbSearchEntitiesResponse;
    if (!res.ok) {
      throw new Error(body.error?.info ?? `HTTP ${res.status}`);
    }
    if (body.error) {
      throw new Error(body.error.info);
    }
    return body;
  }

  async getEntities(params: {
    ids: string[];
    languages?: string[];
    props?: string[];
  }): Promise<WbGetEntitiesResponse> {
    const normalized = params.ids.map((id) => this.normalizeEntityId(id));
    const unique = [...new Set(normalized)];

    if (unique.length === 0) {
      return { entities: {} };
    }

    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += MAX_IDS_PER_REQUEST) {
      chunks.push(unique.slice(i, i + MAX_IDS_PER_REQUEST));
    }

    const merged: Record<string, WikidataEntity> = {};
    for (const chunk of chunks) {
      const url = new URL(this.mediaWikiBase);
      url.searchParams.set('action', 'wbgetentities');
      url.searchParams.set('ids', chunk.join('|'));
      url.searchParams.set(
        'props',
        (params.props ?? ['labels', 'descriptions', 'aliases', 'claims', 'sitelinks']).join('|')
      );
      const langs = params.languages ?? ['en'];
      url.searchParams.set('languages', langs.join('|'));
      url.searchParams.set('format', 'json');
      url.searchParams.set('origin', '*');

      const res = await this.fetchWithTimeout(url.toString());
      const body = (await res.json()) as WbGetEntitiesResponse;
      if (!res.ok) {
        throw new Error(body.error?.info ?? `HTTP ${res.status}`);
      }
      if (body.error) {
        throw new Error(body.error.info);
      }
      Object.assign(merged, body.entities ?? {});
    }

    return { entities: merged };
  }

  normalizeEntityId(id: string): string {
    const trimmed = id.trim();
    if (/^q\d+$/i.test(trimmed)) {
      return 'Q' + trimmed.slice(1);
    }
    return trimmed;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Wikidata-MCP-Server/1.0 (https://github.com/awesome-mcp-servers)',
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
