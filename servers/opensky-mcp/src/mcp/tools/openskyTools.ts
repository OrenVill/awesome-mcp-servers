import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  OpenSkyService,
  type OpenSkyArrivalFlight,
  type OpenSkyStateVector,
  type OpenSkyTrackResponse,
} from '../../services/openskyService.js';

export const GET_ALL_STATES_DEF = {
  name: 'get_all_states',
  description:
    "✈️ I'm fetching live aircraft state vectors from OpenSky\n\nReturns current ADS-B positions for aircraft worldwide, or filter by ICAO24 transponder address(es). Anonymous tier; rate limits apply.",
  keywords: ['opensky', 'ads-b', 'aircraft', 'flight', 'tracking', 'live', 'icao24', 'position'],
};

export const GET_FLIGHT_TRACK_DEF = {
  name: 'get_flight_track',
  description:
    "✈️ I'm fetching a recent flight track from OpenSky\n\nReturns the path (lat/lon/altitude over time) for one aircraft by ICAO24. Optional Unix `time` (defaults to now). Track history may be limited on the anonymous tier.",
  keywords: ['opensky', 'track', 'trajectory', 'path', 'icao24', 'ads-b', 'flight', 'history'],
};

export const GET_AIRPORT_ARRIVALS_DEF = {
  name: 'get_airport_arrivals',
  description:
    "✈️ I'm fetching recent arrivals at an airport from OpenSky\n\nLists flights that arrived at the given ICAO airport code. Optional Unix `begin`/`end` window (defaults to the last 2 hours). Anonymous tier may restrict historical ranges.",
  keywords: ['opensky', 'airport', 'arrivals', 'flights', 'icao', 'aviation', 'schedule'],
};

export interface GetAllStatesInput {
  icao24?: string | string[];
}

export interface GetFlightTrackInput {
  icao24: string;
  time?: number;
}

export interface GetAirportArrivalsInput {
  airport: string;
  begin?: number;
  end?: number;
}

function normalizeIcao24List(
  value: string | string[] | undefined
): { ok: true; ids: string[] } | { ok: false } | { ok: true; ids?: undefined } {
  if (value === undefined) return { ok: true, ids: undefined };
  const items = Array.isArray(value) ? value : [value];
  const cleaned = items
    .map((id) => id.trim().toLowerCase())
    .filter((id) => id.length > 0);
  if (cleaned.length === 0) {
    return { ok: true, ids: undefined };
  }
  for (const id of cleaned) {
    if (!/^[0-9a-f]{6}$/i.test(id)) {
      return { ok: false };
    }
  }
  return { ok: true, ids: cleaned };
}

function stringOrArraySchema(description: string): object {
  return {
    oneOf: [
      { type: 'string', pattern: '^[0-9a-fA-F]{6}$' },
      {
        type: 'array',
        items: { type: 'string', pattern: '^[0-9a-fA-F]{6}$' },
        minItems: 1,
      },
    ],
    description: `${description} Accepts a single ICAO24 hex address or an array of addresses.`,
  };
}

const DEFAULT_ARRIVAL_WINDOW_SEC = 2 * 60 * 60;
const MAX_ARRIVAL_WINDOW_SEC = 2 * 24 * 60 * 60;

export class OpenSkyTools {
  private service: OpenSkyService;

  constructor(service?: OpenSkyService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new OpenSkyService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetAllStatesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          icao24: stringOrArraySchema(
            'Optional ICAO24 transponder address filter (6 hex chars, e.g. "3c6444").'
          ),
        },
      },
    };
  }

  static getGetFlightTrackSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          icao24: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{6}$',
            description: 'ICAO24 transponder address (6 hex characters).',
          },
          time: {
            type: 'number',
            description:
              'Unix timestamp (seconds) for the track snapshot. Defaults to current time if omitted.',
          },
        },
        required: ['icao24'],
      },
    };
  }

  static getGetAirportArrivalsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          airport: {
            type: 'string',
            minLength: 4,
            maxLength: 4,
            description: 'Destination airport ICAO code (4 letters, e.g. "EDDF").',
          },
          begin: {
            type: 'number',
            description:
              'Start of arrival window (Unix seconds). Defaults to 2 hours before `end` or now.',
          },
          end: {
            type: 'number',
            description: 'End of arrival window (Unix seconds). Defaults to now.',
          },
        },
        required: ['airport'],
      },
    };
  }

  async executeGetAllStates(args: GetAllStatesInput): Promise<MCPToolCallResult> {
    const parsed = normalizeIcao24List(args.icao24);
    if (!parsed.ok) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'icao24 must be a 6-character hex string or array of such strings'
      );
    }

    try {
      const response = await this.service.getAllStates(parsed.ids);
      return {
        content: [
          {
            type: 'text',
            text: this.formatStatesResponse(response.time, response.states, parsed.ids),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to fetch states: ${message}`);
    }
  }

  async executeGetFlightTrack(args: GetFlightTrackInput): Promise<MCPToolCallResult> {
    if (!args.icao24 || typeof args.icao24 !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'icao24 is required');
    }
    const icao24 = args.icao24.trim().toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(icao24)) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'icao24 must be a 6-character hexadecimal string'
      );
    }
    const time =
      args.time !== undefined ? args.time : Math.floor(Date.now() / 1000);
    if (typeof time !== 'number' || !Number.isFinite(time) || time <= 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'time must be a positive Unix timestamp');
    }

    try {
      const track = await this.service.getFlightTrack(icao24, time);
      return { content: [{ type: 'text', text: this.formatTrack(track) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to fetch flight track: ${message}`);
    }
  }

  async executeGetAirportArrivals(args: GetAirportArrivalsInput): Promise<MCPToolCallResult> {
    if (!args.airport || typeof args.airport !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'airport is required');
    }
    const airport = args.airport.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(airport)) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'airport must be a 4-letter ICAO code (e.g. EDDF)'
      );
    }

    const end =
      args.end !== undefined ? args.end : Math.floor(Date.now() / 1000);
    const begin =
      args.begin !== undefined ? args.begin : end - DEFAULT_ARRIVAL_WINDOW_SEC;

    if (
      typeof begin !== 'number' ||
      typeof end !== 'number' ||
      !Number.isFinite(begin) ||
      !Number.isFinite(end)
    ) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'begin and end must be finite Unix timestamps in seconds'
      );
    }
    if (begin >= end) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'begin must be less than end');
    }
    if (end - begin > MAX_ARRIVAL_WINDOW_SEC) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        `Time window must not exceed ${MAX_ARRIVAL_WINDOW_SEC / 3600} hours`
      );
    }

    try {
      const flights = await this.service.getAirportArrivals(airport, begin, end);
      return {
        content: [
          {
            type: 'text',
            text: this.formatArrivals(airport, begin, end, flights),
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to fetch arrivals: ${message}`);
    }
  }

  private formatStatesResponse(
    time: number,
    states: OpenSkyStateVector[] | null,
    filter?: string[]
  ): string {
    const timeIso = new Date(time * 1000).toISOString();
    if (!states || states.length === 0) {
      const filterNote = filter?.length ? ` (filter: ${filter.join(', ')})` : '';
      return `No aircraft states returned at ${timeIso}${filterNote}. Aircraft may be out of coverage or filtered ICAO24 not broadcasting.`;
    }

    const maxRows = 50;
    const shown = states.slice(0, maxRows);
    let text = `# OpenSky live states\n\n`;
    text += `- **Snapshot time (UTC):** ${timeIso}\n`;
    text += `- **Aircraft count:** ${states.length}`;
    if (states.length > maxRows) text += ` (showing first ${maxRows})`;
    text += '\n\n';

    shown.forEach((s, i) => {
      text += `## ${i + 1}. ${this.formatStateLine(s)}\n\n`;
    });

    return text.trim();
  }

  private formatStateLine(s: OpenSkyStateVector): string {
    const callsign = (s[1] ?? '').trim() || '(no callsign)';
    const icao = s[0] ?? 'unknown';
    const country = s[2] ?? 'unknown';
    const lat = s[6];
    const lon = s[5];
    const alt = s[7] ?? s[13];
    const onGround = s[8];
    const velocity = s[9];
    const track = s[10];
    const vert = s[11];
    const squawk = s[14];

    let line = `**${callsign}** (icao24: \`${icao}\`, ${country})\n`;
    if (lat != null && lon != null) {
      line += `- Position: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°\n`;
    }
    if (alt != null) line += `- Altitude: ${Math.round(alt)} m\n`;
    if (onGround != null) line += `- On ground: ${onGround ? 'yes' : 'no'}\n`;
    if (velocity != null) line += `- Ground speed: ${velocity.toFixed(1)} m/s\n`;
    if (track != null) line += `- Track: ${track.toFixed(1)}°\n`;
    if (vert != null) line += `- Vertical rate: ${vert.toFixed(1)} m/s\n`;
    if (squawk) line += `- Squawk: ${squawk.trim()}\n`;
    return line.trim();
  }

  private formatTrack(track: OpenSkyTrackResponse): string {
    const callsign = (track.callsign ?? '').trim() || '(no callsign)';
    const start = new Date(track.startTime * 1000).toISOString();
    const end = new Date(track.endTime * 1000).toISOString();
    const points = track.path ?? [];

    let text = `# Flight track: ${callsign}\n\n`;
    text += `- **ICAO24:** \`${track.icao24}\`\n`;
    text += `- **Track start (UTC):** ${start}\n`;
    text += `- **Track end (UTC):** ${end}\n`;
    text += `- **Path points:** ${points.length}\n\n`;

    if (points.length === 0) {
      text += 'No path points in this track.\n';
      return text.trim();
    }

    const sample = points.length <= 20 ? points : [...points.slice(0, 10), ...points.slice(-10)];
    text += '**Sample path** (time UTC, lat, lon, baro alt m, track°, on ground):\n\n';
    sample.forEach((p, idx) => {
      const isGap = points.length > 20 && idx === 10;
      if (isGap) {
        text += `… (${points.length - 20} points omitted) …\n`;
        return;
      }
      const [t, lat, lon, alt, trk, ground] = p;
      text += `- ${new Date(t * 1000).toISOString()}: ${lat.toFixed(4)}, ${lon.toFixed(4)}, ${Math.round(alt)} m, ${trk.toFixed(0)}°, ${ground ? 'ground' : 'air'}\n`;
    });

    return text.trim();
  }

  private formatArrivals(
    airport: string,
    begin: number,
    end: number,
    flights: OpenSkyArrivalFlight[]
  ): string {
    const beginIso = new Date(begin * 1000).toISOString();
    const endIso = new Date(end * 1000).toISOString();

    if (flights.length === 0) {
      return `No arrivals at **${airport}** between ${beginIso} and ${endIso}.`;
    }

    let text = `# Arrivals at ${airport}\n\n`;
    text += `- **Window (UTC):** ${beginIso} → ${endIso}\n`;
    text += `- **Flights:** ${flights.length}\n\n`;

    flights.slice(0, 50).forEach((f, i) => {
      const cs = (f.callsign ?? '').trim() || '(no callsign)';
      text += `${i + 1}. **${cs}** (icao24: \`${f.icao24}\`)\n`;
      text += `   - First seen: ${new Date(f.firstSeen * 1000).toISOString()}\n`;
      text += `   - Last seen: ${new Date(f.lastSeen * 1000).toISOString()}\n`;
      if (f.estDepartureAirport) text += `   - Est. departure: ${f.estDepartureAirport}\n`;
      if (f.estArrivalAirport) text += `   - Est. arrival: ${f.estArrivalAirport}\n`;
      text += '\n';
    });

    if (flights.length > 50) {
      text += `… and ${flights.length - 50} more.\n`;
    }

    return text.trim();
  }
}
