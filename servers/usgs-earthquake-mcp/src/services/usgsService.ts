export interface EarthquakeEvent {
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number | null;
    url: string | null;
    title: string | null;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: [number, number, number];
  };
}

export interface UsgsGeoJsonResponse {
  type: string;
  metadata?: {
    generated?: number;
    count?: number;
    title?: string;
  };
  features: EarthquakeEvent[];
}

export interface UsgsQueryParams {
  startTime?: string;
  endTime?: string;
  minMagnitude?: number;
  maxMagnitude?: number;
  latitude?: number;
  longitude?: number;
  maxRadiusKm?: number;
  limit?: number;
  orderBy?: 'time' | 'time-asc' | 'magnitude' | 'magnitude-asc';
  eventId?: string;
}

export class UsgsService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://earthquake.usgs.gov/fdsnws/event/1';
    this.timeout = options?.timeout ?? 15000;
  }

  async query(params: UsgsQueryParams): Promise<UsgsGeoJsonResponse> {
    const url = new URL(`${this.baseUrl}/query`);
    url.searchParams.set('format', 'geojson');

    if (params.startTime) url.searchParams.set('starttime', params.startTime);
    if (params.endTime) url.searchParams.set('endtime', params.endTime);
    if (params.minMagnitude != null) {
      url.searchParams.set('minmagnitude', String(params.minMagnitude));
    }
    if (params.maxMagnitude != null) {
      url.searchParams.set('maxmagnitude', String(params.maxMagnitude));
    }
    if (
      params.maxRadiusKm != null &&
      params.latitude != null &&
      params.longitude != null
    ) {
      url.searchParams.set('latitude', String(params.latitude));
      url.searchParams.set('longitude', String(params.longitude));
      url.searchParams.set('maxradiuskm', String(params.maxRadiusKm));
    }
    if (params.limit != null) {
      url.searchParams.set('limit', String(params.limit));
    }
    url.searchParams.set('orderby', params.orderBy ?? 'time');

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`USGS API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as UsgsGeoJsonResponse;
  }

  async getRecentSignificant(params: {
    minMagnitude?: number;
    days?: number;
    limit?: number;
  }): Promise<UsgsGeoJsonResponse> {
    const days = Math.min(Math.max(params.days ?? 7, 1), 30);
    const minMagnitude = params.minMagnitude ?? 4.5;
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 200);

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startTime = startDate.toISOString();

    return this.query({
      startTime,
      minMagnitude,
      limit,
      orderBy: 'time',
    });
  }

  async getEvent(eventId: string): Promise<UsgsGeoJsonResponse> {
    const url = new URL(`${this.baseUrl}/query`);
    url.searchParams.set('format', 'geojson');
    url.searchParams.set('eventid', eventId);

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`USGS API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as UsgsGeoJsonResponse;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'usgs-earthquake-mcp/1.0 (https://github.com/awesome-mcp-servers)',
          Accept: 'application/json',
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
