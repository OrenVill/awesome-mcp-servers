import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  WorldTimeService,
  WorldTimeNotFoundError,
  type WorldTimeResponse,
} from '../../services/worldtimeService.js';

export const GET_TIME_BY_TIMEZONE_DEF = {
  name: 'get_time_by_timezone',
  description:
    "🕐 I'm fetching the current time for a timezone\n\nGet current local and UTC datetime for an IANA timezone (e.g. \"Europe/London\", \"America/New_York\"). Pass `timezone` as a string or use `timezones` with an array to look up several at once in a single call.",
  keywords: [
    'worldtime',
    'timezone',
    'time',
    'clock',
    'utc',
    'datetime',
    'iana',
    'batch',
  ],
};

export const GET_TIME_BY_IP_DEF = {
  name: 'get_time_by_ip',
  description:
    "🌐 I'm resolving time from an IP address\n\nGet current datetime for a geographic location inferred from an IP address. Omit `ip` to use the caller's IP (World Time API `/ip` endpoint).",
  keywords: ['worldtime', 'ip', 'geolocation', 'time', 'clock', 'timezone', 'location'],
};

export const LIST_TIMEZONES_DEF = {
  name: 'list_timezones',
  description:
    "📋 I'm listing available IANA timezones\n\nReturn all timezone identifiers supported by the World Time API (e.g. \"Europe/London\").",
  keywords: ['worldtime', 'timezone', 'list', 'iana', 'zones', 'catalog'],
};

export interface GetTimeByTimezoneInput {
  timezone?: string | string[];
  timezones?: string[];
}

export interface GetTimeByIpInput {
  ip?: string;
}

export type ListTimezonesInput = Record<string, never>;

const BATCH_SEPARATOR = '\n\n---\n\n';

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
    description: `${description} Accepts a single value or an array of values for batch requests.`,
  };
}

function resolveTimezoneItems(args: GetTimeByTimezoneInput): {
  items: string[];
  isBatch: boolean;
} | null {
  if (args.timezones !== undefined) {
    if (!Array.isArray(args.timezones) || args.timezones.length === 0) {
      return null;
    }
    if (args.timezones.some((tz) => typeof tz !== 'string' || !tz.trim())) {
      return null;
    }
    return { items: args.timezones, isBatch: true };
  }

  if (args.timezone === undefined) {
    return null;
  }

  const { items, isBatch } = normalizeToArray(args.timezone);
  if (items.some((tz) => typeof tz !== 'string' || !tz.trim())) {
    return null;
  }
  return { items, isBatch };
}

export class WorldtimeTools {
  private service: WorldTimeService;

  constructor(service?: WorldTimeService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new WorldTimeService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetTimeByTimezoneSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          timezone: stringOrArraySchema(
            'IANA timezone identifier (e.g. "Europe/London").'
          ),
          timezones: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description:
              'Batch lookup: array of IANA timezone identifiers. When provided, takes precedence over `timezone`.',
          },
        },
      },
    };
  }

  static getGetTimeByIpSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          ip: {
            type: 'string',
            description:
              'IPv4 or IPv6 address. If omitted, uses the World Time API /ip endpoint for the request origin.',
          },
        },
      },
    };
  }

  static getListTimezonesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    };
  }

  async executeGetTimeByTimezone(
    args: GetTimeByTimezoneInput
  ): Promise<MCPToolCallResult> {
    const resolved = resolveTimezoneItems(args);
    if (!resolved) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'Provide `timezone` (string or string array) or a non-empty `timezones` array'
      );
    }

    const { items, isBatch } = resolved;

    const sections = await Promise.all(
      items.map(async (tz) => {
        try {
          const data = await this.service.getTimeByTimezone(tz);
          return this.formatTimeResponse(data);
        } catch (err) {
          if (err instanceof WorldTimeNotFoundError) {
            return `# ${tz}\n\nTimezone not found.`;
          }
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `# ${tz}\n\nLookup failed: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeGetTimeByIp(args: GetTimeByIpInput): Promise<MCPToolCallResult> {
    const ip = args.ip?.trim();
    if (ip !== undefined && ip.length === 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'ip must be a non-empty string when provided');
    }

    try {
      const data = await this.service.getTimeByIp(ip || undefined);
      const header = ip
        ? `# Time for IP ${ip}\n\n`
        : `# Time for caller IP${data.client_ip ? ` (${data.client_ip})` : ''}\n\n`;
      return {
        content: [{ type: 'text', text: header + this.formatTimeResponse(data, { skipTitle: true }) }],
      };
    } catch (err) {
      if (err instanceof WorldTimeNotFoundError) {
        return createMCPErrorResult(
          MCPErrorCode.API_ERROR,
          ip ? `Could not resolve time for IP: ${ip}` : 'Could not resolve time for caller IP'
        );
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async executeListTimezones(_args: ListTimezonesInput): Promise<MCPToolCallResult> {
    try {
      const zones = await this.service.listTimezones();
      return {
        content: [{ type: 'text', text: this.formatTimezoneList(zones) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  private formatTimeResponse(data: WorldTimeResponse, options?: { skipTitle?: boolean }): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[data.day_of_week] ?? String(data.day_of_week);
    const lines: string[] = [];

    if (!options?.skipTitle) {
      lines.push(`# ${data.timezone}`, '');
    }

    lines.push(
      `**Local:** ${data.datetime}`,
      `**UTC:** ${data.utc_datetime}`,
      `**UTC offset:** ${data.utc_offset}`,
      `**Unix:** ${data.unixtime}`,
      `**Day:** ${dayName} (day ${data.day_of_year} of year, week ${data.week_number})`,
      `**DST:** ${data.dst ? 'yes' : 'no'}`
    );

    if (data.abbreviation) {
      lines.push(`**Abbreviation:** ${data.abbreviation}`);
    }
    if (data.client_ip) {
      lines.push(`**Client IP:** ${data.client_ip}`);
    }

    return lines.join('\n');
  }

  private formatTimezoneList(zones: string[]): string {
    const sorted = [...zones].sort((a, b) => a.localeCompare(b));
    const lines = [`# IANA timezones (${sorted.length})`, ''];
    for (const z of sorted) {
      lines.push(`- ${z}`);
    }
    return lines.join('\n');
  }
}
