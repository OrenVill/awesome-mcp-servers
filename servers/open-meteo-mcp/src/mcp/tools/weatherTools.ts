import {
  MCPContentItem,
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import { OpenMeteoService } from '../../services/openMeteoService.js';

const DEFAULT_CURRENT = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'precipitation',
  'is_day',
];

const DEFAULT_DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'sunrise',
  'sunset',
];

export const GET_CURRENT_WEATHER_DEF = {
  name: 'get_current_weather',
  description:
    "🌤️ I'm fetching current weather\n\nGet current weather for a location. Provide either a `city` name (auto-geocoded via Open-Meteo) OR explicit `latitude` + `longitude`.",
  keywords: ['weather', 'temperature', 'forecast', 'current', 'city'],
};
export const GET_FORECAST_DEF = {
  name: 'get_forecast',
  description:
    "📅 I'm loading weather forecasts\n\nGet weather forecast for the next 1-16 days. Provide either a `city` name (auto-geocoded via Open-Meteo) OR explicit `latitude` + `longitude`.",
  keywords: ['weather', 'forecast', 'temperature', 'precipitation', 'city'],
};

export interface GetCurrentWeatherInput {
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  temperature_unit?: 'celsius' | 'fahrenheit' | string;
  wind_speed_unit?: 'kmh' | 'ms' | 'mph' | 'kn' | string;
  include_html_card?: boolean;
}

export interface GetForecastInput {
  city?: string;
  latitude?: number;
  longitude?: number;
  forecast_days?: number;
  timezone?: string;
  temperature_unit?: 'celsius' | 'fahrenheit' | string;
  wind_speed_unit?: 'kmh' | 'ms' | 'mph' | 'kn' | string;
  include_html_card?: boolean;
}

export class WeatherTools {
  private service: OpenMeteoService;

  constructor(service?: OpenMeteoService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new OpenMeteoService({
        geocodingBase: api.geocodingBaseUrl,
        forecastBase: api.forecastBaseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getCurrentWeatherSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          city: {
            type: 'string',
            description:
              'City name (e.g. "Berlin", "New York", "Tokyo"). When provided, coordinates are resolved automatically via Open-Meteo geocoding. Use this OR latitude+longitude.',
          },
          latitude: {
            type: 'number',
            description: 'Latitude (WGS84). Required if `city` is not provided.',
            minimum: -90,
            maximum: 90,
          },
          longitude: {
            type: 'number',
            description: 'Longitude (WGS84). Required if `city` is not provided.',
            minimum: -180,
            maximum: 180,
          },
          timezone: {
            type: 'string',
            description: 'Timezone (e.g. Europe/Berlin, America/New_York) or "auto"',
            default: 'auto',
          },
          temperature_unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature unit',
            default: 'celsius',
          },
          wind_speed_unit: {
            type: 'string',
            enum: ['kmh', 'ms', 'mph', 'kn'],
            description: 'Wind speed unit',
            default: 'kmh',
          },
          include_html_card: {
            type: 'boolean',
            description:
              'If true, append a second content item with self-contained HTML (inline styles) for an embeddable weather card.',
            default: false,
          },
        },
      },
    };
  }

  static getForecastSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          city: {
            type: 'string',
            description:
              'City name (e.g. "Berlin", "New York", "Tokyo"). When provided, coordinates are resolved automatically via Open-Meteo geocoding. Use this OR latitude+longitude.',
          },
          latitude: {
            type: 'number',
            description: 'Latitude (WGS84). Required if `city` is not provided.',
            minimum: -90,
            maximum: 90,
          },
          longitude: {
            type: 'number',
            description: 'Longitude (WGS84). Required if `city` is not provided.',
            minimum: -180,
            maximum: 180,
          },
          forecast_days: {
            type: 'number',
            description: 'Number of forecast days (1-16)',
            minimum: 1,
            maximum: 16,
            default: 7,
          },
          timezone: {
            type: 'string',
            description: 'Timezone (e.g. Europe/Berlin, America/New_York) or "auto"',
            default: 'auto',
          },
          temperature_unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature unit',
            default: 'celsius',
          },
          wind_speed_unit: {
            type: 'string',
            enum: ['kmh', 'ms', 'mph', 'kn'],
            description: 'Wind speed unit',
            default: 'kmh',
          },
          include_html_card: {
            type: 'boolean',
            description:
              'If true, append a second content item with self-contained HTML (inline styles) for an embeddable forecast card.',
            default: false,
          },
        },
      },
    };
  }

  async executeGetCurrentWeather(args: GetCurrentWeatherInput): Promise<MCPToolCallResult> {
    const resolved = await this.resolveLocation(args);
    if ('error' in resolved) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, resolved.error);
    }
    const { lat, lon, label } = resolved;

    try {
      const response = await this.service.getForecast({
        latitude: lat,
        longitude: lon,
        current: DEFAULT_CURRENT,
        timezone: args.timezone ?? 'auto',
        temperature_unit: (args.temperature_unit ?? 'celsius') as 'celsius' | 'fahrenheit',
        wind_speed_unit: (args.wind_speed_unit ?? 'kmh') as 'kmh' | 'ms' | 'mph' | 'kn',
        forecast_days: 1,
      });

      if (response.error && response.reason) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, response.reason);
      }

      const data = response as unknown as Record<string, unknown>;
      const text = this.formatCurrentWeatherAsText(data, label);
      const content: MCPContentItem[] = [{ type: 'text', text }];
      if (args.include_html_card === true) {
        content.push({ type: 'text', text: this.formatCurrentWeatherAsHtml(data, label) });
      }
      return { content };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Weather fetch failed: ${message}`);
    }
  }

  async executeGetForecast(args: GetForecastInput): Promise<MCPToolCallResult> {
    const resolved = await this.resolveLocation(args);
    if ('error' in resolved) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, resolved.error);
    }
    const { lat, lon, label } = resolved;

    try {
      const response = await this.service.getForecast({
        latitude: lat,
        longitude: lon,
        current: DEFAULT_CURRENT,
        daily: DEFAULT_DAILY,
        timezone: args.timezone ?? 'auto',
        temperature_unit: (args.temperature_unit ?? 'celsius') as 'celsius' | 'fahrenheit',
        wind_speed_unit: (args.wind_speed_unit ?? 'kmh') as 'kmh' | 'ms' | 'mph' | 'kn',
        forecast_days: args.forecast_days ?? 7,
      });

      if (response.error && response.reason) {
        return createMCPErrorResult(MCPErrorCode.API_ERROR, response.reason);
      }

      const data = response as unknown as Record<string, unknown>;
      const text = this.formatForecastAsText(data, label);
      const content: MCPContentItem[] = [{ type: 'text', text }];
      if (args.include_html_card === true) {
        content.push({ type: 'text', text: this.formatForecastAsHtml(data, label) });
      }
      return { content };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Forecast fetch failed: ${message}`);
    }
  }

  private async resolveLocation(args: {
    city?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{ lat: number; lon: number; label?: string } | { error: string }> {
    const city = args.city?.trim();
    if (city) {
      try {
        const geo = await this.service.searchLocations({ name: city, count: 1 });
        const top = geo.results?.[0];
        if (!top) {
          return { error: `Could not find coordinates for city: "${city}"` };
        }
        const label = [top.name, top.admin1, top.country].filter(Boolean).join(', ');
        return { lat: top.latitude, lon: top.longitude, label };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { error: `Geocoding failed for "${city}": ${message}` };
      }
    }
    const lat = args.latitude;
    const lon = args.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return { error: 'Provide either `city` or both `latitude` and `longitude`' };
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return { error: 'Invalid coordinates' };
    }
    return { lat, lon };
  }

  private formatCurrentWeatherAsText(response: Record<string, unknown>, label?: string): string {
    const current = response.current as Record<string, unknown> | undefined;
    const timezone = (response.timezone as string) ?? 'UTC';
    if (!current) return 'No current weather data available.';

    const temp = current.temperature_2m;
    const feelsLike = current.apparent_temperature;
    const humidity = current.relative_humidity_2m;
    const weatherCode = current.weather_code;
    const cloudCover = current.cloud_cover;
    const windSpeed = current.wind_speed_10m;
    const windDir = current.wind_direction_10m;
    const windGusts = current.wind_gusts_10m;
    const precip = current.precipitation;
    const isDay = current.is_day;

    const conditions = this.weatherCodeToDescription(weatherCode as number);
    const coords = `${(response.latitude as number).toFixed(2)}°, ${(response.longitude as number).toFixed(2)}°`;
    let text = `# Current Weather\n`;
    text += `Location: ${label ? `${label} (${coords})` : coords}\n`;
    text += `Timezone: ${timezone}\n\n`;
    text += `**${conditions}** ${isDay === 1 ? '☀️ Day' : '🌙 Night'}\n\n`;
    text += `- Temperature: ${temp}°C (feels like ${feelsLike}°C)\n`;
    text += `- Humidity: ${humidity}%\n`;
    text += `- Cloud cover: ${cloudCover}%\n`;
    text += `- Wind: ${windSpeed} km/h from ${this.windDirectionToCardinal(windDir as number)}`;
    if (windGusts) text += ` (gusts ${windGusts} km/h)`;
    text += `\n`;
    if (precip != null && Number(precip) > 0) text += `- Precipitation: ${precip} mm\n`;
    return text.trim();
  }

  private formatForecastAsText(response: Record<string, unknown>, label?: string): string {
    const daily = response.daily as Record<string, unknown[]> | undefined;
    const timezone = (response.timezone as string) ?? 'UTC';
    if (!daily || !daily.time) return 'No forecast data available.';

    const times = daily.time as string[];
    const maxTemps = (daily.temperature_2m_max ?? []) as number[];
    const minTemps = (daily.temperature_2m_min ?? []) as number[];
    const precipSum = (daily.precipitation_sum ?? []) as number[];
    const precipProb = (daily.precipitation_probability_max ?? []) as number[];
    const weatherCodes = (daily.weather_code ?? []) as number[];

    const current = response.current as Record<string, unknown> | undefined;
    const nowTemp = current?.temperature_2m;
    const nowConditions = this.weatherCodeToDescription((current?.weather_code as number) ?? 0);

    const dayCount = times.length;
    const coords = `${(response.latitude as number).toFixed(2)}°, ${(response.longitude as number).toFixed(2)}°`;
    let text = `# Weather Forecast (${dayCount} days)\n`;
    text += `Location: ${label ? `${label} (${coords})` : coords}\n`;
    text += `Timezone: ${timezone}\n\n`;

    if (current) {
      text += `## Now\n${nowConditions}, ${nowTemp}°C\n\n`;
    }

    text += `## Daily Forecast\n\n`;
    for (let i = 0; i < Math.min(times.length, 7); i++) {
      const date = times[i];
      const max = maxTemps[i] ?? '—';
      const min = minTemps[i] ?? '—';
      const prec = precipSum[i] ?? 0;
      const prob = precipProb[i] ?? '—';
      const cond = this.weatherCodeToDescription(weatherCodes[i] ?? 0);
      text += `**${date}** — ${cond}\n`;
      text += `  ${min}°C / ${max}°C`;
      if (prec > 0) text += ` • ${prec} mm precip`;
      if (typeof prob === 'number') text += ` • ${prob}% precip chance`;
      text += `\n`;
    }
    return text.trim();
  }

  private formatCurrentWeatherAsHtml(response: Record<string, unknown>, label?: string): string {
    const current = (response.current ?? {}) as Record<string, unknown>;
    const lat = (response.latitude as number) ?? 0;
    const lon = (response.longitude as number) ?? 0;
    const timezone = (response.timezone as string) ?? 'UTC';
    const headline = label ?? timezone;
    const code = (current.weather_code as number) ?? 0;
    const isDay = current.is_day === 1;
    const conditions = this.weatherCodeToDescription(code);
    const emoji = this.weatherCodeToEmoji(code, isDay);
    const temp = this.fmt(current.temperature_2m);
    const feels = this.fmt(current.apparent_temperature);
    const humidity = this.fmt(current.relative_humidity_2m);
    const cloud = this.fmt(current.cloud_cover);
    const wind = this.fmt(current.wind_speed_10m);
    const windDir = typeof current.wind_direction_10m === 'number'
      ? this.windDirectionToCardinal(current.wind_direction_10m)
      : '—';
    const gusts = current.wind_gusts_10m;
    const precip = current.precipitation;
    const bg = isDay
      ? 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)'
      : 'linear-gradient(135deg,#020617 0%,#1e1b4b 100%)';
    const accent = isDay ? '#fbbf24' : '#a5b4fc';

    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:340px;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.5);background:${bg};color:#e5e7eb;padding:20px;border:1px solid rgba(255,255,255,0.08);">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:15px;font-weight:600;color:#f3f4f6;">${this.escape(headline)}</div>
      <div style="font-size:12px;color:#94a3b8;">${lat.toFixed(2)}°, ${lon.toFixed(2)}° · ${this.escape(timezone)}</div>
    </div>
    <div style="font-size:48px;line-height:1;">${emoji}</div>
  </div>
  <div style="margin-top:12px;font-size:56px;font-weight:300;line-height:1;color:#f9fafb;">${temp}°</div>
  <div style="font-size:15px;margin-top:4px;color:${accent};font-weight:500;">${this.escape(conditions)}</div>
  <div style="font-size:13px;margin-top:2px;color:#9ca3af;">Feels like ${feels}°</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px;font-size:13px;">
    <div style="background:rgba(255,255,255,0.05);padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);"><span style="color:#94a3b8;">💧 Humidity</span><br><strong style="color:#f3f4f6;">${humidity}%</strong></div>
    <div style="background:rgba(255,255,255,0.05);padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);"><span style="color:#94a3b8;">☁️ Cloud</span><br><strong style="color:#f3f4f6;">${cloud}%</strong></div>
    <div style="background:rgba(255,255,255,0.05);padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);"><span style="color:#94a3b8;">💨 Wind</span><br><strong style="color:#f3f4f6;">${wind} km/h ${this.escape(windDir)}</strong>${gusts != null ? `<br><span style="color:#64748b;font-size:11px;">gusts ${this.escape(String(gusts))}</span>` : ''}</div>
    <div style="background:rgba(255,255,255,0.05);padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);"><span style="color:#94a3b8;">🌧️ Precip</span><br><strong style="color:#f3f4f6;">${precip != null ? this.escape(String(precip)) : '0'} mm</strong></div>
  </div>
</div>`;
  }

  private formatForecastAsHtml(response: Record<string, unknown>, label?: string): string {
    const daily = response.daily as Record<string, unknown[]> | undefined;
    const lat = (response.latitude as number) ?? 0;
    const lon = (response.longitude as number) ?? 0;
    const timezone = (response.timezone as string) ?? 'UTC';
    const headline = label ?? timezone;
    const current = (response.current ?? {}) as Record<string, unknown>;
    const nowCode = (current.weather_code as number) ?? 0;
    const isDay = current.is_day === 1;
    const nowEmoji = this.weatherCodeToEmoji(nowCode, isDay);
    const nowTemp = this.fmt(current.temperature_2m);
    const nowConditions = this.weatherCodeToDescription(nowCode);

    let rows = '';
    if (daily && daily.time) {
      const times = daily.time as string[];
      const maxT = (daily.temperature_2m_max ?? []) as number[];
      const minT = (daily.temperature_2m_min ?? []) as number[];
      const codes = (daily.weather_code ?? []) as number[];
      const probs = (daily.precipitation_probability_max ?? []) as number[];
      const sums = (daily.precipitation_sum ?? []) as number[];
      const limit = Math.min(times.length, 7);
      for (let i = 0; i < limit; i++) {
        const c = codes[i] ?? 0;
        const cond = this.weatherCodeToDescription(c);
        const emoji = this.weatherCodeToEmoji(c, true);
        const prob = probs[i];
        const sum = sums[i];
        rows += `<div style="display:grid;grid-template-columns:80px 32px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,0.06);">
      <div style="font-size:13px;color:#cbd5e1;">${this.escape(this.formatDayLabel(times[i] ?? ''))}</div>
      <div style="font-size:22px;text-align:center;">${emoji}</div>
      <div style="font-size:12px;color:#94a3b8;">${this.escape(cond)}${typeof prob === 'number' && prob > 0 ? ` · ${prob}% · ${sum ?? 0}mm` : ''}</div>
      <div style="font-size:13px;color:#f3f4f6;font-variant-numeric:tabular-nums;"><strong>${this.fmt(maxT[i])}°</strong> <span style="color:#64748b;">${this.fmt(minT[i])}°</span></div>
    </div>`;
      }
    }

    return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:380px;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.5);background:#0f172a;border:1px solid rgba(255,255,255,0.08);color:#e5e7eb;">
  <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);color:#f3f4f6;padding:20px;border-bottom:1px solid rgba(255,255,255,0.08);">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:15px;font-weight:600;">${this.escape(headline)}</div>
        <div style="font-size:12px;color:#a5b4fc;">${lat.toFixed(2)}°, ${lon.toFixed(2)}° · ${this.escape(timezone)}</div>
      </div>
      <div style="font-size:42px;line-height:1;">${nowEmoji}</div>
    </div>
    <div style="font-size:42px;font-weight:300;margin-top:8px;line-height:1;color:#f9fafb;">${nowTemp}°</div>
    <div style="font-size:13px;color:#c7d2fe;margin-top:2px;">${this.escape(nowConditions)}</div>
  </div>
  <div style="padding:4px 16px 12px;">
    ${rows || '<div style="padding:12px;color:#64748b;font-size:13px;">No forecast data.</div>'}
  </div>
</div>`;
  }

  private fmt(v: unknown): string {
    if (v == null) return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1);
    return String(v);
  }

  private formatDayLabel(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  private escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
      c === '&' ? '&amp;' :
      c === '<' ? '&lt;' :
      c === '>' ? '&gt;' :
      c === '"' ? '&quot;' : '&#39;'
    );
  }

  private weatherCodeToEmoji(code: number, isDay: boolean): string {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if (code === 1) return isDay ? '🌤️' : '🌙';
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 57) return '🌦️';
    if (code >= 61 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '🌨️';
    if (code >= 80 && code <= 82) return '🌧️';
    if (code === 85 || code === 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌡️';
  }

  private weatherCodeToDescription(code: number): string {
    const map: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };
    return map[code] ?? `Weather code ${code}`;
  }

  private windDirectionToCardinal(deg: number): string {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const i = Math.round(((deg % 360) / 22.5)) % 16;
    return dirs[i] ?? 'N';
  }
}
