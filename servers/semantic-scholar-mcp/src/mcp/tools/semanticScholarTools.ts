import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  SemanticScholarService,
  type S2Paper,
  type S2CitationEntry,
} from '../../services/semanticScholarService.js';

export const SEARCH_PAPERS_DEF = {
  name: 'search_papers',
  description:
    "📄 I'm searching Semantic Scholar for papers\n\nSearch the Semantic Scholar graph by free-text query. Returns paper IDs, titles, authors, year, venue, and citation counts. Pass an array of queries to run several searches in one call. No API key required (rate limits apply); set SEMANTIC_SCHOLAR_API_KEY for higher limits.",
  keywords: [
    'semantic scholar',
    'search',
    'papers',
    'research',
    'publications',
    'scholarly',
    'citations',
    'academic',
  ],
};

export const GET_PAPER_DEF = {
  name: 'get_paper',
  description:
    "📄 I'm fetching a paper from Semantic Scholar\n\nGet full paper metadata by Semantic Scholar paper ID or external ID prefix (e.g. DOI:10.1038/..., ArXiv:1706.03762, PMID:12345678). Pass a single paperId or an ids array to batch-fetch up to many papers via the batch API.",
  keywords: [
    'semantic scholar',
    'paper',
    'metadata',
    'doi',
    'arxiv',
    'abstract',
    'citations',
    'scholarly',
  ],
};

export const GET_PAPER_CITATIONS_DEF = {
  name: 'get_paper_citations',
  description:
    "📄 I'm listing papers that cite this work\n\nList citing papers for a Semantic Scholar paper ID (or DOI:/ArXiv:/PMID: prefixed ID). Returns citing paper titles, authors, years, and citation counts. Optional limit (1-1000, default 10).",
  keywords: [
    'semantic scholar',
    'citations',
    'cited by',
    'references',
    'scholarly',
    'paper',
    'impact',
  ],
};

export interface SearchPapersInput {
  query: string | string[];
  limit?: number;
}

export interface GetPaperInput {
  paperId?: string;
  ids?: string | string[];
}

export interface GetPaperCitationsInput {
  paperId: string;
  limit?: number;
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

export class SemanticScholarTools {
  private service: SemanticScholarService;

  constructor(service?: SemanticScholarService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new SemanticScholarService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        apiKey: api.apiKey,
      });
    }
  }

  static getSearchPapersSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Free-text search query.'),
          limit: {
            type: 'number',
            description: 'Maximum number of results per query (1-100)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetPaperSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          paperId: {
            type: 'string',
            description:
              'Single paper ID (Semantic Scholar hash or prefixed external ID such as DOI:10.1038/...).',
          },
          ids: stringOrArraySchema(
            'One or more paper IDs for batch lookup (same ID formats as paperId).'
          ),
        },
      },
    };
  }

  static getGetPaperCitationsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          paperId: {
            type: 'string',
            description:
              'Paper ID to list citations for (Semantic Scholar ID or DOI:/ArXiv:/PMID: prefix).',
          },
          limit: {
            type: 'number',
            description: 'Maximum citing papers to return (1-1000)',
            minimum: 1,
            maximum: 1000,
            default: 10,
          },
        },
        required: ['paperId'],
      },
    };
  }

  async executeSearchPapers(args: SearchPapersInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }

    const limit = args.limit ?? 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'limit must be a number between 1 and 100'
      );
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const result = await this.service.searchPapers({ query: query.trim(), limit });
          return this.formatSearchResultsAsText(result.data ?? [], query, result.total);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Semantic Scholar search failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetPaper(args: GetPaperInput): Promise<MCPToolCallResult> {
    const idList = this.resolvePaperIds(args);
    if (!idList.ok) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, idList.error);
    }

    const { ids, isBatch } = idList;

    if (ids.length === 1) {
      try {
        const paper = await this.service.getPaper(ids[0]);
        return { content: [{ type: 'text', text: this.formatPaperAsText(paper) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return createMCPErrorResult(
          MCPErrorCode.API_ERROR,
          `Failed to get paper "${ids[0]}": ${message}`
        );
      }
    }

    try {
      const papers = await this.service.getPapersBatch(ids);
      const sections = ids.map((id, i) => {
        const paper = papers[i];
        if (!paper) {
          return `# ${id}\n\nPaper not found or unavailable.`;
        }
        return this.formatPaperAsText(paper);
      });
      const text = isBatch ? sections.join(BATCH_SEPARATOR) : sections[0];
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Batch paper lookup failed: ${message}`);
    }
  }

  async executeGetPaperCitations(args: GetPaperCitationsInput): Promise<MCPToolCallResult> {
    if (!args.paperId || typeof args.paperId !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'paperId is required');
    }

    const limit = args.limit ?? 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'limit must be a number between 1 and 1000'
      );
    }

    try {
      const result = await this.service.getPaperCitations({
        paperId: args.paperId.trim(),
        limit,
      });
      const text = this.formatCitationsAsText(
        result.data ?? [],
        args.paperId.trim(),
        result.next != null
      );
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(
        MCPErrorCode.API_ERROR,
        `Failed to get citations for "${args.paperId}": ${message}`
      );
    }
  }

  private resolvePaperIds(
    args: GetPaperInput
  ):
    | { ok: true; ids: string[]; isBatch: boolean }
    | { ok: false; error: string } {
    if (args.ids !== undefined) {
      const { items, isBatch } = normalizeToArray(args.ids);
      if (items.length === 0 || items.some((id) => !id || typeof id !== 'string')) {
        return {
          ok: false,
          error: 'ids must be a non-empty string or array of strings when provided',
        };
      }
      return { ok: true, ids: items.map((id) => id.trim()), isBatch: isBatch || items.length > 1 };
    }
    if (args.paperId && typeof args.paperId === 'string' && args.paperId.trim()) {
      return { ok: true, ids: [args.paperId.trim()], isBatch: false };
    }
    return {
      ok: false,
      error: 'Provide paperId (single ID) or ids (one or more paper IDs)',
    };
  }

  private formatAuthors(authors?: S2Paper['authors'], max = 5): string {
    if (!authors || authors.length === 0) return '';
    const names = authors.map((a) => a.name?.trim()).filter((n): n is string => Boolean(n));
    if (names.length === 0) return '';
    if (names.length <= max) return names.join(', ');
    return `${names.slice(0, max).join(', ')}, et al. (${names.length} authors)`;
  }

  private formatExternalIds(externalIds?: S2Paper['externalIds']): string {
    if (!externalIds) return '';
    const parts: string[] = [];
    if (externalIds.DOI) parts.push(`DOI: ${externalIds.DOI}`);
    if (externalIds.ArXiv) parts.push(`arXiv: ${externalIds.ArXiv}`);
    if (externalIds.PubMed) parts.push(`PMID: ${externalIds.PubMed}`);
    return parts.join(' · ');
  }

  private formatPaperAsText(paper: S2Paper): string {
    const title = paper.title?.trim() || '(no title)';
    const authors = this.formatAuthors(paper.authors);
    const external = this.formatExternalIds(paper.externalIds);

    let text = `# ${title}\n\n`;
    if (paper.paperId) text += `**Paper ID:** ${paper.paperId}\n`;
    if (authors) text += `**Authors:** ${authors}\n`;
    if (paper.year != null) text += `**Year:** ${paper.year}\n`;
    if (paper.venue) text += `**Venue:** ${paper.venue}\n`;
    if (paper.citationCount != null) text += `**Citations:** ${paper.citationCount}\n`;
    if (paper.influentialCitationCount != null) {
      text += `**Influential citations:** ${paper.influentialCitationCount}\n`;
    }
    if (paper.referenceCount != null) text += `**References:** ${paper.referenceCount}\n`;
    if (external) text += `**External IDs:** ${external}\n`;
    if (paper.url) text += `**URL:** ${paper.url}\n`;
    if (paper.openAccessPdf?.url) {
      text += `**Open access PDF:** ${paper.openAccessPdf.url}\n`;
    }

    if (paper.abstract) {
      text += `\n## Abstract\n\n${paper.abstract.trim()}`;
    }

    return text.trim();
  }

  private formatSearchResultsAsText(
    papers: S2Paper[],
    query: string,
    total?: number
  ): string {
    if (papers.length === 0) {
      return `No Semantic Scholar papers found for "${query}".`;
    }

    let text = `Found ${papers.length} paper(s) for "${query}"`;
    if (total != null) text += ` (${total.toLocaleString()} total)`;
    text += ':\n\n';

    papers.forEach((p, i) => {
      const title = p.title?.trim() || '(no title)';
      const authors = this.formatAuthors(p.authors, 3);
      text += `${i + 1}. **${title}**\n`;
      if (p.paperId) text += `   Paper ID: ${p.paperId}\n`;
      if (authors) text += `   Authors: ${authors}\n`;
      const meta: string[] = [];
      if (p.year != null) meta.push(String(p.year));
      if (p.venue) meta.push(p.venue);
      if (p.citationCount != null) meta.push(`${p.citationCount} citations`);
      if (meta.length > 0) text += `   ${meta.join(' · ')}\n`;
      text += '\n';
    });

    text += 'Use get_paper with paperId or ids for full metadata.';
    return text.trim();
  }

  private formatCitationsAsText(
    entries: S2CitationEntry[],
    sourcePaperId: string,
    hasMore: boolean
  ): string {
    if (entries.length === 0) {
      return `No citing papers found for "${sourcePaperId}".`;
    }

    let text = `Citing papers for "${sourcePaperId}" (${entries.length} shown`;
    if (hasMore) text += ', more available via API pagination';
    text += '):\n\n';

    entries.forEach((entry, i) => {
      const p = entry.citingPaper;
      const title = p?.title?.trim() || '(no title)';
      text += `${i + 1}. **${title}**\n`;
      if (p?.paperId) text += `   Paper ID: ${p.paperId}\n`;
      const authors = p ? this.formatAuthors(p.authors, 3) : '';
      if (authors) text += `   Authors: ${authors}\n`;
      const meta: string[] = [];
      if (p?.year != null) meta.push(String(p.year));
      if (p?.venue) meta.push(p.venue);
      if (p?.citationCount != null) meta.push(`${p.citationCount} citations`);
      if (meta.length > 0) text += `   ${meta.join(' · ')}\n`;
      if (entry.isInfluential) text += `   Influential citation\n`;
      text += '\n';
    });

    return text.trim();
  }
}
