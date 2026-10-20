import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  WikidataService,
  type WikidataEntity,
  type WikidataSearchHit,
} from '../../services/wikidataService.js';

export const SEARCH_ENTITIES_DEF = {
  name: 'search_entities',
  description:
    "🔍 I'm searching Wikidata\n\nSearch Wikidata entities by label or alias using wbsearchentities. Returns Q-ids, labels, and descriptions. Use before get_entity when you only know a name or topic.",
  keywords: ['wikidata', 'search', 'entity', 'knowledge graph', 'Q-id', 'semantic'],
};

export const GET_ENTITY_DEF = {
  name: 'get_entity',
  description:
    "📦 I'm loading Wikidata entities\n\nFetch full Wikidata entity data by Q-id (wbgetentities): labels, descriptions, aliases, claim counts, and Wikipedia sitelinks. Pass an array of Q-ids to fetch several entities in one call.",
  keywords: ['wikidata', 'entity', 'Q-id', 'claims', 'labels', 'knowledge graph'],
};

export const GET_ENTITY_DESCRIPTION_DEF = {
  name: 'get_entity_description',
  description:
    "📝 I'm loading entity descriptions\n\nGet the Wikidata description for one or more Q-ids in a given language. Pass an array of Q-ids for batch lookup.",
  keywords: ['wikidata', 'description', 'entity', 'Q-id', 'summary'],
};

export interface SearchEntitiesInput {
  search: string;
  language?: string;
  limit?: number;
}

export interface GetEntityInput {
  id: string | string[];
  language?: string;
}

export interface GetEntityDescriptionInput {
  id: string | string[];
  language?: string;
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
    description: `${description} Accepts a single Q-id or an array of Q-ids for batch requests.`,
  };
}

const BATCH_SEPARATOR = '\n\n---\n\n';
const ENTITY_ID_PATTERN = /^Q\d+$/i;

function isValidEntityId(id: string): boolean {
  return ENTITY_ID_PATTERN.test(id.trim());
}

export class WikidataTools {
  private service: WikidataService;
  private defaultLanguage: string;

  constructor(service?: WikidataService, defaultLanguage?: string) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new WikidataService({
        mediaWikiBase: api.mediaWikiBaseUrl,
        timeout: api.timeoutMs,
      });
    }
    this.defaultLanguage = defaultLanguage ?? getConfig().api.defaultLanguage;
  }

  static getSearchEntitiesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          search: {
            type: 'string',
            description: 'Text to search for (label or alias).',
          },
          language: {
            type: 'string',
            description: 'Language code for labels/descriptions in results (e.g. en, de, fr).',
            default: 'en',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (1-50).',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
        },
        required: ['search'],
      },
    };
  }

  static getGetEntitySchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: stringOrArraySchema('Wikidata entity id (e.g. Q937).'),
          language: {
            type: 'string',
            description: 'Preferred language for primary label and description.',
            default: 'en',
          },
        },
        required: ['id'],
      },
    };
  }

  static getGetEntityDescriptionSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: stringOrArraySchema('Wikidata entity id (e.g. Q937).'),
          language: {
            type: 'string',
            description: 'Language code for the description.',
            default: 'en',
          },
        },
        required: ['id'],
      },
    };
  }

  async executeSearchEntities(args: SearchEntitiesInput): Promise<MCPToolCallResult> {
    if (!args.search || typeof args.search !== 'string' || !args.search.trim()) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'search is required and must be a non-empty string'
      );
    }

    const language = args.language ?? this.defaultLanguage;
    const limit = args.limit ?? 10;

    try {
      const response = await this.service.searchEntities({
        search: args.search.trim(),
        language,
        limit,
      });
      const results = response.search ?? [];
      const text = this.formatSearchResultsAsText(results, args.search.trim(), language);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Wikidata search failed: ${message}`);
    }
  }

  async executeGetEntity(args: GetEntityInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.id);
    if (items.length === 0 || items.some((id) => !id || typeof id !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'id is required and must be a string or a non-empty array of strings'
      );
    }

    const invalid = items.filter((id) => !isValidEntityId(id));
    if (invalid.length > 0) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        `Invalid Wikidata entity id(s): ${invalid.join(', ')}. Expected format Q followed by digits (e.g. Q937).`
      );
    }

    const language = args.language ?? this.defaultLanguage;
    const normalizedIds = items.map((id) => this.service.normalizeEntityId(id));

    try {
      const response = await this.service.getEntities({
        ids: normalizedIds,
        languages: [language, 'en'],
      });
      const entities = response.entities ?? {};

      if (!isBatch) {
        const entity = entities[normalizedIds[0]];
        if (!entity || entity.missing !== undefined) {
          return createMCPErrorResult(
            MCPErrorCode.API_ERROR,
            `Entity not found: ${normalizedIds[0]}`
          );
        }
        const text = this.formatEntityAsText(entity, language);
        return { content: [{ type: 'text', text }] };
      }

      const sections = normalizedIds.map((id) => {
        const entity = entities[id];
        if (!entity || entity.missing !== undefined) {
          return `## ${id}\n\nEntity not found.`;
        }
        return this.formatEntityAsText(entity, language);
      });

      return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get entity: ${message}`);
    }
  }

  async executeGetEntityDescription(
    args: GetEntityDescriptionInput
  ): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.id);
    if (items.length === 0 || items.some((id) => !id || typeof id !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'id is required and must be a string or a non-empty array of strings'
      );
    }

    const invalid = items.filter((id) => !isValidEntityId(id));
    if (invalid.length > 0) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        `Invalid Wikidata entity id(s): ${invalid.join(', ')}. Expected format Q followed by digits (e.g. Q937).`
      );
    }

    const language = args.language ?? this.defaultLanguage;
    const normalizedIds = items.map((id) => this.service.normalizeEntityId(id));

    try {
      const response = await this.service.getEntities({
        ids: normalizedIds,
        languages: [language, 'en'],
        props: ['labels', 'descriptions'],
      });
      const entities = response.entities ?? {};

      if (!isBatch) {
        const entity = entities[normalizedIds[0]];
        if (!entity || entity.missing !== undefined) {
          return createMCPErrorResult(
            MCPErrorCode.API_ERROR,
            `Entity not found: ${normalizedIds[0]}`
          );
        }
        const text = this.formatDescriptionAsText(entity, language);
        return { content: [{ type: 'text', text }] };
      }

      const sections = normalizedIds.map((id) => {
        const entity = entities[id];
        if (!entity || entity.missing !== undefined) {
          return `**${id}**: Entity not found.`;
        }
        return this.formatDescriptionAsText(entity, language);
      });

      return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(
        MCPErrorCode.API_ERROR,
        `Failed to get entity description: ${message}`
      );
    }
  }

  private pickTerm(
    terms: Record<string, { value: string }> | undefined,
    language: string
  ): { value: string; language: string } | undefined {
    if (!terms) return undefined;
    if (terms[language]) return { value: terms[language].value, language };
    if (terms.en) return { value: terms.en.value, language: 'en' };
    const first = Object.entries(terms)[0];
    if (!first) return undefined;
    return { value: first[1].value, language: first[0] };
  }

  private formatSearchResultsAsText(
    results: WikidataSearchHit[],
    query: string,
    language: string
  ): string {
    if (results.length === 0) {
      return `No Wikidata entities found for "${query}" (language: ${language}).`;
    }

    let text = `Found ${results.length} entity(ies) for "${query}" (language: ${language}):\n\n`;
    results.forEach((hit, i) => {
      const label =
        hit.display?.label?.value ??
        hit.label ??
        hit.id;
      const description =
        hit.display?.description?.value ?? hit.description ?? '(no description)';
      text += `${i + 1}. **${label}** (${hit.id})\n`;
      text += `   ${description}\n`;
      if (hit.url) text += `   ${hit.url}\n`;
      text += '\n';
    });
    text += 'Use get_entity or get_entity_description with the Q-id for full details.';
    return text.trim();
  }

  private formatEntityAsText(entity: WikidataEntity, language: string): string {
    const label = this.pickTerm(entity.labels, language);
    const description = this.pickTerm(entity.descriptions, language);
    const title = label?.value ?? entity.id;

    let text = `## ${title} (${entity.id})\n\n`;
    if (description) {
      text += `*${description.value}* (${description.language})\n\n`;
    }

    const aliasList = entity.aliases?.[language] ?? entity.aliases?.en;
    if (aliasList && aliasList.length > 0) {
      text += `**Aliases (${language}):** ${aliasList.map((a) => a.value).join(', ')}\n\n`;
    }

    const claimCount = entity.claims ? Object.keys(entity.claims).length : 0;
    text += `**Property types with claims:** ${claimCount}\n`;

    const sitelinks = entity.sitelinks ? Object.values(entity.sitelinks) : [];
    if (sitelinks.length > 0) {
      text += `\n**Wikipedia / sister projects (${sitelinks.length} sitelinks):**\n`;
      const enwiki = sitelinks.find((s) => s.site === 'enwiki');
      const preview = enwiki ? [enwiki, ...sitelinks.filter((s) => s !== enwiki).slice(0, 4)] : sitelinks.slice(0, 5);
      preview.forEach((link) => {
        const url =
          link.url ??
          (link.site === 'enwiki'
            ? `https://en.wikipedia.org/wiki/${encodeURIComponent(link.title.replace(/ /g, '_'))}`
            : undefined);
        text += `- ${link.site}: ${link.title}${url ? ` — ${url}` : ''}\n`;
      });
      if (sitelinks.length > preview.length) {
        text += `- … and ${sitelinks.length - preview.length} more\n`;
      }
    }

    text += `\nhttps://www.wikidata.org/wiki/${entity.id}`;
    return text.trim();
  }

  private formatDescriptionAsText(entity: WikidataEntity, language: string): string {
    const label = this.pickTerm(entity.labels, language);
    const description = this.pickTerm(entity.descriptions, language);
    const title = label?.value ?? entity.id;

    if (!description) {
      return `**${title}** (${entity.id}): No description in ${language} (or English fallback).`;
    }

    return `**${title}** (${entity.id}): ${description.value} [${description.language}]`;
  }
}
