import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  UsgsService,
  type EarthquakeEvent,
  type UsgsGeoJsonResponse,
} from '../../services/usgsService.js';

export const QUERY_EARTHQUAKES_DEF = {
  name: 'query_earthquakes',
  description:
    "🌐 I'm querying the USGS earthquake catalog\n\nFlexible search across the USGS Earthquake Catalog by time range, magnitude range, and geographic region (point + radius). Results ordered by time (most recent first).",
  keywords: [
    'usgs',
    'earthquake',
    'seismic',
    'quake',
    'magnitude',
    'fdsn',
    'catalog',
    'query',
  ],
};

export const GET_RECENT_SIGNIFICANT_DEF = {
  name: 'get_recent_significant',
  description:
    "🚨 I'm fetching recent significant earthquakes\n\nReturn earthquakes at or above a magnitude threshold within the last N days (max 30). Defaults to M ≥ 4.5 over the last 7 days.",
  keywords: [
    'usgs',
    'earthquake',
    'recent',
    'significant',
    'magnitude',
    'seismic',
    'quake',
  ],
};

export const GET_EVENT_DEF = {
  name: 'get_event',
  description:
    "🔎 I'm fetching a single earthquake event\n\nLook up one earthquake by its USGS event ID (e.g. `nc73649170`) and return its magnitude, location, time, depth, and details URL.",
  keywords: ['usgs', 'earthquake', 'event', 'lookup', 'id', 'detail'],
};

export interface QueryEarthquakesInput {
  start_time?: string;
  end_time?: string;
  min_magnitude?: number;
  max_magnitude?: number;
  latitude?: number;
  longitude?: number;
  max_radius_km?: number;
  limit?: number;
}

export interface GetRecentSignificantInput {
  min_magnitude?: number;
  days?: number;
  limit?: number;
}

export interface GetEventInput {
  event_id: string;
}

export class UsgsTools {
  private service: UsgsService;

  constructor(service?: UsgsService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new UsgsService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getQueryEarthquakesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          start_time: {
            type: 'string',
            description:
              'ISO 8601 start time (e.g. "2024-01-01" or "2024-01-01T00:00:00Z").',
          },
          end_time: {
            type: 'string',
            description: 'ISO 8601 end time.',
          },
          min_magnitude: {
            type: 'number',
            description: 'Minimum magnitude (inclusive).',
          },
          max_magnitude: {
            type: 'number',
            description: 'Maximum magnitude (inclusive).',
          },
          latitude: {
            type: 'number',
            description:
              'Center latitude in decimal degrees (used with longitude + max_radius_km).',
            minimum: -90,
            maximum: 90,
          },
          longitude: {
            type: 'number',
            description:
              'Center longitude in decimal degrees (used with latitude + max_radius_km).',
            minimum: -180,
            maximum: 180,
          },
          max_radius_km: {
            type: 'number',
            description:
              'Maximum radius from (latitude, longitude) in kilometers. If set, latitude and longitude are required.',
            minimum: 0,
          },
          limit: {
            type: 'number',
            description: 'Maximum number of events to return (1-1000).',
            minimum: 1,
            maximum: 1000,
            default: 50,
          },
        },
      },
    };
  }

  static getGetRecentSignificantSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          min_magnitude: {
            type: 'number',
            description: 'Minimum magnitude threshold.',
            default: 4.5,
          },
          days: {
            type: 'number',
            description: 'Number of days to look back (1-30).',
            minimum: 1,
            maximum: 30,
            default: 7,
          },
          limit: {
            type: 'number',
            description: 'Maximum events to return (1-200).',
            minimum: 1,
            maximum: 200,
            default: 20,
          },
        },
      },
    };
  }

  static getGetEventSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          event_id: {
            type: 'string',
            description: 'USGS event ID (e.g. "nc73649170").',
          },
        },
        required: ['event_id'],
      },
    };
  }

  async executeQueryEarthquakes(
    args: QueryEarthquakesInput
  ): Promise<MCPToolCallResult> {
    if (
      args.max_radius_km != null &&
      (args.latitude == null || args.longitude == null)
    ) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'max_radius_km requires both latitude and longitude'
      );
    }

    const limit = args.limit ?? 50;
    if (limit < 1 || limit > 1000) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'limit must be between 1 and 1000'
      );
    }

    try {
      const response = await this.service.query({
        startTime: args.start_time,
        endTime: args.end_time,
        minMagnitude: args.min_magnitude,
        maxMagnitude: args.max_magnitude,
        latitude: args.latitude,
        longitude: args.longitude,
        maxRadiusKm: args.max_radius_km,
        limit,
        orderBy: 'time',
      });

      const text = this.formatEventsAsText(
        response,
        this.describeQuery(args, limit)
      );
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(
        MCPErrorCode.API_ERROR,
        `USGS query failed: ${message}`
      );
    }
  }

  async executeGetRecentSignificant(
    args: GetRecentSignificantInput
  ): Promise<MCPToolCallResult> {
    const minMagnitude = args.min_magnitude ?? 4.5;
    const days = args.days ?? 7;
    const limit = args.limit ?? 20;

    if (days < 1 || days > 30) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'days must be between 1 and 30'
      );
    }
    if (limit < 1 || limit > 200) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'limit must be between 1 and 200'
      );
    }

    try {
      const response = await this.service.getRecentSignificant({
        minMagnitude,
        days,
        limit,
      });

      const heading = `Recent earthquakes (M >= ${minMagnitude}, last ${days} day(s), up to ${limit})`;
      const text = this.formatEventsAsText(response, heading);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(
        MCPErrorCode.API_ERROR,
        `USGS recent-significant query failed: ${message}`
      );
    }
  }

  async executeGetEvent(args: GetEventInput): Promise<MCPToolCallResult> {
    if (!args.event_id || typeof args.event_id !== 'string') {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'event_id is required and must be a string'
      );
    }

    try {
      const response = await this.service.getEvent(args.event_id);
      const features = response.features ?? [];
      if (features.length === 0) {
        return createMCPErrorResult(
          MCPErrorCode.API_ERROR,
          `No earthquake event found with id: "${args.event_id}"`
        );
      }

      const text = this.formatEventDetail(features[0]!);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(
        MCPErrorCode.API_ERROR,
        `Failed to get event: ${message}`
      );
    }
  }

  private describeQuery(args: QueryEarthquakesInput, limit: number): string {
    const parts: string[] = [];
    if (args.start_time) parts.push(`from ${args.start_time}`);
    if (args.end_time) parts.push(`to ${args.end_time}`);
    if (args.min_magnitude != null) parts.push(`M >= ${args.min_magnitude}`);
    if (args.max_magnitude != null) parts.push(`M <= ${args.max_magnitude}`);
    if (
      args.max_radius_km != null &&
      args.latitude != null &&
      args.longitude != null
    ) {
      parts.push(
        `within ${args.max_radius_km} km of (${args.latitude}, ${args.longitude})`
      );
    }
    parts.push(`limit ${limit}`);
    return `Earthquake query (${parts.join(', ')})`;
  }

  private formatEventsAsText(
    response: UsgsGeoJsonResponse,
    heading: string
  ): string {
    const features = response.features ?? [];
    if (features.length === 0) {
      return `${heading}\n\nNo earthquakes matched.`;
    }

    let text = `${heading}\n\nFound ${features.length} event(s):\n\n`;
    features.forEach((f, i) => {
      text += `${i + 1}. ${this.formatEventLine(f)}\n`;
    });
    return text.trim();
  }

  private formatEventLine(event: EarthquakeEvent): string {
    const mag = event.properties.mag;
    const place = event.properties.place ?? 'Unknown location';
    const time = event.properties.time;
    const url = event.properties.url ?? '';
    const depth = event.geometry?.coordinates?.[2];

    const magStr = mag != null ? `M${mag}` : 'M?';
    const isoTime = time != null ? new Date(time).toISOString() : 'unknown time';
    const depthStr = depth != null ? `${depth} km` : '?';
    return `${magStr} — ${place}\n  ${isoTime} · depth ${depthStr} · ${url}`;
  }

  private formatEventDetail(event: EarthquakeEvent): string {
    const mag = event.properties.mag;
    const place = event.properties.place ?? 'Unknown location';
    const time = event.properties.time;
    const url = event.properties.url ?? '';
    const title = event.properties.title ?? '';
    const [lon, lat, depth] = event.geometry?.coordinates ?? [
      undefined,
      undefined,
      undefined,
    ];

    const magStr = mag != null ? `M${mag}` : 'M?';
    const isoTime =
      time != null ? new Date(time).toISOString() : 'unknown time';
    const depthStr = depth != null ? `${depth} km` : '?';

    let text = `# ${title || `${magStr} — ${place}`}\n\n`;
    text += `${magStr} — ${place}\n`;
    text += `  ${isoTime} · depth ${depthStr} · ${url}\n`;
    text += `  id: ${event.id}\n`;
    if (lat != null && lon != null) {
      text += `  coordinates: ${lat}, ${lon}\n`;
    }
    return text.trim();
  }
}
