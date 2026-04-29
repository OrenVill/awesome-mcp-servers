export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  owner?: { login: string; html_url?: string };
  html_url?: string;
  description?: string | null;
  fork?: boolean;
  language?: string | null;
  stargazers_count?: number;
  watchers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  license?: { name?: string; spdx_id?: string } | null;
  topics?: string[];
  default_branch?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  homepage?: string | null;
  archived?: boolean;
  disabled?: boolean;
  visibility?: string;
}

export interface GithubUser {
  login: string;
  id: number;
  type?: string;
  name?: string | null;
  company?: string | null;
  blog?: string | null;
  location?: string | null;
  bio?: string | null;
  email?: string | null;
  public_repos?: number;
  public_gists?: number;
  followers?: number;
  following?: number;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GithubIssue {
  number: number;
  title: string;
  state: string;
  user?: { login: string };
  labels?: Array<{ name: string } | string>;
  comments?: number;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
  pull_request?: unknown;
  body?: string | null;
}

export interface GithubRelease {
  id: number;
  tag_name: string;
  name?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  author?: { login: string };
  published_at?: string | null;
  created_at?: string;
  html_url?: string;
  body?: string | null;
}

export interface GithubSearchReposResponse {
  total_count: number;
  incomplete_results?: boolean;
  items: GithubRepo[];
}

export class GithubApiError extends Error {
  status: number;
  rateLimited: boolean;

  constructor(message: string, status: number, rateLimited = false) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

export class GithubService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://api.github.com';
    this.timeout = options?.timeout ?? 15000;
  }

  async getRepo(owner: string, repo: string): Promise<GithubRepo> {
    const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    return this.fetchJson<GithubRepo>(path);
  }

  async getUser(username: string): Promise<GithubUser> {
    const path = `/users/${encodeURIComponent(username)}`;
    return this.fetchJson<GithubUser>(path);
  }

  async listRepoIssues(params: {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
    limit?: number;
  }): Promise<GithubIssue[]> {
    const { owner, repo } = params;
    const state = params.state ?? 'open';
    const perPage = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const url = new URL(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      this.baseUrl
    );
    url.searchParams.set('state', state);
    url.searchParams.set('per_page', String(perPage));
    return this.fetchJson<GithubIssue[]>(url.pathname + url.search);
  }

  async listRepoReleases(params: {
    owner: string;
    repo: string;
    limit?: number;
  }): Promise<GithubRelease[]> {
    const { owner, repo } = params;
    const perPage = Math.min(Math.max(params.limit ?? 10, 1), 100);
    const url = new URL(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`,
      this.baseUrl
    );
    url.searchParams.set('per_page', String(perPage));
    return this.fetchJson<GithubRelease[]>(url.pathname + url.search);
  }

  async searchRepos(params: {
    query: string;
    limit?: number;
  }): Promise<GithubSearchReposResponse> {
    const perPage = Math.min(Math.max(params.limit ?? 10, 1), 50);
    const url = new URL('/search/repositories', this.baseUrl);
    url.searchParams.set('q', params.query);
    url.searchParams.set('per_page', String(perPage));
    return this.fetchJson<GithubSearchReposResponse>(url.pathname + url.search);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'github-public-mcp/1.0 (https://github.com/awesome-mcp-servers)',
        },
      });
      clearTimeout(id);

      if (!res.ok) {
        const remaining = res.headers.get('x-ratelimit-remaining');
        if (res.status === 403 && remaining === '0') {
          const reset = res.headers.get('x-ratelimit-reset');
          let resetMsg = '';
          if (reset) {
            const resetDate = new Date(parseInt(reset, 10) * 1000);
            if (!Number.isNaN(resetDate.getTime())) {
              resetMsg = ` Resets at ${resetDate.toISOString()}.`;
            }
          }
          throw new GithubApiError(
            `GitHub rate limit hit (60/hr unauthenticated).${resetMsg}`,
            res.status,
            true
          );
        }

        let detail = '';
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) detail = `: ${body.message}`;
        } catch {
          // ignore non-JSON error bodies
        }
        throw new GithubApiError(
          `GitHub API ${res.status} ${res.statusText}${detail}`,
          res.status
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof GithubApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new GithubApiError(`Request timed out after ${this.timeout}ms`, 0);
      }
      throw err;
    }
  }
}
