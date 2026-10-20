export interface WorldTimeResponse {
  abbreviation?: string;
  client_ip?: string;
  datetime: string;
  day_of_week: number;
  day_of_year: number;
  dst: boolean;
  dst_from?: string | null;
  dst_offset: number;
  dst_until?: string | null;
  raw_offset: number;
  timezone: string;
  unixtime: number;
  utc_datetime: string;
  utc_offset: string;
  week_number: number;
}

export class WorldTimeNotFoundError extends Error {
  constructor(public resource: string, detail?: string) {
    super(detail ?? `Not found: ${resource}`);
    this.name = 'WorldTimeNotFoundError';
  }
}

export class WorldTimeService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'http://worldtimeapi.org/api').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async getTimeByTimezone(timezone: string): Promise<WorldTimeResponse> {
    const path = this.timezoneToPath(timezone);
    const res = await this.fetchWithTimeout(`${this.baseUrl}/timezone/${path}`);
    if (res.status === 404) {
      throw new WorldTimeNotFoundError(timezone, `Unknown timezone: ${timezone}`);
    }
    if (!res.ok) {
      throw new Error(`World Time API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as WorldTimeResponse;
  }

  async getTimeByIp(ip?: string): Promise<WorldTimeResponse> {
    const url = ip ? `${this.baseUrl}/ip/${encodeURIComponent(ip)}` : `${this.baseUrl}/ip`;
    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) {
      throw new WorldTimeNotFoundError(ip ?? 'caller', `Could not resolve time for IP${ip ? `: ${ip}` : ''}`);
    }
    if (!res.ok) {
      throw new Error(`World Time API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as WorldTimeResponse;
  }

  async listTimezones(): Promise<string[]> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/timezone`);
    if (!res.ok) {
      throw new Error(`World Time API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as string[];
  }

  private timezoneToPath(timezone: string): string {
    const trimmed = timezone.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmed) {
      throw new Error('timezone must be a non-empty string');
    }
    return trimmed
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
