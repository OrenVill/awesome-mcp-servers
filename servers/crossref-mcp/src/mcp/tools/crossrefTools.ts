import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  CrossrefService,
  type CrossrefWork,
  type CrossrefJournal,
  type CrossrefAuthor,
  type CrossrefDateParts,
} from '../../services/crossrefService.js';

export const GET_WORK_DEF = {
  name: 'get_work',
  description:
    "📚 I'm looking up DOI metadata\n\nLook up a scholarly work on Crossref by DOI (e.g. 10.1038/nphys1170). Returns title, authors, journal, year, type, URL, and abstract when available. Pass an array of DOIs to fetch several works at once in a single call.",
  keywords: ['crossref', 'doi', 'work', 'paper', 'article', 'scholarly', 'citation', 'metadata'],
};
export const SEARCH_WORKS_DEF = {
  name: 'search_works',
  description:
    "📚 I'm searching scholarly works\n\nSearch Crossref for scholarly works by free-text query. Returns DOIs, titles, authors, and journal info. Use optional filter for date ranges (e.g. from-pub-date:2020). Pass an array to run several searches at once in a single call.",
  keywords: ['crossref', 'search', 'works', 'papers', 'articles', 'scholarly', 'research', 'publications'],
};
export const SEARCH_JOURNALS_DEF = {
  name: 'search_journals',
  description:
    "📚 I'm searching journals\n\nSearch Crossref for journals by title or keywords. Returns ISSN, title, and publisher for each match. Pass an array to run several searches at once in a single call.",
  keywords: ['crossref', 'journals', 'search', 'issn', 'publisher', 'periodicals'],
};
export const GET_JOURNAL_DEF = {
  name: 'get_journal',
  description:
    "📚 I'm looking up a journal\n\nGet journal details from Crossref by ISSN. Returns title, publisher, ISSNs, and total works count. Pass an array of ISSNs to fetch several journals at once in a single call.",
  keywords: ['crossref', 'journal', 'issn', 'publisher', 'periodical'],
};

export interface GetWorkInput {
  doi: string | string[];
}

export interface SearchWorksInput {
  query: string | string[];
  limit?: number;
  filter?: string;
}

export interface SearchJournalsInput {
  query: string | string[];
  limit?: number;
}

export interface GetJournalInput {
  issn: string | string[];
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

export class CrossrefTools {
  private service: CrossrefService;

  constructor(service?: CrossrefService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new CrossrefService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        mailto: api.mailto,
      });
    }
  }

  static getGetWorkSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          doi: stringOrArraySchema('DOI of the work to look up (e.g. "10.1038/nphys1170").'),
        },
        required: ['doi'],
      },
    };
  }

  static getSearchWorksSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Free-text query to search Crossref works.'),
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
          filter: {
            type: 'string',
            description:
              'Optional Crossref filter expression, e.g. "from-pub-date:2020" or "type:journal-article"',
          },
        },
        required: ['query'],
      },
    };
  }

  static getSearchJournalsSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Query to search journals by title or keywords.'),
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetJournalSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          issn: stringOrArraySchema('ISSN of the journal (e.g. "2167-8359").'),
        },
        required: ['issn'],
      },
    };
  }

  async executeGetWork(args: GetWorkInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.doi);
    if (items.length === 0 || items.some((d) => !d || typeof d !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'doi is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (doi) => {
        try {
          const work = await this.service.getWork(doi.trim());
          return this.formatWorkAsText(work);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${doi}\n\nFailed to get work: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSearchWorks(args: SearchWorksInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }

    const limit = args.limit ?? 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'limit must be a number between 1 and 100');
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const message = await this.service.searchWorks({
            query,
            limit,
            filter: args.filter,
          });
          return this.formatWorksListAsText(message.items, query, message['total-results']);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Crossref works search failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSearchJournals(args: SearchJournalsInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }

    const limit = args.limit ?? 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'limit must be a number between 1 and 100');
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const message = await this.service.searchJournals({ query, limit });
          return this.formatJournalsListAsText(message.items, query, message['total-results']);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Crossref journals search failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetJournal(args: GetJournalInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.issn);
    if (items.length === 0 || items.some((i) => !i || typeof i !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'issn is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (issn) => {
        try {
          const journal = await this.service.getJournal(issn.trim());
          return this.formatJournalAsText(journal);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${issn}\n\nFailed to get journal: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  // ---------- formatting ----------

  private formatWorkAsText(work: CrossrefWork): string {
    const title = work.title?.[0]?.trim() || '(no title)';
    const authors = this.formatAuthors(work.author);
    const journal = work['container-title']?.[0] || work['short-container-title']?.[0];
    const year = this.extractYear(work);
    const type = work.type;
    const url = work.URL || `https://doi.org/${work.DOI}`;

    let text = `# ${title}\n\n`;
    text += `**DOI:** ${work.DOI}\n`;
    if (authors) text += `**Authors:** ${authors}\n`;
    if (journal) text += `**Journal:** ${journal}\n`;
    if (year) text += `**Year:** ${year}\n`;
    if (type) text += `**Type:** ${type}\n`;
    if (work.publisher) text += `**Publisher:** ${work.publisher}\n`;
    if (work.volume) text += `**Volume:** ${work.volume}\n`;
    if (work.issue) text += `**Issue:** ${work.issue}\n`;
    if (work.page) text += `**Pages:** ${work.page}\n`;
    if (work['is-referenced-by-count'] != null) {
      text += `**Cited by:** ${work['is-referenced-by-count']}\n`;
    }
    text += `**URL:** ${url}\n`;

    if (work.abstract) {
      const cleanAbstract = work.abstract
        .replace(/<jats:[^>]+>/g, '')
        .replace(/<\/jats:[^>]+>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();
      text += `\n## Abstract\n\n${cleanAbstract}`;
    }

    return text.trim();
  }

  private formatWorksListAsText(
    items: CrossrefWork[],
    query: string,
    totalResults?: number
  ): string {
    if (items.length === 0) {
      return `No Crossref works found for "${query}".`;
    }

    let text = `Found ${items.length} work(s) for "${query}"`;
    if (totalResults != null) text += ` (${totalResults.toLocaleString()} total)`;
    text += ':\n\n';

    items.forEach((w, i) => {
      const title = w.title?.[0]?.trim() || '(no title)';
      const authors = this.formatAuthors(w.author, 3);
      const journal = w['container-title']?.[0] || w['short-container-title']?.[0];
      const year = this.extractYear(w);

      text += `${i + 1}. **${title}**\n`;
      text += `   DOI: ${w.DOI}\n`;
      if (authors) text += `   Authors: ${authors}\n`;
      const meta: string[] = [];
      if (journal) meta.push(journal);
      if (year) meta.push(String(year));
      if (w.type) meta.push(w.type);
      if (meta.length > 0) text += `   ${meta.join(' · ')}\n`;
      text += '\n';
    });

    text += 'Use get_work with a DOI to fetch full metadata and abstract.';
    return text.trim();
  }

  private formatJournalsListAsText(
    items: CrossrefJournal[],
    query: string,
    totalResults?: number
  ): string {
    if (items.length === 0) {
      return `No Crossref journals found for "${query}".`;
    }

    let text = `Found ${items.length} journal(s) for "${query}"`;
    if (totalResults != null) text += ` (${totalResults.toLocaleString()} total)`;
    text += ':\n\n';

    items.forEach((j, i) => {
      const issn = j.ISSN?.[0] ?? '(no ISSN)';
      text += `${i + 1}. **${j.title}**\n`;
      text += `   ISSN: ${issn}`;
      if (j.ISSN && j.ISSN.length > 1) {
        text += ` (also ${j.ISSN.slice(1).join(', ')})`;
      }
      text += '\n';
      if (j.publisher) text += `   Publisher: ${j.publisher}\n`;
      text += '\n';
    });

    text += 'Use get_journal with an ISSN to fetch full journal details.';
    return text.trim();
  }

  private formatJournalAsText(journal: CrossrefJournal): string {
    let text = `# ${journal.title}\n\n`;
    if (journal.ISSN && journal.ISSN.length > 0) {
      text += `**ISSN:** ${journal.ISSN.join(', ')}\n`;
    }
    if (journal.publisher) text += `**Publisher:** ${journal.publisher}\n`;
    const total = journal.counts?.['total-dois'];
    if (total != null) text += `**Total works:** ${total.toLocaleString()}\n`;
    const current = journal.counts?.['current-dois'];
    if (current != null) text += `**Current works:** ${current.toLocaleString()}\n`;
    const backfile = journal.counts?.['backfile-dois'];
    if (backfile != null) text += `**Backfile works:** ${backfile.toLocaleString()}\n`;
    if (journal.subjects && journal.subjects.length > 0) {
      text += `**Subjects:** ${journal.subjects.map((s) => s.name).join(', ')}\n`;
    }
    return text.trim();
  }

  private formatAuthors(authors?: CrossrefAuthor[], max = 5): string {
    if (!authors || authors.length === 0) return '';
    const names = authors.map((a) => {
      if (a.name) return a.name;
      const given = a.given ?? '';
      const family = a.family ?? '';
      return `${given} ${family}`.trim();
    }).filter((n) => n.length > 0);

    if (names.length === 0) return '';
    if (names.length <= max) return names.join(', ');
    return `${names.slice(0, max).join(', ')}, et al. (${names.length} authors)`;
  }

  private extractYear(work: CrossrefWork): number | undefined {
    const candidates: (CrossrefDateParts | undefined)[] = [
      work.issued,
      work['published-print'],
      work['published-online'],
      work.published,
      work.created,
    ];
    for (const c of candidates) {
      const year = c?.['date-parts']?.[0]?.[0];
      if (typeof year === 'number') return year;
    }
    return undefined;
  }
}
