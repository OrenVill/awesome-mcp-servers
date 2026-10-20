import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  OpennotifyService,
  type AstrosResponse,
  type IssNowResponse,
  type IssPassResponse,
} from '../../services/opennotifyService.js';

export const GET_ISS_LOCATION_DEF = {
  name: 'get_iss_location',
  description:
    "🛰️ I'm fetching the ISS position\n\nReturns the current latitude and longitude of the International Space Station from Open Notify, plus the observation timestamp.",
  keywords: ['iss', 'space station', 'location', 'coordinates', 'open-notify', 'orbit', 'satellite'],
};

export const GET_PEOPLE_IN_SPACE_DEF = {
  name: 'get_people_in_space',
  description:
    "👨‍🚀 I'm listing people in space\n\nReturns how many people are currently in space and their names, grouped by spacecraft (ISS, Tiangong, etc.) via Open Notify.",
  keywords: ['astronauts', 'cosmonauts', 'space', 'iss', 'crew', 'open-notify', 'people in space'],
};

export const GET_ISS_PASS_TIMES_DEF = {
  name: 'get_iss_pass_times',
  description:
    "🛰️ I'm predicting ISS pass times\n\nReturns upcoming visible ISS pass times for a location. Provide latitude and longitude (degrees); optional altitude in meters above sea level (default 20). Note: Open Notify may no longer host this endpoint — if the API is unavailable, the tool reports that clearly.",
  keywords: [
    'iss',
    'pass',
    'overhead',
    'visibility',
    'rise time',
    'open-notify',
    'satellite',
    'location',
  ],
};

export interface GetIssLocationInput {
  [key: string]: unknown;
}

export interface GetPeopleInSpaceInput {
  [key: string]: unknown;
}

export interface GetIssPassTimesInput {
  lat: number;
  lon: number;
  alt?: number;
}

export class OpennotifyTools {
  private service: OpennotifyService;

  constructor(service?: OpennotifyService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new OpennotifyService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetIssLocationSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    };
  }

  static getGetPeopleInSpaceSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    };
  }

  static getGetIssPassTimesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          lat: {
            type: 'number',
            description: 'Observer latitude in decimal degrees (-90 to 90)',
            minimum: -90,
            maximum: 90,
          },
          lon: {
            type: 'number',
            description: 'Observer longitude in decimal degrees (-180 to 180)',
            minimum: -180,
            maximum: 180,
          },
          alt: {
            type: 'number',
            description: 'Observer altitude in meters above sea level (default 20)',
            minimum: 0,
            default: 20,
          },
        },
        required: ['lat', 'lon'],
      },
    };
  }

  async executeGetIssLocation(_args: GetIssLocationInput): Promise<MCPToolCallResult> {
    try {
      const data = await this.service.getIssLocation();
      if (data.message !== 'success') {
        return createMCPErrorResult(
          MCPErrorCode.API_ERROR,
          `Open Notify ISS location request failed: ${data.message}`
        );
      }
      return { content: [{ type: 'text', text: this.formatIssLocationAsText(data) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async executeGetPeopleInSpace(_args: GetPeopleInSpaceInput): Promise<MCPToolCallResult> {
    try {
      const data = await this.service.getPeopleInSpace();
      if (data.message !== 'success') {
        return createMCPErrorResult(
          MCPErrorCode.API_ERROR,
          `Open Notify people-in-space request failed: ${data.message}`
        );
      }
      return { content: [{ type: 'text', text: this.formatPeopleInSpaceAsText(data) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async executeGetIssPassTimes(args: GetIssPassTimesInput): Promise<MCPToolCallResult> {
    const lat = args.lat;
    const lon = args.lon;
    if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'lat is required and must be a number between -90 and 90'
      );
    }
    if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'lon is required and must be a number between -180 and 180'
      );
    }
    const alt = args.alt ?? 20;
    if (typeof alt !== 'number' || !Number.isFinite(alt) || alt < 0) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'alt must be a non-negative number (meters above sea level)'
      );
    }

    try {
      const data = await this.service.getIssPassTimes({ lat, lon, alt });
      if (data.message !== 'success') {
        return createMCPErrorResult(
          MCPErrorCode.API_ERROR,
          `Open Notify ISS pass request failed: ${data.message}`
        );
      }
      return { content: [{ type: 'text', text: this.formatIssPassTimesAsText(data) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  private formatIssLocationAsText(data: IssNowResponse): string {
    const { latitude, longitude } = data.iss_position;
    const when = new Date(data.timestamp * 1000).toISOString();
    let text = `# International Space Station — current position\n\n`;
    text += `**Latitude:** ${latitude}°\n`;
    text += `**Longitude:** ${longitude}°\n`;
    text += `**Timestamp (UTC):** ${when}\n`;
    text += `\nData from Open Notify (\`iss-now.json\`).`;
    return text.trim();
  }

  private formatPeopleInSpaceAsText(data: AstrosResponse): string {
    let text = `# People in space\n\n`;
    text += `**Total:** ${data.number}\n\n`;

    const byCraft = new Map<string, string[]>();
    for (const person of data.people) {
      const list = byCraft.get(person.craft) ?? [];
      list.push(person.name);
      byCraft.set(person.craft, list);
    }

    for (const [craft, names] of [...byCraft.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      text += `## ${craft} (${names.length})\n\n`;
      names.sort((a, b) => a.localeCompare(b)).forEach((name, i) => {
        text += `${i + 1}. ${name}\n`;
      });
      text += '\n';
    }

    text += `Data from Open Notify (\`astros.json\`).`;
    return text.trim();
  }

  private formatIssPassTimesAsText(data: IssPassResponse): string {
    const req = data.request;
    let text = `# ISS pass times\n\n`;
    text += `**Location:** ${req.latitude}°, ${req.longitude}° (altitude ${req.altitude} m)\n`;
    text += `**Passes returned:** ${req.passes}\n\n`;

    if (!data.response || data.response.length === 0) {
      text += `No upcoming passes were returned for this location.`;
      return text.trim();
    }

    data.response.forEach((pass, i) => {
      const rise = new Date(pass.risetime * 1000).toISOString();
      const minutes = Math.floor(pass.duration / 60);
      const seconds = pass.duration % 60;
      text += `${i + 1}. **Rise (UTC):** ${rise} — **Duration:** ${minutes}m ${seconds}s\n`;
    });

    text += `\nData from Open Notify (\`iss-pass.json\`).`;
    return text.trim();
  }
}
