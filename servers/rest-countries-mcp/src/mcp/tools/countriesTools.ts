import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import { RestCountriesService } from '../../services/restCountriesService.js';
import type { Country } from '../../services/restCountriesService.js';

export const GET_COUNTRY_DEF = {
  name: 'get_country',
  description:
    "🌍 I'm looking up countries\n\nLook up a country by name or alpha-2/alpha-3 code. Returns country details including capital, region, population, languages.",
  keywords: ['country', 'countries', 'geography', 'capital', 'region'],
};
export const SEARCH_COUNTRIES_DEF = {
  name: 'search_countries',
  description:
    "🔎 I'm filtering country matches\n\nSearch countries by region, subregion, or capital city. Returns matching countries.",
  keywords: ['country', 'countries', 'region', 'capital', 'search'],
};
export const LIST_ALL_COUNTRIES_DEF = {
  name: 'list_all_countries',
  description:
    "🗺️ I'm listing all countries\n\nList all countries with optional field selection. Returns name, codes, capital, region, etc.",
  keywords: ['country', 'countries', 'list', 'all'],
};

const DEFAULT_FIELDS = [
  'name',
  'cca2',
  'cca3',
  'capital',
  'region',
  'subregion',
  'population',
  'area',
  'currencies',
  'languages',
];

export interface GetCountryInput {
  nameOrCode: string | string[];
}

export interface SearchCountriesInput {
  searchType: 'region' | 'subregion' | 'capital';
  query: string | string[];
}

export interface ListAllCountriesInput {
  fields?: string;
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

export class CountriesTools {
  private service: RestCountriesService;

  constructor(service?: RestCountriesService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new RestCountriesService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetCountrySchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          nameOrCode: stringOrArraySchema(
            'Country name (e.g. "peru", "United States") or alpha-2/alpha-3 code (e.g. "pe", "PE", "per").'
          ),
        },
        required: ['nameOrCode'],
      },
    };
  }

  static getSearchCountriesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          searchType: {
            type: 'string',
            enum: ['region', 'subregion', 'capital'],
            description: 'Type of search: region (e.g. Europe, Americas), subregion (e.g. South America), or capital city',
          },
          query: stringOrArraySchema(
            'Search value (e.g. "Europe", "South America", "Paris").'
          ),
        },
        required: ['searchType', 'query'],
      },
    };
  }

  static getListAllCountriesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          fields: {
            type: 'string',
            description:
              'Comma-separated fields to return (max 10). Default: name,cca2,cca3,capital,region,subregion,population,area,currencies,languages. See REST Countries API fields.',
            default: 'name,cca2,cca3,capital,region,subregion,population,area,currencies,languages',
          },
        },
        required: [],
      },
    };
  }

  async executeGetCountry(args: GetCountryInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.nameOrCode);
    if (items.length === 0 || items.some((v) => !v || typeof v !== 'string' || !v.trim())) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'nameOrCode is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (raw) => {
        const input = raw.trim();
        try {
          const isCode = input.length === 2 || input.length === 3;
          let country: Country | Country[] | null = null;

          if (isCode && /^[a-zA-Z]{2,3}$/.test(input)) {
            country = await this.service.getByAlphaCode(input);
          } else {
            const results = await this.service.getByName(input);
            country = results.length > 0 ? results[0] : null;
          }

          if (!country || (Array.isArray(country) && country.length === 0)) {
            return `No country found for "${input}". Try a different name or alpha code (e.g. "pe" or "peru").`;
          }

          const c = Array.isArray(country) ? country[0] : country;
          return this.formatCountryAsText(c);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Country lookup failed for "${input}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSearchCountries(args: SearchCountriesInput): Promise<MCPToolCallResult> {
    const { searchType } = args;
    if (!['region', 'subregion', 'capital'].includes(searchType)) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'searchType must be region, subregion, or capital'
      );
    }

    const { items, isBatch } = normalizeToArray(args.query);
    if (items.length === 0 || items.some((v) => !v || typeof v !== 'string' || !v.trim())) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'query is required and must be a string or a non-empty array of strings'
      );
    }

    const sections = await Promise.all(
      items.map(async (raw) => {
        const q = raw.trim();
        try {
          let countries: Country[];
          switch (searchType) {
            case 'region':
              countries = await this.service.getByRegion(q);
              break;
            case 'subregion':
              countries = await this.service.getBySubregion(q);
              break;
            case 'capital':
              countries = await this.service.getByCapital(q);
              break;
            default:
              return `searchType must be region, subregion, or capital`;
          }
          return this.formatCountryListAsText(countries, `${searchType}: ${q}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Search failed for "${q}": ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeListAllCountries(args: ListAllCountriesInput): Promise<MCPToolCallResult> {
    const fieldsStr = args.fields?.trim() || DEFAULT_FIELDS.join(',');
    const fields = fieldsStr.split(',').map((f) => f.trim()).filter(Boolean);
    if (fields.length > 10) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'Maximum 10 fields allowed for list_all_countries'
      );
    }
    const effectiveFields = fields.length > 0 ? fields : DEFAULT_FIELDS;

    try {
      const countries = await this.service.getAll(effectiveFields);
      const text = this.formatCountryListAsText(countries, 'all countries');
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `List failed: ${message}`);
    }
  }

  private formatCountryAsText(c: Country): string {
    const name = c.name?.common ?? c.name?.official ?? 'Unknown';
    const official = c.name?.official ?? '';
    let text = `# ${name}\n`;
    if (official && official !== name) text += `Official: ${official}\n`;
    text += `\n`;
    if (c.cca2) text += `- Alpha-2: ${c.cca2}\n`;
    if (c.cca3) text += `- Alpha-3: ${c.cca3}\n`;
    if (c.capital?.length) text += `- Capital: ${c.capital.join(', ')}\n`;
    if (c.region) text += `- Region: ${c.region}\n`;
    if (c.subregion) text += `- Subregion: ${c.subregion}\n`;
    if (typeof c.population === 'number')
      text += `- Population: ${c.population.toLocaleString()}\n`;
    if (typeof c.area === 'number')
      text += `- Area: ${c.area.toLocaleString()} km²\n`;
    if (c.currencies && Object.keys(c.currencies).length) {
      const cur = Object.entries(c.currencies)
        .map(([code, v]) => `${code}: ${(v as { name?: string }).name ?? code}`)
        .join(', ');
      text += `- Currencies: ${cur}\n`;
    }
    if (c.languages && Object.keys(c.languages).length) {
      const lang = Object.values(c.languages).join(', ');
      text += `- Languages: ${lang}\n`;
    }
    return text.trim();
  }

  private formatCountryListAsText(countries: Country[], context: string): string {
    if (countries.length === 0) {
      return `No countries found for ${context}.`;
    }
    let text = `Found ${countries.length} countr${countries.length === 1 ? 'y' : 'ies'} for ${context}:\n\n`;
    countries.forEach((c, i) => {
      const name = c.name?.common ?? c.name?.official ?? 'Unknown';
      const codes = [c.cca2, c.cca3].filter(Boolean).join(' / ');
      const cap = c.capital?.length ? ` — ${c.capital[0]}` : '';
      text += `${i + 1}. ${name} (${codes})${cap}\n`;
    });
    return text.trim();
  }
}
