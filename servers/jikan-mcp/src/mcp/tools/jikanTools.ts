import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  JikanService,
  type JikanAnime,
  type JikanTopAnimeFilter,
} from '../../services/jikanService.js';

export const SEARCH_ANIME_DEF = {
  name: 'search_anime',
  description:
    "🎌 I'm searching MyAnimeList anime via Jikan\n\nSearch anime by title or keywords using the unofficial Jikan API (MyAnimeList). Returns MAL IDs, scores, status, and type. Pass an array of queries to search several titles at once (requests are rate-limited to 3/s).",
  keywords: [
    'jikan',
    'mal',
    'myanimelist',
    'anime',
    'search',
    'manga',
    'batch',
    'query',
  ],
};

export const GET_ANIME_DEF = {
  name: 'get_anime',
  description:
    "🎌 I'm loading anime details from MyAnimeList\n\nGet full anime metadata by MyAnimeList ID (mal_id from search_anime). Returns synopsis, genres, episodes, score, and airing info.",
  keywords: ['jikan', 'mal', 'myanimelist', 'anime', 'details', 'synopsis', 'mal_id'],
};

export const GET_TOP_ANIME_DEF = {
  name: 'get_top_anime',
  description:
    "🏆 I'm fetching top anime from MyAnimeList\n\nGet top-ranked anime lists from MAL via Jikan. Optional filter: airing, upcoming, bypopularity, or favorite. Returns mal_id, rank, score, and title.",
  keywords: [
    'jikan',
    'mal',
    'myanimelist',
    'anime',
    'top',
    'ranking',
    'popular',
    'airing',
  ],
};

export interface SearchAnimeInput {
  query: string | string[];
  limit?: number;
  page?: number;
}

export interface GetAnimeInput {
  mal_id: number;
}

export interface GetTopAnimeInput {
  filter?: JikanTopAnimeFilter;
  limit?: number;
  page?: number;
}

const TOP_FILTERS: JikanTopAnimeFilter[] = [
  'airing',
  'upcoming',
  'bypopularity',
  'favorite',
];

const BATCH_SEPARATOR = '\n\n---\n\n';

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

export class JikanTools {
  private service: JikanService;

  constructor(service?: JikanService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new JikanService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        minRequestIntervalMs: api.minRequestIntervalMs,
      });
    }
  }

  static getSearchAnimeSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Search query (anime title or keywords).'),
          limit: {
            type: 'number',
            description: 'Maximum results per query (1-25)',
            minimum: 1,
            maximum: 25,
            default: 10,
          },
          page: {
            type: 'number',
            description: 'Results page (1-based)',
            minimum: 1,
            default: 1,
          },
        },
        required: ['query'],
      },
    };
  }

  static getAnimeSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          mal_id: {
            type: 'integer',
            description: 'MyAnimeList anime ID (positive integer from search_anime)',
            minimum: 1,
          },
        },
        required: ['mal_id'],
      },
    };
  }

  static getTopAnimeSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          filter: {
            type: 'string',
            enum: TOP_FILTERS,
            description:
              'Top list type: airing, upcoming, bypopularity, or favorite. Omit for the default all-time top list.',
          },
          limit: {
            type: 'number',
            description: 'Maximum results (1-25)',
            minimum: 1,
            maximum: 25,
            default: 10,
          },
          page: {
            type: 'number',
            description: 'Results page (1-based)',
            minimum: 1,
            default: 1,
          },
        },
      },
    };
  }

  async executeSearchAnime(args: SearchAnimeInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((q) => !q || typeof q !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }
    const limit = this.clampLimit(args.limit, 1, 25, 10);
    const page = this.clampLimit(args.page, 1, 1000, 1);

    const sections: string[] = [];
    for (const query of items) {
      try {
        const response = await this.service.searchAnime({ query, limit, page });
        sections.push(this.formatSearchResults(response.data, query, response.pagination));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        sections.push(`Jikan search_anime failed for "${query}": ${message}`);
      }
    }

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetAnime(args: GetAnimeInput): Promise<MCPToolCallResult> {
    const id = this.parseMalId(args.mal_id);
    if (id === null) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'mal_id is required and must be a positive integer'
      );
    }

    try {
      const anime = await this.service.getAnime(id);
      return { content: [{ type: 'text', text: this.formatAnimeDetail(anime) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async executeGetTopAnime(args: GetTopAnimeInput): Promise<MCPToolCallResult> {
    const filter = args.filter;
    if (filter !== undefined && !TOP_FILTERS.includes(filter)) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        `filter must be one of: ${TOP_FILTERS.join(', ')}`
      );
    }
    const limit = this.clampLimit(args.limit, 1, 25, 10);
    const page = this.clampLimit(args.page, 1, 1000, 1);

    try {
      const response = await this.service.getTopAnime({ filter, limit, page });
      const label = filter ?? 'default top';
      return {
        content: [
          {
            type: 'text',
            text: this.formatTopResults(response.data, label, response.pagination),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  private parseMalId(value: unknown): number | null {
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

  private formatSearchResults(
    results: JikanAnime[],
    query: string,
    pagination?: { current_page?: number; items?: { total?: number } }
  ): string {
    if (results.length === 0) {
      return `No anime found for "${query}".`;
    }

    const total = pagination?.items?.total;
    const page = pagination?.current_page;
    let text = `Found ${results.length} anime for "${query}"`;
    if (total != null) text += ` (${total} total on MAL`;
    if (page != null) text += page > 1 || total != null ? `, page ${page}` : '';
    if (total != null) text += ')';
    text += ':\n\n';

    results.forEach((anime, i) => {
      text += this.formatAnimeLine(anime, i + 1);
    });
    return text.trim();
  }

  private formatTopResults(
    results: JikanAnime[],
    filterLabel: string,
    pagination?: { current_page?: number }
  ): string {
    if (results.length === 0) {
      return `No top anime returned for filter "${filterLabel}".`;
    }
    const page = pagination?.current_page;
    let text = `Top anime (${filterLabel})`;
    if (page != null && page > 1) text += ` — page ${page}`;
    text += `:\n\n`;
    results.forEach((anime, i) => {
      text += this.formatAnimeLine(anime, i + 1, true);
    });
    return text.trim();
  }

  private formatAnimeLine(anime: JikanAnime, index: number, showRank = false): string {
    const titleEn =
      anime.title_english && anime.title_english !== anime.title
        ? ` / ${anime.title_english}`
        : '';
    const score = anime.score != null ? ` — score ${anime.score}` : '';
    const rank =
      showRank && anime.rank != null ? ` — rank #${anime.rank}` : '';
    let line = `${index}. ${anime.title}${titleEn} (MAL ID: ${anime.mal_id}${rank}${score})\n`;
    const meta: string[] = [];
    if (anime.type) meta.push(anime.type);
    if (anime.status) meta.push(anime.status);
    if (anime.episodes != null) meta.push(`${anime.episodes} ep`);
    if (meta.length) line += `   ${meta.join(' | ')}\n`;
    if (anime.url) line += `   ${anime.url}\n`;
    return line;
  }

  private formatAnimeDetail(anime: JikanAnime): string {
    const lines: string[] = [];
    lines.push(`${anime.title} (MAL ID: ${anime.mal_id})`);
    if (anime.title_english) lines.push(`English: ${anime.title_english}`);
    if (anime.title_japanese) lines.push(`Japanese: ${anime.title_japanese}`);
    if (anime.url) lines.push(`URL: ${anime.url}`);
    if (anime.type) lines.push(`Type: ${anime.type}`);
    if (anime.source) lines.push(`Source: ${anime.source}`);
    if (anime.episodes != null) lines.push(`Episodes: ${anime.episodes}`);
    lines.push(`Status: ${anime.status ?? 'unknown'}`);
    if (anime.aired?.string) lines.push(`Aired: ${anime.aired.string}`);
    if (anime.score != null) {
      const scored =
        anime.scored_by != null ? ` (${anime.scored_by.toLocaleString()} scores)` : '';
      lines.push(`Score: ${anime.score}${scored}`);
    }
    if (anime.rank != null) lines.push(`Rank: #${anime.rank}`);
    if (anime.popularity != null) lines.push(`Popularity: #${anime.popularity}`);
    if (anime.rating) lines.push(`Rating: ${anime.rating}`);
    if (anime.duration) lines.push(`Duration: ${anime.duration}`);
    if (anime.season || anime.year) {
      lines.push(`Season: ${[anime.season, anime.year].filter(Boolean).join(' ')}`);
    }
    if (anime.genres?.length) {
      lines.push(`Genres: ${anime.genres.map((g) => g.name).join(', ')}`);
    }
    if (anime.studios?.length) {
      lines.push(`Studios: ${anime.studios.map((s) => s.name).join(', ')}`);
    }
    if (anime.synopsis) {
      lines.push('');
      lines.push('Synopsis:');
      lines.push(anime.synopsis.trim());
    }
    return lines.join('\n');
  }
}
