export interface LatestRatesResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface TimeSeriesResponse {
  amount: number;
  base: string;
  start_date: string;
  end_date: string;
  rates: Record<string, Record<string, number>>;
}

export type CurrenciesResponse = Record<string, string>;

export class FrankfurterService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.frankfurter.app').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async getLatestRates(params: {
    base?: string;
    symbols?: string;
  }): Promise<LatestRatesResponse> {
    const url = new URL(`${this.baseUrl}/latest`);
    if (params.base) url.searchParams.set('from', params.base);
    if (params.symbols) url.searchParams.set('to', params.symbols);

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Frankfurter API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as LatestRatesResponse;
  }

  async convert(params: {
    amount: number;
    from: string;
    to: string;
  }): Promise<LatestRatesResponse> {
    const url = new URL(`${this.baseUrl}/latest`);
    url.searchParams.set('amount', String(params.amount));
    url.searchParams.set('from', params.from);
    url.searchParams.set('to', params.to);

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Frankfurter API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as LatestRatesResponse;
  }

  async getHistoricalRates(params: {
    date: string;
    base?: string;
    symbols?: string;
  }): Promise<LatestRatesResponse> {
    const url = new URL(`${this.baseUrl}/${encodeURIComponent(params.date)}`);
    if (params.base) url.searchParams.set('from', params.base);
    if (params.symbols) url.searchParams.set('to', params.symbols);

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Frankfurter API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as LatestRatesResponse;
  }

  async getTimeSeries(params: {
    startDate: string;
    endDate?: string;
    base?: string;
    symbols?: string;
  }): Promise<TimeSeriesResponse> {
    const range = params.endDate
      ? `${encodeURIComponent(params.startDate)}..${encodeURIComponent(params.endDate)}`
      : `${encodeURIComponent(params.startDate)}..`;
    const url = new URL(`${this.baseUrl}/${range}`);
    if (params.base) url.searchParams.set('from', params.base);
    if (params.symbols) url.searchParams.set('to', params.symbols);

    const res = await this.fetchWithTimeout(url.toString());
    if (!res.ok) {
      throw new Error(`Frankfurter API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as TimeSeriesResponse;
  }

  async listCurrencies(): Promise<CurrenciesResponse> {
    const url = `${this.baseUrl}/currencies`;
    const res = await this.fetchWithTimeout(url);
    if (!res.ok) {
      throw new Error(`Frankfurter API returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as CurrenciesResponse;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'frankfurter-mcp/1.0 (https://github.com/awesome-mcp-servers)',
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
