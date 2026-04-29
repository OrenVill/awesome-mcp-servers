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
  word: string;
  lang?: string;
}

export interface GetSynonymsInput {
  word: string;
  lang?: string;
}

export interface GetPhoneticsInput {
  word: string;
  lang?: string;
}

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
          word: {
            type: 'string',
            description: 'The word to look up (e.g. "serendipity")',
          },
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
          word: {
            type: 'string',
            description: 'The word to find synonyms for',
          },
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
          word: {
            type: 'string',
            description: 'The word to get phonetics and audio for',
          },
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
    if (!args.word || typeof args.word !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'word is required and must be a string');
    }
    const lang = args.lang ?? 'en';

    try {
      const entries = await this.service.define(args.word, lang);
      const text = this.formatEntriesAsText(args.word, entries);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      if (err instanceof DictionaryNotFoundError) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Word not found: "${args.word}" (${lang})`);
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Dictionary lookup failed: ${message}`);
    }
  }

  async executeGetSynonyms(args: GetSynonymsInput): Promise<MCPToolCallResult> {
    if (!args.word || typeof args.word !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'word is required and must be a string');
    }
    const lang = args.lang ?? 'en';

    try {
      const groups = await this.service.synonyms(args.word, lang);
      const text = this.formatSynonymsAsText(args.word, groups);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      if (err instanceof DictionaryNotFoundError) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Word not found: "${args.word}" (${lang})`);
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Synonym lookup failed: ${message}`);
    }
  }

  async executeGetPhonetics(args: GetPhoneticsInput): Promise<MCPToolCallResult> {
    if (!args.word || typeof args.word !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'word is required and must be a string');
    }
    const lang = args.lang ?? 'en';

    try {
      const phonetics = await this.service.phonetics(args.word, lang);
      const text = this.formatPhoneticsAsText(args.word, phonetics);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      if (err instanceof DictionaryNotFoundError) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Word not found: "${args.word}" (${lang})`);
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Phonetics lookup failed: ${message}`);
    }
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
