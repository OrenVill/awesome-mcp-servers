export interface PypiProjectInfo {
  author?: string | null;
  author_email?: string | null;
  bugtrack_url?: string | null;
  classifiers?: string[];
  description?: string | null;
  description_content_type?: string | null;
  docs_url?: string | null;
  download_url?: string | null;
  downloads?: { last_day?: number; last_month?: number; last_week?: number };
  home_page?: string | null;
  keywords?: string | null;
  license?: string | null;
  maintainer?: string | null;
  maintainer_email?: string | null;
  name?: string;
  package_url?: string | null;
  platform?: string | null;
  project_url?: string | null;
  project_urls?: Record<string, string> | null;
  release_url?: string | null;
  requires_dist?: string[];
  requires_python?: string | null;
  summary?: string | null;
  version?: string;
  yanked?: boolean;
  yanked_reason?: string | null;
  [key: string]: unknown;
}

export interface PypiPackageJson {
  info: PypiProjectInfo;
  releases?: Record<string, unknown[]>;
  urls?: Array<{
    comment_text?: string;
    digests?: Record<string, string>;
    downloads?: number;
    filename?: string;
    has_sig?: boolean;
    md5_digest?: string;
    packagetype?: string;
    python_version?: string;
    requires_python?: string | null;
    size?: number;
    upload_time?: string;
    upload_time_iso_8601?: string;
    url?: string;
    yanked?: boolean;
    yanked_reason?: string | null;
  }>;
  vulnerabilities?: unknown[];
}

export interface PypiSearchHit {
  name: string;
  summary?: string;
  version?: string;
  score: number;
}

export interface PypiSearchResult {
  query: string;
  totalMatches: number;
  packages: PypiSearchHit[];
}

interface SimpleIndexJson {
  meta?: { '_last-serial'?: number };
  projects: Array<{ name: string }>;
}

export class PypiApiError extends Error {
  status: number;
  notFound: boolean;

  constructor(message: string, status: number, notFound = false) {
    super(message);
    this.name = 'PypiApiError';
    this.status = status;
    this.notFound = notFound;
  }
}

const USER_AGENT = 'pypi-mcp/1.0 (https://github.com/awesome-mcp-servers)';

export class PypiService {
  private readonly baseUrl: string;
  private readonly simpleIndexUrl: string;
  private readonly timeout: number;
  private simpleIndexNames: string[] | null = null;
  private simpleIndexLoadPromise: Promise<void> | null = null;

  constructor(options?: {
    baseUrl?: string;
    simpleIndexUrl?: string;
    timeout?: number;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://pypi.org').replace(/\/$/, '');
    this.simpleIndexUrl = (
      options?.simpleIndexUrl ?? `${this.baseUrl}/simple/`
    ).replace(/\/$/, '') + '/';
    this.timeout = options?.timeout ?? 30000;
  }

  async getPackage(name: string): Promise<PypiPackageJson> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new PypiApiError('Package name is required', 0);
    }
    const normalized = trimmed.toLowerCase();
    const path = `/pypi/${encodeURIComponent(normalized)}/json`;
    return this.fetchJson<PypiPackageJson>(path, {
      Accept: 'application/json',
    });
  }

  /**
   * Search package names via the PEP 691 Simple Index JSON API (cached in memory).
   * PyPI's HTML/XML-RPC search endpoints are not available for automated clients.
   */
  async searchPackages(query: string, limit = 20): Promise<PypiSearchResult> {
    const q = query.trim();
    if (!q) {
      throw new PypiApiError('Search query is required', 0);
    }

    await this.ensureSimpleIndexLoaded();
    const needle = q.toLowerCase();
    const names = this.simpleIndexNames ?? [];

    const exact: string[] = [];
    const prefix: string[] = [];
    const substring: string[] = [];

    for (const name of names) {
      const lower = name.toLowerCase();
      if (lower === needle) {
        exact.push(name);
      } else if (lower.startsWith(needle)) {
        prefix.push(name);
      } else if (lower.includes(needle)) {
        substring.push(name);
      }
    }

    prefix.sort((a, b) => a.localeCompare(b));
    substring.sort((a, b) => a.localeCompare(b));

    const ranked = [...exact, ...prefix, ...substring];
    const totalMatches = ranked.length;
    const selected = ranked.slice(0, limit);

    const packages = await Promise.all(
      selected.map(async (name, index) => {
        const tierScore =
          index < exact.length
            ? 3
            : index < exact.length + prefix.length
              ? 2
              : 1;
        try {
          const doc = await this.getPackage(name);
          return {
            name: doc.info.name ?? name,
            summary: doc.info.summary ?? undefined,
            version: doc.info.version ?? undefined,
            score: tierScore,
          } satisfies PypiSearchHit;
        } catch {
          return {
            name,
            score: tierScore,
          } satisfies PypiSearchHit;
        }
      })
    );

    return {
      query: q,
      totalMatches,
      packages,
    };
  }

  async preloadSimpleIndex(): Promise<void> {
    await this.ensureSimpleIndexLoaded();
  }

  private async ensureSimpleIndexLoaded(): Promise<void> {
    if (this.simpleIndexNames) return;
    if (!this.simpleIndexLoadPromise) {
      this.simpleIndexLoadPromise = this.loadSimpleIndex();
    }
    await this.simpleIndexLoadPromise;
  }

  private async loadSimpleIndex(): Promise<void> {
    const url = this.simpleIndexUrl;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.pypi.simple.v1+json',
          'User-Agent': USER_AGENT,
        },
      });
      clearTimeout(id);

      if (!res.ok) {
        throw new PypiApiError(
          `PyPI simple index ${res.status} ${res.statusText}`,
          res.status
        );
      }

      const body = (await res.json()) as SimpleIndexJson;
      if (!Array.isArray(body.projects)) {
        throw new PypiApiError('Invalid simple index response', 0);
      }
      this.simpleIndexNames = body.projects.map((p) => p.name);
    } catch (err) {
      clearTimeout(id);
      this.simpleIndexLoadPromise = null;
      if (err instanceof PypiApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PypiApiError(`Request timed out after ${this.timeout}ms`, 0);
      }
      throw err;
    }
  }

  private async fetchJson<T>(
    path: string,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          ...extraHeaders,
        },
      });
      clearTimeout(id);

      if (!res.ok) {
        if (res.status === 404) {
          throw new PypiApiError('Package not found', res.status, true);
        }
        let detail = '';
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) detail = `: ${body.message}`;
        } catch {
          // ignore non-JSON error bodies
        }
        throw new PypiApiError(
          `PyPI ${res.status} ${res.statusText}${detail}`,
          res.status
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof PypiApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PypiApiError(`Request timed out after ${this.timeout}ms`, 0);
      }
      throw err;
    }
  }
}
