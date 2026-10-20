import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  OpenAlexService,
  reconstructAbstract,
  type OpenAlexWork,
  type OpenAlexAuthor,
} from '../../services/openalexService.js';

export const SEARCH_WORKS_DEF = {
  name: 'search_works',
  description:
    "📚 I'm searching OpenAlex works\n\nSearch the OpenAlex catalog of scholarly works by free-text query. Returns OpenAlex IDs, titles, authors, publication year, and citation counts. Pass an array of queries to run several searches at once in a single call.",
  keywords: ['openalex', 'search', 'works', 'papers', 'articles', 'scholarly', 'research', 'publications'],
};
export const GET_WORK_DEF = {
  name: 'get_work',
  description:
    "📚 I'm looking up a work on OpenAlex\n\nFetch a scholarly work from OpenAlex by OpenAlex ID (e.g. W2741809807 or https://openalex.org/W2741809807) or DOI (e.g. 10.1038/nature12373). Returns title, authors, venue, year, citations, open access, and abstract when available. Pass an array of IDs to fetch several works at once.",
  keywords: ['openalex', 'work', 'paper', 'article', 'doi', 'metadata', 'citation', 'scholarly'],
};
export const SEARCH_AUTHORS_DEF = {
  name: 'search_authors',
  description:
    "👤 I'm searching OpenAlex authors\n\nSearch OpenAlex for authors by name or keywords. Returns OpenAlex IDs, display names, institutions, and citation stats. Pass an array of queries to run several searches at once in a single call.",
  keywords: ['openalex', 'search', 'authors', 'researchers', 'scholars', 'people', 'academics'],
};
export const GET_AUTHOR_DEF = {
  name: 'get_author',
  description:
    "👤 I'm looking up an OpenAlex author\n\nGet author profile from OpenAlex by OpenAlex ID (e.g. A2208157607 or https://openalex.org/A2208157607). Returns works count, citations, h-index, ORCID, and affiliations. Pass an array of IDs to fetch several authors at once.",
  keywords: ['openalex', 'author', 'researcher', 'scholar', 'h-index', 'orcid', 'profile'],
};

export interface SearchWorksInput {
  query: string | string[];
  per_page?: number;
}

export interface GetWorkInput {
  id: string | string[];
}

export interface SearchAuthorsInput {
  query: string | string[];
  per_page?: number;
}

export interface GetAuthorInput {
  id: string | string[];
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

export class OpenAlexTools {
  private service: OpenAlexService;

  constructor(service?: OpenAlexService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new OpenAlexService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        mailto: api.mailto,
      });
    }
  }

  static getSearchWorksSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Free-text query to search OpenAlex works.'),
          per_page: {
            type: 'number',
            description: 'Number of results per page (1-200)',
            minimum: 1,
            maximum: 200,
            default: 10,
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetWorkSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: stringOrArraySchema(
            'OpenAlex work ID (W… or full openalex.org URL) or DOI (e.g. "10.1038/nature12373").'
          ),
        },
        required: ['id'],
      },
    };
  }

  static getSearchAuthorsSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Free-text query to search OpenAlex authors.'),
          per_page: {
            type: 'number',
            description: 'Number of results per page (1-200)',
            minimum: 1,
            maximum: 200,
            default: 10,
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetAuthorSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: stringOrArraySchema(
            'OpenAlex author ID (A… or full openalex.org URL).'
          ),
        },
        required: ['id'],
      },
    };
  }

  async executeSearchWorks(args: SearchWorksInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }

    const perPage = args.per_page ?? 10;
    if (typeof perPage !== 'number' || perPage < 1 || perPage > 200) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'per_page must be a number between 1 and 200'
      );
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const response = await this.service.searchWorks({ query, perPage });
          return this.formatWorksListAsText(response.results, query, response.meta?.count);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `OpenAlex works search failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetWork(args: GetWorkInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.id);
    if (items.length === 0 || items.some((i) => !i || typeof i !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'id is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (id) => {
        try {
          const work = await this.service.getWork(id.trim());
          return this.formatWorkAsText(work);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${id}\n\nFailed to get work: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSearchAuthors(args: SearchAuthorsInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }

    const perPage = args.per_page ?? 10;
    if (typeof perPage !== 'number' || perPage < 1 || perPage > 200) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'per_page must be a number between 1 and 200'
      );
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const response = await this.service.searchAuthors({ query, perPage });
          return this.formatAuthorsListAsText(response.results, query, response.meta?.count);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `OpenAlex authors search failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetAuthor(args: GetAuthorInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.id);
    if (items.length === 0 || items.some((i) => !i || typeof i !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'id is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (id) => {
        try {
          const author = await this.service.getAuthor(id.trim());
          return this.formatAuthorAsText(author);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${id}\n\nFailed to get author: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  private formatWorkAsText(work: OpenAlexWork): string {
    const title = work.title?.trim() || work.display_name?.trim() || '(no title)';
    const openAlexId = shortOpenAlexId(work.id);
    const authors = this.formatAuthorships(work.authorships);
    const source = work.primary_location?.source?.display_name;
    const year = work.publication_year;
    const doi = work.doi?.replace(/^https?:\/\/doi\.org\//i, '') ?? work.ids?.doi;

    let text = `# ${title}\n\n`;
    text += `**OpenAlex ID:** ${openAlexId}\n`;
    if (doi) text += `**DOI:** ${doi}\n`;
    if (authors) text += `**Authors:** ${authors}\n`;
    if (source) text += `**Venue:** ${source}\n`;
    if (year != null) text += `**Year:** ${year}\n`;
    if (work.type) text += `**Type:** ${work.type}\n`;
    if (work.cited_by_count != null) {
      text += `**Cited by:** ${work.cited_by_count.toLocaleString()}\n`;
    }
    if (work.open_access?.is_oa != null) {
      text += `**Open access:** ${work.open_access.is_oa ? 'yes' : 'no'}`;
      if (work.open_access.oa_status) text += ` (${work.open_access.oa_status})`;
      text += '\n';
    }
    const landing =
      work.primary_location?.landing_page_url ??
      (doi ? `https://doi.org/${doi}` : work.id);
    text += `**URL:** ${landing}\n`;
    if (work.primary_location?.pdf_url) {
      text += `**PDF:** ${work.primary_location.pdf_url}\n`;
    }

    const abstract = reconstructAbstract(work.abstract_inverted_index);
    if (abstract) {
      text += `\n## Abstract\n\n${abstract}`;
    }

    return text.trim();
  }

  private formatWorksListAsText(
    items: OpenAlexWork[],
    query: string,
    totalCount?: number
  ): string {
    if (items.length === 0) {
      return `No OpenAlex works found for "${query}".`;
    }

    let text = `Found ${items.length} work(s) for "${query}"`;
    if (totalCount != null) text += ` (${totalCount.toLocaleString()} total)`;
    text += ':\n\n';

    items.forEach((w, i) => {
      const title = w.title?.trim() || w.display_name?.trim() || '(no title)';
      const authors = this.formatAuthorships(w.authorships, 3);
      const source = w.primary_location?.source?.display_name;
      const year = w.publication_year;
      const openAlexId = shortOpenAlexId(w.id);

      text += `${i + 1}. **${title}**\n`;
      text += `   OpenAlex: ${openAlexId}\n`;
      if (authors) text += `   Authors: ${authors}\n`;
      const meta: string[] = [];
      if (source) meta.push(source);
      if (year != null) meta.push(String(year));
      if (w.cited_by_count != null) meta.push(`${w.cited_by_count} citations`);
      if (meta.length > 0) text += `   ${meta.join(' · ')}\n`;
      text += '\n';
    });

    text += 'Use get_work with an OpenAlex ID or DOI for full metadata and abstract.';
    return text.trim();
  }

  private formatAuthorAsText(author: OpenAlexAuthor): string {
    const name = author.display_name?.trim() || '(no name)';
    const openAlexId = shortOpenAlexId(author.id);

    let text = `# ${name}\n\n`;
    text += `**OpenAlex ID:** ${openAlexId}\n`;
    if (author.orcid) text += `**ORCID:** ${author.orcid}\n`;
    if (author.works_count != null) {
      text += `**Works:** ${author.works_count.toLocaleString()}\n`;
    }
    if (author.cited_by_count != null) {
      text += `**Cited by:** ${author.cited_by_count.toLocaleString()}\n`;
    }
    const hIndex = author.summary_stats?.h_index ?? author.h_index;
    const i10 = author.summary_stats?.i10_index ?? author.i10_index;
    if (hIndex != null) text += `**h-index:** ${hIndex}\n`;
    if (i10 != null) text += `**i10-index:** ${i10}\n`;
    const institutions = author.last_known_institutions
      ?.map((i) => i.display_name)
      .filter(Boolean);
    if (institutions && institutions.length > 0) {
      text += `**Affiliations:** ${institutions.join('; ')}\n`;
    }
    text += `**URL:** ${author.id}\n`;
    return text.trim();
  }

  private formatAuthorsListAsText(
    items: OpenAlexAuthor[],
    query: string,
    totalCount?: number
  ): string {
    if (items.length === 0) {
      return `No OpenAlex authors found for "${query}".`;
    }

    let text = `Found ${items.length} author(s) for "${query}"`;
    if (totalCount != null) text += ` (${totalCount.toLocaleString()} total)`;
    text += ':\n\n';

    items.forEach((a, i) => {
      const name = a.display_name?.trim() || '(no name)';
      const openAlexId = shortOpenAlexId(a.id);
      const inst = a.last_known_institutions?.[0]?.display_name;

      text += `${i + 1}. **${name}**\n`;
      text += `   OpenAlex: ${openAlexId}\n`;
      if (inst) text += `   Institution: ${inst}\n`;
      const stats: string[] = [];
      if (a.works_count != null) stats.push(`${a.works_count} works`);
      if (a.cited_by_count != null) stats.push(`${a.cited_by_count} citations`);
      const h = a.summary_stats?.h_index ?? a.h_index;
      if (h != null) stats.push(`h-index ${h}`);
      if (stats.length > 0) text += `   ${stats.join(' · ')}\n`;
      text += '\n';
    });

    text += 'Use get_author with an OpenAlex ID for full profile details.';
    return text.trim();
  }

  private formatAuthorships(authorships?: OpenAlexWork['authorships'], max = 5): string {
    if (!authorships || authorships.length === 0) return '';
    const names = authorships
      .map((a) => a.author?.display_name?.trim())
      .filter((n): n is string => Boolean(n));

    if (names.length === 0) return '';
    if (names.length <= max) return names.join(', ');
    return `${names.slice(0, max).join(', ')}, et al. (${names.length} authors)`;
  }
}

function shortOpenAlexId(id: string): string {
  const match = id.match(/([WA]\d+)$/i);
  return match ? match[1]!.toUpperCase() : id;
}
