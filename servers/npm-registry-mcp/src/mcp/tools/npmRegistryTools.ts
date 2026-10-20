import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  NpmRegistryService,
  NpmRegistryApiError,
  type NpmPackageDocument,
  type NpmSearchResponse,
  type NpmSearchObject,
} from '../../services/npmRegistryService.js';

export const GET_PACKAGE_DEF = {
  name: 'get_package',
  description:
    "📦 I'm fetching npm package metadata\n\nGet metadata for an npm package from registry.npmjs.org (latest version, description, license, maintainers, publish time). Supports scoped names like `@types/node`. Pass an array of names to fetch several packages in one call.",
  keywords: ['npm', 'registry', 'package', 'javascript', 'node', 'metadata', 'version'],
};

export const SEARCH_PACKAGES_DEF = {
  name: 'search_packages',
  description:
    "🔍 I'm searching the npm registry\n\nSearch npm packages by keyword or phrase using the registry search API. Optional `size` (1–250, default 20) limits how many results are returned.",
  keywords: ['npm', 'registry', 'search', 'find', 'package', 'javascript', 'discover'],
};

export interface GetPackageInput {
  name: string | string[];
}

export interface SearchPackagesInput {
  text: string;
  size?: number;
}

function normalizeToArray<T>(value: T | T[]): { items: T[]; isBatch: boolean } {
  if (Array.isArray(value)) return { items: value, isBatch: true };
  return { items: [value], isBatch: false };
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

const BATCH_SEPARATOR = '\n\n---\n\n';

export class NpmRegistryTools {
  private service: NpmRegistryService;

  constructor(service?: NpmRegistryService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new NpmRegistryService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetPackageSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: stringOrArraySchema(
            'npm package name, e.g. "lodash" or "@types/node".'
          ),
        },
        required: ['name'],
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
          text: {
            type: 'string',
            description: 'Search query (keywords, package name fragments, etc.)',
          },
          size: {
            type: 'number',
            description: 'Maximum number of results to return (1–250)',
            minimum: 1,
            maximum: 250,
            default: 20,
          },
        },
        required: ['text'],
      },
    };
  }

  private clampSize(size: number | undefined): number {
    if (size === undefined || Number.isNaN(size)) return 20;
    return Math.min(250, Math.max(1, Math.floor(size)));
  }

  private formatRepository(repo: NpmPackageDocument['repository']): string | undefined {
    if (!repo) return undefined;
    if (typeof repo === 'string') return repo;
    if (repo.url) return repo.url;
    return undefined;
  }

  private formatLicense(license: unknown): string | undefined {
    if (!license) return undefined;
    if (typeof license === 'string') return license;
    if (typeof license === 'object' && license !== null && 'type' in license) {
      const t = (license as { type?: string }).type;
      return t ?? undefined;
    }
    return undefined;
  }

  formatPackageAsText(doc: NpmPackageDocument, requestedName: string): string {
    const pkgName = doc.name ?? doc._id ?? requestedName;
    const distTags = doc['dist-tags'] ?? {};
    const latest = distTags.latest;
    const latestMeta = latest && doc.versions ? doc.versions[latest] : undefined;

    const lines: string[] = [`# ${pkgName}`];

    const description = doc.description ?? latestMeta?.description;
    if (description) lines.push('', description);

    if (latest) {
      lines.push('', `**Latest:** ${latest}`);
      const published = doc.time?.[latest];
      if (published) lines.push(`**Published:** ${published}`);
    }

    const license =
      this.formatLicense(doc.license) ??
      this.formatLicense(latestMeta?.license);
    if (license) lines.push(`**License:** ${license}`);

    const homepage = doc.homepage ?? latestMeta?.homepage;
    if (homepage) lines.push(`**Homepage:** ${homepage}`);

    const repo = this.formatRepository(doc.repository);
    if (repo) lines.push(`**Repository:** ${repo}`);

    const keywords = doc.keywords ?? latestMeta?.keywords;
    if (keywords?.length) {
      lines.push(`**Keywords:** ${keywords.slice(0, 15).join(', ')}`);
    }

    if (doc.maintainers?.length) {
      const names = doc.maintainers
        .map((m) => m.name)
        .filter(Boolean)
        .slice(0, 10);
      if (names.length) lines.push(`**Maintainers:** ${names.join(', ')}`);
    }

    const versionCount = doc.versions ? Object.keys(doc.versions).length : 0;
    if (versionCount > 0) {
      lines.push(`**Versions on registry:** ${versionCount}`);
    }

    const distTagsList = Object.keys(distTags);
    if (distTagsList.length > 1) {
      const tags = distTagsList
        .slice(0, 8)
        .map((t) => `${t}@${distTags[t]}`)
        .join(', ');
      lines.push(`**Dist-tags:** ${tags}${distTagsList.length > 8 ? ', …' : ''}`);
    }

    if (latestMeta?.engines && Object.keys(latestMeta.engines).length) {
      const engines = Object.entries(latestMeta.engines)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      lines.push(`**Engines:** ${engines}`);
    }

    if (latestMeta?.dist?.tarball) {
      lines.push(`**Tarball:** ${latestMeta.dist.tarball}`);
    }

    return lines.join('\n');
  }

  formatSearchAsText(response: NpmSearchResponse, query: string): string {
    const lines: string[] = [
      `# npm search: "${query}"`,
      '',
      `**Total matches:** ${response.total}`,
      `**Showing:** ${response.objects.length}`,
      '',
    ];

    if (response.objects.length === 0) {
      lines.push('No packages found.');
      return lines.join('\n');
    }

    response.objects.forEach((obj, i) => {
      lines.push(this.formatSearchHit(obj, i + 1));
      if (i < response.objects.length - 1) lines.push('');
    });

    return lines.join('\n');
  }

  private formatSearchHit(obj: NpmSearchObject, index: number): string {
    const pkg = obj.package;
    const parts: string[] = [`## ${index}. ${pkg.name}`];
    if (pkg.version) parts.push(`v${pkg.version}`);
    if (obj.score?.final !== undefined) {
      parts[0] += ` (score: ${obj.score.final.toFixed(3)})`;
    }
    const block: string[] = [parts[0]];
    if (pkg.description) block.push(pkg.description);
    const link = pkg.links?.npm ?? `https://www.npmjs.com/package/${pkg.name}`;
    block.push(`npm: ${link}`);
    if (pkg.links?.homepage) block.push(`homepage: ${pkg.links.homepage}`);
    if (pkg.publisher?.username) block.push(`publisher: ${pkg.publisher.username}`);
    if (pkg.date) block.push(`updated: ${pkg.date}`);
    return block.join('\n');
  }

  async executeGetPackage(args: GetPackageInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.name);
    if (items.length === 0 || items.some((n) => !n || typeof n !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'name is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (name) => {
        try {
          const doc = await this.service.getPackage(name);
          return this.formatPackageAsText(doc, name);
        } catch (err) {
          if (err instanceof NpmRegistryApiError && err.notFound) {
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
    if (!args.text || typeof args.text !== 'string' || !args.text.trim()) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'text is required and must be a non-empty string'
      );
    }

    const size = this.clampSize(args.size);

    try {
      const response = await this.service.searchPackages(args.text, size);
      return {
        content: [{ type: 'text', text: this.formatSearchAsText(response, args.text.trim()) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async initialize(): Promise<void> {}

  async cleanup(): Promise<void> {}
}
