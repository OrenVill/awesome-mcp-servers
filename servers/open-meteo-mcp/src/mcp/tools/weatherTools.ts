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

export interface GetCurrentWeatherInput {
  latitude: number;
  longitude: number;
  timezone?: string;
  temperature_unit?: 'celsius' | 'fahrenheit' | string;
  wind_speed_unit?: 'kmh' | 'ms' | 'mph' | 'kn' | string;
}

export interface GetForecastInput {
  latitude: number;
  longitude: number;
  forecast_days?: number;
  timezone?: string;
  temperature_unit?: 'celsius' | 'fahrenheit' | string;
  wind_speed_unit?: 'kmh' | 'ms' | 'mph' | 'kn' | string;
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
          latitude: {
            type: 'number',
            description: 'Latitude (WGS84)',
            minimum: -90,
            maximum: 90,
          },
          longitude: {
            type: 'number',
            description: 'Longitude (WGS84)',
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
        },
        required: ['latitude', 'longitude'],
      },
    };
  }

  static getForecastSchema(): { inputSchema: { type: 'object'; properties: object; required?: string[] } } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          latitude: {
            type: 'number',
            description: 'Latitude (WGS84)',
            minimum: -90,
            maximum: 90,
          },
          longitude: {
            type: 'number',
            description: 'Longitude (WGS84)',
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
        },
        required: ['latitude', 'longitude'],
      },
    };
  }

  async executeGetCurrentWeather(args: GetCurrentWeatherInput): Promise<MCPToolCallResult> {
    const lat = args.latitude;
    const lon = args.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'latitude and longitude are required');
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'Invalid coordinates');
    }

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

      const text = this.formatCurrentWeatherAsText(
        response as unknown as Record<string, unknown>
      );
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Weather fetch failed: ${message}`);
    }
  }

  async executeGetForecast(args: GetForecastInput): Promise<MCPToolCallResult> {
    const lat = args.latitude;
    const lon = args.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'latitude and longitude are required');
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'Invalid coordinates');
    }

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

      const text = this.formatForecastAsText(
        response as unknown as Record<string, unknown>
      );
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Forecast fetch failed: ${message}`);
    }
  }

  private formatCurrentWeatherAsText(response: Record<string, unknown>): string {
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
    let text = `# Current Weather\n`;
    text += `Location: ${(response.latitude as number).toFixed(2)}°, ${(response.longitude as number).toFixed(2)}°\n`;
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

  private formatForecastAsText(response: Record<string, unknown>): string {
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
    let text = `# Weather Forecast (${dayCount} days)\n`;
    text += `Location: ${(response.latitude as number).toFixed(2)}°, ${(response.longitude as number).toFixed(2)}°\n`;
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
