import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  PubmedService,
  type PubmedArticleSummary,
  type PubmedSearchResult,
} from '../../services/pubmedService.js';

export const SEARCH_ARTICLES_DEF = {
  name: 'search_articles',
  description:
    "🔬 I'm searching PubMed\n\nSearch PubMed/MEDLINE via NCBI E-utilities (esearch). Returns PMIDs, titles, journal, and publication date for each hit. Pass an array of queries to run several searches at once. Optional email helps NCBI identify your client (polite pool).",
  keywords: [
    'pubmed',
    'medline',
    'ncbi',
    'search',
    'articles',
    'papers',
    'biomedical',
    'literature',
    'pmid',
  ],
};

export const GET_ARTICLE_SUMMARY_DEF = {
  name: 'get_article_summary',
  description:
    "🔬 I'm fetching PubMed article summaries\n\nGet bibliographic summaries from PubMed by PMID (esummary): title, authors, journal, dates, publication types, DOI when present. Pass a single PMID or an array to fetch several at once in one call.",
  keywords: [
    'pubmed',
    'pmid',
    'summary',
    'metadata',
    'citation',
    'authors',
    'journal',
    'ncbi',
  ],
};

export const GET_ARTICLE_ABSTRACT_DEF = {
  name: 'get_article_abstract',
  description:
    "🔬 I'm fetching PubMed abstracts\n\nFetch full abstract text for PubMed articles by PMID (efetch). Pass a single PMID or an array to retrieve several abstracts at once.",
  keywords: [
    'pubmed',
    'pmid',
    'abstract',
    'full text',
    'medline',
    'ncbi',
    'literature',
  ],
};

export interface SearchArticlesInput {
  query: string | string[];
  max_results?: number;
  email?: string;
}

export interface GetArticleSummaryInput {
  pmid: string | string[];
  email?: string;
}

export interface GetArticleAbstractInput {
  pmid: string | string[];
  email?: string;
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

export class PubmedTools {
  private service: PubmedService;

  constructor(service?: PubmedService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new PubmedService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        toolName: api.toolName,
        email: api.email,
      });
    }
  }

  static getSearchArticlesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('PubMed search query (supports PubMed query syntax).'),
          max_results: {
            type: 'number',
            description: 'Maximum number of PMIDs to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
          email: {
            type: 'string',
            description:
              'Optional contact email for NCBI E-utilities etiquette (overrides PUBMED_EMAIL for this request).',
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetArticleSummarySchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          pmid: stringOrArraySchema('PubMed ID (PMID), e.g. "35296578".'),
          email: {
            type: 'string',
            description:
              'Optional contact email for NCBI E-utilities etiquette (overrides PUBMED_EMAIL for this request).',
          },
        },
        required: ['pmid'],
      },
    };
  }

  static getGetArticleAbstractSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          pmid: stringOrArraySchema('PubMed ID (PMID), e.g. "35296578".'),
          email: {
            type: 'string',
            description:
              'Optional contact email for NCBI E-utilities etiquette (overrides PUBMED_EMAIL for this request).',
          },
        },
        required: ['pmid'],
      },
    };
  }

  async executeSearchArticles(args: SearchArticlesInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }

    const maxResults = args.max_results ?? 10;
    if (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 100) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'max_results must be a number between 1 and 100'
      );
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const search = await this.service.searchArticles({
            query: query.trim(),
            maxResults,
            email: args.email,
          });
          if (search.ids.length === 0) {
            return this.formatEmptySearch(query, search);
          }
          const summaries = await this.service.getArticleSummaries(search.ids, args.email);
          return this.formatSearchResults(query, search, summaries);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `PubMed search failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetArticleSummary(args: GetArticleSummaryInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.pmid);
    if (items.length === 0 || items.some((p) => !p || typeof p !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'pmid is required and must be a string or a non-empty array of strings'
      );
    }

    const pmids = items.map((p) => p.trim());

    try {
      const summaries = await this.service.getArticleSummaries(pmids, args.email);
      const sections = pmids.map((id) => {
        const summary = summaries.get(id);
        if (!summary) {
          return `# PMID ${id}\n\nNo summary found for this PMID.`;
        }
        return this.formatSummaryAsText(summary);
      });

      if (!isBatch) {
        return { content: [{ type: 'text', text: sections[0] }] };
      }
      return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async executeGetArticleAbstract(args: GetArticleAbstractInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.pmid);
    if (items.length === 0 || items.some((p) => !p || typeof p !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'pmid is required and must be a string or a non-empty array of strings'
      );
    }

    const pmids = items.map((p) => p.trim());

    try {
      const abstracts = await this.service.getArticleAbstracts(pmids, args.email);
      const sections = pmids.map((id) => this.formatAbstractAsText(id, abstracts.get(id)));

      if (!isBatch) {
        return { content: [{ type: 'text', text: sections[0] }] };
      }
      return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  private formatEmptySearch(query: string, search: PubmedSearchResult): string {
    let text = `No PubMed articles found for "${query}".`;
    if (search.queryTranslation) {
      text += `\n\nQuery translation: ${search.queryTranslation}`;
    }
    return text;
  }

  private formatSearchResults(
    query: string,
    search: PubmedSearchResult,
    summaries: Map<string, PubmedArticleSummary>
  ): string {
    let text = `Found ${search.ids.length} article(s) for "${query}"`;
    if (search.count > search.ids.length) {
      text += ` (${search.count.toLocaleString()} total in PubMed)`;
    }
    text += ':\n\n';

    search.ids.forEach((id, i) => {
      const s = summaries.get(id);
      const title = s?.title?.trim() || '(no title)';
      const journal = s?.fulljournalname || s?.source || '';
      const pubdate = s?.pubdate || s?.epubdate || '';
      const authors = this.formatAuthors(s?.authors, 3);

      text += `${i + 1}. **${title}**\n`;
      text += `   PMID: ${id}\n`;
      if (authors) text += `   Authors: ${authors}\n`;
      const meta: string[] = [];
      if (journal) meta.push(journal);
      if (pubdate) meta.push(pubdate);
      if (s?.pubtype?.length) meta.push(s.pubtype[0]);
      if (meta.length > 0) text += `   ${meta.join(' · ')}\n`;
      if (s?.doi) text += `   DOI: ${s.doi}\n`;
      text += '\n';
    });

    text +=
      'Use get_article_summary or get_article_abstract with a PMID for full details or abstract text.';
    if (search.queryTranslation) {
      text += `\n\nQuery translation: ${search.queryTranslation}`;
    }
    return text.trim();
  }

  private formatSummaryAsText(summary: PubmedArticleSummary): string {
    const title = summary.title?.trim() || summary.sorttitle?.trim() || '(no title)';
    const authors = this.formatAuthors(summary.authors);
    const journal = summary.fulljournalname || summary.source;
    const pubdate = summary.pubdate || summary.epubdate;

    let text = `# ${title}\n\n`;
    text += `**PMID:** ${summary.uid}\n`;
    if (authors) text += `**Authors:** ${authors}\n`;
    if (journal) text += `**Journal:** ${journal}\n`;
    if (pubdate) text += `**Published:** ${pubdate}\n`;
    if (summary.volume) {
      let volIssue = summary.volume;
      if (summary.issue) volIssue += `(${summary.issue})`;
      text += `**Volume/Issue:** ${volIssue}\n`;
    }
    if (summary.pages) text += `**Pages:** ${summary.pages}\n`;
    if (summary.pubtype?.length) {
      text += `**Publication types:** ${summary.pubtype.join(', ')}\n`;
    }
    if (summary.issn) text += `**ISSN:** ${summary.issn}\n`;
    if (summary.doi) text += `**DOI:** ${summary.doi}\n`;
    if (summary.pmc) text += `**PMC:** ${summary.pmc}\n`;
    text += `**URL:** https://pubmed.ncbi.nlm.nih.gov/${summary.uid}/\n`;
    if (summary.recordstatus) text += `**Record status:** ${summary.recordstatus}\n`;

    return text.trim();
  }

  private formatAbstractAsText(
    pmid: string,
    entry?: { title?: string; abstract: string }
  ): string {
    const title = entry?.title?.trim();
    let text = title ? `# ${title}\n\n` : `# PMID ${pmid}\n\n`;
    text += `**PMID:** ${pmid}\n`;
    text += `**URL:** https://pubmed.ncbi.nlm.nih.gov/${pmid}/\n\n`;
    text += `## Abstract\n\n${entry?.abstract ?? '(No abstract available)'}`;
    return text.trim();
  }

  private formatAuthors(
    authors?: Array<{ name?: string }>,
    max = 5
  ): string {
    if (!authors || authors.length === 0) return '';
    const names = authors
      .map((a) => a.name?.trim())
      .filter((n): n is string => Boolean(n && n.length > 0));

    if (names.length === 0) return '';
    if (names.length <= max) return names.join(', ');
    return `${names.slice(0, max).join(', ')}, et al. (${names.length} authors)`;
  }
}
