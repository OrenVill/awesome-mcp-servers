export interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  county?: string;
  state?: string;
  state_district?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  [key: string]: string | undefined;
}

export interface NominatimPlace {
  place_id: number;
  licence?: string;
  osm_type?: string;
  osm_id?: number;
  boundingbox?: string[];
  lat: string;
  lon: string;
  display_name: string;
  class?: string;
  type?: string;
  importance?: number;
  icon?: string;
  address?: NominatimAddress;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
}

export interface NominatimReversePlace extends NominatimPlace {
  error?: string;
}

export interface NominatimErrorResponse {
  error?: string | { code?: number; message?: string };
}

export class NominatimService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly userAgent: string;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    userAgent?: string;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
    this.userAgent =
      options?.userAgent ?? 'nominatim-mcp/1.0 (https://github.com/awesome-mcp-servers)';
  }

  async geocode(params: {
    query: string;
    limit?: number;
    countryCodes?: string;
  }): Promise<NominatimPlace[]> {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('q', params.query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(params.limit ?? 5));
    url.searchParams.set('addressdetails', '1');
    if (params.countryCodes) {
      url.searchParams.set('countrycodes', params.countryCodes);
    }

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Nominatim returned HTTP ${res.status}`);
    }
    return (await res.json()) as NominatimPlace[];
  }

  async reverseGeocode(params: {
    lat: number;
    lon: number;
    zoom?: number;
  }): Promise<NominatimReversePlace> {
    const url = new URL(`${this.baseUrl}/reverse`);
    url.searchParams.set('lat', String(params.lat));
    url.searchParams.set('lon', String(params.lon));
    url.searchParams.set('format', 'json');
    url.searchParams.set('zoom', String(params.zoom ?? 18));
    url.searchParams.set('addressdetails', '1');

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Nominatim returned HTTP ${res.status}`);
    }
    return (await res.json()) as NominatimReversePlace;
  }

  async lookup(params: { osmIds: string }): Promise<NominatimPlace[]> {
    const url = new URL(`${this.baseUrl}/lookup`);
    url.searchParams.set('osm_ids', params.osmIds);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Nominatim returned HTTP ${res.status}`);
    }
    return (await res.json()) as NominatimPlace[];
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
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
