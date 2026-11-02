import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import {
  AGENT_READY_BATCH_DESCRIPTION,
  BATCH_SEPARATOR,
  batchCoordinateProperties,
  coordinateBatchInputExamples,
  formatInputFieldError,
  resolveCoordinatePairs,
  AgentReadyObjectInputSchema,
} from '@awesome-mcp/mcp-schema-helpers';
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
    inputSchema: AgentReadyObjectInputSchema;
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        description: AGENT_READY_BATCH_DESCRIPTION,
        examples: coordinateBatchInputExamples('lat', 'lng', { lonPlural: 'lngs' }),
        properties: {
          ...batchCoordinateProperties('lat', 'lng', { lonPlural: 'lngs' }),
          date: {
            type: 'string',
            description:
              'Optional date in YYYY-MM-DD format (UTC). Omit for today. Applies to all locations in a batch.',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
        },
      },
    };
  }

  async executeGetSunTimes(args: GetSunTimesInput): Promise<MCPToolCallResult> {
    const coord = resolveCoordinatePairs(
      args,
      'lat',
      'lng',
      { minimum: -90, maximum: 90 },
      { minimum: -180, maximum: 180 },
      'lngs'
    );
    if ('field' in coord) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(coord));
    }
    const pairs: Array<{ lat: number; lng: number }> = coord.pairs.map((p) => ({
      lat: p.lat,
      lng: p.lon,
    }));
    const isBatch = coord.isBatch;

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
        const text = this.formatSunTimesAsJson(response, latVal, lngVal, date);
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
          return this.formatSunTimesAsJson(response, latVal, lngVal, date);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `Sun times for ${latVal}, ${lngVal} failed: ${message}`;
        }
      })
    );

    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  private formatSunTimesAsJson(
    response: SunTimesResponse,
    lat: number,
    lng: number,
    date?: string
  ): string {
    const r = response.results;
    const payload = {
      location: { lat, lng },
      date: date ?? 'today (UTC)',
      timezone: response.tzid ?? null,
      sunrise: r.sunrise,
      sunset: r.sunset,
      solar_noon: r.solar_noon,
      day_length_seconds: r.day_length,
      day_length_human: this.formatDayLength(r.day_length),
      civil_twilight: { begin: r.civil_twilight_begin, end: r.civil_twilight_end },
      nautical_twilight: { begin: r.nautical_twilight_begin, end: r.nautical_twilight_end },
      astronomical_twilight: {
        begin: r.astronomical_twilight_begin,
        end: r.astronomical_twilight_end,
      },
    };
    return JSON.stringify(payload, null, 2);
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
