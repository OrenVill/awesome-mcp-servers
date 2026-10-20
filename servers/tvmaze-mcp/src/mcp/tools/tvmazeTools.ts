import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  TvmazeService,
  type TvmazeEpisode,
  type TvmazeSearchResult,
  type TvmazeShow,
} from '../../services/tvmazeService.js';

export const SEARCH_SHOWS_DEF = {
  name: 'search_shows',
  description:
    "📺 I'm searching TVMaze for TV shows\n\nSearch TV shows by title or keywords using the TVMaze API. Returns matching shows with TVMaze ID, status, genres, and rating. Pass an array of queries to search several titles at once in a single call.",
  keywords: [
    'tvmaze',
    'tv',
    'television',
    'shows',
    'series',
    'search',
    'batch',
    'query',
  ],
};

export const GET_SHOW_DEF = {
  name: 'get_show',
  description:
    "📺 I'm loading a TVMaze show\n\nGet full details for a TV show by TVMaze show ID (from search_shows). Returns schedule, network, genres, status, and summary.",
  keywords: ['tvmaze', 'tv', 'show', 'series', 'details', 'metadata'],
};

export const GET_SHOW_EPISODES_DEF = {
  name: 'get_show_episodes',
  description:
    "📺 I'm listing TVMaze episodes\n\nList all episodes for a TV show by TVMaze show ID. Returns season/episode numbers, air dates, and titles in broadcast order.",
  keywords: ['tvmaze', 'tv', 'episodes', 'season', 'airdate', 'series'],
};

export interface SearchShowsInput {
  query: string | string[];
  limit?: number;
}

export interface GetShowInput {
  tvmaze_id: number;
}

export interface GetShowEpisodesInput {
  tvmaze_id: number;
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

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export class TvmazeTools {
  private service: TvmazeService;

  constructor(service?: TvmazeService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new TvmazeService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchShowsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Search query (show title or keywords).'),
          limit: {
            type: 'number',
            description: 'Maximum number of results per query (1-25)',
            minimum: 1,
            maximum: 25,
            default: 10,
          },
        },
        required: ['query'],
      },
    };
  }

  static getShowSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          tvmaze_id: {
            type: 'integer',
            description: 'TVMaze show ID (positive integer from search_shows)',
            minimum: 1,
          },
        },
        required: ['tvmaze_id'],
      },
    };
  }

  static getShowEpisodesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          tvmaze_id: {
            type: 'integer',
            description: 'TVMaze show ID (positive integer from search_shows)',
            minimum: 1,
          },
        },
        required: ['tvmaze_id'],
      },
    };
  }

  async executeSearchShows(args: SearchShowsInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }
    const limit = this.clampLimit(args.limit, 1, 25, 10);

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const results = await this.service.searchShows(query);
          return this.formatSearchResults(results.slice(0, limit), query);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `TVMaze search_shows failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetShow(args: GetShowInput): Promise<MCPToolCallResult> {
    const id = this.parseShowId(args.tvmaze_id);
    if (id === null) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'tvmaze_id is required and must be a positive integer'
      );
    }

    try {
      const show = await this.service.getShow(id);
      return { content: [{ type: 'text', text: this.formatShow(show) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async executeGetShowEpisodes(args: GetShowEpisodesInput): Promise<MCPToolCallResult> {
    const id = this.parseShowId(args.tvmaze_id);
    if (id === null) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'tvmaze_id is required and must be a positive integer'
      );
    }

    try {
      const episodes = await this.service.getShowEpisodes(id);
      return {
        content: [{ type: 'text', text: this.formatEpisodes(episodes, id) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  private parseShowId(value: unknown): number | null {
    const n =
      typeof value === 'number' && Number.isFinite(value)
        ? Math.floor(value)
        : typeof value === 'string' && /^\d+$/.test(value)
          ? parseInt(value, 10)
          : NaN;
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }

  private clampLimit(value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(min, Math.min(max, n));
  }

  private formatSearchResults(results: TvmazeSearchResult[], query: string): string {
    if (results.length === 0) {
      return `No TV shows found for "${query}".`;
    }

    let text = `Found ${results.length} show(s) for "${query}":\n\n`;
    results.forEach((r, i) => {
      const show = r.show;
      const rating = show.rating?.average != null ? ` — rating ${show.rating.average}` : '';
      const genres = show.genres?.length ? show.genres.join(', ') : 'n/a';
      text += `${i + 1}. ${show.name} (TVMaze ID: ${show.id}, score: ${r.score.toFixed(3)})\n`;
      text += `   Status: ${show.status ?? 'unknown'} | Genres: ${genres}${rating}\n`;
      if (show.premiered) {
        text += `   Premiered: ${show.premiered}${show.ended ? ` | Ended: ${show.ended}` : ''}\n`;
      }
      if (show.url) {
        text += `   ${show.url}\n`;
      }
    });
    return text.trim();
  }

  private formatShow(show: TvmazeShow): string {
    const lines: string[] = [];
    lines.push(`${show.name} (TVMaze ID: ${show.id})`);
    if (show.url) lines.push(`URL: ${show.url}`);
    if (show.type) lines.push(`Type: ${show.type}`);
    if (show.language) lines.push(`Language: ${show.language}`);
    if (show.genres?.length) lines.push(`Genres: ${show.genres.join(', ')}`);
    lines.push(`Status: ${show.status ?? 'unknown'}`);
    if (show.rating?.average != null) lines.push(`Rating: ${show.rating.average}`);
    const runtime = show.averageRuntime ?? show.runtime;
    if (runtime != null) lines.push(`Runtime: ${runtime} min`);
    if (show.premiered) {
      lines.push(`Premiered: ${show.premiered}${show.ended ? ` | Ended: ${show.ended}` : ''}`);
    }
    const network = show.network?.name ?? show.webChannel?.name;
    if (network) lines.push(`Network: ${network}`);
    if (show.schedule?.days?.length) {
      const time = show.schedule.time ? ` at ${show.schedule.time}` : '';
      lines.push(`Schedule: ${show.schedule.days.join(', ')}${time}`);
    }
    if (show.officialSite) lines.push(`Site: ${show.officialSite}`);
    const imdb = show.externals?.imdb;
    if (imdb) lines.push(`IMDb: tt${imdb.replace(/^tt/, '')}`);
    const summary = stripHtml(show.summary);
    if (summary) {
      lines.push('');
      lines.push('Summary:');
      lines.push(summary);
    }
    return lines.join('\n');
  }

  private formatEpisodes(episodes: TvmazeEpisode[], showId: number): string {
    if (episodes.length === 0) {
      return `No episodes listed for TVMaze show ID ${showId}.`;
    }

    let text = `${episodes.length} episode(s) for show ID ${showId}:\n\n`;
    for (const ep of episodes) {
      const epNum = ep.number != null ? `${ep.season}x${String(ep.number).padStart(2, '0')}` : `S${ep.season}`;
      const air = ep.airdate ? ` — ${ep.airdate}` : '';
      const runtime = ep.runtime != null ? ` (${ep.runtime} min)` : '';
      text += `- ${epNum}: ${ep.name}${air}${runtime}\n`;
    }
    return text.trim();
  }
}
