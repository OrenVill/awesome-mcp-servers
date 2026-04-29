import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  MdnService,
  type BrowserSupport,
  type MdnDoc,
  type MdnSearchDocument,
} from '../../services/mdnService.js';

export const SEARCH_MDN_DEF = {
  name: 'search_mdn',
  description:
    "🔎 I'm searching MDN Web Docs\n\nSearch MDN documentation for HTML, CSS, JavaScript, and Web APIs. Returns document titles, slugs, summaries, and relevance scores. Use the slug from results with get_doc or get_browser_compat.",
  keywords: ['mdn', 'search', 'docs', 'web', 'html', 'css', 'javascript', 'api'],
};
export const GET_DOC_DEF = {
  name: 'get_doc',
  description:
    "📘 I'm loading MDN documentation\n\nFetch a full MDN doc by slug (e.g. `Web/API/fetch`, `Web/CSS/grid`). Returns title, summary, MDN URL, and a plain-text rendering of the body sections.",
  keywords: ['mdn', 'doc', 'documentation', 'reference', 'web-platform'],
};
export const GET_BROWSER_COMPAT_DEF = {
  name: 'get_browser_compat',
  description:
    "🧭 I'm checking browser compatibility\n\nExtract browser support data from an MDN doc's compatibility section. Returns per-browser version_added, version_removed, and notes for the feature at the given slug.",
  keywords: ['mdn', 'browser', 'compat', 'compatibility', 'support', 'caniuse'],
};

export interface SearchMdnInput {
  query: string;
  locale?: string;
  limit?: number;
}

export interface GetDocInput {
  slug: string;
  locale?: string;
}

export interface GetBrowserCompatInput {
  slug: string;
  locale?: string;
}

export class MdnTools {
  private service: MdnService;

  constructor(service?: MdnService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new MdnService({
        searchBase: api.searchBaseUrl,
        docsBase: api.docsBaseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchMdnSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query for MDN docs (e.g. "fetch", "css grid", "Array.map")',
          },
          locale: {
            type: 'string',
            description: 'Locale code (default "en-US")',
            default: 'en-US',
          },
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

  static getGetDocSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          slug: {
            type: 'string',
            description: 'MDN doc slug, e.g. "Web/API/fetch" or "Web/CSS/grid"',
          },
          locale: {
            type: 'string',
            description: 'Locale code (default "en-US")',
            default: 'en-US',
          },
        },
        required: ['slug'],
      },
    };
  }

  static getGetBrowserCompatSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          slug: {
            type: 'string',
            description: 'MDN doc slug whose browser compatibility table you want',
          },
          locale: {
            type: 'string',
            description: 'Locale code (default "en-US")',
            default: 'en-US',
          },
        },
        required: ['slug'],
      },
    };
  }

  async executeSearchMdn(args: SearchMdnInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required and must be a string');
    }
    const limit = args.limit ?? 10;
    if (limit < 1 || limit > 50) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'limit must be between 1 and 50');
    }

    try {
      const response = await this.service.search({
        query: args.query,
        locale: args.locale ?? 'en-US',
        limit,
      });
      const docs = response.documents ?? [];
      const text = this.formatSearchResultsAsText(docs, args.query);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `MDN search failed: ${message}`);
    }
  }

  async executeGetDoc(args: GetDocInput): Promise<MCPToolCallResult> {
    if (!args.slug || typeof args.slug !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'slug is required and must be a string');
    }

    try {
      const doc = await this.service.getDoc({
        slug: args.slug,
        locale: args.locale ?? 'en-US',
      });
      if (!doc) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `MDN doc not found: "${args.slug}"`);
      }
      const text = this.formatDocAsText(doc);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get MDN doc: ${message}`);
    }
  }

  async executeGetBrowserCompat(args: GetBrowserCompatInput): Promise<MCPToolCallResult> {
    if (!args.slug || typeof args.slug !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'slug is required and must be a string');
    }

    try {
      const support = await this.service.getBrowserCompat({
        slug: args.slug,
        locale: args.locale ?? 'en-US',
      });
      const text = this.formatBrowserCompatAsText(args.slug, support);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get browser compatibility: ${message}`);
    }
  }

  private formatSearchResultsAsText(docs: MdnSearchDocument[], query: string): string {
    if (docs.length === 0) {
      return `No MDN docs found for "${query}".`;
    }

    let text = `Found ${docs.length} MDN doc(s) for "${query}":\n\n`;
    docs.forEach((d, i) => {
      const summary = (d.summary ?? '').replace(/\s+/g, ' ').trim();
      text += `${i + 1}. **${d.title}**\n`;
      text += `   slug: \`${d.slug}\`\n`;
      if (typeof d.score === 'number') {
        text += `   score: ${d.score.toFixed(3)}\n`;
      }
      if (summary) {
        text += `   ${summary}\n`;
      }
      text += '\n';
    });
    text += 'Use get_doc or get_browser_compat with a slug above to fetch details.';
    return text.trim();
  }

  private formatDocAsText(doc: MdnDoc): string {
    let text = `# ${doc.title}\n\n`;
    if (doc.mdn_url) {
      text += `URL: https://developer.mozilla.org${doc.mdn_url}\n\n`;
    }
    if (doc.summary) {
      text += `${doc.summary.trim()}\n\n`;
    }

    const sections = doc.body ?? [];
    for (const section of sections) {
      const title = section.value?.title;
      const content = section.value?.content;
      if (title) {
        text += `## ${title}\n\n`;
      }
      if (typeof content === 'string' && content.trim()) {
        const plain = this.htmlToText(content);
        text += `${plain}\n\n`;
      } else if (section.type === 'browser_compatibility') {
        text += `_(browser compatibility table — call get_browser_compat for structured data)_\n\n`;
      } else if (section.type === 'specifications') {
        text += `_(specifications section)_\n\n`;
      }
    }
    return text.trim();
  }

  private formatBrowserCompatAsText(slug: string, support: BrowserSupport[]): string {
    if (support.length === 0) {
      return `No browser compatibility data found for "${slug}".`;
    }
    let text = `Browser compatibility for \`${slug}\`:\n\n`;
    for (const s of support) {
      const added =
        s.version_added === true
          ? 'yes'
          : s.version_added === false
            ? 'no'
            : s.version_added == null
              ? 'unknown'
              : String(s.version_added);
      text += `- **${s.browser}**: added ${added}`;
      if (s.version_removed != null && s.version_removed !== false) {
        const removed = s.version_removed === true ? 'yes' : String(s.version_removed);
        text += `, removed ${removed}`;
      }
      if (s.notes) {
        const notes = this.htmlToText(s.notes).replace(/\s+/g, ' ').trim();
        if (notes) text += ` — ${notes}`;
      }
      text += '\n';
    }
    return text.trim();
  }

  private htmlToText(html: string, maxChars = 1500): string {
    const stripped = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
      .replace(/<br\s*\/?>(\s*)/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (stripped.length > maxChars) {
      return stripped.slice(0, maxChars).trimEnd() + '...';
    }
    return stripped;
  }
}
