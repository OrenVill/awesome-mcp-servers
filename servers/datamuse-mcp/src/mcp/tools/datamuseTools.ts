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
import { DatamuseService, type DatamuseWord } from '../../services/datamuseService.js';

export const FIND_RHYMES_DEF = {
  name: 'find_rhymes',
  description:
    "🔤 I'm finding rhymes\n\nFind words that rhyme with a given word using the Datamuse API. Useful for poetry, songwriting, and wordplay. Pass an array of words to handle several at once in a single call.",
  keywords: ['datamuse', 'rhymes', 'rhyme', 'words', 'poetry', 'songwriting'],
};
export const FIND_SYNONYMS_DEF = {
  name: 'find_synonyms',
  description:
    "🔤 I'm finding synonyms\n\nFind synonyms for a given word using the Datamuse API. Returns words with the same or similar meaning. Pass an array of words to handle several at once in a single call.",
  keywords: ['datamuse', 'synonyms', 'synonym', 'thesaurus', 'words', 'similar'],
};
export const MEANS_LIKE_DEF = {
  name: 'means_like',
  description:
    "🔤 I'm finding words by meaning\n\nFind words with similar meaning to the query (concept search). Accepts multi-word phrases (e.g., \"ringing in the ears\"). Pass an array to handle several queries at once in a single call.",
  keywords: ['datamuse', 'meaning', 'concept', 'related', 'words', 'definition'],
};
export const SOUNDS_LIKE_DEF = {
  name: 'sounds_like',
  description:
    "🔤 I'm finding words that sound alike\n\nFind words that sound similar to the input word using the Datamuse API. Useful for phonetic matching and homophones. Pass an array of words to handle several at once in a single call.",
  keywords: ['datamuse', 'sounds', 'phonetic', 'homophone', 'words', 'pronunciation'],
};
export const SUGGEST_DEF = {
  name: 'suggest',
  description:
    "🔤 I'm suggesting word completions\n\nGet autocomplete-style suggestions for a prefix using the Datamuse API. Returns likely word completions ranked by popularity. Pass an array of prefixes to handle several at once in a single call.",
  keywords: ['datamuse', 'suggest', 'autocomplete', 'completion', 'prefix', 'words'],
};

export interface FindRhymesInput {
  word: string | string[];
  limit?: number;
}

export interface FindSynonymsInput {
  word: string | string[];
  limit?: number;
}

export interface MeansLikeInput {
  query: string | string[];
  limit?: number;
}

export interface SoundsLikeInput {
  word: string | string[];
  limit?: number;
}

export interface SuggestInput {
  prefix: string | string[];
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

  static getFindRhymesSchema(): { inputSchema: AgentReadyObjectInputSchema } {
    return {
      inputSchema: {
        type: 'object' as const,
        additionalProperties: true,
        description: AGENT_READY_BATCH_DESCRIPTION,
        examples: stringBatchInputExamples('word', defaultStringBatchOptions('word')),
        properties: {
          ...batchStringProperties('word', 'Word to find rhymes for (e.g. "moon").'),
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      },
    };
  }

  static getFindSynonymsSchema(): { inputSchema: AgentReadyObjectInputSchema } {
    return {
      inputSchema: {
        type: 'object' as const,
        additionalProperties: true,
        description: AGENT_READY_BATCH_DESCRIPTION,
        examples: stringBatchInputExamples('word', defaultStringBatchOptions('word')),
        properties: {
          ...batchStringProperties('word', 'Word to find synonyms for (e.g. "happy").'),
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      },
    };
  }

  static getMeansLikeSchema(): { inputSchema: AgentReadyObjectInputSchema } {
    return {
      inputSchema: {
        type: 'object' as const,
        additionalProperties: true,
        description: AGENT_READY_BATCH_DESCRIPTION,
        examples: stringBatchInputExamples('query', defaultStringBatchOptions('query')),
        properties: {
          ...batchStringProperties('query', 'Concept or phrase to search by meaning (multi-word allowed, e.g. "ringing in the ears").'),
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      },
    };
  }

  static getSoundsLikeSchema(): { inputSchema: AgentReadyObjectInputSchema } {
    return {
      inputSchema: {
        type: 'object' as const,
        additionalProperties: true,
        description: AGENT_READY_BATCH_DESCRIPTION,
        examples: stringBatchInputExamples('word', defaultStringBatchOptions('word')),
        properties: {
          ...batchStringProperties('word', 'Word whose sound you want to match (e.g. "jirraf").'),
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      },
    };
  }

  static getSuggestSchema(): { inputSchema: AgentReadyObjectInputSchema } {
    return {
      inputSchema: {
        type: 'object' as const,
        additionalProperties: true,
        description: AGENT_READY_BATCH_DESCRIPTION,
        examples: stringBatchInputExamples('prefix', defaultStringBatchOptions('prefix')),
        properties: {
          ...batchStringProperties('prefix', 'Prefix to autocomplete (e.g. "ele").'),
          limit: {
            type: 'number',
            description: 'Maximum number of suggestions to return (1-50)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
        },
      },
    };
  }

  async executeFindRhymes(args: FindRhymesInput): Promise<MCPToolCallResult> {
    const wordBatch = normalizeStringArgFromArgs(args, 'word');
    if ('field' in wordBatch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(wordBatch));
    }
    const { items, isBatch } = wordBatch;
    if (items.length === 0 || items.some((w) => !w || typeof w !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'word is required and must be a string or a non-empty array of strings'
      );
    }
    const limit = this.clampLimit(args.limit, 1, 100, 20);

    const sections = await Promise.all(
      items.map(async (word) => {
        try {
          const results = await this.service.findRhymes(word, limit);
          return this.formatWordsAsText(results, `rhymes for "${word}"`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Datamuse find_rhymes failed for "${word}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeFindSynonyms(args: FindSynonymsInput): Promise<MCPToolCallResult> {
    const wordBatch = normalizeStringArgFromArgs(args, 'word');
    if ('field' in wordBatch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(wordBatch));
    }
    const { items, isBatch } = wordBatch;
    if (items.length === 0 || items.some((w) => !w || typeof w !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'word is required and must be a string or a non-empty array of strings'
      );
    }
    const limit = this.clampLimit(args.limit, 1, 100, 20);

    const sections = await Promise.all(
      items.map(async (word) => {
        try {
          const results = await this.service.findSynonyms(word, limit);
          return this.formatWordsAsText(results, `synonyms for "${word}"`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Datamuse find_synonyms failed for "${word}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeMeansLike(args: MeansLikeInput): Promise<MCPToolCallResult> {
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
    const limit = this.clampLimit(args.limit, 1, 100, 20);

    const sections = await Promise.all(
      items.map(async (query) => {
        try {
          const results = await this.service.meansLike(query, limit);
          return this.formatWordsAsText(results, `words meaning like "${query}"`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Datamuse means_like failed for "${query}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSoundsLike(args: SoundsLikeInput): Promise<MCPToolCallResult> {
    const wordBatch = normalizeStringArgFromArgs(args, 'word');
    if ('field' in wordBatch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(wordBatch));
    }
    const { items, isBatch } = wordBatch;
    if (items.length === 0 || items.some((w) => !w || typeof w !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'word is required and must be a string or a non-empty array of strings'
      );
    }
    const limit = this.clampLimit(args.limit, 1, 100, 20);

    const sections = await Promise.all(
      items.map(async (word) => {
        try {
          const results = await this.service.soundsLike(word, limit);
          return this.formatWordsAsText(results, `words that sound like "${word}"`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Datamuse sounds_like failed for "${word}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSuggest(args: SuggestInput): Promise<MCPToolCallResult> {
    const prefixBatch = normalizeStringArgFromArgs(args, 'prefix');
    if ('field' in prefixBatch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(prefixBatch));
    }
    const { items, isBatch } = prefixBatch;
    if (items.length === 0 || items.some((p) => !p || typeof p !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'prefix is required and must be a string or a non-empty array of strings'
      );
    }
    const limit = this.clampLimit(args.limit, 1, 50, 10);

    const sections = await Promise.all(
      items.map(async (prefix) => {
        try {
          const results = await this.service.suggest(prefix, limit);
          return this.formatWordsAsText(results, `suggestions for "${prefix}"`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Datamuse suggest failed for "${prefix}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
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
