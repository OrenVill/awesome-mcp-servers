export interface MdnSearchDocument {
  title: string;
  slug: string;
  summary?: string;
  score?: number;
  mdn_url?: string;
  locale?: string;
}

export interface MdnSearchResponse {
  documents?: MdnSearchDocument[];
  metadata?: {
    total?: { value: number };
    took_ms?: number;
  };
}

export interface MdnBodySection {
  type: string;
  value: {
    id?: string;
    title?: string;
    content?: string;
    isH3?: boolean;
    query?: string;
    support?: Record<string, MdnSupportEntry | MdnSupportEntry[]>;
    [key: string]: unknown;
  };
}

export interface MdnSupportEntry {
  version_added?: string | boolean | null;
  version_removed?: string | boolean | null;
  notes?: string | string[];
  partial_implementation?: boolean;
  flags?: Array<{ type?: string; name?: string; value_to_set?: string }>;
  prefix?: string;
  alternative_name?: string;
}

export interface MdnDoc {
  title: string;
  mdn_url?: string;
  summary?: string;
  body?: MdnBodySection[];
  locale?: string;
  popularity?: number;
}

export interface MdnDocResponse {
  doc?: MdnDoc;
}

export interface BrowserSupport {
  browser: string;
  version_added: string | boolean | null;
  version_removed?: string | boolean | null;
  notes?: string;
}

export class MdnService {
  private readonly searchBase: string;
  private readonly docsBase: string;
  private readonly timeout: number;

  constructor(options?: {
    searchBase?: string;
    docsBase?: string;
    timeout?: number;
  }) {
    this.searchBase = options?.searchBase ?? 'https://developer.mozilla.org/api/v1/search';
    this.docsBase = options?.docsBase ?? 'https://developer.mozilla.org';
    this.timeout = options?.timeout ?? 15000;
  }

  async search(params: {
    query: string;
    locale?: string;
    limit?: number;
  }): Promise<MdnSearchResponse> {
    const url = new URL(this.searchBase);
    url.searchParams.set('q', params.query);
    url.searchParams.set('locale', params.locale ?? 'en-US');

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`MDN search returned ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as MdnSearchResponse;

    const limit = params.limit ?? 10;
    if (data.documents && data.documents.length > limit) {
      data.documents = data.documents.slice(0, limit);
    }
    return data;
  }

  async getDoc(params: { slug: string; locale?: string }): Promise<MdnDoc | null> {
    const locale = params.locale ?? 'en-US';
    const slug = params.slug.replace(/^\/+|\/+$/g, '');
    const url = `${this.docsBase}/${locale}/docs/${slug}/index.json`;

    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`MDN doc fetch returned ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as MdnDocResponse;
    return data.doc ?? null;
  }

  async getBrowserCompat(params: {
    slug: string;
    locale?: string;
  }): Promise<BrowserSupport[]> {
    const doc = await this.getDoc(params);
    if (!doc?.body) return [];

    const compatSections = doc.body.filter(
      (s) => s.type === 'browser_compatibility'
    );
    const out: BrowserSupport[] = [];

    for (const section of compatSections) {
      const support = section.value?.support;
      if (!support || typeof support !== 'object') continue;

      for (const [browser, raw] of Object.entries(support)) {
        const entries = Array.isArray(raw) ? raw : [raw];
        for (const entry of entries) {
          if (!entry) continue;
          const item: BrowserSupport = {
            browser,
            version_added:
              entry.version_added === undefined ? null : entry.version_added,
          };
          if (entry.version_removed != null) {
            item.version_removed = entry.version_removed;
          }
          if (entry.notes) {
            item.notes = Array.isArray(entry.notes)
              ? entry.notes.join(' ')
              : entry.notes;
          }
          out.push(item);
        }
      }
    }

    return out;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'mdn-compat-mcp/1.0 (https://github.com/awesome-mcp-servers)',
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
