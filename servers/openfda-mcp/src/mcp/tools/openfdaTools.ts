import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  OpenFdaService,
  OpenFdaNotFoundError,
  type OpenFdaDrugLabel,
  type OpenFdaDeviceEvent,
  type OpenFdaFoodEnforcement,
} from '../../services/openfdaService.js';

export const SEARCH_DRUG_LABELS_DEF = {
  name: 'search_drug_labels',
  description:
    "💊 I'm searching FDA drug labels\n\nSearch openFDA drug labeling (SPL) records. Pass a Lucene-style `search` query (e.g. `openfda.brand_name:aspirin` or plain `aspirin`). Optional `limit` (default 5, max 100).",
  keywords: ['openfda', 'fda', 'drug', 'label', 'spl', 'medication', 'pharmaceutical', 'prescription', 'otc'],
};

export const SEARCH_DEVICE_EVENTS_DEF = {
  name: 'search_device_events',
  description:
    "🩺 I'm searching device adverse events\n\nSearch openFDA MAUDE device adverse event reports. Pass a Lucene-style `search` query (e.g. `device.brand_name:catheter`). Optional `limit` (default 5, max 100).",
  keywords: ['openfda', 'fda', 'device', 'maude', 'adverse', 'event', 'medical', 'report'],
};

export const SEARCH_FOOD_ENFORCEMENT_DEF = {
  name: 'search_food_enforcement',
  description:
    "🥫 I'm searching food recalls\n\nSearch openFDA food enforcement (recall) records. Pass a Lucene-style `search` query (e.g. `product_description:coffee`). Optional `limit` (default 5, max 100).",
  keywords: ['openfda', 'fda', 'food', 'recall', 'enforcement', 'contamination', 'allergen', 'safety'],
};

export interface SearchInput {
  search: string;
  limit?: number;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 100;
const TEXT_SNIPPET = 400;

function firstString(value: string[] | undefined): string | undefined {
  return value?.[0];
}

function joinUnique(values: string[] | undefined, max = 5): string {
  if (!values?.length) return '';
  return [...new Set(values)].slice(0, max).join(', ');
}

function truncate(text: string, max = TEXT_SNIPPET): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function stripMarkup(text: string): string {
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export class OpenFdaTools {
  private service: OpenFdaService;

  constructor(service?: OpenFdaService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new OpenFdaService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          search: {
            type: 'string',
            description:
              'openFDA Lucene search query or plain term (e.g. "aspirin", "openfda.brand_name:ibuprofen").',
          },
          limit: {
            type: 'integer',
            description: 'Maximum number of results to return (default 5, max 100).',
            minimum: 1,
            maximum: MAX_LIMIT,
            default: DEFAULT_LIMIT,
          },
        },
        required: ['search'],
      },
    };
  }

  async executeSearchDrugLabels(args: SearchInput): Promise<MCPToolCallResult> {
    return this.runSearch('drug labels', args, (limit) =>
      this.service.searchDrugLabels({ search: args.search.trim(), limit })
    );
  }

  async executeSearchDeviceEvents(args: SearchInput): Promise<MCPToolCallResult> {
    return this.runSearch('device events', args, (limit) =>
      this.service.searchDeviceEvents({ search: args.search.trim(), limit })
    );
  }

  async executeSearchFoodEnforcement(args: SearchInput): Promise<MCPToolCallResult> {
    return this.runSearch('food enforcement', args, (limit) =>
      this.service.searchFoodEnforcement({ search: args.search.trim(), limit })
    );
  }

  private normalizeLimit(limit: unknown): number | MCPToolCallResult {
    if (limit === undefined) return DEFAULT_LIMIT;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        `limit must be an integer between 1 and ${MAX_LIMIT}`
      );
    }
    return limit;
  }

  private async runSearch<T>(
    label: string,
    args: SearchInput,
    fetch: (limit: number) => Promise<{ meta: { results?: { total?: number } }; results: T[] }>
  ): Promise<MCPToolCallResult> {
    if (!args.search || typeof args.search !== 'string' || !args.search.trim()) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'search is required and must be a non-empty string');
    }

    const limitResult = this.normalizeLimit(args.limit);
    if (typeof limitResult !== 'number') {
      return limitResult;
    }

    try {
      const response = await fetch(limitResult);
      const total = response.meta.results?.total ?? response.results.length;
      if (response.results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No ${label} matched search "${args.search.trim()}" (total reported: ${total}).`,
            },
          ],
        };
      }

      let text = `openFDA ${label} — search: "${args.search.trim()}"\n`;
      text += `Showing ${response.results.length} of ${total} match(es)\n\n`;

      response.results.forEach((item, index) => {
        text += `--- Result ${index + 1} ---\n`;
        text += `${this.formatResultItem(item)}\n\n`;
      });

      return { content: [{ type: 'text', text: text.trim() }] };
    } catch (err) {
      if (err instanceof OpenFdaNotFoundError) {
        return {
          content: [
            {
              type: 'text',
              text: `No ${label} matched search "${args.search.trim()}".`,
            },
          ],
        };
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('timed out')) {
        return createMCPErrorResult(MCPErrorCode.TIMEOUT, message);
      }
      return createMCPErrorResult(MCPErrorCode.API_ERROR, `openFDA ${label} search failed: ${message}`);
    }
  }

  private formatResultItem(item: unknown): string {
    if (this.isDrugLabel(item)) return this.formatDrugLabel(item);
    if (this.isDeviceEvent(item)) return this.formatDeviceEvent(item);
    if (this.isFoodEnforcement(item)) return this.formatFoodEnforcement(item);
    return JSON.stringify(item).slice(0, TEXT_SNIPPET);
  }

  private isDrugLabel(item: unknown): item is OpenFdaDrugLabel {
    return typeof item === 'object' && item !== null && ('openfda' in item || 'purpose' in item);
  }

  private isDeviceEvent(item: unknown): item is OpenFdaDeviceEvent {
    return typeof item === 'object' && item !== null && ('device' in item || 'mdr_text' in item);
  }

  private isFoodEnforcement(item: unknown): item is OpenFdaFoodEnforcement {
    return typeof item === 'object' && item !== null && ('recall_number' in item || 'product_description' in item);
  }

  private formatDrugLabel(label: OpenFdaDrugLabel): string {
    const brand = joinUnique(label.openfda?.brand_name);
    const generic = joinUnique(label.openfda?.generic_name);
    const manufacturer = joinUnique(label.openfda?.manufacturer_name, 3);
    const purpose = firstString(label.purpose);
    const indications = firstString(label.indications_and_usage);

    const lines: string[] = [];
    if (brand) lines.push(`Brand: ${brand}`);
    if (generic) lines.push(`Generic: ${generic}`);
    if (manufacturer) lines.push(`Manufacturer: ${manufacturer}`);
    if (label.effective_time) lines.push(`Effective: ${label.effective_time}`);
    if (purpose) lines.push(`Purpose: ${truncate(stripMarkup(purpose))}`);
    if (indications) lines.push(`Indications: ${truncate(stripMarkup(indications))}`);
    if (label.set_id) lines.push(`Set ID: ${label.set_id}`);
    return lines.length > 0 ? lines.join('\n') : '(No summary fields in record)';
  }

  private formatDeviceEvent(event: OpenFdaDeviceEvent): string {
    const device = event.device?.[0];
    const problems = event.patient?.flatMap((p) => p.patient_problems ?? []) ?? [];
    const narrative = event.mdr_text?.find((t) => t.text)?.text;

    const lines: string[] = [];
    if (event.report_number) lines.push(`Report: ${event.report_number}`);
    if (event.date_received) lines.push(`Received: ${event.date_received}`);
    if (event.event_type) lines.push(`Event type: ${event.event_type}`);
    if (device?.brand_name) lines.push(`Device brand: ${device.brand_name}`);
    if (device?.generic_name) lines.push(`Device generic: ${device.generic_name}`);
    if (device?.manufacturer_d_name) lines.push(`Manufacturer: ${device.manufacturer_d_name}`);
    if (problems.length) lines.push(`Patient problems: ${joinUnique(problems, 8)}`);
    if (narrative) lines.push(`Narrative: ${truncate(stripMarkup(narrative))}`);
    return lines.length > 0 ? lines.join('\n') : '(No summary fields in record)';
  }

  private formatFoodEnforcement(recall: OpenFdaFoodEnforcement): string {
    const lines: string[] = [];
    if (recall.recall_number) lines.push(`Recall #: ${recall.recall_number}`);
    if (recall.status) lines.push(`Status: ${recall.status}`);
    if (recall.classification) lines.push(`Class: ${recall.classification}`);
    if (recall.report_date) lines.push(`Report date: ${recall.report_date}`);
    if (recall.recalling_firm) lines.push(`Firm: ${recall.recalling_firm}`);
    const location = [recall.city, recall.state, recall.country].filter(Boolean).join(', ');
    if (location) lines.push(`Location: ${location}`);
    if (recall.product_description) lines.push(`Product: ${truncate(recall.product_description)}`);
    if (recall.reason_for_recall) lines.push(`Reason: ${truncate(recall.reason_for_recall)}`);
    if (recall.distribution_pattern) lines.push(`Distribution: ${truncate(recall.distribution_pattern, 200)}`);
    return lines.length > 0 ? lines.join('\n') : '(No summary fields in record)';
  }
}
