export interface IssPosition {
  latitude: string;
  longitude: string;
}

export interface IssNowResponse {
  timestamp: number;
  message: string;
  iss_position: IssPosition;
}

export interface PersonInSpace {
  name: string;
  craft: string;
}

export interface AstrosResponse {
  message: string;
  number: number;
  people: PersonInSpace[];
}

export interface IssPassRequest {
  altitude: number;
  datetime: number;
  latitude: number;
  longitude: number;
  passes: number;
}

export interface IssPassEntry {
  duration: number;
  risetime: number;
}

export interface IssPassResponse {
  message: string;
  request: IssPassRequest;
  response: IssPassEntry[];
}

export class OpennotifyService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'http://api.open-notify.org').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async getIssLocation(): Promise<IssNowResponse> {
    const url = `${this.baseUrl}/iss-now.json`;
    const res = await this.fetchWithTimeout(url);
    return this.parseJsonResponse(res, url);
  }

  async getPeopleInSpace(): Promise<AstrosResponse> {
    const url = `${this.baseUrl}/astros.json`;
    const res = await this.fetchWithTimeout(url);
    return this.parseJsonResponse(res, url);
  }

  async getIssPassTimes(params: {
    lat: number;
    lon: number;
    alt?: number;
  }): Promise<IssPassResponse> {
    const alt = params.alt ?? 20;
    const url = new URL(`${this.baseUrl}/iss-pass.json`);
    url.searchParams.set('lat', String(params.lat));
    url.searchParams.set('lon', String(params.lon));
    url.searchParams.set('alt', String(alt));
    const res = await this.fetchWithTimeout(url.toString());
    return this.parseJsonResponse(res, url.toString());
  }

  private userAgent(): string {
    return 'opennotify-mcp/1.0 (https://github.com/awesome-mcp-servers)';
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent(),
          Accept: 'application/json',
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw err;
    }
  }

  private async parseJsonResponse<T>(res: Response, url: string): Promise<T> {
    const contentType = res.headers.get('content-type') ?? '';
    const bodyText = await res.text();

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          `Open Notify returned 404 for ${url}. The ISS pass times endpoint may have been removed from the public API.`
        );
      }
      throw new Error(`Open Notify returned ${res.status} ${res.statusText}`);
    }

    if (!contentType.includes('application/json') && bodyText.trimStart().startsWith('<')) {
      throw new Error(
        'Open Notify returned HTML instead of JSON. The requested endpoint may no longer be available.'
      );
    }

    try {
      return JSON.parse(bodyText) as T;
    } catch {
      throw new Error('Open Notify returned a response that could not be parsed as JSON');
    }
  }
}
