import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  DictionaryService,
  DictionaryNotFoundError,
  type DictionaryEntry,
  type DictionaryPhonetic,
} from '../../services/dictionaryService.js';

export const DEFINE_WORD_DEF = {
  name: 'define_word',
  description:
    "📚 I'm looking up word definitions\n\nGet the full dictionary entry for a word: phonetic, parts of speech, definitions, and example usages. Defaults to English.",
  keywords: ['dictionary', 'definition', 'define', 'meaning', 'word', 'vocabulary'],
};
export const GET_SYNONYMS_DEF = {
  name: 'get_synonyms',
  description:
    "🔁 I'm finding synonyms\n\nReturn synonyms for a word, grouped by part of speech, sourced from the dictionary entry.",
  keywords: ['dictionary', 'synonyms', 'thesaurus', 'similar', 'word', 'vocabulary'],
};
export const GET_PHONETICS_DEF = {
  name: 'get_phonetics',
  description:
    "🔊 I'm fetching phonetics\n\nReturn IPA phonetic spellings and audio pronunciation URLs for a word.",
  keywords: ['dictionary', 'phonetics', 'pronunciation', 'ipa', 'audio', 'word'],
};

export interface DefineWordInput {
  word: string | string[];
  lang?: string;
}

export interface GetSynonymsInput {
  word: string | string[];
  lang?: string;
}

export interface GetPhoneticsInput {
  word: string | string[];
  lang?: string;
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

export class DictionaryTools {
  private service: DictionaryService;

  constructor(service?: DictionaryService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new DictionaryService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getDefineWordSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          word: stringOrArraySchema('The word to look up (e.g. "serendipity").'),
          lang: {
            type: 'string',
            description: 'Language code (default: "en"). Examples: en, en_US, es, fr, de, hi, ja, ru.',
            default: 'en',
          },
        },
        required: ['word'],
      },
    };
  }

  static getGetSynonymsSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          word: stringOrArraySchema('The word to find synonyms for.'),
          lang: {
            type: 'string',
            description: 'Language code (default: "en")',
            default: 'en',
          },
        },
        required: ['word'],
      },
    };
  }

  static getGetPhoneticsSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          word: stringOrArraySchema('The word to get phonetics and audio for.'),
          lang: {
            type: 'string',
            description: 'Language code (default: "en")',
            default: 'en',
          },
        },
        required: ['word'],
      },
    };
  }

  async executeDefineWord(args: DefineWordInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.word);
    if (items.length === 0 || items.some((w) => !w || typeof w !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'word is required and must be a string or a non-empty array of strings'
      );
    }
    const lang = args.lang ?? 'en';

    const sections = await Promise.all(
      items.map(async (word) => {
        try {
          const entries = await this.service.define(word, lang);
          return this.formatEntriesAsText(word, entries);
        } catch (err) {
          if (err instanceof DictionaryNotFoundError) {
            return `# ${word}\n\nWord not found (${lang}).`;
          }
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${word}\n\nDictionary lookup failed: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetSynonyms(args: GetSynonymsInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.word);
    if (items.length === 0 || items.some((w) => !w || typeof w !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'word is required and must be a string or a non-empty array of strings'
      );
    }
    const lang = args.lang ?? 'en';

    const sections = await Promise.all(
      items.map(async (word) => {
        try {
          const groups = await this.service.synonyms(word, lang);
          return this.formatSynonymsAsText(word, groups);
        } catch (err) {
          if (err instanceof DictionaryNotFoundError) {
            return `# Synonyms for "${word}"\n\nWord not found (${lang}).`;
          }
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# Synonyms for "${word}"\n\nSynonym lookup failed: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetPhonetics(args: GetPhoneticsInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.word);
    if (items.length === 0 || items.some((w) => !w || typeof w !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'word is required and must be a string or a non-empty array of strings'
      );
    }
    const lang = args.lang ?? 'en';

    const sections = await Promise.all(
      items.map(async (word) => {
        try {
          const phonetics = await this.service.phonetics(word, lang);
          return this.formatPhoneticsAsText(word, phonetics);
        } catch (err) {
          if (err instanceof DictionaryNotFoundError) {
            return `# Phonetics for "${word}"\n\nWord not found (${lang}).`;
          }
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# Phonetics for "${word}"\n\nPhonetics lookup failed: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  private formatEntriesAsText(word: string, entries: DictionaryEntry[]): string {
    if (entries.length === 0) {
      return `No definitions found for "${word}".`;
    }

    const parts: string[] = [`# ${word}`];

    entries.forEach((entry, idx) => {
      if (entries.length > 1) parts.push(`\n## Entry ${idx + 1}`);

      if (entry.phonetic) {
        parts.push(`*${entry.phonetic}*`);
      } else {
        const firstWithText = (entry.phonetics ?? []).find((p) => p.text);
        if (firstWithText?.text) parts.push(`*${firstWithText.text}*`);
      }

      for (const meaning of entry.meanings ?? []) {
        parts.push(`\n**${meaning.partOfSpeech}**`);
        meaning.definitions.forEach((def, i) => {
          parts.push(`${i + 1}. ${def.definition}`);
          if (def.example) parts.push(`   _e.g._ "${def.example}"`);
        });
        if (meaning.synonyms && meaning.synonyms.length > 0) {
          parts.push(`Synonyms: ${meaning.synonyms.join(', ')}`);
        }
        if (meaning.antonyms && meaning.antonyms.length > 0) {
          parts.push(`Antonyms: ${meaning.antonyms.join(', ')}`);
        }
      }

      if (entry.origin) parts.push(`\nOrigin: ${entry.origin}`);
    });

    return parts.join('\n').trim();
  }

  private formatSynonymsAsText(
    word: string,
    groups: Array<{ partOfSpeech: string; synonyms: string[] }>
  ): string {
    const nonEmpty = groups.filter((g) => g.synonyms.length > 0);
    if (nonEmpty.length === 0) {
      return `No synonyms found for "${word}".`;
    }

    const lines: string[] = [`# Synonyms for "${word}"`];
    for (const g of nonEmpty) {
      lines.push(`\n**${g.partOfSpeech}**: ${g.synonyms.join(', ')}`);
    }
    return lines.join('\n').trim();
  }

  private formatPhoneticsAsText(word: string, phonetics: DictionaryPhonetic[]): string {
    if (phonetics.length === 0) {
      return `No phonetics found for "${word}".`;
    }

    const lines: string[] = [`# Phonetics for "${word}"`];
    phonetics.forEach((p, i) => {
      const text = p.text ?? '(no IPA)';
      const audio = p.audio ? ` — audio: ${p.audio}` : '';
      lines.push(`${i + 1}. ${text}${audio}`);
    });
    return lines.join('\n').trim();
  }
}
