export interface SpaceXLaunchLinks {
  patch?: { small?: string | null; large?: string | null };
  webcast?: string | null;
  article?: string | null;
  wikipedia?: string | null;
  presskit?: string | null;
  flickr?: { small?: string[]; original?: string[] };
}

export interface SpaceXLaunch {
  id: string;
  name: string;
  date_utc: string;
  date_unix?: number;
  rocket: string;
  success?: boolean | null;
  upcoming?: boolean;
  details?: string | null;
  flight_number?: number;
  links?: SpaceXLaunchLinks;
  failures?: Array<{ time?: number; altitude?: number | null; reason?: string }>;
  crew?: string[];
  capsules?: string[];
  payloads?: string[];
  launchpad?: string;
}

export interface SpaceXRocket {
  id: string;
  name: string;
  type?: string;
  active?: boolean;
  stages?: number;
  boosters?: number;
  cost_per_launch?: number;
  success_rate_pct?: number;
  first_flight?: string;
  country?: string;
  company?: string;
  height?: { meters?: number; feet?: number };
  diameter?: { meters?: number; feet?: number };
  mass?: { kg?: number; lb?: number };
  description?: string;
  wikipedia?: string;
}

export interface SpaceXQueryResponse<T> {
  docs: T[];
  totalDocs?: number;
  limit?: number;
  page?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface ListLaunchesParams {
  upcoming?: boolean;
  success?: boolean;
  limit?: number;
  sort?: 'asc' | 'desc';
}

export class SpaceXService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://api.spacexdata.com/v4';
    this.timeout = options?.timeout ?? 15000;
  }

  async getLatestLaunch(): Promise<SpaceXLaunch> {
    const url = `${this.baseUrl}/launches/latest`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`SpaceX API returned ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as SpaceXLaunch;
  }

  async getNextLaunch(): Promise<SpaceXLaunch> {
    const url = `${this.baseUrl}/launches/next`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`SpaceX API returned ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as SpaceXLaunch;
  }

  async listLaunches(params: ListLaunchesParams): Promise<SpaceXQueryResponse<SpaceXLaunch>> {
    const url = `${this.baseUrl}/launches/query`;
    const query: Record<string, unknown> = {};
    if (params.upcoming !== undefined) query.upcoming = params.upcoming;
    if (params.success !== undefined) query.success = params.success;

    const sort = params.sort ?? 'desc';
    const limit = params.limit ?? 10;

    const body = {
      query,
      options: {
        limit,
        sort: { date_unix: sort },
      },
    };

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`SpaceX API returned ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as SpaceXQueryResponse<SpaceXLaunch>;
  }

  async getLaunch(id: string): Promise<SpaceXLaunch> {
    const url = `${this.baseUrl}/launches/${encodeURIComponent(id)}`;
    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) {
      throw new Error(`Launch not found: ${id}`);
    }
    if (!res.ok) {
      throw new Error(`SpaceX API returned ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as SpaceXLaunch;
  }

  async getRocket(id: string): Promise<SpaceXRocket> {
    const url = `${this.baseUrl}/rockets/${encodeURIComponent(id)}`;
    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) {
      throw new Error(`Rocket not found: ${id}`);
    }
    if (!res.ok) {
      throw new Error(`SpaceX API returned ${res.status}: ${res.statusText}`);
    }
    return (await res.json()) as SpaceXRocket;
  }

  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'User-Agent': 'spacex-mcp/1.0 (https://github.com/awesome-mcp-servers)',
          ...(init?.headers ?? {}),
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
}
