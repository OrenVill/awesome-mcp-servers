import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  WorldbankService,
  type WBCountry,
  type WBIndicator,
  type WBCountryIndicatorRow,
} from '../../services/worldbankService.js';

export const LIST_COUNTRIES_DEF = {
  name: 'list_countries',
  description:
    "🌍 I'm listing World Bank economies\n\nList countries and economies from the World Bank Open Data catalog. By default excludes regional/income aggregates. Optional single-page mode with `page` and `per_page`.",
  keywords: [
    'world bank',
    'worldbank',
    'countries',
    'economies',
    'development',
    'iso',
    'list',
  ],
};

export const SEARCH_INDICATORS_DEF = {
  name: 'search_indicators',
  description:
    "🔎 I'm searching development indicators\n\nSearch World Bank indicators by keyword(s) in id or name. Scans indicator pages from a data source (default: World Development Indicators). Pass an array of queries to search several terms at once in a single call.",
  keywords: [
    'world bank',
    'worldbank',
    'indicators',
    'search',
    'wdi',
    'development',
    'statistics',
    'metrics',
  ],
};

export const GET_COUNTRY_INDICATOR_DEF = {
  name: 'get_country_indicator',
  description:
    "📊 I'm fetching indicator time series\n\nGet values for a country and indicator (e.g. `us` + `SP.POP.TOTL`). Optional `date` as a year (`2020`) or range (`2000:2020`). Pass arrays for `country_code` and/or `indicator_id` to batch related lookups in one call.",
  keywords: [
    'world bank',
    'worldbank',
    'indicator',
    'time series',
    'gdp',
    'population',
    'country',
    'statistics',
    'data',
  ],
};

export interface ListCountriesInput {
  page?: number;
  per_page?: number;
  include_aggregates?: boolean;
  single_page?: boolean;
}

export interface SearchIndicatorsInput {
  query: string | string[];
  limit?: number;
  source_id?: string;
}

export interface GetCountryIndicatorInput {
  country_code: string | string[];
  indicator_id: string | string[];
  date?: string;
  per_page?: number;
}

const DATE_RE = /^(\d{4})(?::(\d{4}))?$/;

function normalizeToArray<T>(value: T | T[]): { items: T[]; isBatch: boolean } {
  if (Array.isArray(value)) return { items: value, isBatch: true };
  return { items: [value], isBatch: false };
}

function stringOrArraySchema(description: string): object {
  return {
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' }, minItems: 1 },
    ],
    description: `${description} Accepts a single value or an array of values for batch requests.`,
  };
}

const BATCH_SEPARATOR = '\n\n---\n\n';

function formatCountryLine(c: WBCountry): string {
  const region = c.region?.value?.trim() ?? '';
  const income = c.incomeLevel?.value?.trim() ?? '';
  const iso = c.iso2Code ? `ISO2 ${c.iso2Code}` : 'no ISO2';
  const capital = c.capitalCity ? ` · capital ${c.capitalCity}` : '';
  return `- **${c.name}** (\`${c.id}\`, ${iso})${capital}${region ? ` · ${region}` : ''}${income ? ` · ${income}` : ''}`;
}

function formatCountriesAsText(
  countries: WBCountry[],
  meta: { total: number; aggregatesIncluded: boolean }
): string {
  const lines = countries.map(formatCountryLine);
  const header = `World Bank countries (${countries.length} shown${meta.total !== countries.length ? ` of ${meta.total} API rows` : ''}${meta.aggregatesIncluded ? ', aggregates included' : ', aggregates excluded'})`;
  return `${header}\n\n${lines.join('\n')}`;
}

function formatIndicatorLine(ind: WBIndicator): string {
  const source = ind.source?.value ? ` · ${ind.source.value}` : '';
  return `- **${ind.name}** (\`${ind.id}\`)${source}`;
}

function formatIndicatorsAsText(
  query: string,
  indicators: WBIndicator[],
  scannedPages: number
): string {
  if (indicators.length === 0) {
    return `No indicators matched "${query}" (scanned ${scannedPages} page(s)). Try broader keywords or a different source_id.`;
  }
  const lines = indicators.map(formatIndicatorLine);
  return `Indicators matching "${query}" (${indicators.length}, scanned ${scannedPages} page(s)):\n\n${lines.join('\n')}`;
}

function formatSeriesAsText(
  countryCode: string,
  indicatorId: string,
  series: WBCountryIndicatorRow[],
  dateFilter?: string
): string {
  if (series.length === 0) {
    return `No data for country \`${countryCode}\`, indicator \`${indicatorId}\`${dateFilter ? `, date ${dateFilter}` : ''}.`;
  }

  const sample = series[0];
  const title = sample.indicator?.value ?? indicatorId;
  const countryName = sample.country?.value ?? countryCode;

  const rows = [...series].sort((a, b) => Number(b.date) - Number(a.date));
  const valueLines = rows.map((row) => {
    const val =
      row.value === null || row.value === undefined
        ? 'n/a'
        : row.value.toLocaleString('en-US');
    return `- ${row.date}: ${val}${row.unit ? ` ${row.unit}` : ''}`;
  });

  return `**${title}** — ${countryName} (\`${countryCode}\` / \`${indicatorId}\`)\n\n${valueLines.join('\n')}`;
}

function resolveIndicatorPairs(
  countryCode: string | string[],
  indicatorId: string | string[]
): { country: string; indicator: string }[] | { error: string } {
  const countries = normalizeToArray(countryCode);
  const indicators = normalizeToArray(indicatorId);

  if (countries.items.length === 1 && indicators.items.length === 1) {
    return [{ country: countries.items[0], indicator: indicators.items[0] }];
  }
  if (countries.items.length === 1) {
    return indicators.items.map((indicator) => ({
      country: countries.items[0],
      indicator,
    }));
  }
  if (indicators.items.length === 1) {
    return countries.items.map((country) => ({
      country,
      indicator: indicators.items[0],
    }));
  }
  if (countries.items.length === indicators.items.length) {
    return countries.items.map((country, i) => ({
      country,
      indicator: indicators.items[i],
    }));
  }
  return {
    error:
      'When both country_code and indicator_id are arrays, they must be the same length (zipped pairs), or pass a single country_code with multiple indicator_id values (or vice versa).',
  };
}

export class WorldbankTools {
  private service: WorldbankService;

  constructor(service?: WorldbankService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new WorldbankService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        defaultSourceId: api.defaultSourceId,
      });
    }
  }

  static getListCountriesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          page: {
            type: 'integer',
            minimum: 1,
            description: 'Page number when single_page is true (default 1).',
          },
          per_page: {
            type: 'integer',
            minimum: 1,
            maximum: 500,
            description: 'Results per API page (default 500).',
          },
          include_aggregates: {
            type: 'boolean',
            description:
              'Include regional/income aggregates (default false — countries only).',
          },
          single_page: {
            type: 'boolean',
            description:
              'If true, return one API page only instead of fetching all pages.',
          },
        },
      },
    };
  }

  static getSearchIndicatorsSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: stringOrArraySchema('Search terms matched against indicator id and name.'),
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Max indicators per query (default 25).',
          },
          source_id: {
            type: 'string',
            description:
              'World Bank data source id (default 2 = World Development Indicators).',
          },
        },
        required: ['query'],
      },
    };
  }

  static getGetCountryIndicatorSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          country_code: stringOrArraySchema(
            'World Bank country id or ISO2 code (e.g. us, USA, IND).'
          ),
          indicator_id: stringOrArraySchema(
            'Indicator id (e.g. SP.POP.TOTL, NY.GDP.MKTP.CD).'
          ),
          date: {
            type: 'string',
            description:
              'Optional year (YYYY) or inclusive range (YYYY:YYYY) passed to the World Bank API.',
          },
          per_page: {
            type: 'integer',
            minimum: 1,
            maximum: 2000,
            description: 'Max observations to return (default 500).',
          },
        },
        required: ['country_code', 'indicator_id'],
      },
    };
  }

  async executeListCountries(input: ListCountriesInput): Promise<MCPToolCallResult> {
    try {
      const { pagination, countries } = await this.service.listCountries({
        page: input.page,
        perPage: input.per_page,
        excludeAggregates: !input.include_aggregates,
        fetchAll: !input.single_page,
      });

      const text = formatCountriesAsText(countries, {
        total: pagination.total,
        aggregatesIncluded: Boolean(input.include_aggregates),
      });
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('timed out')) {
        return createMCPErrorResult(MCPErrorCode.TIMEOUT, msg);
      }
      return createMCPErrorResult(MCPErrorCode.API_ERROR, msg);
    }
  }

  async executeSearchIndicators(input: SearchIndicatorsInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(input.query);
    if (items.length === 0 || items.every((q) => !String(q).trim())) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required');
    }

    const sections: string[] = [];
    for (const rawQuery of items) {
      const query = String(rawQuery).trim();
      if (!query) {
        sections.push('Skipped empty query.');
        continue;
      }
      try {
        const result = await this.service.searchIndicators({
          query,
          limit: input.limit,
          sourceId: input.source_id,
        });
        sections.push(
          formatIndicatorsAsText(result.query, result.indicators, result.scannedPages)
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const code = msg.includes('timed out') ? MCPErrorCode.TIMEOUT : MCPErrorCode.API_ERROR;
        sections.push(`Error (${code}) for "${query}": ${msg}`);
      }
    }

    const text = isBatch ? sections.join(BATCH_SEPARATOR) : sections[0] ?? '';
    return { content: [{ type: 'text', text }] };
  }

  async executeGetCountryIndicator(
    input: GetCountryIndicatorInput
  ): Promise<MCPToolCallResult> {
    if (input.date !== undefined && input.date !== '' && !DATE_RE.test(input.date.trim())) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'date must be YYYY or YYYY:YYYY (e.g. 2020 or 2000:2020)'
      );
    }

    const pairs = resolveIndicatorPairs(input.country_code, input.indicator_id);
    if ('error' in pairs) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, pairs.error);
    }

    const isBatch = pairs.length > 1;
    const sections: string[] = [];

    for (const { country, indicator } of pairs) {
      try {
        const result = await this.service.getCountryIndicator({
          countryCode: country,
          indicatorId: indicator,
          date: input.date,
          perPage: input.per_page,
        });
        sections.push(
          formatSeriesAsText(
            result.countryCode,
            result.indicatorId,
            result.series,
            input.date?.trim()
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const code = msg.includes('timed out') ? MCPErrorCode.TIMEOUT : MCPErrorCode.API_ERROR;
        sections.push(
          `Error (${code}) for \`${country}\` + \`${indicator}\`: ${msg}`
        );
      }
    }

    const text = isBatch ? sections.join(BATCH_SEPARATOR) : sections[0] ?? '';
    return { content: [{ type: 'text', text }] };
  }
}
