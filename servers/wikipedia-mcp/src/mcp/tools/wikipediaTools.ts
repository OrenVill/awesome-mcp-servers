import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import { WikipediaService } from '../../services/wikipediaService.js';

export const SEARCH_WIKIPEDIA_DEF = {
  name: 'search_wikipedia',
  description:
    "🔍 I'm searching Wikipedia\n\nSearch for Wikipedia articles by query. Returns article titles and snippets. Use before get_article or get_summary when you need to find articles by topic.",
  keywords: ['wikipedia', 'search', 'article', 'encyclopedia'],
};
export const GET_ARTICLE_DEF = {
  name: 'get_article',
  description:
    "📖 I'm loading full articles\n\nGet full extract/summary of a Wikipedia article by exact title. Returns introductory and extended content.",
  keywords: ['wikipedia', 'article', 'read', 'content'],
};
export const GET_SUMMARY_DEF = {
  name: 'get_summary',
  description:
    "📝 I'm loading short summaries\n\nGet a brief summary of a Wikipedia article by exact title. Uses REST summary when available, otherwise intro extract.",
  keywords: ['wikipedia', 'summary', 'brief'],
};

export interface SearchWikipediaInput {
  query: string;
  limit?: number;
}

export interface GetArticleInput {
  title: string;
}

export interface GetSummaryInput {
  title: string;
}

export class WikipediaTools {
  private service: WikipediaService;

  constructor(service?: WikipediaService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new WikipediaService({
        restBase: api.restBaseUrl,
        mediaWikiBase: api.mediaWikiBaseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchWikipediaSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find Wikipedia articles',
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

  static getGetArticleSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: {
            type: 'string',
            description: 'Exact Wikipedia article title (e.g. "Albert Einstein")',
          },
        },
        required: ['title'],
      },
    };
  }

  static getGetSummarySchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: {
            type: 'string',
            description: 'Exact Wikipedia article title for a brief summary',
          },
        },
        required: ['title'],
      },
    };
  }

  async executeSearchWikipedia(args: SearchWikipediaInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required and must be a string');
    }

    try {
      const response = await this.service.search({
        query: args.query,
        limit: args.limit ?? 10,
      });

      const results = response.query?.search ?? [];
      const totalHits = response.query?.searchinfo?.totalhits;
      const text = this.formatSearchResultsAsText(results, args.query, totalHits);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Wikipedia search failed: ${message}`);
    }
  }

  async executeGetArticle(args: GetArticleInput): Promise<MCPToolCallResult> {
    if (!args.title || typeof args.title !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'title is required and must be a string');
    }

    try {
      const response = await this.service.getExtract({
        title: args.title,
        introOnly: false,
        maxChars: 15000,
      });

      const pages = response.query?.pages ?? {};
      const page = Object.values(pages).find((p) => p.pageid !== undefined && p.pageid > 0);
      if (!page || page.pageid === -1 || !page.extract) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Article not found: "${args.title}"`);
      }

      const text = this.formatArticleAsText(page.title, page.extract);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get article: ${message}`);
    }
  }

  async executeGetSummary(args: GetSummaryInput): Promise<MCPToolCallResult> {
    if (!args.title || typeof args.title !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'title is required and must be a string');
    }

    try {
      const restSummary = await this.service.getRestSummary(args.title);
      if (restSummary?.extract) {
        const text = this.formatRestSummaryAsText(restSummary);
        return { content: [{ type: 'text', text }] };
      }

      const response = await this.service.getExtract({
        title: args.title,
        introOnly: true,
        maxChars: 500,
      });

      const pages = response.query?.pages ?? {};
      const page = Object.values(pages).find((p) => p.pageid !== undefined && p.pageid > 0);
      if (!page || page.pageid === -1 || !page.extract) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Article not found: "${args.title}"`);
      }

      const text = this.formatArticleAsText(page.title, page.extract);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get summary: ${message}`);
    }
  }

  private formatSearchResultsAsText(
    results: Array<{ title: string; snippet: string; pageid?: number }>,
    query: string,
    totalHits?: number
  ): string {
    if (results.length === 0) {
      return `No Wikipedia articles found for "${query}".`;
    }

    let text = `Found ${results.length} article(s) for "${query}"`;
    if (totalHits != null) text += ` (${totalHits.toLocaleString()} total)`;
    text += ':\n\n';

    results.forEach((r, i) => {
      const snippet = r.snippet.replace(/<[^>]+>/g, '').trim();
      text += `${i + 1}. **${r.title}**\n`;
      text += `   ${snippet}\n\n`;
    });
    text += 'Use get_article or get_summary with the exact title to fetch full content.';
    return text.trim();
  }

  private formatArticleAsText(title: string, extract: string): string {
    return `# ${title}\n\n${extract.trim()}`;
  }

  private formatRestSummaryAsText(summary: {
    title: string;
    extract?: string;
    description?: string;
    content_urls?: { desktop?: { page?: string } };
  }): string {
    let text = `# ${summary.title}\n\n`;
    if (summary.description) text += `*${summary.description}*\n\n`;
    if (summary.extract) text += summary.extract.trim();
    if (summary.content_urls?.desktop?.page) {
      text += `\n\n[View on Wikipedia](${summary.content_urls.desktop.page})`;
    }
    return text.trim();
  }
}
