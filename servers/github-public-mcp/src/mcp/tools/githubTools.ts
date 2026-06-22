import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  GithubService,
  GithubApiError,
  type GithubRepo,
  type GithubUser,
  type GithubIssue,
  type GithubRelease,
  type GithubSearchReposResponse,
} from '../../services/githubService.js';

export const GET_REPO_DEF = {
  name: 'get_repo',
  description:
    "🐙 I'm fetching a GitHub repo\n\nGet metadata for a public GitHub repository (description, stars, forks, language, license, default branch, etc.). Unauthenticated — limited to ~60 requests/hour per IP.",
  keywords: ['github', 'repo', 'repository', 'metadata', 'stars'],
};

export const GET_USER_DEF = {
  name: 'get_user',
  description:
    "🐙 I'm fetching a GitHub user\n\nGet a public GitHub user or organization profile by username (name, bio, location, public repo count, followers). Unauthenticated — limited to ~60 requests/hour per IP.",
  keywords: ['github', 'user', 'profile', 'organization', 'developer'],
};

export const LIST_REPO_ISSUES_DEF = {
  name: 'list_repo_issues',
  description:
    "🐙 I'm listing GitHub issues\n\nList issues for a public repository, filtered by state (open/closed/all). GitHub's API includes pull requests in this list. Unauthenticated — limited to ~60 requests/hour per IP.",
  keywords: ['github', 'issues', 'bug', 'tracker', 'repo'],
};

export const LIST_REPO_RELEASES_DEF = {
  name: 'list_repo_releases',
  description:
    "🐙 I'm listing GitHub releases\n\nList releases for a public repository (tag, name, published date, draft/prerelease flags). Unauthenticated — limited to ~60 requests/hour per IP.",
  keywords: ['github', 'releases', 'tags', 'versions', 'changelog'],
};

export const SEARCH_REPOS_DEF = {
  name: 'search_repos',
  description:
    "🐙 I'm searching GitHub repos\n\nSearch public GitHub repositories with a query (supports GitHub search qualifiers like `language:`, `stars:>100`, `topic:`). Unauthenticated — limited to ~60 requests/hour per IP.",
  keywords: ['github', 'search', 'repository', 'discover', 'find'],
};

export interface GetRepoInput {
  owner: string;
  repo: string | string[];
}

export interface GetUserInput {
  username: string | string[];
}

export interface ListRepoIssuesInput {
  owner: string;
  repo: string | string[];
  state?: 'open' | 'closed' | 'all';
  limit?: number;
}

export interface ListRepoReleasesInput {
  owner: string;
  repo: string | string[];
  limit?: number;
}

export interface SearchReposInput {
  query: string | string[];
  limit?: number;
}

/**
 * Normalize a scalar-or-array input into an array plus a flag telling whether
 * the caller supplied a batch. Single-value callers keep their original
 * behaviour (one result, no batch separators); array callers get one section
 * per item joined by a horizontal rule.
 */
function normalizeToArray<T>(value: T | T[]): { items: T[]; isBatch: boolean } {
  if (Array.isArray(value)) return { items: value, isBatch: true };
  return { items: [value], isBatch: false };
}

/** JSON-Schema fragment for a parameter that accepts a string or string[]. */
function stringOrArraySchema(description: string): object {
  return {
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' }, minItems: 1 },
    ],
    description: `${description} Accepts a single value or an array of values for batch requests.`,
  };
}

const BATCH_SEPARATOR = '\n\n---\n\n';

export class GithubTools {
  private service: GithubService;

  constructor(service?: GithubService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new GithubService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetRepoSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner login (user or organization), e.g. "vercel"',
          },
          repo: stringOrArraySchema('Repository name, e.g. "next.js".'),
        },
        required: ['owner', 'repo'],
      },
    };
  }

  static getGetUserSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          username: stringOrArraySchema(
            'GitHub username or organization login, e.g. "torvalds".'
          ),
        },
        required: ['username'],
      },
    };
  }

  static getListRepoIssuesSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner login',
          },
          repo: stringOrArraySchema('Repository name.'),
          state: {
            type: 'string',
            description: 'Filter by issue state',
            enum: ['open', 'closed', 'all'],
            default: 'open',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of issues to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ['owner', 'repo'],
      },
    };
  }

  static getListRepoReleasesSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner login',
          },
          repo: stringOrArraySchema('Repository name.'),
          limit: {
            type: 'number',
            description: 'Maximum number of releases to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
        },
        required: ['owner', 'repo'],
      },
    };
  }

  static getSearchReposSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema(
            'Search query (supports qualifiers like `language:typescript stars:>1000 topic:cli`).'
          ),
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-50)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
        },
        required: ['query'],
      },
    };
  }

  async executeGetRepo(args: GetRepoInput): Promise<MCPToolCallResult> {
    if (!args.owner || typeof args.owner !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'owner is required and must be a string');
    }
    const { items, isBatch } = normalizeToArray(args.repo);
    if (items.length === 0 || items.some((r) => !r || typeof r !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'repo is required and must be a string or a non-empty array of strings'
      );
    }
    const owner = args.owner;

    const sections = await Promise.all(
      items.map(async (repo) => {
        try {
          const data = await this.service.getRepo(owner, repo);
          return this.formatRepoAsText(data);
        } catch (err) {
          return this.formatErrorSection(err, `Failed to get repo ${owner}/${repo}`);
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetUser(args: GetUserInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.username);
    if (items.length === 0 || items.some((u) => !u || typeof u !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'username is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (username) => {
        try {
          const user = await this.service.getUser(username);
          return this.formatUserAsText(user);
        } catch (err) {
          return this.formatErrorSection(err, `Failed to get user ${username}`);
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeListRepoIssues(args: ListRepoIssuesInput): Promise<MCPToolCallResult> {
    if (!args.owner || typeof args.owner !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'owner is required and must be a string');
    }
    const { items, isBatch } = normalizeToArray(args.repo);
    if (items.length === 0 || items.some((r) => !r || typeof r !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'repo is required and must be a string or a non-empty array of strings'
      );
    }
    if (args.state && !['open', 'closed', 'all'].includes(args.state)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'state must be one of: open, closed, all');
    }
    const owner = args.owner;
    const state = args.state ?? 'open';
    const limit = args.limit ?? 20;

    const sections = await Promise.all(
      items.map(async (repo) => {
        try {
          const issues = await this.service.listRepoIssues({
            owner,
            repo,
            state,
            limit,
          });
          return this.formatIssuesAsText(issues, owner, repo, state);
        } catch (err) {
          return this.formatErrorSection(err, `Failed to list issues for ${owner}/${repo}`);
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeListRepoReleases(args: ListRepoReleasesInput): Promise<MCPToolCallResult> {
    if (!args.owner || typeof args.owner !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'owner is required and must be a string');
    }
    const { items, isBatch } = normalizeToArray(args.repo);
    if (items.length === 0 || items.some((r) => !r || typeof r !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'repo is required and must be a string or a non-empty array of strings'
      );
    }
    const owner = args.owner;
    const limit = args.limit ?? 10;

    const sections = await Promise.all(
      items.map(async (repo) => {
        try {
          const releases = await this.service.listRepoReleases({
            owner,
            repo,
            limit,
          });
          return this.formatReleasesAsText(releases, owner, repo);
        } catch (err) {
          return this.formatErrorSection(err, `Failed to list releases for ${owner}/${repo}`);
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSearchRepos(args: SearchReposInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }
    const limit = args.limit ?? 10;

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const response = await this.service.searchRepos({
            query,
            limit,
          });
          return this.formatSearchReposAsText(response, query);
        } catch (err) {
          return this.formatErrorSection(err, `Failed to search repositories for "${query}"`);
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  private formatErrorSection(err: unknown, prefix: string): string {
    if (err instanceof GithubApiError && err.rateLimited) {
      return `${prefix}: ${err.message}`;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return `${prefix}: ${message}`;
  }

  private formatRepoAsText(repo: GithubRepo): string {
    let text = `# ${repo.full_name}\n\n`;
    if (repo.description) text += `${repo.description}\n\n`;

    const lines: string[] = [];
    if (repo.html_url) lines.push(`URL: ${repo.html_url}`);
    if (repo.homepage) lines.push(`Homepage: ${repo.homepage}`);
    if (repo.language) lines.push(`Language: ${repo.language}`);
    if (repo.default_branch) lines.push(`Default branch: ${repo.default_branch}`);
    if (repo.license?.name) lines.push(`License: ${repo.license.name}`);
    if (repo.visibility) lines.push(`Visibility: ${repo.visibility}`);
    if (repo.archived) lines.push(`Archived: yes`);
    if (repo.fork) lines.push(`Fork: yes`);
    lines.push(`Stars: ${repo.stargazers_count ?? 0}`);
    lines.push(`Forks: ${repo.forks_count ?? 0}`);
    lines.push(`Open issues: ${repo.open_issues_count ?? 0}`);
    if (repo.created_at) lines.push(`Created: ${repo.created_at}`);
    if (repo.updated_at) lines.push(`Updated: ${repo.updated_at}`);
    if (repo.pushed_at) lines.push(`Last push: ${repo.pushed_at}`);
    if (repo.topics && repo.topics.length > 0) {
      lines.push(`Topics: ${repo.topics.join(', ')}`);
    }

    text += lines.join('\n');
    return text.trim();
  }

  private formatUserAsText(user: GithubUser): string {
    let text = `# ${user.name ?? user.login} (@${user.login})\n\n`;
    if (user.bio) text += `${user.bio}\n\n`;

    const lines: string[] = [];
    if (user.type) lines.push(`Type: ${user.type}`);
    if (user.html_url) lines.push(`URL: ${user.html_url}`);
    if (user.company) lines.push(`Company: ${user.company}`);
    if (user.location) lines.push(`Location: ${user.location}`);
    if (user.blog) lines.push(`Blog: ${user.blog}`);
    if (user.email) lines.push(`Email: ${user.email}`);
    if (user.public_repos != null) lines.push(`Public repos: ${user.public_repos}`);
    if (user.public_gists != null) lines.push(`Public gists: ${user.public_gists}`);
    if (user.followers != null) lines.push(`Followers: ${user.followers}`);
    if (user.following != null) lines.push(`Following: ${user.following}`);
    if (user.created_at) lines.push(`Created: ${user.created_at}`);

    text += lines.join('\n');
    return text.trim();
  }

  private formatIssuesAsText(
    issues: GithubIssue[],
    owner: string,
    repo: string,
    state: string
  ): string {
    if (issues.length === 0) {
      return `No ${state} issues found for ${owner}/${repo}.`;
    }

    let text = `Found ${issues.length} ${state} issue(s)/PR(s) for ${owner}/${repo}:\n\n`;
    issues.forEach((issue) => {
      const isPR = issue.pull_request != null;
      const kind = isPR ? 'PR' : 'Issue';
      const author = issue.user?.login ?? 'unknown';
      text += `- [${kind} #${issue.number}] **${issue.title}** (${issue.state})\n`;
      text += `  by @${author}`;
      if (issue.comments != null) text += ` · ${issue.comments} comment(s)`;
      if (issue.created_at) text += ` · created ${issue.created_at}`;
      text += '\n';
      if (issue.labels && issue.labels.length > 0) {
        const labelNames = issue.labels
          .map((l) => (typeof l === 'string' ? l : l.name))
          .filter(Boolean);
        if (labelNames.length > 0) text += `  labels: ${labelNames.join(', ')}\n`;
      }
      if (issue.html_url) text += `  ${issue.html_url}\n`;
      text += '\n';
    });
    return text.trim();
  }

  private formatReleasesAsText(
    releases: GithubRelease[],
    owner: string,
    repo: string
  ): string {
    if (releases.length === 0) {
      return `No releases found for ${owner}/${repo}.`;
    }

    let text = `Found ${releases.length} release(s) for ${owner}/${repo}:\n\n`;
    releases.forEach((rel) => {
      const name = rel.name && rel.name.trim().length > 0 ? rel.name : rel.tag_name;
      const flags: string[] = [];
      if (rel.draft) flags.push('draft');
      if (rel.prerelease) flags.push('prerelease');
      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      text += `- **${name}** (\`${rel.tag_name}\`)${flagStr}\n`;
      if (rel.author?.login) text += `  by @${rel.author.login}`;
      if (rel.published_at) text += ` · published ${rel.published_at}`;
      text += '\n';
      if (rel.html_url) text += `  ${rel.html_url}\n`;
      text += '\n';
    });
    return text.trim();
  }

  private formatSearchReposAsText(
    response: GithubSearchReposResponse,
    query: string
  ): string {
    const items = response.items ?? [];
    if (items.length === 0) {
      return `No repositories found for "${query}".`;
    }

    let text = `Found ${items.length} repo(s) for "${query}"`;
    if (response.total_count != null) {
      text += ` (${response.total_count.toLocaleString()} total)`;
    }
    text += ':\n\n';

    items.forEach((repo, i) => {
      text += `${i + 1}. **${repo.full_name}** — ${repo.stargazers_count ?? 0} stars`;
      if (repo.language) text += ` · ${repo.language}`;
      text += '\n';
      if (repo.description) text += `   ${repo.description}\n`;
      if (repo.html_url) text += `   ${repo.html_url}\n`;
      text += '\n';
    });
    text += 'Use get_repo with owner and repo to fetch full metadata.';
    return text.trim();
  }
}
