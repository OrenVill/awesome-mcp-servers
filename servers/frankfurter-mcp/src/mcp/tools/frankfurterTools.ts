import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  FrankfurterService,
  type LatestRatesResponse,
  type TimeSeriesResponse,
  type CurrenciesResponse,
} from '../../services/frankfurterService.js';

export const GET_LATEST_RATES_DEF = {
  name: 'get_latest_rates',
  description:
    "💱 I'm fetching the latest FX rates\n\nGet the latest ECB foreign exchange rates. Optional `base` (default EUR) and comma-separated `symbols` (e.g. \"USD,GBP,JPY\").",
  keywords: ['frankfurter', 'forex', 'fx', 'currency', 'exchange', 'rates', 'latest', 'ecb'],
};

export const CONVERT_CURRENCY_DEF = {
  name: 'convert_currency',
  description:
    "💵 I'm converting currency\n\nConvert an amount from one currency to another using the latest ECB rate. Requires `amount`, `from`, and `to` ISO codes.",
  keywords: ['frankfurter', 'forex', 'fx', 'currency', 'convert', 'exchange'],
};

export const GET_HISTORICAL_RATES_DEF = {
  name: 'get_historical_rates',
  description:
    "🗓️ I'm looking up historical FX rates\n\nGet ECB rates for a specific date (YYYY-MM-DD). Optional base currency (default EUR) and comma-separated target symbols.",
  keywords: ['frankfurter', 'forex', 'fx', 'currency', 'historical', 'rates', 'date'],
};

export const GET_TIME_SERIES_DEF = {
  name: 'get_time_series',
  description:
    "📈 I'm building an FX time series\n\nGet ECB rates over a date range. Requires `start_date` (YYYY-MM-DD); `end_date` defaults to the latest available. Returns first/last rates and the count of dated points.",
  keywords: ['frankfurter', 'forex', 'fx', 'currency', 'timeseries', 'time-series', 'history', 'range'],
};

export const LIST_CURRENCIES_DEF = {
  name: 'list_currencies',
  description:
    "🌍 I'm listing supported currencies\n\nList all currencies supported by Frankfurter as an ISO code → name map.",
  keywords: ['frankfurter', 'currencies', 'iso', 'codes', 'list', 'supported'],
};

export interface GetLatestRatesInput {
  base?: string;
  symbols?: string;
}

export interface ConvertCurrencyInput {
  amount: number;
  from: string;
  to: string;
}

export interface GetHistoricalRatesInput {
  date: string;
  base?: string;
  symbols?: string;
}

export interface GetTimeSeriesInput {
  start_date: string;
  end_date?: string;
  base?: string;
  symbols?: string;
}

export type ListCurrenciesInput = Record<string, never>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class FrankfurterTools {
  private service: FrankfurterService;

  constructor(service?: FrankfurterService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new FrankfurterService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getGetLatestRatesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          base: {
            type: 'string',
            description: 'Base currency ISO code (default "EUR"), e.g. "USD".',
          },
          symbols: {
            type: 'string',
            description:
              'Comma-separated target currency ISO codes, e.g. "USD,GBP,JPY". Omit to return all available rates.',
          },
        },
      },
    };
  }

  static getConvertCurrencySchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          amount: {
            type: 'number',
            description: 'Amount to convert. Must be a positive number.',
            exclusiveMinimum: 0,
          },
          from: {
            type: 'string',
            description: 'Source currency ISO code, e.g. "USD".',
          },
          to: {
            type: 'string',
            description: 'Target currency ISO code, e.g. "EUR".',
          },
        },
        required: ['amount', 'from', 'to'],
      },
    };
  }

  static getGetHistoricalRatesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (e.g. "2020-01-15").',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          base: {
            type: 'string',
            description: 'Base currency ISO code (default "EUR").',
          },
          symbols: {
            type: 'string',
            description: 'Comma-separated target currency ISO codes.',
          },
        },
        required: ['date'],
      },
    };
  }

  static getGetTimeSeriesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          start_date: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format.',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          end_date: {
            type: 'string',
            description: 'End date in YYYY-MM-DD format. Omit to use the latest available.',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
          },
          base: {
            type: 'string',
            description: 'Base currency ISO code (default "EUR").',
          },
          symbols: {
            type: 'string',
            description: 'Comma-separated target currency ISO codes.',
          },
        },
        required: ['start_date'],
      },
    };
  }

  static getListCurrenciesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    };
  }

  async executeGetLatestRates(args: GetLatestRatesInput): Promise<MCPToolCallResult> {
    if (args.base !== undefined && typeof args.base !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'base must be a string');
    }
    if (args.symbols !== undefined && typeof args.symbols !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'symbols must be a comma-separated string');
    }

    try {
      const response = await this.service.getLatestRates({
        base: args.base?.toUpperCase(),
        symbols: args.symbols?.toUpperCase(),
      });
      const text = this.formatLatestRatesAsText(response);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get latest rates: ${message}`);
    }
  }

  async executeConvertCurrency(args: ConvertCurrencyInput): Promise<MCPToolCallResult> {
    if (typeof args.amount !== 'number' || !Number.isFinite(args.amount) || args.amount <= 0) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'amount is required and must be a positive number');
    }
    if (!args.from || typeof args.from !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'from is required and must be a string ISO code');
    }
    if (!args.to || typeof args.to !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'to is required and must be a string ISO code');
    }

    const from = args.from.toUpperCase();
    const to = args.to.toUpperCase();

    if (from === to) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        '"from" and "to" must be different currency codes'
      );
    }

    try {
      const response = await this.service.convert({ amount: args.amount, from, to });
      const converted = response.rates?.[to];
      if (typeof converted !== 'number') {
        return createMCPErrorResult(
          MCPErrorCode.API_ERROR,
          `Frankfurter did not return a rate for ${to}`
        );
      }
      const rate = converted / args.amount;
      const text = `${this.formatNumber(args.amount)} ${from} = ${this.formatNumber(converted)} ${to} (rate: ${this.formatNumber(rate, 6)}) on ${response.date}`;
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Conversion failed: ${message}`);
    }
  }

  async executeGetHistoricalRates(args: GetHistoricalRatesInput): Promise<MCPToolCallResult> {
    if (!args.date || typeof args.date !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'date is required and must be a string');
    }
    if (!ISO_DATE_RE.test(args.date)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'date must be in YYYY-MM-DD format');
    }
    if (args.base !== undefined && typeof args.base !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'base must be a string');
    }
    if (args.symbols !== undefined && typeof args.symbols !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'symbols must be a comma-separated string');
    }

    try {
      const response = await this.service.getHistoricalRates({
        date: args.date,
        base: args.base?.toUpperCase(),
        symbols: args.symbols?.toUpperCase(),
      });
      const text = this.formatLatestRatesAsText(response, { historical: true, requestedDate: args.date });
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get historical rates: ${message}`);
    }
  }

  async executeGetTimeSeries(args: GetTimeSeriesInput): Promise<MCPToolCallResult> {
    if (!args.start_date || typeof args.start_date !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'start_date is required and must be a string');
    }
    if (!ISO_DATE_RE.test(args.start_date)) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'start_date must be in YYYY-MM-DD format');
    }
    if (args.end_date !== undefined) {
      if (typeof args.end_date !== 'string' || !ISO_DATE_RE.test(args.end_date)) {
        return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'end_date must be in YYYY-MM-DD format');
      }
      if (args.end_date < args.start_date) {
        return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'end_date must be on or after start_date');
      }
    }
    if (args.base !== undefined && typeof args.base !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'base must be a string');
    }
    if (args.symbols !== undefined && typeof args.symbols !== 'string') {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'symbols must be a comma-separated string');
    }

    try {
      const response = await this.service.getTimeSeries({
        startDate: args.start_date,
        endDate: args.end_date,
        base: args.base?.toUpperCase(),
        symbols: args.symbols?.toUpperCase(),
      });
      const text = this.formatTimeSeriesAsText(response);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to get time series: ${message}`);
    }
  }

  async executeListCurrencies(_args: ListCurrenciesInput): Promise<MCPToolCallResult> {
    try {
      const response = await this.service.listCurrencies();
      const text = this.formatCurrenciesAsText(response);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `Failed to list currencies: ${message}`);
    }
  }

  private formatLatestRatesAsText(
    response: LatestRatesResponse,
    opts?: { historical?: boolean; requestedDate?: string }
  ): string {
    const entries = Object.entries(response.rates ?? {});
    if (entries.length === 0) {
      return `No rates returned for base ${response.base} on ${response.date}.`;
    }

    const header = opts?.historical
      ? `Historical FX rates for ${opts.requestedDate ?? response.date} (base: ${response.base}, ECB date: ${response.date})`
      : `Latest FX rates (base: ${response.base}, date: ${response.date})`;

    let text = `${header}\n\n`;
    entries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([code, rate]) => {
        text += `- 1 ${response.base} = ${this.formatNumber(rate, 6)} ${code}\n`;
      });
    if (response.amount !== 1) {
      text += `\n(Rates shown for amount=1; API echoed amount=${response.amount}.)`;
    }
    return text.trim();
  }

  private formatTimeSeriesAsText(response: TimeSeriesResponse): string {
    const allDates = Object.keys(response.rates ?? {}).sort();
    if (allDates.length === 0) {
      return `No time series data returned (base: ${response.base}, ${response.start_date} to ${response.end_date}).`;
    }

    const firstDate = allDates[0]!;
    const lastDate = allDates[allDates.length - 1]!;
    const firstRates = response.rates[firstDate] ?? {};
    const lastRates = response.rates[lastDate] ?? {};
    const symbols = Array.from(new Set([...Object.keys(firstRates), ...Object.keys(lastRates)])).sort();

    let text = `FX time series — base ${response.base}\n`;
    text += `Range: ${response.start_date} to ${response.end_date} (${allDates.length} dated point(s))\n\n`;
    text += `First (${firstDate}):\n`;
    symbols.forEach((code) => {
      const v = firstRates[code];
      if (typeof v === 'number') text += `- 1 ${response.base} = ${this.formatNumber(v, 6)} ${code}\n`;
    });
    text += `\nLast (${lastDate}):\n`;
    symbols.forEach((code) => {
      const v = lastRates[code];
      if (typeof v === 'number') text += `- 1 ${response.base} = ${this.formatNumber(v, 6)} ${code}\n`;
    });

    if (allDates.length >= 2) {
      const changes: string[] = [];
      symbols.forEach((code) => {
        const a = firstRates[code];
        const b = lastRates[code];
        if (typeof a === 'number' && typeof b === 'number' && a !== 0) {
          const pct = ((b - a) / a) * 100;
          const sign = pct >= 0 ? '+' : '';
          changes.push(`${code}: ${sign}${pct.toFixed(2)}%`);
        }
      });
      if (changes.length > 0) {
        text += `\nChange (first → last): ${changes.join(', ')}`;
      }
    }

    if (allDates.length > 365) {
      text += `\n\nNote: range exceeds 365 days; only first/last summarized.`;
    }

    return text.trim();
  }

  private formatCurrenciesAsText(response: CurrenciesResponse): string {
    const entries = Object.entries(response).sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) {
      return 'No currencies returned.';
    }
    let text = `Supported currencies (${entries.length}):\n\n`;
    entries.forEach(([code, name]) => {
      text += `- ${code} — ${name}\n`;
    });
    return text.trim();
  }

  private formatNumber(value: number, maxFractionDigits = 4): string {
    if (!Number.isFinite(value)) return String(value);
    const fixed = value.toFixed(maxFractionDigits);
    // Trim trailing zeros (but keep at least 2 decimal places for readability of money-like values)
    if (fixed.includes('.')) {
      const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
      return trimmed.includes('.') ? trimmed : `${trimmed}.00`;
    }
    return `${fixed}.00`;
  }
}
