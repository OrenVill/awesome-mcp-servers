import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  StackExchangeService,
  StackExchangeApiError,
  type StackExchangeQuestion,
  type StackExchangeTag,
} from '../../services/stackexchangeService.js';

export const SEARCH_QUESTIONS_DEF = {
  name: 'search_questions',
  description:
    "📚 I'm searching Stack Exchange questions\n\nSearch questions on a Stack Exchange site (default: Stack Overflow) using the advanced search API. No API key required. Pass an array of queries to run several searches in one call.",
  keywords: [
    'stackexchange',
    'stackoverflow',
    'questions',
    'search',
    'programming',
    'q&a',
  ],
};

export const GET_QUESTION_DEF = {
  name: 'get_question',
  description:
    "📚 I'm fetching Stack Exchange questions\n\nGet one or more questions by ID (title, score, tags, link, answer count, owner). Default site is Stack Overflow. Pass multiple IDs to fetch them in a single API call.",
  keywords: [
    'stackexchange',
    'stackoverflow',
    'question',
    'id',
    'post',
    'details',
  ],
};

export const SEARCH_TAGS_DEF = {
  name: 'search_tags',
  description:
    "📚 I'm searching Stack Exchange tags\n\nFind tags whose name contains a substring (e.g. `react`, `python`). Returns tag name and usage count on the given site (default: Stack Overflow).",
  keywords: ['stackexchange', 'stackoverflow', 'tags', 'topics', 'labels'],
};

export interface SearchQuestionsInput {
  query: string | string[];
  site?: string;
  pagesize?: number;
}

export interface GetQuestionInput {
  question_id?: number | number[];
  ids?: number | number[];
  site?: string;
}

export interface SearchTagsInput {
  inname: string;
  site?: string;
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
    description: `${description} Accepts a single value or an array for batch requests.`,
  };
}

function numberOrArraySchema(description: string): object {
  return {
    oneOf: [
      { type: 'number' },
      { type: 'array', items: { type: 'number' }, minItems: 1 },
    ],
    description: `${description} Accepts a single ID or an array of IDs.`,
  };
}

const BATCH_SEPARATOR = '\n\n---\n\n';

export class StackExchangeTools {
  private service: StackExchangeService;

  constructor(service?: StackExchangeService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new StackExchangeService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        defaultSite: api.defaultSite,
      });
    }
  }

  static getSearchQuestionsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Search terms (supports Stack Exchange search syntax).'),
          site: {
            type: 'string',
            description:
              'Stack Exchange site name, e.g. "stackoverflow", "superuser", "serverfault". Defaults to STACKEXCHANGE_SITE or stackoverflow.',
          },
          pagesize: {
            type: 'number',
            description: 'Number of results per query (1-100)',
            minimum: 1,
            maximum: 100,
            default: 15,
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetQuestionSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          question_id: numberOrArraySchema('Question ID on the site.'),
          ids: numberOrArraySchema('Alias for question_id — one ID or many.'),
          site: {
            type: 'string',
            description:
              'Stack Exchange site name. Defaults to STACKEXCHANGE_SITE or stackoverflow.',
          },
        },
      },
    };
  }

  static getSearchTagsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          inname: {
            type: 'string',
            description: 'Substring to match in tag names, e.g. "java" or "react".',
          },
          site: {
            type: 'string',
            description:
              'Stack Exchange site name. Defaults to STACKEXCHANGE_SITE or stackoverflow.',
          },
        },
        required: ['inname'],
      },
    };
  }

  async executeSearchQuestions(args: SearchQuestionsInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }
    if (args.pagesize !== undefined && (args.pagesize < 1 || args.pagesize > 100)) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'pagesize must be between 1 and 100'
      );
    }

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const result = await this.service.searchQuestions({
            query,
            site: args.site,
            pagesize: args.pagesize,
          });
          return this.formatSearchQuestionsAsText(query, args.site, result.items, result.has_more);
        } catch (err) {
          return this.formatErrorSection(err, `Search failed for query: ${query}`);
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetQuestion(args: GetQuestionInput): Promise<MCPToolCallResult> {
    const rawIds = args.question_id ?? args.ids;
    if (rawIds === undefined || rawIds === null) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'question_id or ids is required (number or array of numbers)'
      );
    }

    const { items, isBatch } = normalizeToArray(rawIds);
    if (
      items.length === 0 ||
      items.some((id) => typeof id !== 'number' || !Number.isFinite(id) || id <= 0)
    ) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'question IDs must be positive numbers'
      );
    }

    try {
      const result = await this.service.getQuestions({
        ids: items.map((id) => Math.floor(id)),
        site: args.site,
      });
      const byId = new Map(result.items.map((q) => [q.question_id, q]));
      const sections = items.map((id) => {
        const qid = Math.floor(id);
        const question = byId.get(qid);
        if (!question) {
          return `Question ${qid}: not found on site "${this.service.resolveSite(args.site)}".`;
        }
        return this.formatQuestionAsText(question, args.site);
      });

      if (!isBatch && sections.length === 1) {
        return { content: [{ type: 'text', text: sections[0] }] };
      }
      return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return createMCPErrorResult(MCPErrorCode.API_ERROR, msg);
    }
  }

  async executeSearchTags(args: SearchTagsInput): Promise<MCPToolCallResult> {
    if (!args.inname || typeof args.inname !== 'string' || !args.inname.trim()) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'inname is required and must be a non-empty string'
      );
    }

    try {
      const result = await this.service.searchTags({
        inname: args.inname.trim(),
        site: args.site,
      });
      const text = this.formatTagsAsText(args.inname, args.site, result.items);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return createMCPErrorResult(MCPErrorCode.API_ERROR, msg);
    }
  }

  private formatSearchQuestionsAsText(
    query: string,
    site: string | undefined,
    items: StackExchangeQuestion[],
    hasMore?: boolean
  ): string {
    const siteName = this.service.resolveSite(site);
    const lines: string[] = [
      `Search: "${query}" on ${siteName}`,
      `Results: ${items.length}${hasMore ? ' (more available)' : ''}`,
      '',
    ];
    if (items.length === 0) {
      lines.push('No questions matched.');
      return lines.join('\n');
    }
    for (const q of items) {
      lines.push(this.formatQuestionSummary(q));
      lines.push('');
    }
    return lines.join('\n').trimEnd();
  }

  private formatQuestionAsText(q: StackExchangeQuestion, site?: string): string {
    const siteName = this.service.resolveSite(site);
    const lines: string[] = [
      `# ${q.title ?? '(untitled)'}`,
      `Site: ${siteName}`,
      `ID: ${q.question_id}`,
    ];
    if (q.link) lines.push(`Link: ${q.link}`);
    if (q.score !== undefined) lines.push(`Score: ${q.score}`);
    if (q.view_count !== undefined) lines.push(`Views: ${q.view_count}`);
    if (q.answer_count !== undefined) lines.push(`Answers: ${q.answer_count}`);
    if (q.is_answered !== undefined) {
      lines.push(`Answered: ${q.is_answered ? 'yes' : 'no'}`);
    }
    if (q.tags?.length) lines.push(`Tags: ${q.tags.join(', ')}`);
    if (q.creation_date) {
      lines.push(`Created: ${new Date(q.creation_date * 1000).toISOString()}`);
    }
    if (q.owner?.display_name) {
      lines.push(`Author: ${q.owner.display_name}`);
    }
    const body = q.body_markdown ?? q.body;
    if (body) {
      lines.push('', 'Body (excerpt):', body.slice(0, 2000) + (body.length > 2000 ? '…' : ''));
    }
    return lines.join('\n');
  }

  private formatQuestionSummary(q: StackExchangeQuestion): string {
    const parts = [
      `[${q.question_id}] ${q.title ?? '(untitled)'}`,
      q.link ? `  ${q.link}` : '',
      `  score=${q.score ?? 0} answers=${q.answer_count ?? 0}${q.is_answered ? ' ✓' : ''}`,
    ];
    if (q.tags?.length) parts.push(`  tags: ${q.tags.join(', ')}`);
    return parts.filter(Boolean).join('\n');
  }

  private formatTagsAsText(
    inname: string,
    site: string | undefined,
    items: StackExchangeTag[]
  ): string {
    const siteName = this.service.resolveSite(site);
    const lines: string[] = [
      `Tags matching "${inname}" on ${siteName}`,
      `Found: ${items.length}`,
      '',
    ];
    if (items.length === 0) {
      lines.push('No tags matched.');
      return lines.join('\n');
    }
    for (const tag of items) {
      lines.push(`- ${tag.name} (${tag.count ?? 0} questions)`);
    }
    return lines.join('\n');
  }

  private formatErrorSection(err: unknown, context: string): string {
    if (err instanceof StackExchangeApiError) {
      return `${context}\nError: ${err.message}`;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return `${context}\nError: ${msg}`;
  }
}
