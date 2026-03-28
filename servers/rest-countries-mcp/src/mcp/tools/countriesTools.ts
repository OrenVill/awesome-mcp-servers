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
    "🌍 I'm looking up a country by name or alpha code\n\nLook up a country by name or alpha-2/alpha-3 code. Returns country details including capital, region, population, languages.",
  keywords: ['country', 'countries', 'geography', 'capital', 'region'],
};
export const SEARCH_COUNTRIES_DEF = {
  name: 'search_countries',
  description:
    "🔎 I'm searching countries by region, subregion, or capital\n\nSearch countries by region, subregion, or capital city. Returns matching countries.",
  keywords: ['country', 'countries', 'region', 'capital', 'search'],
};
export const LIST_ALL_COUNTRIES_DEF = {
  name: 'list_all_countries',
  description:
    "🗺️ I'm listing all countries with optional field selection\n\nList all countries with optional field selection. Returns name, codes, capital, region, etc.",
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
  nameOrCode: string;
}

export interface SearchCountriesInput {
  searchType: 'region' | 'subregion' | 'capital';
  query: string;
}

export interface ListAllCountriesInput {
  fields?: string;
}

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
          nameOrCode: {
            type: 'string',
            description:
              'Country name (e.g. "peru", "United States") or alpha-2/alpha-3 code (e.g. "pe", "PE", "per")',
          },
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
          query: {
            type: 'string',
            description: 'Search value (e.g. "Europe", "South America", "Paris")',
          },
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
    const input = args.nameOrCode?.trim();
    if (!input) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'nameOrCode is required');
    }

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
        return {
          content: [
            {
              type: 'text',
              text: `No country found for "${input}". Try a different name or alpha code (e.g. "pe" or "peru").`,
            },
          ],
        };
      }

      const c = Array.isArray(country) ? country[0] : country;
      const text = this.formatCountryAsText(c);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Country lookup failed: ${message}`);
    }
  }

  async executeSearchCountries(args: SearchCountriesInput): Promise<MCPToolCallResult> {
    const { searchType, query } = args;
    const q = query?.trim();
    if (!q) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required');
    }
    if (!['region', 'subregion', 'capital'].includes(searchType)) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'searchType must be region, subregion, or capital'
      );
    }

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
          return createMCPErrorResult(
            MCPErrorCode.INVALID_INPUT,
            'searchType must be region, subregion, or capital'
          );
      }

      const text = this.formatCountryListAsText(countries, `${searchType}: ${q}`);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Search failed: ${message}`);
    }
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
