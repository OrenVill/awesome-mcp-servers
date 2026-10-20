export interface GbifSpeciesMatch {
  key: number;
  scientificName?: string;
  canonicalName?: string;
  rank?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
  taxonomicStatus?: string;
  matchType?: string;
}

export interface GbifSpeciesSearchResponse {
  count: number;
  limit: number;
  offset: number;
  endOfRecords: boolean;
  results: GbifSpeciesMatch[];
}

export interface GbifSpeciesDetail extends GbifSpeciesMatch {
  vernacularName?: string;
  authorship?: string;
  nameAccordingTo?: string;
  parentKey?: number;
  acceptedKey?: number;
  synonym?: boolean;
  numDescendants?: number;
}

export interface GbifOccurrence {
  key: number;
  scientificName?: string;
  country?: string;
  countryCode?: string;
  stateProvince?: string;
  locality?: string;
  decimalLatitude?: number;
  decimalLongitude?: number;
  eventDate?: string;
  basisOfRecord?: string;
  institutionCode?: string;
  catalogNumber?: string;
}

export interface GbifOccurrenceSearchResponse {
  count: number;
  limit: number;
  offset: number;
  endOfRecords: boolean;
  results: GbifOccurrence[];
}

export class GbifService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://api.gbif.org/v1';
    this.timeout = options?.timeout ?? 15000;
  }

  async searchSpecies(q: string, limit: number): Promise<GbifSpeciesSearchResponse> {
    const url = new URL(`${this.baseUrl}/species/search`);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(limit));
    return this.fetchJson<GbifSpeciesSearchResponse>(url.toString());
  }

  async getSpecies(key: number): Promise<GbifSpeciesDetail> {
    const url = `${this.baseUrl}/species/${key}`;
    return this.fetchJson<GbifSpeciesDetail>(url);
  }

  async searchOccurrences(
    scientificName: string,
    limit: number,
    country?: string
  ): Promise<GbifOccurrenceSearchResponse> {
    const url = new URL(`${this.baseUrl}/occurrence/search`);
    url.searchParams.set('scientificName', scientificName);
    url.searchParams.set('limit', String(limit));
    if (country && country.trim()) {
      url.searchParams.set('country', country.trim());
    }
    return this.fetchJson<GbifOccurrenceSearchResponse>(url.toString());
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await this.fetchWithTimeout(url);
    if (res.status === 404) {
      throw new Error('GBIF resource not found (404)');
    }
    if (!res.ok) {
      throw new Error(`GBIF API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'gbif-mcp/1.0 (https://github.com/awesome-mcp-servers)',
        },
      });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`GBIF API request timed out after ${this.timeout}ms`);
      }
      throw err;
    }
  }
}
