import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  NominatimService,
  type NominatimPlace,
  type NominatimReversePlace,
} from '../../services/nominatimService.js';

export const GEOCODE_DEF = {
  name: 'geocode',
  description:
    "📍 I'm geocoding addresses\n\nForward geocode an address or place name to coordinates and structured address details via OpenStreetMap Nominatim. Returns up to N matches with lat/lon, display name, and address parts.",
  keywords: ['nominatim', 'openstreetmap', 'geocode', 'address', 'search', 'location', 'coordinates'],
};
export const REVERSE_GEOCODE_DEF = {
  name: 'reverse_geocode',
  description:
    "🗺️ I'm reverse-geocoding coordinates\n\nReverse geocode a latitude/longitude pair to a structured address via OpenStreetMap Nominatim. Returns the closest OSM object with display name and address parts.",
  keywords: ['nominatim', 'openstreetmap', 'reverse', 'geocode', 'coordinates', 'address', 'latlon'],
};
export const LOOKUP_DEF = {
  name: 'lookup',
  description:
    "📍 I'm looking up OSM objects\n\nBulk lookup of OpenStreetMap objects by their OSM IDs (comma-separated, e.g. R146656,W104393803,N240109189). Returns address details for each.",
  keywords: ['nominatim', 'openstreetmap', 'osm', 'lookup', 'id', 'bulk'],
};

export interface GeocodeInput {
  query: string;
  limit?: number;
  country_codes?: string;
}

export interface ReverseGeocodeInput {
  lat: number;
  lon: number;
  zoom?: number;
}

export interface LookupInput {
  osm_ids: string;
}

export class NominatimTools {
  private service: NominatimService;

  constructor(service?: NominatimService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new NominatimService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        userAgent: api.userAgent,
      });
    }
  }

  static getGeocodeSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Address or place name to geocode (e.g. "1600 Pennsylvania Ave NW, Washington DC")',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-50)',
            minimum: 1,
            maximum: 50,
            default: 5,
          },
          country_codes: {
            type: 'string',
            description: 'Optional comma-separated ISO 3166-1 alpha-2 country codes (e.g. "us,ca") to restrict results',
          },
        },
        required: ['query'],
      },
    };
  }

  static getReverseGeocodeSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          lat: {
            type: 'number',
            description: 'Latitude in decimal degrees (-90 to 90)',
            minimum: -90,
            maximum: 90,
          },
          lon: {
            type: 'number',
            description: 'Longitude in decimal degrees (-180 to 180)',
            minimum: -180,
            maximum: 180,
          },
          zoom: {
            type: 'number',
            description: 'Level of detail for the result (0=country, 18=building). Default 18.',
            minimum: 0,
            maximum: 18,
            default: 18,
          },
        },
        required: ['lat', 'lon'],
      },
    };
  }

  static getLookupSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          osm_ids: {
            type: 'string',
            description:
              'Comma-separated OSM IDs prefixed with type letter (R=relation, W=way, N=node), e.g. "R146656,W104393803,N240109189"',
          },
        },
        required: ['osm_ids'],
      },
    };
  }

  async executeGeocode(args: GeocodeInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required and must be a string');
    }
    if (args.limit != null && (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 50)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'limit must be a number between 1 and 50');
    }
    if (args.country_codes != null && typeof args.country_codes !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'country_codes must be a string');
    }

    try {
      const places = await this.service.geocode({
        query: args.query,
        limit: args.limit ?? 5,
        countryCodes: args.country_codes,
      });
      const text = this.formatGeocodeResultsAsText(places, args.query);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Nominatim geocode failed: ${message}`);
    }
  }

  async executeReverseGeocode(args: ReverseGeocodeInput): Promise<MCPToolCallResult> {
    if (typeof args.lat !== 'number' || Number.isNaN(args.lat) || args.lat < -90 || args.lat > 90) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'lat is required and must be a number between -90 and 90');
    }
    if (typeof args.lon !== 'number' || Number.isNaN(args.lon) || args.lon < -180 || args.lon > 180) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'lon is required and must be a number between -180 and 180');
    }
    if (args.zoom != null && (typeof args.zoom !== 'number' || args.zoom < 0 || args.zoom > 18)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'zoom must be a number between 0 and 18');
    }

    try {
      const place = await this.service.reverseGeocode({
        lat: args.lat,
        lon: args.lon,
        zoom: args.zoom ?? 18,
      });
      if (place.error) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Nominatim reverse geocode: ${place.error}`);
      }
      const text = this.formatReverseAsText(place, args.lat, args.lon);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Nominatim reverse geocode failed: ${message}`);
    }
  }

  async executeLookup(args: LookupInput): Promise<MCPToolCallResult> {
    if (!args.osm_ids || typeof args.osm_ids !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'osm_ids is required and must be a string');
    }
    const ids = args.osm_ids.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'osm_ids must contain at least one ID');
    }
    const invalid = ids.find((id) => !/^[RWN]\d+$/.test(id));
    if (invalid) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        `Invalid OSM ID "${invalid}". Use form like R146656, W104393803, or N240109189.`
      );
    }

    try {
      const places = await this.service.lookup({ osmIds: ids.join(',') });
      const text = this.formatLookupResultsAsText(places, ids);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Nominatim lookup failed: ${message}`);
    }
  }

  private formatGeocodeResultsAsText(places: NominatimPlace[], query: string): string {
    if (!places || places.length === 0) {
      return `No results found for "${query}".`;
    }

    let text = `Found ${places.length} result(s) for "${query}":\n\n`;
    places.forEach((p, i) => {
      text += `${i + 1}. **${p.display_name}**\n`;
      text += `   - Coordinates: ${p.lat}, ${p.lon}\n`;
      if (p.class || p.type) text += `   - Type: ${[p.class, p.type].filter(Boolean).join(' / ')}\n`;
      if (p.osm_type && p.osm_id != null) text += `   - OSM: ${p.osm_type}/${p.osm_id}\n`;
      const addr = this.formatAddressLines(p.address);
      if (addr) text += `   - Address:\n${addr}\n`;
      text += '\n';
    });
    return text.trim();
  }

  private formatReverseAsText(place: NominatimReversePlace, lat: number, lon: number): string {
    let text = `Reverse geocode for ${lat}, ${lon}:\n\n`;
    if (place.display_name) text += `**${place.display_name}**\n`;
    if (place.lat && place.lon) text += `- Matched coordinates: ${place.lat}, ${place.lon}\n`;
    if (place.class || place.type) text += `- Type: ${[place.class, place.type].filter(Boolean).join(' / ')}\n`;
    if (place.osm_type && place.osm_id != null) text += `- OSM: ${place.osm_type}/${place.osm_id}\n`;
    const addr = this.formatAddressLines(place.address);
    if (addr) text += `- Address:\n${addr}\n`;
    return text.trim();
  }

  private formatLookupResultsAsText(places: NominatimPlace[], ids: string[]): string {
    if (!places || places.length === 0) {
      return `No OSM objects found for: ${ids.join(', ')}`;
    }

    let text = `Looked up ${places.length} OSM object(s):\n\n`;
    places.forEach((p, i) => {
      text += `${i + 1}. **${p.display_name}**\n`;
      if (p.osm_type && p.osm_id != null) text += `   - OSM: ${p.osm_type}/${p.osm_id}\n`;
      if (p.lat && p.lon) text += `   - Coordinates: ${p.lat}, ${p.lon}\n`;
      if (p.class || p.type) text += `   - Type: ${[p.class, p.type].filter(Boolean).join(' / ')}\n`;
      const addr = this.formatAddressLines(p.address);
      if (addr) text += `   - Address:\n${addr}\n`;
      text += '\n';
    });
    return text.trim();
  }

  private formatAddressLines(address?: NominatimPlace['address']): string {
    if (!address) return '';
    const keys: Array<keyof NonNullable<NominatimPlace['address']>> = [
      'house_number',
      'road',
      'neighbourhood',
      'suburb',
      'city',
      'town',
      'village',
      'hamlet',
      'county',
      'state',
      'state_district',
      'postcode',
      'country',
      'country_code',
    ];
    const lines: string[] = [];
    for (const k of keys) {
      const v = address[k];
      if (v) lines.push(`     - ${k}: ${v}`);
    }
    return lines.join('\n');
  }
}
