import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  PypiService,
  PypiApiError,
  type PypiPackageJson,
  type PypiSearchResult,
} from '../../services/pypiService.js';

export const GET_PACKAGE_DEF = {
  name: 'get_package',
  description:
    "🐍 I'm fetching PyPI package metadata\n\nGet metadata for a Python package from pypi.org (latest version, summary, license, requires-python, project URLs). Pass `name` as a string or `names` as an array to fetch several packages in one call.",
  keywords: ['pypi', 'python', 'package', 'pip', 'metadata', 'version', 'registry'],
};

export const SEARCH_PACKAGES_DEF = {
  name: 'search_packages',
  description:
    "🔍 I'm searching PyPI package names\n\nSearch PyPI by matching against the official Simple Index (PEP 691 JSON). The index is cached after the first search. Optional `limit` (1–100, default 20) caps how many matches are returned with metadata.",
  keywords: ['pypi', 'python', 'search', 'find', 'package', 'pip', 'discover'],
};

export interface GetPackageInput {
  name?: string | string[];
  names?: string[];
}

export interface SearchPackagesInput {
  query: string;
  limit?: number;
}

const BATCH_SEPARATOR = '\n\n---\n\n';

function resolvePackageNames(args: GetPackageInput): string[] {
  const fromNames = args.names?.filter((n) => typeof n === 'string' && n.trim());
  if (fromNames?.length) return fromNames.map((n) => n.trim());
  if (Array.isArray(args.name)) {
    return args.name
      .filter((n) => typeof n === 'string' && n.trim())
      .map((n) => n.trim());
  }
  if (args.name && typeof args.name === 'string' && args.name.trim()) {
    return [args.name.trim()];
  }
  return [];
}

function stringOrArraySchema(description: string): object {
  return {
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' }, minItems: 1 },
    ],
    description: `${description} Accepts a single value or an array of values for batch requests.`,
  };
}

export class PypiTools {
  private service: PypiService;
  private defaultSearchLimit: number;

  constructor(service?: PypiService, defaultSearchLimit?: number) {
    const api = getConfig().api;
    this.defaultSearchLimit = defaultSearchLimit ?? api.searchMaxResults;
    this.service =
      service ??
      new PypiService({
        baseUrl: api.baseUrl,
        simpleIndexUrl: api.simpleIndexUrl,
        timeout: api.timeoutMs,
      });
  }

  static getGetPackageSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: stringOrArraySchema('PyPI project name, e.g. "requests".'),
          names: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description:
              'Alternative batch field: list of PyPI project names (same as passing an array to `name`).',
          },
        },
      },
    };
  }

  static getSearchPackagesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search string matched against PyPI project names.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1–100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ['query'],
      },
    };
  }

  private clampLimit(limit: number | undefined): number {
    if (limit === undefined || Number.isNaN(limit)) return this.defaultSearchLimit;
    return Math.min(100, Math.max(1, Math.floor(limit)));
  }

  formatPackageAsText(doc: PypiPackageJson, requestedName: string): string {
    const info = doc.info;
    const pkgName = info.name ?? requestedName;
    const lines: string[] = [`# ${pkgName}`];

    const summary = info.summary ?? info.description;
    if (summary) lines.push('', summary);

    if (info.version) lines.push('', `**Latest:** ${info.version}`);

    if (info.license) lines.push(`**License:** ${info.license}`);

    if (info.requires_python) {
      lines.push(`**Requires-Python:** ${info.requires_python}`);
    }

    const home =
      info.project_urls?.Homepage ??
      info.home_page ??
      info.package_url ??
      undefined;
    if (home) lines.push(`**Homepage:** ${home}`);

    if (info.project_urls && Object.keys(info.project_urls).length) {
      const urls = Object.entries(info.project_urls)
        .slice(0, 6)
        .map(([label, url]) => `${label}: ${url}`);
      if (urls.length) {
        lines.push('', '**Project URLs:**', ...urls.map((u) => `- ${u}`));
      }
    }

    if (info.keywords) {
      lines.push(`**Keywords:** ${info.keywords}`);
    }

    if (info.author) lines.push(`**Author:** ${info.author}`);
    if (info.maintainer) lines.push(`**Maintainer:** ${info.maintainer}`);

    if (info.requires_dist?.length) {
      const deps = info.requires_dist.slice(0, 12).join(', ');
      const extra =
        info.requires_dist.length > 12
          ? ` (+${info.requires_dist.length - 12} more)`
          : '';
      lines.push(`**Dependencies:** ${deps}${extra}`);
    }

    const releaseCount = doc.releases ? Object.keys(doc.releases).length : 0;
    if (releaseCount > 0) {
      lines.push(`**Releases on PyPI:** ${releaseCount}`);
    }

    const latestFile = doc.urls?.find((u) => u.packagetype === 'sdist') ?? doc.urls?.[0];
    if (latestFile?.url) {
      lines.push(`**Source/dist URL:** ${latestFile.url}`);
    }

    lines.push(`**PyPI:** https://pypi.org/project/${encodeURIComponent(pkgName)}/`);

    return lines.join('\n');
  }

  formatSearchAsText(result: PypiSearchResult): string {
    const lines: string[] = [
      `# PyPI search: "${result.query}"`,
      '',
      `**Total name matches:** ${result.totalMatches}`,
      `**Showing:** ${result.packages.length}`,
      '',
      '_Search uses the PEP 691 Simple Index (cached locally after first query)._',
      '',
    ];

    if (result.packages.length === 0) {
      lines.push('No packages found.');
      return lines.join('\n');
    }

    result.packages.forEach((pkg, i) => {
      const header = `## ${i + 1}. ${pkg.name}`;
      const block: string[] = [header];
      if (pkg.version) block.push(`**Version:** ${pkg.version}`);
      if (pkg.summary) block.push(pkg.summary);
      block.push(`https://pypi.org/project/${encodeURIComponent(pkg.name)}/`);
      lines.push(block.join('\n'));
      if (i < result.packages.length - 1) lines.push('');
    });

    return lines.join('\n');
  }

  async executeGetPackage(args: GetPackageInput): Promise<MCPToolCallResult> {
    const names = resolvePackageNames(args);
    if (names.length === 0) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'Provide `name` (string) or `names` (non-empty string array)'
      );
    }

    const isBatch = names.length > 1;

    const sections = await Promise.all(
      names.map(async (name) => {
        try {
          const doc = await this.service.getPackage(name);
          return this.formatPackageAsText(doc, name);
        } catch (err) {
          if (err instanceof PypiApiError && err.notFound) {
            return `Package not found: "${name}"`;
          }
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `get_package failed for "${name}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSearchPackages(args: SearchPackagesInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string' || !args.query.trim()) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a non-empty string'
      );
    }

    const limit = this.clampLimit(args.limit);

    try {
      const result = await this.service.searchPackages(args.query.trim(), limit);
      return {
        content: [{ type: 'text', text: this.formatSearchAsText(result) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async initialize(): Promise<void> {}

  async cleanup(): Promise<void> {}
}
