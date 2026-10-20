import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  SunriseSunsetService,
  type SunTimesResponse,
} from '../../services/sunriseSunsetService.js';

export const GET_SUN_TIMES_DEF = {
  name: 'get_sun_times',
  description:
    "🌅 I'm fetching sunrise and sunset times\n\nGet sunrise, sunset, solar noon, day length, and twilight times for a latitude/longitude via Sunrise-Sunset.org. Optional `date` (YYYY-MM-DD; defaults to today UTC). Pass arrays of latitude/longitude (paired positionally) to look up several locations at once in a single call.",
  keywords: [
    'sunrise',
    'sunset',
    'sun',
    'twilight',
    'solar',
    'daylight',
    'coordinates',
    'lat',
    'lng',
    'location',
    'astronomy',
  ],
};

export interface GetSunTimesInput {
  lat: number | number[];
  lng: number | number[];
  date?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BATCH_SEPARATOR = '\n\n---\n\n';

function normalizeToArray<T>(value: T | T[]): { items: T[]; isBatch: boolean } {
  if (Array.isArray(value)) return { items: value, isBatch: true };
  return { items: [value], isBatch: false };
}

function numberOrArraySchema(description: string, range: { minimum: number; maximum: number }): object {
  return {
    oneOf: [
      { type: 'number', minimum: range.minimum, maximum: range.maximum },
      {
        type: 'array',
        items: { type: 'number', minimum: range.minimum, maximum: range.maximum },
        minItems: 1,
      },
    ],
    description: `${description} Accepts a single value or an array of values for batch requests.`,
  };
}

export class SunriseSunsetTools {
  private service: SunriseSunsetService;

  constructor(service?: SunriseSunsetService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new SunriseSunsetService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetSunTimesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          lat: numberOrArraySchema('Latitude in decimal degrees (-90 to 90).', {
            minimum: -90,
            maximum: 90,
          }),
          lng: numberOrArraySchema('Longitude in decimal degrees (-180 to 180).', {
            minimum: -180,
            maximum: 180,
          }),
          date: {
            type: 'string',
            description:
              'Optional date in YYYY-MM-DD format (UTC). Omit for today. Applies to all locations in a batch.',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
        },
        required: ['lat', 'lng'],
      },
    };
  }

  async executeGetSunTimes(args: GetSunTimesInput): Promise<MCPToolCallResult> {
    const lat = normalizeToArray(args.lat);
    const lng = normalizeToArray(args.lng);
    const isBatch = lat.isBatch || lng.isBatch;

    if (lat.items.length !== lng.items.length) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        `lat and lng must have the same number of values when batching (got ${lat.items.length} lat and ${lng.items.length} lng)`
      );
    }

    const pairs = lat.items.map((latVal, i) => ({ lat: latVal, lng: lng.items[i]! }));
    if (pairs.length === 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'lat and lng are required');
    }

    for (const { lat: latVal, lng: lngVal } of pairs) {
      if (typeof latVal !== 'number' || Number.isNaN(latVal) || latVal < -90 || latVal > 90) {
        return createMCPErrorResult(
          MCPErrorCode.INVALID_INPUT,
          'lat is required and must be a number between -90 and 90'
        );
      }
      if (typeof lngVal !== 'number' || Number.isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
        return createMCPErrorResult(
          MCPErrorCode.INVALID_INPUT,
          'lng is required and must be a number between -180 and 180'
        );
      }
    }

    if (args.date !== undefined) {
      if (typeof args.date !== 'string' || !ISO_DATE_RE.test(args.date)) {
        return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'date must be in YYYY-MM-DD format');
      }
    }

    const date = args.date;

    if (!isBatch) {
      const { lat: latVal, lng: lngVal } = pairs[0]!;
      try {
        const response = await this.service.getSunTimes({ lat: latVal, lng: lngVal, date });
        const text = this.formatSunTimesAsText(response, latVal, lngVal, date);
        return { content: [{ type: 'text', text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get sun times: ${message}`);
      }
    }

    const sections = await Promise.all(
      pairs.map(async ({ lat: latVal, lng: lngVal }) => {
        try {
          const response = await this.service.getSunTimes({ lat: latVal, lng: lngVal, date });
          return this.formatSunTimesAsText(response, latVal, lngVal, date);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Sun times for ${latVal}, ${lngVal} failed: ${message}`;
        }
      })
    );

    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  private formatSunTimesAsText(
    response: SunTimesResponse,
    lat: number,
    lng: number,
    date?: string
  ): string {
    const r = response.results;
    const dateLabel = date ?? 'today (UTC)';
    const tz = response.tzid ? ` (${response.tzid})` : '';

    let text = `Sun times for ${lat}, ${lng} on ${dateLabel}${tz}\n\n`;
    text += `- Sunrise: ${r.sunrise}\n`;
    text += `- Sunset: ${r.sunset}\n`;
    text += `- Solar noon: ${r.solar_noon}\n`;
    text += `- Day length: ${this.formatDayLength(r.day_length)}\n\n`;
    text += `Civil twilight: ${r.civil_twilight_begin} → ${r.civil_twilight_end}\n`;
    text += `Nautical twilight: ${r.nautical_twilight_begin} → ${r.nautical_twilight_end}\n`;
    text += `Astronomical twilight: ${r.astronomical_twilight_begin} → ${r.astronomical_twilight_end}`;

    return text.trim();
  }

  private formatDayLength(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return `${seconds}s`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}h ${m}m (${seconds}s)`;
    }
    if (m > 0) {
      return `${m}m ${s}s (${seconds}s)`;
    }
    return `${seconds}s`;
  }
}
