import {
  MCPContentItem,
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import {
  BATCH_SEPARATOR,
  batchStringProperties,
  batchNumberProperties,
  resolveStringBatch,
  resolveNumberBatch,
  formatInputFieldError,
  normalizeToArray,
  normalizeStringArgFromArgs,
} from '@awesome-mcp/mcp-schema-helpers';
import { getConfig } from '../../config.js';
import { OpenMeteoService } from '../../services/openMeteoService.js';

export const SEARCH_LOCATIONS_DEF = {
  name: 'search_locations',
  description:
    "📍 I'm finding place coordinates\n\nSearch for locations by name or postal code. Returns coordinates and timezone for use with weather tools. Use before get_current_weather or get_forecast when you only have a place name. Pass an array of names to search several at once in a single call.",
  keywords: ['weather', 'location', 'city', 'search', 'geocode', 'coordinates'],
};

export interface SearchLocationsInput {
  name: string | string[];
  count?: number;
  language?: string;
  countryCode?: string;
}

export class GeocodingTools {
  private service: OpenMeteoService;

  constructor(service?: OpenMeteoService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new OpenMeteoService({
        geocodingBase: api.geocodingBaseUrl,
        forecastBase: api.forecastBaseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchLocationsSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          ...batchStringProperties('name', 'Location name or postal code to search for (min 2 characters).'),
          count: {
            type: 'number',
            description: 'Number of results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
          language: {
            type: 'string',
            description: 'Language for localized results (e.g. en, de, fr)',
            default: 'en',
          },
          countryCode: {
            type: 'string',
            description: 'ISO-3166-1 alpha2 country code to filter results',
            pattern: '^[A-Za-z]{2}$',
          },
        },
      },
    };
  }

  async executeSearchLocations(args: SearchLocationsInput): Promise<MCPToolCallResult> {
    const nameBatch = normalizeStringArgFromArgs(args, 'name');
    if ('field' in nameBatch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(nameBatch));
    }
    const { items, isBatch } = nameBatch;
    if (items.length === 0 || items.some((n) => !n || typeof n !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'name is required and must be a string or a non-empty array of strings'
      );
    }
    if (items.some((n) => n.length < 2)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'name must be at least 2 characters');
    }

    // Preserve EXACT original single-value behaviour: a failed lookup returns an
    // error result, not a formatted section.
    if (!isBatch) {
      const name = items[0];
      try {
        const response = await this.service.searchLocations({
          name,
          count: args.count ?? 10,
          language: args.language ?? 'en',
          countryCode: args.countryCode,
        });
        const results = response.results ?? [];
        const text = this.formatResultsAsText(results, name);
        return { content: [{ type: 'text', text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Geocoding failed: ${message}`);
      }
    }

    const sections = await Promise.all(
      items.map(async (name) => {
        try {
          const response = await this.service.searchLocations({
            name,
            count: args.count ?? 10,
            language: args.language ?? 'en',
            countryCode: args.countryCode,
          });
          const results = response.results ?? [];
          return this.formatResultsAsText(results, name);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Geocoding failed for "${name}": ${message}`;
        }
      })
    );

    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  private formatResultsAsText(
    results: Array<{
      id: number;
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      country_code?: string;
      timezone?: string;
      admin1?: string;
      population?: number;
    }>,
    query: string
  ): string {
    if (results.length === 0) {
      return `No locations found for "${query}". Try a different search term or check spelling.`;
    }

    let text = `Found ${results.length} location(s) for "${query}":\n\n`;
    results.forEach((r, i) => {
      const parts = [r.name];
      if (r.admin1 && r.admin1 !== r.name) parts.push(r.admin1);
      if (r.country) parts.push(r.country);
      const location = parts.join(', ');
      text += `${i + 1}. ${location}\n`;
      text += `   Coordinates: ${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}\n`;
      if (r.timezone) text += `   Timezone: ${r.timezone}\n`;
      if (r.population) text += `   Population: ${r.population.toLocaleString()}\n`;
      text += '\n';
    });
    text += 'Use latitude and longitude with get_current_weather or get_forecast to fetch weather data.';
    return text.trim();
  }
}
