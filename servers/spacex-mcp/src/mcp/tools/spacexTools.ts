import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  SpaceXService,
  type SpaceXLaunch,
  type SpaceXRocket,
} from '../../services/spacexService.js';

export const GET_LATEST_LAUNCH_DEF = {
  name: 'get_latest_launch',
  description:
    "🚀 I'm fetching the most recent SpaceX launch\n\nReturns details of the latest SpaceX launch including name, date, rocket, success status, mission details, and links.",
  keywords: ['spacex', 'launch', 'latest', 'rocket', 'space'],
};

export const GET_NEXT_LAUNCH_DEF = {
  name: 'get_next_launch',
  description:
    "🚀 I'm fetching the next scheduled SpaceX launch\n\nReturns details of the upcoming SpaceX launch including name, scheduled date, rocket, and mission details.",
  keywords: ['spacex', 'launch', 'next', 'upcoming', 'rocket', 'space'],
};

export const LIST_LAUNCHES_DEF = {
  name: 'list_launches',
  description:
    "🚀 I'm listing SpaceX launches\n\nList SpaceX launches with optional filters: upcoming, success. Supports pagination via limit (1-50) and sort order (asc/desc by launch date).",
  keywords: ['spacex', 'launches', 'list', 'history', 'rocket', 'space'],
};

export const GET_LAUNCH_DEF = {
  name: 'get_launch',
  description:
    "🚀 I'm fetching a single SpaceX launch by id\n\nReturns full details of a specific SpaceX launch given its id.",
  keywords: ['spacex', 'launch', 'detail', 'rocket', 'space'],
};

export const GET_ROCKET_DEF = {
  name: 'get_rocket',
  description:
    "🚀 I'm fetching a SpaceX rocket by id\n\nReturns details about a SpaceX rocket including specs, success rate, first flight, and description.",
  keywords: ['spacex', 'rocket', 'specs', 'falcon', 'starship', 'space'],
};

export interface GetLatestLaunchInput {
  // no args
  [key: string]: unknown;
}

export interface GetNextLaunchInput {
  // no args
  [key: string]: unknown;
}

export interface ListLaunchesInput {
  upcoming?: boolean;
  success?: boolean;
  limit?: number;
  sort?: 'asc' | 'desc';
}

export interface GetLaunchInput {
  id: string;
}

export interface GetRocketInput {
  id: string;
}

export class SpacexTools {
  private service: SpaceXService;

  constructor(service?: SpaceXService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new SpaceXService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetLatestLaunchSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    };
  }

  static getGetNextLaunchSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    };
  }

  static getListLaunchesSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          upcoming: {
            type: 'boolean',
            description: 'Filter by upcoming launches (true) or past launches (false). Optional.',
          },
          success: {
            type: 'boolean',
            description: 'Filter by successful launches (true) or failed launches (false). Optional.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (1-50)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
          sort: {
            type: 'string',
            description: 'Sort order by launch date',
            enum: ['asc', 'desc'],
            default: 'desc',
          },
        },
      },
    };
  }

  static getGetLaunchSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'SpaceX launch id (e.g. "5eb87cd9ffd86e000604b32a")',
          },
        },
        required: ['id'],
      },
    };
  }

  static getGetRocketSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'SpaceX rocket id (e.g. "5e9d0d95eda69973a809d1ec")',
          },
        },
        required: ['id'],
      },
    };
  }

  async executeGetLatestLaunch(_args: GetLatestLaunchInput): Promise<MCPToolCallResult> {
    try {
      const launch = await this.service.getLatestLaunch();
      return { content: [{ type: 'text', text: this.formatLaunch(launch, 'Latest Launch') }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to fetch latest launch: ${message}`);
    }
  }

  async executeGetNextLaunch(_args: GetNextLaunchInput): Promise<MCPToolCallResult> {
    try {
      const launch = await this.service.getNextLaunch();
      return { content: [{ type: 'text', text: this.formatLaunch(launch, 'Next Launch') }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to fetch next launch: ${message}`);
    }
  }

  async executeListLaunches(args: ListLaunchesInput): Promise<MCPToolCallResult> {
    const limit = args.limit ?? 10;
    if (typeof limit !== 'number' || limit < 1 || limit > 50) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'limit must be a number between 1 and 50');
    }
    const sort = args.sort ?? 'desc';
    if (sort !== 'asc' && sort !== 'desc') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, "sort must be 'asc' or 'desc'");
    }
    if (args.upcoming !== undefined && typeof args.upcoming !== 'boolean') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'upcoming must be a boolean');
    }
    if (args.success !== undefined && typeof args.success !== 'boolean') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'success must be a boolean');
    }

    try {
      const response = await this.service.listLaunches({
        upcoming: args.upcoming,
        success: args.success,
        limit,
        sort,
      });
      return { content: [{ type: 'text', text: this.formatLaunchList(response.docs, response.totalDocs) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to list launches: ${message}`);
    }
  }

  async executeGetLaunch(args: GetLaunchInput): Promise<MCPToolCallResult> {
    if (!args.id || typeof args.id !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'id is required and must be a string');
    }

    try {
      const launch = await this.service.getLaunch(args.id);
      return { content: [{ type: 'text', text: this.formatLaunch(launch, 'Launch') }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to fetch launch: ${message}`);
    }
  }

  async executeGetRocket(args: GetRocketInput): Promise<MCPToolCallResult> {
    if (!args.id || typeof args.id !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'id is required and must be a string');
    }

    try {
      const rocket = await this.service.getRocket(args.id);
      return { content: [{ type: 'text', text: this.formatRocket(rocket) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to fetch rocket: ${message}`);
    }
  }

  private formatLaunch(launch: SpaceXLaunch, heading: string): string {
    let text = `# ${heading}: ${launch.name}\n\n`;
    text += `- **ID:** ${launch.id}\n`;
    text += `- **Date (UTC):** ${launch.date_utc}\n`;
    text += `- **Rocket ID:** ${launch.rocket}\n`;
    if (launch.flight_number !== undefined) {
      text += `- **Flight #:** ${launch.flight_number}\n`;
    }
    if (launch.upcoming !== undefined) {
      text += `- **Upcoming:** ${launch.upcoming ? 'yes' : 'no'}\n`;
    }
    if (launch.success !== undefined && launch.success !== null) {
      text += `- **Success:** ${launch.success ? 'yes' : 'no'}\n`;
    } else if (launch.upcoming) {
      text += `- **Success:** (pending)\n`;
    }

    if (launch.details) {
      const details = launch.details.length > 500
        ? launch.details.slice(0, 500).trim() + '…'
        : launch.details;
      text += `\n**Details:**\n${details}\n`;
    }

    const links: string[] = [];
    if (launch.links?.webcast) links.push(`[Webcast](${launch.links.webcast})`);
    if (launch.links?.wikipedia) links.push(`[Wikipedia](${launch.links.wikipedia})`);
    if (launch.links?.article) links.push(`[Article](${launch.links.article})`);
    if (links.length > 0) {
      text += `\n**Links:** ${links.join(' · ')}\n`;
    }

    return text.trim();
  }

  private formatLaunchList(launches: SpaceXLaunch[], totalDocs?: number): string {
    if (launches.length === 0) {
      return 'No launches found matching the given filters.';
    }

    let text = `Found ${launches.length} launch(es)`;
    if (totalDocs != null) text += ` (${totalDocs.toLocaleString()} total)`;
    text += ':\n\n';

    launches.forEach((l, i) => {
      text += `${i + 1}. **${l.name}** (id: ${l.id})\n`;
      text += `   - Date (UTC): ${l.date_utc}\n`;
      text += `   - Rocket: ${l.rocket}\n`;
      if (l.upcoming !== undefined) {
        text += `   - Upcoming: ${l.upcoming ? 'yes' : 'no'}\n`;
      }
      if (l.success !== undefined && l.success !== null) {
        text += `   - Success: ${l.success ? 'yes' : 'no'}\n`;
      }
      if (l.details) {
        const details = l.details.length > 500
          ? l.details.slice(0, 500).trim() + '…'
          : l.details;
        text += `   - Details: ${details}\n`;
      }
      const links: string[] = [];
      if (l.links?.webcast) links.push(`webcast: ${l.links.webcast}`);
      if (l.links?.wikipedia) links.push(`wiki: ${l.links.wikipedia}`);
      if (links.length > 0) {
        text += `   - Links: ${links.join(' | ')}\n`;
      }
      text += '\n';
    });

    return text.trim();
  }

  private formatRocket(rocket: SpaceXRocket): string {
    let text = `# Rocket: ${rocket.name}\n\n`;
    text += `- **ID:** ${rocket.id}\n`;
    if (rocket.type) text += `- **Type:** ${rocket.type}\n`;
    if (rocket.active !== undefined) text += `- **Active:** ${rocket.active ? 'yes' : 'no'}\n`;
    if (rocket.first_flight) text += `- **First flight:** ${rocket.first_flight}\n`;
    if (rocket.country) text += `- **Country:** ${rocket.country}\n`;
    if (rocket.company) text += `- **Company:** ${rocket.company}\n`;
    if (rocket.stages !== undefined) text += `- **Stages:** ${rocket.stages}\n`;
    if (rocket.boosters !== undefined) text += `- **Boosters:** ${rocket.boosters}\n`;
    if (rocket.success_rate_pct !== undefined) {
      text += `- **Success rate:** ${rocket.success_rate_pct}%\n`;
    }
    if (rocket.cost_per_launch !== undefined) {
      text += `- **Cost per launch:** $${rocket.cost_per_launch.toLocaleString()}\n`;
    }
    if (rocket.height?.meters !== undefined) {
      text += `- **Height:** ${rocket.height.meters} m\n`;
    }
    if (rocket.diameter?.meters !== undefined) {
      text += `- **Diameter:** ${rocket.diameter.meters} m\n`;
    }
    if (rocket.mass?.kg !== undefined) {
      text += `- **Mass:** ${rocket.mass.kg.toLocaleString()} kg\n`;
    }

    if (rocket.description) {
      const desc = rocket.description.length > 500
        ? rocket.description.slice(0, 500).trim() + '…'
        : rocket.description;
      text += `\n**Description:**\n${desc}\n`;
    }

    if (rocket.wikipedia) {
      text += `\n**Links:** [Wikipedia](${rocket.wikipedia})\n`;
    }

    return text.trim();
  }
}
