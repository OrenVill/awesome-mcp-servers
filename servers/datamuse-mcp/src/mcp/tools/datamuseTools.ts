import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import { DatamuseService, type DatamuseWord } from '../../services/datamuseService.js';

export const FIND_RHYMES_DEF = {
  name: 'find_rhymes',
  description:
    "🔤 I'm finding rhymes\n\nFind words that rhyme with a given word using the Datamuse API. Useful for poetry, songwriting, and wordplay.",
  keywords: ['datamuse', 'rhymes', 'rhyme', 'words', 'poetry', 'songwriting'],
};
export const FIND_SYNONYMS_DEF = {
  name: 'find_synonyms',
  description:
    "🔤 I'm finding synonyms\n\nFind synonyms for a given word using the Datamuse API. Returns words with the same or similar meaning.",
  keywords: ['datamuse', 'synonyms', 'synonym', 'thesaurus', 'words', 'similar'],
};
export const MEANS_LIKE_DEF = {
  name: 'means_like',
  description:
    "🔤 I'm finding words by meaning\n\nFind words with similar meaning to the query (concept search). Accepts multi-word phrases (e.g., \"ringing in the ears\").",
  keywords: ['datamuse', 'meaning', 'concept', 'related', 'words', 'definition'],
};
export const SOUNDS_LIKE_DEF = {
  name: 'sounds_like',
  description:
    "🔤 I'm finding words that sound alike\n\nFind words that sound similar to the input word using the Datamuse API. Useful for phonetic matching and homophones.",
  keywords: ['datamuse', 'sounds', 'phonetic', 'homophone', 'words', 'pronunciation'],
};
export const SUGGEST_DEF = {
  name: 'suggest',
  description:
    "🔤 I'm suggesting word completions\n\nGet autocomplete-style suggestions for a prefix using the Datamuse API. Returns likely word completions ranked by popularity.",
  keywords: ['datamuse', 'suggest', 'autocomplete', 'completion', 'prefix', 'words'],
};

export interface FindRhymesInput {
  word: string;
  limit?: number;
}

export interface FindSynonymsInput {
  word: string;
  limit?: number;
}

export interface MeansLikeInput {
  query: string;
  limit?: number;
}

export interface SoundsLikeInput {
  word: string;
  limit?: number;
}

export interface SuggestInput {
  prefix: string;
  limit?: number;
}

export class DatamuseTools {
  private service: DatamuseService;

  constructor(service?: DatamuseService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new DatamuseService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getFindRhymesSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          word: {
            type: 'string',
            description: 'Word to find rhymes for (e.g. "moon")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ['word'],
      },
    };
  }

  static getFindSynonymsSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          word: {
            type: 'string',
            description: 'Word to find synonyms for (e.g. "happy")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ['word'],
      },
    };
  }

  static getMeansLikeSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Concept or phrase to search by meaning (multi-word allowed, e.g. "ringing in the ears")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ['query'],
      },
    };
  }

  static getSoundsLikeSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          word: {
            type: 'string',
            description: 'Word whose sound you want to match (e.g. "jirraf")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ['word'],
      },
    };
  }

  static getSuggestSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          prefix: {
            type: 'string',
            description: 'Prefix to autocomplete (e.g. "ele")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of suggestions to return (1-50)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
        },
        required: ['prefix'],
      },
    };
  }

  async executeFindRhymes(args: FindRhymesInput): Promise<MCPToolCallResult> {
    if (!args.word || typeof args.word !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'word is required and must be a string');
    }
    const limit = this.clampLimit(args.limit, 1, 100, 20);

    try {
      const results = await this.service.findRhymes(args.word, limit);
      const text = this.formatWordsAsText(results, `rhymes for "${args.word}"`);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Datamuse find_rhymes failed: ${message}`);
    }
  }

  async executeFindSynonyms(args: FindSynonymsInput): Promise<MCPToolCallResult> {
    if (!args.word || typeof args.word !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'word is required and must be a string');
    }
    const limit = this.clampLimit(args.limit, 1, 100, 20);

    try {
      const results = await this.service.findSynonyms(args.word, limit);
      const text = this.formatWordsAsText(results, `synonyms for "${args.word}"`);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Datamuse find_synonyms failed: ${message}`);
    }
  }

  async executeMeansLike(args: MeansLikeInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required and must be a string');
    }
    const limit = this.clampLimit(args.limit, 1, 100, 20);

    try {
      const results = await this.service.meansLike(args.query, limit);
      const text = this.formatWordsAsText(results, `words meaning like "${args.query}"`);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Datamuse means_like failed: ${message}`);
    }
  }

  async executeSoundsLike(args: SoundsLikeInput): Promise<MCPToolCallResult> {
    if (!args.word || typeof args.word !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'word is required and must be a string');
    }
    const limit = this.clampLimit(args.limit, 1, 100, 20);

    try {
      const results = await this.service.soundsLike(args.word, limit);
      const text = this.formatWordsAsText(results, `words that sound like "${args.word}"`);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Datamuse sounds_like failed: ${message}`);
    }
  }

  async executeSuggest(args: SuggestInput): Promise<MCPToolCallResult> {
    if (!args.prefix || typeof args.prefix !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'prefix is required and must be a string');
    }
    const limit = this.clampLimit(args.limit, 1, 50, 10);

    try {
      const results = await this.service.suggest(args.prefix, limit);
      const text = this.formatWordsAsText(results, `suggestions for "${args.prefix}"`);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Datamuse suggest failed: ${message}`);
    }
  }

  private clampLimit(value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(min, Math.min(max, n));
  }

  private formatWordsAsText(words: DatamuseWord[], label: string): string {
    if (words.length === 0) {
      return `No ${label} found.`;
    }

    let text = `Found ${words.length} ${label}:\n\n`;
    words.forEach((w, i) => {
      const score = w.score != null ? ` (score: ${w.score})` : '';
      text += `${i + 1}. ${w.word}${score}\n`;
    });
    return text.trim();
  }
}
