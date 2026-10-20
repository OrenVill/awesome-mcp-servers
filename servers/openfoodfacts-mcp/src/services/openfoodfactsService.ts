export interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  categories?: string;
  labels?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  allergens?: string;
  allergens_from_ingredients?: string;
  traces?: string;
  countries?: string;
  stores?: string;
  packaging?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  ecoscore_grade?: string;
  image_url?: string;
  image_front_url?: string;
  url?: string;
  nutriments?: Record<string, number | string | undefined>;
  serving_size?: string;
  [key: string]: unknown;
}

export interface OpenFoodFactsProductResponse {
  code?: string;
  status: number;
  status_verbose?: string;
  product?: OpenFoodFactsProduct;
}

export interface OpenFoodFactsSearchProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  ecoscore_grade?: string;
  categories?: string;
  image_url?: string;
  url?: string;
}

export interface OpenFoodFactsSearchResponse {
  count: number;
  page: number;
  page_count: number;
  page_size: number;
  skip: number;
  products: OpenFoodFactsSearchProduct[];
}

export class OpenFoodFactsApiError extends Error {
  status: number;
  notFound: boolean;

  constructor(message: string, status: number, notFound = false) {
    super(message);
    this.name = 'OpenFoodFactsApiError';
    this.status = status;
    this.notFound = notFound;
  }
}

export class OpenFoodFactsService {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly userAgent =
    'openfoodfacts-mcp/1.0 (https://github.com/awesome-mcp-servers)';

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://world.openfoodfacts.org/api/v2').replace(
      /\/$/,
      ''
    );
    this.timeout = options?.timeout ?? 15000;
  }

  async getProductByBarcode(barcode: string): Promise<OpenFoodFactsProductResponse> {
    const trimmed = barcode.trim();
    if (!trimmed) {
      throw new OpenFoodFactsApiError('Barcode is required', 0);
    }
    const path = `/product/${encodeURIComponent(trimmed)}`;
    const data = await this.fetchJson<OpenFoodFactsProductResponse>(path);
    if (data.status === 0 || !data.product) {
      throw new OpenFoodFactsApiError(
        `Product not found for barcode ${trimmed}`,
        404,
        true
      );
    }
    return data;
  }

  async searchProducts(
    searchTerms: string,
    pageSize = 20
  ): Promise<OpenFoodFactsSearchResponse> {
    const q = searchTerms.trim();
    if (!q) {
      throw new OpenFoodFactsApiError('search_terms is required', 0);
    }
    const params = new URLSearchParams({
      search_terms: q,
      page_size: String(pageSize),
      fields:
        'code,product_name,brands,quantity,nutriscore_grade,nova_group,ecoscore_grade,categories,image_url,url',
    });
    return this.fetchJson<OpenFoodFactsSearchResponse>(`/search?${params.toString()}`);
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': this.userAgent,
        },
      });
      clearTimeout(id);

      if (!res.ok) {
        let detail = '';
        try {
          const body = (await res.json()) as { status_verbose?: string; message?: string };
          if (body?.status_verbose) detail = `: ${body.status_verbose}`;
          else if (body?.message) detail = `: ${body.message}`;
        } catch {
          // ignore non-JSON error bodies
        }
        throw new OpenFoodFactsApiError(
          `Open Food Facts ${res.status} ${res.statusText}${detail}`,
          res.status
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(id);
      if (err instanceof OpenFoodFactsApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new OpenFoodFactsApiError(`Request timed out after ${this.timeout}ms`, 0);
      }
      throw err;
    }
  }
}
