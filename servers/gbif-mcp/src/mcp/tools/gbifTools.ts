import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  GbifService,
  type GbifOccurrence,
  type GbifSpeciesDetail,
  type GbifSpeciesMatch,
} from '../../services/gbifService.js';

export const SEARCH_SPECIES_DEF = {
  name: 'search_species',
  description:
    "🦋 I'm searching GBIF species\n\nSearch the Global Biodiversity Information Facility taxonomy for species and taxa matching a free-text query (scientific or vernacular names).",
  keywords: ['gbif', 'species', 'taxonomy', 'biodiversity', 'search', 'scientific name', 'taxon'],
};

export const GET_SPECIES_DEF = {
  name: 'get_species',
  description:
    "🦋 I'm fetching GBIF species records\n\nLook up one or more GBIF species/taxon records by numeric taxon key(s). Returns scientific name, rank, classification, and taxonomic status.",
  keywords: ['gbif', 'species', 'taxon', 'taxonomy', 'key', 'lookup', 'biodiversity'],
};

export const SEARCH_OCCURRENCES_DEF = {
  name: 'search_occurrences',
  description:
    "🦋 I'm searching GBIF occurrence records\n\nFind biodiversity occurrence records (observations, specimens) for a scientific name. Optionally filter by ISO 3166-1 alpha-2 country code (e.g. US, DE, BR).",
  keywords: ['gbif', 'occurrence', 'observation', 'specimen', 'distribution', 'geography', 'biodiversity'],
};

export interface SearchSpeciesInput {
  q: string;
  limit?: number;
}

export interface GetSpeciesInput {
  key?: number;
  keys?: number[];
}

export interface SearchOccurrencesInput {
  scientificName: string;
  country?: string;
  limit?: number;
}

const BATCH_SEPARATOR = '\n\n---\n\n';

export class GbifTools {
  private service: GbifService;

  constructor(service?: GbifService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new GbifService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
      });
    }
  }

  static getSearchSpeciesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          q: {
            type: 'string',
            description: 'Free-text search query (scientific or vernacular name, e.g. "Panthera leo" or "lion").',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of species results (1-300)',
            minimum: 1,
            maximum: 300,
            default: 20,
          },
        },
        required: ['q'],
      },
    };
  }

  static getGetSpeciesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          key: {
            type: 'number',
            description: 'Single GBIF taxon key (speciesKey or taxonKey from search results).',
          },
          keys: {
            type: 'array',
            items: { type: 'number' },
            minItems: 1,
            description: 'Multiple GBIF taxon keys to fetch in one call.',
          },
        },
      },
    };
  }

  static getSearchOccurrencesSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          scientificName: {
            type: 'string',
            description: 'Scientific name to match (e.g. "Homo sapiens").',
          },
          country: {
            type: 'string',
            description: 'Optional ISO 3166-1 alpha-2 country code filter (e.g. "US", "GB").',
          },
          limit: {
            type: 'number',
            description: 'Maximum occurrence records to return (1-300)',
            minimum: 1,
            maximum: 300,
            default: 20,
          },
        },
        required: ['scientificName'],
      },
    };
  }

  async executeSearchSpecies(args: SearchSpeciesInput): Promise<MCPToolCallResult> {
    const q = typeof args.q === 'string' ? args.q.trim() : '';
    if (!q) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'q is required and must be a non-empty string');
    }
    const limit = this.clampLimit(args.limit, 1, 300, 20);

    try {
      const data = await this.service.searchSpecies(q, limit);
      const text = this.formatSpeciesSearchResults(data.results, data.count, q);
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  async executeGetSpecies(args: GetSpeciesInput): Promise<MCPToolCallResult> {
    const isBatch = args.keys != null;
    let keyList: number[];

    if (args.keys != null) {
      if (!Array.isArray(args.keys) || args.keys.length === 0) {
        return createMCPErrorResult(
          MCPErrorCode.INVALID_INPUT,
          'keys must be a non-empty array of numbers when provided'
        );
      }
      keyList = args.keys;
    } else if (args.key != null) {
      keyList = [args.key];
    } else {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'Provide either key (number) or keys (array of numbers)'
      );
    }

    if (keyList.some((k) => typeof k !== 'number' || !Number.isFinite(k))) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'All taxon keys must be finite numbers');
    }

    const sections = await Promise.all(
      keyList.map(async (key) => {
        try {
          const species = await this.service.getSpecies(key);
          return this.formatSpeciesDetail(species);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return `GBIF get_species failed for key ${key}: ${message}`;
        }
      })
    );

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  async executeSearchOccurrences(args: SearchOccurrencesInput): Promise<MCPToolCallResult> {
    const scientificName =
      typeof args.scientificName === 'string' ? args.scientificName.trim() : '';
    if (!scientificName) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'scientificName is required and must be a non-empty string'
      );
    }
    const limit = this.clampLimit(args.limit, 1, 300, 20);
    const country = typeof args.country === 'string' ? args.country : undefined;

    try {
      const data = await this.service.searchOccurrences(scientificName, limit, country);
      const text = this.formatOccurrenceResults(
        data.results,
        data.count,
        scientificName,
        country
      );
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(MCPErrorCode.API_ERROR, message);
    }
  }

  private clampLimit(value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
    return Math.max(min, Math.min(max, n));
  }

  private formatSpeciesSearchResults(
    results: GbifSpeciesMatch[],
    totalCount: number,
    query: string
  ): string {
    if (results.length === 0) {
      return `No GBIF species matches for "${query}".`;
    }

    let text = `GBIF species search for "${query}": showing ${results.length} of ${totalCount} total matches\n\n`;
    results.forEach((s, i) => {
      text += `${i + 1}. key=${s.key} — ${s.scientificName ?? s.canonicalName ?? '(unnamed)'}\n`;
      if (s.rank) text += `   rank: ${s.rank}\n`;
      if (s.kingdom) text += `   kingdom: ${s.kingdom}\n`;
      if (s.taxonomicStatus) text += `   status: ${s.taxonomicStatus}\n`;
      if (s.matchType) text += `   match: ${s.matchType}\n`;
    });
    return text.trim();
  }

  private formatSpeciesDetail(s: GbifSpeciesDetail): string {
    const name = s.scientificName ?? s.canonicalName ?? '(unnamed)';
    let text = `GBIF taxon key ${s.key}\n\n`;
    text += `Scientific name: ${name}\n`;
    if (s.authorship) text += `Authorship: ${s.authorship}\n`;
    if (s.vernacularName) text += `Vernacular name: ${s.vernacularName}\n`;
    if (s.rank) text += `Rank: ${s.rank}\n`;
    if (s.taxonomicStatus) text += `Taxonomic status: ${s.taxonomicStatus}\n`;
    if (s.synonym != null) text += `Synonym: ${s.synonym ? 'yes' : 'no'}\n`;

    const lineage: string[] = [];
    if (s.kingdom) lineage.push(s.kingdom);
    if (s.phylum) lineage.push(s.phylum);
    if (s.class) lineage.push(s.class);
    if (s.order) lineage.push(s.order);
    if (s.family) lineage.push(s.family);
    if (s.genus) lineage.push(s.genus);
    if (s.species) lineage.push(s.species);
    if (lineage.length > 0) {
      text += `Classification: ${lineage.join(' › ')}\n`;
    }
    if (s.parentKey != null) text += `Parent key: ${s.parentKey}\n`;
    if (s.acceptedKey != null) text += `Accepted key: ${s.acceptedKey}\n`;
    if (s.numDescendants != null) text += `Descendants: ${s.numDescendants}\n`;
    if (s.nameAccordingTo) text += `Name according to: ${s.nameAccordingTo}\n`;

    return text.trim();
  }

  private formatOccurrenceResults(
    results: GbifOccurrence[],
    totalCount: number,
    scientificName: string,
    country?: string
  ): string {
    const filterLabel = country ? ` in country ${country.toUpperCase()}` : '';
    if (results.length === 0) {
      return `No GBIF occurrence records for "${scientificName}"${filterLabel}.`;
    }

    let text = `GBIF occurrences for "${scientificName}"${filterLabel}: showing ${results.length} of ${totalCount} total\n\n`;
    results.forEach((o, i) => {
      text += `${i + 1}. occurrence key=${o.key}\n`;
      if (o.scientificName) text += `   name: ${o.scientificName}\n`;
      const place = [o.locality, o.stateProvince, o.country].filter(Boolean).join(', ');
      if (place) text += `   place: ${place}\n`;
      if (o.decimalLatitude != null && o.decimalLongitude != null) {
        text += `   coordinates: ${o.decimalLatitude}, ${o.decimalLongitude}\n`;
      }
      if (o.eventDate) text += `   date: ${o.eventDate}\n`;
      if (o.basisOfRecord) text += `   basis: ${o.basisOfRecord}\n`;
      const inst = [o.institutionCode, o.catalogNumber].filter(Boolean).join(' ');
      if (inst) text += `   record: ${inst}\n`;
    });
    return text.trim();
  }
}
