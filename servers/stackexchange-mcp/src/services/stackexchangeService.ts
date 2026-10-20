export interface StackExchangeOwner {
  display_name?: string;
  reputation?: number;
  user_id?: number;
  profile_image?: string;
  link?: string;
}

export interface StackExchangeQuestion {
  question_id: number;
  title?: string;
  link?: string;
  score?: number;
  view_count?: number;
  answer_count?: number;
  is_answered?: boolean;
  tags?: string[];
  creation_date?: number;
  last_activity_date?: number;
  body_markdown?: string;
  body?: string;
  owner?: StackExchangeOwner;
  accepted_answer_id?: number;
}

export interface StackExchangeTag {
  name: string;
  count?: number;
  is_moderator_only?: boolean;
  is_required?: boolean;
  has_synonyms?: boolean;
}

export interface StackExchangeListResponse<T> {
  items: T[];
  has_more?: boolean;
  quota_max?: number;
  quota_remaining?: number;
  total?: number;
  page?: number;
  page_size?: number;
}

export class StackExchangeApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'StackExchangeApiError';
  }
}

export class StackExchangeService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly defaultSite: string;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    defaultSite?: string;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.stackexchange.com/2.3').replace(
      /\/$/,
      ''
    );
    this.timeout = options?.timeout ?? 15000;
    this.defaultSite = options?.defaultSite ?? 'stackoverflow';
  }

  resolveSite(site?: string): string {
    const s = site?.trim();
    return s && s.length > 0 ? s : this.defaultSite;
  }

  async searchQuestions(params: {
    query: string;
    site?: string;
    pagesize?: number;
  }): Promise<StackExchangeListResponse<StackExchangeQuestion>> {
    const pagesize = Math.min(Math.max(params.pagesize ?? 15, 1), 100);
    const url = this.buildUrl('/search/advanced', {
      q: params.query,
      site: this.resolveSite(params.site),
      pagesize: String(pagesize),
      order: 'desc',
      sort: 'relevance',
    });
    return this.fetchList<StackExchangeQuestion>(url);
  }

  async getQuestions(params: {
    ids: number[];
    site?: string;
  }): Promise<StackExchangeListResponse<StackExchangeQuestion>> {
    if (params.ids.length === 0) {
      throw new StackExchangeApiError('At least one question ID is required');
    }
    const idList = params.ids.join(';');
    const url = this.buildUrl(`/questions/${idList}`, {
      site: this.resolveSite(params.site),
    });
    return this.fetchList<StackExchangeQuestion>(url);
  }

  async searchTags(params: {
    inname: string;
    site?: string;
  }): Promise<StackExchangeListResponse<StackExchangeTag>> {
    const url = this.buildUrl('/tags', {
      inname: params.inname,
      site: this.resolveSite(params.site),
      order: 'desc',
      sort: 'popular',
      pagesize: '30',
    });
    return this.fetchList<StackExchangeTag>(url);
  }

  private buildUrl(path: string, query: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async fetchList<T>(url: string): Promise<StackExchangeListResponse<T>> {
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { error_message?: string };
        if (body.error_message) detail = body.error_message;
      } catch {
        /* ignore */
      }
      throw new StackExchangeApiError(
        `Stack Exchange API returned ${res.status}: ${detail}`,
        res.status
      );
    }
    return (await res.json()) as StackExchangeListResponse<T>;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'stackexchange-mcp/1.0 (awesome-mcp-servers)',
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new StackExchangeApiError(`Request timed out after ${this.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
