const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1';
const FORECAST_BASE = 'https://api.open-meteo.com/v1';

export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  country?: string;
  timezone?: string;
  population?: number;
  postcodes?: string[];
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
}

export interface GeocodingResponse {
  results?: GeocodingResult[];
}

export interface ForecastResponse {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown[]>;
  daily?: Record<string, unknown[]>;
  generationtime_ms?: number;
  error?: boolean;
  reason?: string;
}

export class OpenMeteoService {
  private readonly geocodingBase: string;
  private readonly forecastBase: string;
  private readonly timeout: number;

  constructor(options?: {
    geocodingBase?: string;
    forecastBase?: string;
    timeout?: number;
  }) {
    this.geocodingBase = options?.geocodingBase ?? GEOCODING_BASE;
    this.forecastBase = options?.forecastBase ?? FORECAST_BASE;
    this.timeout = options?.timeout ?? 15000;
  }

  async searchLocations(params: {
    name: string;
    count?: number;
    language?: string;
    countryCode?: string;
  }): Promise<GeocodingResponse> {
    const url = new URL(`${this.geocodingBase}/search`);
    url.searchParams.set('name', params.name);
    if (params.count != null) url.searchParams.set('count', String(params.count));
    if (params.language) url.searchParams.set('language', params.language);
    if (params.countryCode) url.searchParams.set('country_code', params.countryCode);

    const res = await this.fetchWithTimeout(url.toString());
    return (await res.json()) as GeocodingResponse;
  }

  async getForecast(params: {
    latitude: number;
    longitude: number;
    current?: string[];
    hourly?: string[];
    daily?: string[];
    timezone?: string;
    forecast_days?: number;
    temperature_unit?: 'celsius' | 'fahrenheit';
    wind_speed_unit?: 'kmh' | 'ms' | 'mph' | 'kn';
    precipitation_unit?: 'mm' | 'inch';
  }): Promise<ForecastResponse> {
    const url = new URL(`${this.forecastBase}/forecast`);
    url.searchParams.set('latitude', String(params.latitude));
    url.searchParams.set('longitude', String(params.longitude));
    if (params.current?.length) url.searchParams.set('current', params.current.join(','));
    if (params.hourly?.length) url.searchParams.set('hourly', params.hourly.join(','));
    if (params.daily?.length) url.searchParams.set('daily', params.daily.join(','));
    if (params.timezone) url.searchParams.set('timezone', params.timezone);
    if (params.forecast_days != null) url.searchParams.set('forecast_days', String(params.forecast_days));
    if (params.temperature_unit) url.searchParams.set('temperature_unit', params.temperature_unit);
    if (params.wind_speed_unit) url.searchParams.set('wind_speed_unit', params.wind_speed_unit);
    if (params.precipitation_unit) url.searchParams.set('precipitation_unit', params.precipitation_unit);

    const res = await this.fetchWithTimeout(url.toString());
    return (await res.json()) as ForecastResponse;
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
}
