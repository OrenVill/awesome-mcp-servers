export interface WBPagination {
  page: number;
  pages: number;
  per_page: number | string;
  total: number;
  sourceid?: string;
  lastupdated?: string;
}

export interface WBCountry {
  id: string;
  iso2Code: string;
  name: string;
  region?: { id: string; value: string };
  incomeLevel?: { id: string; value: string };
  lendingType?: { id: string; value: string };
  capitalCity?: string;
  longitude?: string;
  latitude?: string;
}

export interface WBIndicator {
  id: string;
  name: string;
  unit?: string;
  source?: { id: string; value: string };
  sourceNote?: string;
}

export interface WBCountryIndicatorRow {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
  unit?: string;
  obs_status?: string;
  decimal?: number;
}

type WBListResponse<T> = [WBPagination, T[]];

export class WorldbankService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  readonly defaultSourceId: string;

  constructor(options?: {
    baseUrl?: string;
    timeout?: number;
    defaultSourceId?: string;
  }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.worldbank.org/v2').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 20000;
    this.defaultSourceId = options?.defaultSourceId ?? '2';
  }

  isAggregateCountry(country: WBCountry): boolean {
    if (country.incomeLevel?.value === 'Aggregates') return true;
    if (country.region?.value === 'Aggregates') return true;
    if (!country.iso2Code || country.iso2Code.length === 0) return true;
    return false;
  }

  async listCountries(params?: {
    page?: number;
    perPage?: number;
    excludeAggregates?: boolean;
    fetchAll?: boolean;
  }): Promise<{ pagination: WBPagination; countries: WBCountry[] }> {
    const perPage = params?.perPage ?? 500;
    const excludeAggregates = params?.excludeAggregates !== false;
    const fetchAll = params?.fetchAll !== false;

    if (!fetchAll) {
      const page = params?.page ?? 1;
      const { pagination, rows } = await this.fetchCountriesPage(page, perPage);
      let countries = rows;
      if (excludeAggregates) {
        countries = countries.filter((c) => !this.isAggregateCountry(c));
      }
      return { pagination, countries };
    }

    const first = await this.fetchCountriesPage(1, perPage);
    let all = first.rows;
    for (let p = 2; p <= first.pagination.pages; p++) {
      const next = await this.fetchCountriesPage(p, perPage);
      all = all.concat(next.rows);
    }
    if (excludeAggregates) {
      all = all.filter((c) => !this.isAggregateCountry(c));
    }
    return {
      pagination: {
        ...first.pagination,
        page: 1,
        pages: 1,
        per_page: all.length,
        total: all.length,
      },
      countries: all,
    };
  }

  private async fetchCountriesPage(
    page: number,
    perPage: number
  ): Promise<{ pagination: WBPagination; rows: WBCountry[] }> {
    const url = new URL(`${this.baseUrl}/country`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));

    const [pagination, rows] = await this.getJson<WBListResponse<WBCountry>>(url.toString());
    return { pagination, rows: rows ?? [] };
  }

  async searchIndicators(params: {
    query: string;
    limit?: number;
    sourceId?: string;
    maxPages?: number;
  }): Promise<{ query: string; indicators: WBIndicator[]; scannedPages: number }> {
    const query = params.query.trim();
    if (!query) {
      throw new Error('query is required');
    }

    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const sourceId = params.sourceId ?? this.defaultSourceId;
    const maxPages = Math.min(Math.max(params.maxPages ?? 30, 1), 100);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    const matches: WBIndicator[] = [];
    let scannedPages = 0;

    for (let page = 1; page <= maxPages && matches.length < limit; page++) {
      const url = new URL(`${this.baseUrl}/source/${encodeURIComponent(sourceId)}/indicator`);
      url.searchParams.set('format', 'json');
      url.searchParams.set('page', String(page));
      url.searchParams.set('per_page', '100');

      const [pagination, rows] = await this.getJson<WBListResponse<WBIndicator>>(url.toString());
      scannedPages = page;

      for (const ind of rows ?? []) {
        if (this.indicatorMatches(ind, terms)) {
          matches.push(ind);
          if (matches.length >= limit) break;
        }
      }

      if (page >= pagination.pages) break;
    }

    return { query, indicators: matches, scannedPages };
  }

  private indicatorMatches(indicator: WBIndicator, terms: string[]): boolean {
    const haystack = `${indicator.id} ${indicator.name}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  }

  async getCountryIndicator(params: {
    countryCode: string;
    indicatorId: string;
    date?: string;
    perPage?: number;
  }): Promise<{
    countryCode: string;
    indicatorId: string;
    pagination: WBPagination;
    series: WBCountryIndicatorRow[];
  }> {
    const countryCode = params.countryCode.trim().toLowerCase();
    const indicatorId = params.indicatorId.trim();
    if (!countryCode || !indicatorId) {
      throw new Error('country_code and indicator_id are required');
    }

    const perPage = Math.min(Math.max(params.perPage ?? 500, 1), 2000);
    const url = new URL(
      `${this.baseUrl}/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicatorId)}`
    );
    url.searchParams.set('format', 'json');
    url.searchParams.set('per_page', String(perPage));
    if (params.date?.trim()) {
      url.searchParams.set('date', params.date.trim());
    }

    const [pagination, rows] = await this.getJson<WBListResponse<WBCountryIndicatorRow>>(
      url.toString()
    );

    return {
      countryCode,
      indicatorId,
      pagination,
      series: rows ?? [],
    };
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`World Bank API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
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
