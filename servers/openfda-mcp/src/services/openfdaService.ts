export interface OpenFdaMeta {
  disclaimer?: string;
  last_updated?: string;
  results?: {
    skip?: number;
    limit?: number;
    total?: number;
  };
}

export interface OpenFdaListResponse<T> {
  meta: OpenFdaMeta;
  results: T[];
}

export interface OpenFdaDrugLabel {
  effective_time?: string;
  purpose?: string[];
  indications_and_usage?: string[];
  warnings?: string[];
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    product_type?: string[];
    route?: string[];
  };
  set_id?: string;
}

export interface OpenFdaDeviceEvent {
  date_received?: string;
  date_of_event?: string;
  event_type?: string;
  report_number?: string;
  device?: Array<{
    brand_name?: string;
    generic_name?: string;
    device_report_product_code?: string;
    manufacturer_d_name?: string;
  }>;
  patient?: Array<{
    patient_problems?: string[];
  }>;
  mdr_text?: Array<{ text?: string; text_type_code?: string }>;
}

export interface OpenFdaFoodEnforcement {
  recall_number?: string;
  status?: string;
  classification?: string;
  product_description?: string;
  reason_for_recall?: string;
  recalling_firm?: string;
  city?: string;
  state?: string;
  country?: string;
  report_date?: string;
  distribution_pattern?: string;
  code_info?: string;
}

export class OpenFdaNotFoundError extends Error {
  constructor(message = 'No matches found') {
    super(message);
    this.name = 'OpenFdaNotFoundError';
  }
}

export class OpenFdaService {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options?: { baseUrl?: string; timeout?: number }) {
    this.baseUrl = (options?.baseUrl ?? 'https://api.fda.gov').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 15000;
  }

  async searchDrugLabels(params: {
    search: string;
    limit?: number;
  }): Promise<OpenFdaListResponse<OpenFdaDrugLabel>> {
    return this.search<OpenFdaDrugLabel>('/drug/label.json', params);
  }

  async searchDeviceEvents(params: {
    search: string;
    limit?: number;
  }): Promise<OpenFdaListResponse<OpenFdaDeviceEvent>> {
    return this.search<OpenFdaDeviceEvent>('/device/event.json', params);
  }

  async searchFoodEnforcement(params: {
    search: string;
    limit?: number;
  }): Promise<OpenFdaListResponse<OpenFdaFoodEnforcement>> {
    return this.search<OpenFdaFoodEnforcement>('/food/enforcement.json', params);
  }

  private async search<T>(
    path: string,
    params: { search: string; limit?: number }
  ): Promise<OpenFdaListResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('search', params.search);
    url.searchParams.set('limit', String(params.limit ?? 5));

    const res = await this.fetchWithTimeout(url.toString());
    if (res.status === 404) {
      throw new OpenFdaNotFoundError();
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) detail = body.error.message;
      } catch {
        /* ignore parse errors */
      }
      throw new Error(`openFDA returned ${res.status}: ${detail}`);
    }

    const json = (await res.json()) as OpenFdaListResponse<T>;
    return json;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'openfda-mcp/1.0 (https://github.com/awesome-mcp-servers)',
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
}
