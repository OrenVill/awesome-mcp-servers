import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import {
  AGENT_READY_BATCH_DESCRIPTION,
  BATCH_SEPARATOR,
  batchNumberProperties,
  batchStringProperties,
  defaultStringBatchOptions,
  formatInputFieldError,
  normalizeStringArgFromArgs,
  normalizeToArray,
  resolveNumberBatch,
  resolveStringBatch,
  stringBatchInputExamples,
  AgentReadyObjectInputSchema,
} from '@awesome-mcp/mcp-schema-helpers';
import { getConfig } from '../../config.js';
import { ArxivService, type ArxivPaper } from '../../services/arxivService.js';

export const SEARCH_ARXIV_DEF = {
  name: 'search_arxiv',
  description:
    "🔍 I'm searching arXiv\n\nSearch arXiv research papers by free-text query. Optionally filter by category (e.g. cs.AI). Returns titles, authors, IDs, and summaries. Pass an array to run several searches at once in a single call.",
  keywords: ['arxiv', 'search', 'papers', 'research', 'preprint'],
};
export const GET_PAPER_DEF = {
  name: 'get_paper',
  description:
    "📄 I'm fetching a paper\n\nFetch metadata for a single arXiv paper by ID (e.g. 2401.12345 or cs/0301001). Returns title, authors, summary, and category. Pass an array of IDs to fetch several papers at once in a single call.",
  keywords: ['arxiv', 'paper', 'metadata', 'id', 'fetch'],
};
export const LIST_RECENT_DEF = {
  name: 'list_recent',
  description:
    "🆕 I'm listing recent papers\n\nList recent arXiv papers in a given category (e.g. cs.LG, cs.AI), sorted by submission date descending.",
  keywords: ['arxiv', 'recent', 'category', 'latest', 'papers'],
};

export interface SearchArxivInput {
  query: string | string[];
  max_results?: number;
  category?: string;
}

export interface GetPaperInput {
  id: string | string[];
}

export interface ListRecentInput {
  category: string;
  max_results?: number;
}

export class ArxivTools {
  private service: ArxivService;

  constructor(service?: ArxivService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new ArxivService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchArxivSchema(): {
    inputSchema: AgentReadyObjectInputSchema;
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        description: AGENT_READY_BATCH_DESCRIPTION,
        examples: stringBatchInputExamples('query', defaultStringBatchOptions('query')),
        properties: {
          ...batchStringProperties('query', 'Free-text search query for arXiv papers.'),
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (1-50)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
          category: {
            type: 'string',
            description:
              'Optional arXiv category filter (e.g. "cs.AI", "stat.ML", "math.AG")',
          },
        },
      },
    };
  }

  static getGetPaperSchema(): {
    inputSchema: AgentReadyObjectInputSchema;
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        description: AGENT_READY_BATCH_DESCRIPTION,
        examples: stringBatchInputExamples('id', defaultStringBatchOptions('id')),
        properties: {
          ...batchStringProperties('id', 'arXiv ID, e.g. "2401.12345" (new format) or "cs/0301001" (old format).'),
        },
      },
    };
  }

  static getListRecentSchema(): {
    inputSchema: AgentReadyObjectInputSchema;
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            description:
              'arXiv category to list recent papers from (e.g. "cs.LG", "cs.AI", "stat.ML")',
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ['category'],
      },
    };
  }

  async executeSearchArxiv(args: SearchArxivInput): Promise<MCPToolCallResult> {
    const queryBatch = normalizeStringArgFromArgs(args, 'query');
    if ('field' in queryBatch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(queryBatch));
    }
    const { items, isBatch } = queryBatch;
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }
    if (args.category !== undefined && typeof args.category !== 'string') {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'category must be a string when provided'
      );
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const papers = await this.service.search({
            query,
            maxResults: args.max_results ?? 10,
            category: args.category,
          });
          return formatPapersAsText(papers, {
            emptyMessage: `No arXiv papers found for "${query}"${
              args.category ? ` in ${args.category}` : ''
            }.`,
            header: `Found ${papers.length} arXiv paper(s) for "${query}"${
              args.category ? ` in ${args.category}` : ''
            }`,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `arXiv search failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetPaper(args: GetPaperInput): Promise<MCPToolCallResult> {
    const idBatch = normalizeStringArgFromArgs(args, 'id');
    if ('field' in idBatch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(idBatch));
    }
    const { items, isBatch } = idBatch;
    if (items.length === 0 || items.some((id) => !id || typeof id !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'id is required and must be a string or a non-empty array of strings'
      );
    }

    // Preserve exact original behaviour for single (non-batch) callers:
    // a missing paper or failure returns an MCP error result, not a section.
    if (!isBatch) {
      const id = items[0];
      try {
        const paper = await this.service.getPaper(id);
        if (!paper) {
          return createMCPErrorResult(
            MCPErrorCode.API_ERROR,
            `Paper not found: "${id}"`
          );
        }
        const text = formatSinglePaperAsText(paper);
        return { content: [{ type: 'text', text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return createMCPErrorResult(
          MCPErrorCode.API_ERROR,
          `Failed to get paper: ${message}`
        );
      }
    }

    const sections = await Promise.all(
      items.map(async (id) => {
        try {
          const paper = await this.service.getPaper(id);
          if (!paper) {
            return `# ${id}\n\nPaper not found.`;
          }
          return formatSinglePaperAsText(paper);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${id}\n\nFailed to get paper: ${message}`;
        }
      })
    );

    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeListRecent(args: ListRecentInput): Promise<MCPToolCallResult> {
    if (!args.category || typeof args.category !== 'string') {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'category is required and must be a string'
      );
    }

    try {
      const papers = await this.service.listRecent({
        category: args.category,
        maxResults: args.max_results ?? 20,
      });
      const text = formatPapersAsText(papers, {
        emptyMessage: `No recent arXiv papers found in "${args.category}".`,
        header: `Latest ${papers.length} paper(s) in ${args.category}`,
      });
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(
        MCPErrorCode.API_ERROR,
        `Failed to list recent papers: ${message}`
      );
    }
  }
}

function formatPapersAsText(
  papers: ArxivPaper[],
  opts: { emptyMessage: string; header: string }
): string {
  if (papers.length === 0) return opts.emptyMessage;

  let text = `${opts.header}:\n\n`;
  papers.forEach((p, i) => {
    const authors = p.authors.length > 0 ? p.authors.join(', ') : 'Unknown';
    const idShort = shortenId(p.id);
    const summary = compactWhitespace(p.summary);
    const published = p.published ? p.published.split('T')[0] : '';
    text += `${i + 1}. **${p.title || 'Untitled'}**\n`;
    text += `Authors: ${authors}\n`;
    text += `ID: ${idShort}\n`;
    if (published) text += `Published: ${published}\n`;
    if (p.primaryCategory) text += `Category: ${p.primaryCategory}\n`;
    text += `Summary: ${truncate(summary, 500)}\n\n`;
  });
  return text.trim();
}

function formatSinglePaperAsText(p: ArxivPaper): string {
  const authors = p.authors.length > 0 ? p.authors.join(', ') : 'Unknown';
  const idShort = shortenId(p.id);
  const summary = compactWhitespace(p.summary);
  let text = `# ${p.title || 'Untitled'}\n\n`;
  text += `**Authors:** ${authors}\n`;
  text += `**ID:** ${idShort}\n`;
  if (p.primaryCategory) text += `**Category:** ${p.primaryCategory}\n`;
  if (p.published) text += `**Published:** ${p.published}\n`;
  if (p.updated && p.updated !== p.published) {
    text += `**Updated:** ${p.updated}\n`;
  }
  if (p.link) text += `**Link:** ${p.link}\n`;
  text += `\n## Summary\n\n${summary}`;
  return text.trim();
}

function shortenId(rawId: string): string {
  // arXiv <id> is typically a full URL like http://arxiv.org/abs/2401.12345v1.
  // Strip the prefix so the displayed ID is the bare arXiv identifier.
  const m = rawId.match(/arxiv\.org\/abs\/(.+)$/i);
  return m && m[1] ? m[1] : rawId;
}

function compactWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
