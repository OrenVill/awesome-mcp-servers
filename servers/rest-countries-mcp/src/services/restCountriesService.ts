export interface Country {
  name?: {
    common?: string;
    official?: string;
  };
  cca2?: string;
  cca3?: string;
  capital?: string[];
  region?: string;
  subregion?: string;
  population?: number;
  area?: number;
  currencies?: Record<string, { name?: string; symbol?: string }>;
  languages?: Record<string, string>;
  flags?: { png?: string; svg?: string };
  [key: string]: unknown;
}

export class RestCountriesService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = options?.baseUrl ?? 'https://restcountries.com/v3.1';
    this.timeout = options?.timeout ?? 15000;
  }

  async getByName(name: string): Promise<Country[]> {
    const url = `${this.baseUrl}/name/${encodeURIComponent(name)}`;
    return this.fetchJson<Country[]>(url);
  }

  async getByAlphaCode(code: string): Promise<Country | null> {
    const cleanCode = code.trim().toLowerCase();
    if (cleanCode.length !== 2 && cleanCode.length !== 3) return null;
    const url = `${this.baseUrl}/alpha/${encodeURIComponent(cleanCode)}`;
    try {
      const result = await this.fetchJson<Country | { status?: number } | []>(url);
      if (Array.isArray(result) && result.length === 0) return null;
      if (result && typeof (result as { status?: number }).status === 'number') return null;
      return result as Country;
    } catch {
      return null;
    }
  }

  async getByRegion(region: string): Promise<Country[]> {
    const url = `${this.baseUrl}/region/${encodeURIComponent(region)}`;
    return this.fetchJson<Country[]>(url);
  }

  async getBySubregion(subregion: string): Promise<Country[]> {
    const url = `${this.baseUrl}/subregion/${encodeURIComponent(subregion)}`;
    return this.fetchJson<Country[]>(url);
  }

  async getByCapital(capital: string): Promise<Country[]> {
    const url = `${this.baseUrl}/capital/${encodeURIComponent(capital)}`;
    return this.fetchJson<Country[]>(url);
  }

  async getByCurrency(currency: string): Promise<Country[]> {
    const url = `${this.baseUrl}/currency/${encodeURIComponent(currency)}`;
    return this.fetchJson<Country[]>(url);
  }

  async getByLanguage(lang: string): Promise<Country[]> {
    const url = `${this.baseUrl}/lang/${encodeURIComponent(lang)}`;
    return this.fetchJson<Country[]>(url);
  }

  async getAll(fields: string[]): Promise<Country[]> {
    const fieldsStr = fields.join(',');
    const url = `${this.baseUrl}/all?fields=${encodeURIComponent(fieldsStr)}`;
    return this.fetchJson<Country[]>(url);
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      if (!res.ok) {
        if (res.status === 404) {
          return [] as T;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
}
