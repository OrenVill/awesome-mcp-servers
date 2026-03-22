import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  HackerNewsService,
  type HNItem,
  type StoryListType,
} from '../../services/hackerNewsService.js';

export interface GetTopStoriesInput {
  count?: number;
  listType?: 'top' | 'new' | 'best';
}

export interface GetStoryInput {
  id: number;
}

export interface GetCommentsInput {
  storyId: number;
  maxDepth?: number;
  maxComments?: number;
}

export interface SearchHNInput {
  query: string;
  hitsPerPage?: number;
  page?: number;
}

export class HackerNewsTools {
  private service: HackerNewsService;

  constructor(service?: HackerNewsService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new HackerNewsService({
        firebaseBase: api.firebaseBaseUrl,
        algoliaBase: api.algoliaBaseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getTopStoriesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          count: {
            type: 'number',
            description: 'Number of top stories to fetch (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          listType: {
            type: 'string',
            enum: ['top', 'new', 'best'],
            description: 'Story list: top (default), new, or best',
            default: 'top',
          },
        },
        required: [],
      },
    };
  }

  static getStorySchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'number',
            description: 'Hacker News item ID (story, comment, job, etc.)',
          },
        },
        required: ['id'],
      },
    };
  }

  static getCommentsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          storyId: {
            type: 'number',
            description: 'Story ID to fetch comments for',
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum nesting depth for comment tree (default 3)',
            minimum: 1,
            maximum: 10,
            default: 3,
          },
          maxComments: {
            type: 'number',
            description: 'Maximum total comments to fetch (default 50)',
            minimum: 1,
            maximum: 200,
            default: 50,
          },
        },
        required: ['storyId'],
      },
    };
  }

  static getSearchHNSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Search query for Hacker News',
          },
          hitsPerPage: {
            type: 'number',
            description: 'Number of results per page (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          page: {
            type: 'number',
            description: 'Page number (0-based) for pagination',
            minimum: 0,
            default: 0,
          },
        },
        required: ['query'],
      },
    };
  }

  async executeGetTopStories(args: GetTopStoriesInput): Promise<MCPToolCallResult> {
    const count = Math.min(Math.max(args.count ?? 20, 1), 100);
    const listType = (args.listType ?? 'top') as StoryListType;

    try {
      const ids = await this.service.getStoryIds(listType);
      const slice = ids.slice(0, count);
      const items: HNItem[] = [];

      for (const id of slice) {
        const item = await this.service.getItem(id);
        if (item && !item.deleted && !item.dead) {
          items.push(item);
        }
      }

      const text = this.formatStoriesAsText(items, listType);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Fetch failed: ${message}`);
    }
  }

  async executeGetStory(args: GetStoryInput): Promise<MCPToolCallResult> {
    const id = args.id;
    if (typeof id !== 'number' || id < 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'id must be a non-negative number');
    }

    try {
      const item = await this.service.getItem(id);
      if (!item) {
        return { content: [{ type: 'text', text: `Item ${id} not found.` }] };
      }

      const text = this.formatItemAsText(item);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Fetch failed: ${message}`);
    }
  }

  async executeGetComments(args: GetCommentsInput): Promise<MCPToolCallResult> {
    const storyId = args.storyId;
    const maxDepth = Math.min(Math.max(args.maxDepth ?? 3, 1), 10);
    const maxComments = Math.min(Math.max(args.maxComments ?? 50, 1), 200);

    if (typeof storyId !== 'number' || storyId < 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'storyId must be a non-negative number');
    }

    try {
      const story = await this.service.getItem(storyId);
      if (!story) {
        return { content: [{ type: 'text', text: `Story ${storyId} not found.` }] };
      }

      if (story.type !== 'story' && story.type !== 'job' && story.type !== 'poll') {
        return { content: [{ type: 'text', text: `Item ${storyId} is not a story (type: ${story.type ?? 'unknown'}).` }] };
      }

      const kids = story.kids ?? [];
      if (kids.length === 0) {
        const text = this.formatItemAsText(story) + '\n\nNo comments yet.';
        return { content: [{ type: 'text', text }] };
      }

      const comments: HNItem[] = [];
      const fetchKids = async (ids: number[], depth: number): Promise<void> => {
        if (depth > maxDepth || comments.length >= maxComments) return;
        for (const kidId of ids) {
          if (comments.length >= maxComments) break;
          const kid = await this.service.getItem(kidId);
          if (kid && !kid.deleted && !kid.dead) {
            comments.push(kid);
            if (kid.kids?.length && depth < maxDepth) {
              await fetchKids(kid.kids, depth + 1);
            }
          }
        }
      };

      await fetchKids(kids, 1);

      const text = this.formatItemAsText(story) + '\n\n' + this.formatCommentTree(story, comments, kids);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Fetch failed: ${message}`);
    }
  }

  async executeSearchHN(args: SearchHNInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required');
    }

    try {
      const response = await this.service.search({
        query: args.query,
        hitsPerPage: args.hitsPerPage ?? 20,
        page: args.page ?? 0,
      });

      const text = this.formatSearchResultsAsText(response);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Search failed: ${message}`);
    }
  }

  private formatStoriesAsText(items: HNItem[], listType: string): string {
    let text = `# Hacker News ${listType} stories (${items.length})\n\n`;
    items.forEach((item, i) => {
      const title = item.title ?? '(no title)';
      const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
      const by = item.by ?? 'unknown';
      const score = item.score ?? 0;
      const kidsCount = item.descendants ?? item.kids?.length ?? 0;
      text += `${i + 1}. **${title}**\n`;
      text += `   URL: ${url}\n`;
      text += `   by ${by} | ${score} points | ${kidsCount} comments | id: ${item.id}\n\n`;
    });
    return text.trim();
  }

  private formatItemAsText(item: HNItem): string {
    const type = item.type ?? 'item';
    let text = `# ${type}: ${item.title ?? '(no title)'}\n\n`;
    if (item.url) text += `URL: ${item.url}\n`;
    text += `by ${item.by ?? 'unknown'} | ${item.score ?? 0} points | `;
    text += `${item.descendants ?? item.kids?.length ?? 0} comments | id: ${item.id}\n`;
    if (item.time) {
      text += `Posted: ${new Date(item.time * 1000).toISOString()}\n`;
    }
    if (item.text) {
      text += `\n${item.text}\n`;
    }
    return text.trim();
  }

  private formatCommentTree(story: HNItem, comments: HNItem[], topKids: number[]): string {
    const byId = new Map(comments.map((c) => [c.id, c]));
    let text = '## Comments\n\n';

    const formatComment = (item: HNItem, indent: string): string => {
      const by = item.by ?? 'unknown';
      const time = item.time ? new Date(item.time * 1000).toLocaleDateString() : '';
      const preview = (item.text ?? '')
        .replace(/<[^>]+>/g, '')
        .slice(0, 200);
      if (preview.length < (item.text ?? '').length) {
        return `${indent}**${by}** (${time}): ${preview}...\n`;
      }
      return `${indent}**${by}** (${time}): ${preview}\n`;
    };

    const render = (ids: number[], depth: number): void => {
      const prefix = '  '.repeat(depth);
      for (const id of ids) {
        const c = byId.get(id);
        if (c) {
          text += formatComment(c, prefix);
          if (c.kids?.length) render(c.kids, depth + 1);
        }
      }
    };

    render(topKids, 0);
    return text.trim();
  }

  private formatSearchResultsAsText(response: {
    hits: Array<{
      objectID: string;
      title: string;
      url?: string;
      author: string;
      points: number;
      num_comments: number;
      created_at: string;
    }>;
    nbHits: number;
    page: number;
    nbPages: number;
    query: string;
  }): string {
    const { hits, nbHits, page, nbPages, query } = response;
    let text = `# Hacker News search: "${query}"\n`;
    text += `${nbHits} result(s), page ${page + 1}/${nbPages || 1}\n\n`;

    hits.forEach((h, i) => {
      const url = h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`;
      text += `${i + 1}. **${h.title}**\n`;
      text += `   ${url}\n`;
      text += `   by ${h.author} | ${h.points} points | ${h.num_comments} comments | id: ${h.objectID}\n`;
      text += `   ${h.created_at}\n\n`;
    });

    return text.trim();
  }
}
