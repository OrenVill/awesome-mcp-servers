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

/**
 * REST Countries' hosted v1–v4 endpoints (incl. `/v3.1`) were deprecated and
 * taken down; they now 301-redirect to a deprecation notice, and v5 requires an
 * API key. To keep this server key-free we source the same underlying data from
 * the open `mledoze/countries` dataset (the upstream REST Countries was built
 * from), served as a single static JSON file via the jsDelivr CDN. The file is
 * fetched once and cached in memory; all lookups filter that cache locally.
 *
 * Note: the dataset does not carry a `population` field, so population is
 * omitted from results (every other field the tools surface is present).
 */
const DEFAULT_DATASET_URL =
  'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json';

export class RestCountriesService {
  private readonly datasetUrl: string;
  private readonly timeout: number;
  private cache: Country[] | null = null;
  private inflight: Promise<Country[]> | null = null;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.datasetUrl = options?.baseUrl ?? DEFAULT_DATASET_URL;
    this.timeout = options?.timeout ?? 15000;
  }

  async getByName(name: string): Promise<Country[]> {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    const all = await this.loadAll();
    const matches = all.filter((c) => {
      const common = c.name?.common?.toLowerCase() ?? '';
      const official = c.name?.official?.toLowerCase() ?? '';
      const alt = this.altSpellings(c);
      return (
        common.includes(q) ||
        official.includes(q) ||
        alt.some((s) => s.includes(q))
      );
    });
    // Rank exact matches first so the handler's results[0] is the best hit.
    return matches.sort((a, b) => this.nameScore(b, q) - this.nameScore(a, q));
  }

  async getByAlphaCode(code: string): Promise<Country | null> {
    const cc = code.trim().toLowerCase();
    if (cc.length !== 2 && cc.length !== 3) return null;
    const all = await this.loadAll();
    const match = all.find(
      (c) =>
        c.cca2?.toLowerCase() === cc ||
        c.cca3?.toLowerCase() === cc ||
        this.str(c.cioc).toLowerCase() === cc ||
        this.str(c.ccn3).toLowerCase() === cc
    );
    return match ?? null;
  }

  async getByRegion(region: string): Promise<Country[]> {
    const q = region.trim().toLowerCase();
    const all = await this.loadAll();
    return all.filter((c) => c.region?.toLowerCase() === q);
  }

  async getBySubregion(subregion: string): Promise<Country[]> {
    const q = subregion.trim().toLowerCase();
    const all = await this.loadAll();
    return all.filter((c) => c.subregion?.toLowerCase() === q);
  }

  async getByCapital(capital: string): Promise<Country[]> {
    const q = capital.trim().toLowerCase();
    const all = await this.loadAll();
    return all.filter((c) =>
      (c.capital ?? []).some((cap) => cap.toLowerCase().includes(q))
    );
  }

  async getByCurrency(currency: string): Promise<Country[]> {
    const q = currency.trim().toLowerCase();
    const all = await this.loadAll();
    return all.filter((c) => {
      const cur = c.currencies ?? {};
      return (
        Object.keys(cur).some((codeKey) => codeKey.toLowerCase() === q) ||
        Object.values(cur).some((v) => (v?.name ?? '').toLowerCase().includes(q))
      );
    });
  }

  async getByLanguage(lang: string): Promise<Country[]> {
    const q = lang.trim().toLowerCase();
    const all = await this.loadAll();
    return all.filter((c) => {
      const langs = c.languages ?? {};
      return (
        Object.keys(langs).some((codeKey) => codeKey.toLowerCase() === q) ||
        Object.values(langs).some((name) => name.toLowerCase().includes(q))
      );
    });
  }

  async getAll(_fields: string[]): Promise<Country[]> {
    // The static dataset already includes every field, so the `fields` argument
    // (which the old API used only to cap payload size) is a no-op here.
    return this.loadAll();
  }

  /** Lazily fetch the dataset once; concurrent (e.g. batched) calls share one fetch. */
  private async loadAll(): Promise<Country[]> {
    if (this.cache) return this.cache;
    if (!this.inflight) {
      this.inflight = this.fetchDataset();
    }
    try {
      this.cache = await this.inflight;
      return this.cache;
    } finally {
      this.inflight = null;
    }
  }

  private async fetchDataset(): Promise<Country[]> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    let res: Response;
    try {
      res = await fetch(this.datasetUrl, { signal: controller.signal });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(
        `Failed to reach the country dataset at ${this.datasetUrl}: ${message}`
      );
    } finally {
      clearTimeout(id);
    }

    if (!res.ok) {
      throw new Error(
        `Country dataset request failed: HTTP ${res.status} ${res.statusText} (${this.datasetUrl})`
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error(
        `Country dataset at ${this.datasetUrl} returned a response that is not valid JSON`
      );
    }

    // Defensive: a deprecation notice or any other non-array payload must surface
    // as a clear error instead of being silently treated as "no countries found".
    if (!Array.isArray(data)) {
      const errs =
        data && typeof data === 'object' && 'errors' in data
          ? ` (${JSON.stringify((data as { errors: unknown }).errors)})`
          : '';
      throw new Error(
        `Country dataset at ${this.datasetUrl} returned an unexpected (non-array) response${errs}`
      );
    }

    return data as Country[];
  }

  private altSpellings(c: Country): string[] {
    const alt = c.altSpellings;
    return Array.isArray(alt)
      ? alt.filter((s): s is string => typeof s === 'string').map((s) => s.toLowerCase())
      : [];
  }

  private nameScore(c: Country, q: string): number {
    const common = c.name?.common?.toLowerCase() ?? '';
    const official = c.name?.official?.toLowerCase() ?? '';
    if (common === q || official === q) return 3;
    if (common.startsWith(q) || official.startsWith(q)) return 2;
    return 1;
  }

  private str(v: unknown): string {
    return typeof v === 'string' ? v : '';
  }
}
