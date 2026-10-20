export interface SunTimesResults {
  sunrise: string;
  sunset: string;
  solar_noon: string;
  day_length: number;
  civil_twilight_begin: string;
  civil_twilight_end: string;
  nautical_twilight_begin: string;
  nautical_twilight_end: string;
  astronomical_twilight_begin: string;
  astronomical_twilight_end: string;
}

export interface SunTimesResponse {
  results: SunTimesResults;
  status: string;
  tzid?: string;
}

export class SunriseSunsetService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.sunrise-sunset.org/json').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async getSunTimes(params: {
    lat: number;
    lng: number;
    date?: string;
  }): Promise<SunTimesResponse> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('lat', String(params.lat));
    url.searchParams.set('lng', String(params.lng));
    url.searchParams.set('formatted', '0');
    if (params.date) {
      url.searchParams.set('date', params.date);
    }

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Sunrise-Sunset API returned ${res.status} ${res.statusText}`);
    }

    const body = (await res.json()) as SunTimesResponse;
    if (body.status !== 'OK') {
      throw new Error(`Sunrise-Sunset API status: ${body.status}`);
    }
    return body;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'sunrise-sunset-mcp/1.0 (https://github.com/awesome-mcp-servers)',
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    }
  }
}
