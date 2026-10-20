import {
  MCPToolCallResult,
  createMCPErrorResult,
  MCPErrorCode,
} from '../types/mcpTypes.js';
import { getConfig } from '../../config.js';
import {
  MusicBrainzService,
  type MusicBrainzArtist,
  type MusicBrainzRelease,
} from '../../services/musicbrainzService.js';

export const SEARCH_ARTIST_DEF = {
  name: 'search_artist',
  description:
    "🎵 I'm searching MusicBrainz artists\n\nSearch MusicBrainz for artists by name or Lucene query (e.g. artist:\"Radiohead\" or Radiohead). Returns MBIDs, names, types, countries, and disambiguation.",
  keywords: ['musicbrainz', 'music', 'artist', 'band', 'musician', 'search', 'mbid'],
};

export const SEARCH_RELEASE_DEF = {
  name: 'search_release',
  description:
    "💿 I'm searching MusicBrainz releases\n\nSearch MusicBrainz for albums and releases by title or Lucene query (e.g. release:\"OK Computer\" or artist:Radiohead AND release:Kid). Returns MBIDs, titles, dates, and artist credits.",
  keywords: ['musicbrainz', 'music', 'release', 'album', 'search', 'discography'],
};

export const LOOKUP_ARTIST_DEF = {
  name: 'lookup_artist',
  description:
    "🎤 I'm looking up a MusicBrainz artist\n\nLook up full artist details by MusicBrainz ID (MBID). Returns name, type, country, life span, aliases, and tags. Pass an array of MBIDs to fetch several artists in one call (requests are rate-limited to 1/s).",
  keywords: [
    'musicbrainz',
    'music',
    'artist',
    'mbid',
    'lookup',
    'metadata',
    'batch',
    'uuid',
  ],
};

export interface SearchArtistInput {
  query: string;
  limit?: number;
  offset?: number;
}

export interface SearchReleaseInput {
  query: string;
  limit?: number;
  offset?: number;
}

export interface LookupArtistInput {
  mbid: string | string[];
}

const MBID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export class MusicbrainzTools {
  private service: MusicBrainzService;

  constructor(service?: MusicBrainzService) {
    if (service) {
      this.service = service;
    } else {
      const api = getConfig().api;
      this.service = new MusicBrainzService({
        baseUrl: api.baseUrl,
        timeout: api.timeoutMs,
        userAgent: api.userAgent,
        minRequestIntervalMs: api.minRequestIntervalMs,
      });
    }
  }

  static getSearchArtistSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description:
              'Search query (plain name or Lucene syntax, e.g. artist:"The Beatles").',
          },
          limit: {
            type: 'number',
            description: 'Maximum results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 25,
          },
          offset: {
            type: 'number',
            description: 'Result offset for pagination',
            minimum: 0,
            default: 0,
          },
        },
        required: ['query'],
      },
    };
  }

  static getSearchReleaseSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description:
              'Search query (plain title or Lucene syntax, e.g. release:"Abbey Road").',
          },
          limit: {
            type: 'number',
            description: 'Maximum results to return (1-100)',
            minimum: 1,
            maximum: 100,
            default: 25,
          },
          offset: {
            type: 'number',
            description: 'Result offset for pagination',
            minimum: 0,
            default: 0,
          },
        },
        required: ['query'],
      },
    };
  }

  static getLookupArtistSchema(): {
    inputSchema: { type: 'object'; properties: object; required?: string[] };
  } {
    return {
      inputSchema: {
        type: 'object' as const,
        properties: {
          mbid: stringOrArraySchema(
            'MusicBrainz artist ID (UUID, e.g. "a74b1b7f-71a5-4011-9341-f9781536e263").'
          ),
        },
        required: ['mbid'],
      },
    };
  }

  async executeSearchArtist(args: SearchArtistInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string' || !args.query.trim()) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required');
    }

    const limit = args.limit ?? 25;
    const offset = args.offset ?? 0;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'limit must be a number between 1 and 100'
      );
    }
    if (typeof offset !== 'number' || offset < 0) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'offset must be a non-negative number'
      );
    }

    try {
      const result = await this.service.searchArtists({
        query: args.query.trim(),
        limit,
        offset,
      });
      const text = this.formatArtistSearchAsText(
        result.artists ?? [],
        args.query.trim(),
        result.count,
        offset
      );
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(
        MCPErrorCode.API_ERROR,
        `Artist search failed: ${message}`
      );
    }
  }

  async executeSearchRelease(args: SearchReleaseInput): Promise<MCPToolCallResult> {
    if (!args.query || typeof args.query !== 'string' || !args.query.trim()) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, 'query is required');
    }

    const limit = args.limit ?? 25;
    const offset = args.offset ?? 0;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'limit must be a number between 1 and 100'
      );
    }
    if (typeof offset !== 'number' || offset < 0) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'offset must be a non-negative number'
      );
    }

    try {
      const result = await this.service.searchReleases({
        query: args.query.trim(),
        limit,
        offset,
      });
      const text = this.formatReleaseSearchAsText(
        result.releases ?? [],
        args.query.trim(),
        result.count,
        offset
      );
      return { content: [{ type: 'text', text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return createMCPErrorResult(
        MCPErrorCode.API_ERROR,
        `Release search failed: ${message}`
      );
    }
  }

  async executeLookupArtist(args: LookupArtistInput): Promise<MCPToolCallResult> {
    const { items, isBatch } = normalizeToArray(args.mbid);
    if (items.length === 0 || items.some((m) => !m || typeof m !== 'string')) {
      return createMCPErrorResult(
        MCPErrorCode.INVALID_INPUT,
        'mbid is required and must be a string or a non-empty array of strings'
      );
    }

    const sections: string[] = [];
    for (const raw of items) {
      const mbid = raw.trim();
      if (!MBID_RE.test(mbid)) {
        sections.push(`# ${mbid}\n\nInvalid MBID format (expected UUID).`);
        continue;
      }
      try {
        const artist = await this.service.lookupArtist(mbid);
        sections.push(this.formatArtistAsText(artist));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        sections.push(`# ${mbid}\n\nFailed to look up artist: ${message}`);
      }
    }

    if (!isBatch) {
      return { content: [{ type: 'text', text: sections[0] }] };
    }
    return { content: [{ type: 'text', text: sections.join(BATCH_SEPARATOR) }] };
  }

  private formatArtistSearchAsText(
    artists: MusicBrainzArtist[],
    query: string,
    total?: number,
    offset?: number
  ): string {
    if (artists.length === 0) {
      return `No MusicBrainz artists found for "${query}".`;
    }

    let text = `Found ${artists.length} artist(s) for "${query}"`;
    if (total != null) text += ` (${total.toLocaleString()} total`;
    if (offset != null && offset > 0) text += `, offset ${offset}`;
    if (total != null) text += ')';
    text += ':\n\n';

    artists.forEach((a, i) => {
      text += `${i + 1}. **${a.name}**\n`;
      text += `   MBID: ${a.id}\n`;
      const meta: string[] = [];
      if (a.type) meta.push(a.type);
      if (a.country) meta.push(a.country);
      if (a['life-span']?.begin) {
        const end = a['life-span'].ended && a['life-span'].end ? `–${a['life-span'].end}` : '';
        meta.push(`${a['life-span'].begin}${end}`);
      }
      if (meta.length > 0) text += `   ${meta.join(' · ')}\n`;
      if (a.disambiguation) text += `   Disambiguation: ${a.disambiguation}\n`;
      text += '\n';
    });

    text += 'Use lookup_artist with an MBID for full details.';
    return text.trim();
  }

  private formatReleaseSearchAsText(
    releases: MusicBrainzRelease[],
    query: string,
    total?: number,
    offset?: number
  ): string {
    if (releases.length === 0) {
      return `No MusicBrainz releases found for "${query}".`;
    }

    let text = `Found ${releases.length} release(s) for "${query}"`;
    if (total != null) text += ` (${total.toLocaleString()} total`;
    if (offset != null && offset > 0) text += `, offset ${offset}`;
    if (total != null) text += ')';
    text += ':\n\n';

    releases.forEach((r, i) => {
      text += `${i + 1}. **${r.title}**\n`;
      text += `   MBID: ${r.id}\n`;
      const credit = this.formatArtistCredit(r);
      if (credit) text += `   Artist: ${credit}\n`;
      const meta: string[] = [];
      if (r.date) meta.push(r.date);
      if (r.country) meta.push(r.country);
      if (r.status) meta.push(r.status);
      if (r['release-group']?.['primary-type']) {
        meta.push(r['release-group']['primary-type']);
      }
      if (meta.length > 0) text += `   ${meta.join(' · ')}\n`;
      if (r.disambiguation) text += `   Disambiguation: ${r.disambiguation}\n`;
      text += '\n';
    });

    return text.trim();
  }

  private formatArtistAsText(artist: MusicBrainzArtist): string {
    let text = `# ${artist.name}\n\n`;
    text += `**MBID:** ${artist.id}\n`;
    if (artist['sort-name'] && artist['sort-name'] !== artist.name) {
      text += `**Sort name:** ${artist['sort-name']}\n`;
    }
    if (artist.type) text += `**Type:** ${artist.type}\n`;
    if (artist.gender) text += `**Gender:** ${artist.gender}\n`;
    if (artist.country) text += `**Country:** ${artist.country}\n`;
    const span = artist['life-span'];
    if (span?.begin || span?.end) {
      const end = span.end ? ` – ${span.end}` : span.ended ? ' (ended)' : '';
      text += `**Active:** ${span.begin ?? '?'}${end}\n`;
    }
    if (artist.disambiguation) {
      text += `**Disambiguation:** ${artist.disambiguation}\n`;
    }

    if (artist.aliases && artist.aliases.length > 0) {
      const names = artist.aliases
        .slice(0, 15)
        .map((a) => (a.locale ? `${a.name} (${a.locale})` : a.name));
      text += `\n## Aliases\n\n${names.join(', ')}`;
      if (artist.aliases.length > 15) {
        text += ` … and ${artist.aliases.length - 15} more`;
      }
      text += '\n';
    }

    if (artist.tags && artist.tags.length > 0) {
      const tags = artist.tags
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
        .map((t) => t.name);
      text += `\n## Tags\n\n${tags.join(', ')}\n`;
    }

    text += `\n**URL:** https://musicbrainz.org/artist/${artist.id}`;
    return text.trim();
  }

  private formatArtistCredit(release: MusicBrainzRelease): string {
    const credits = release['artist-credit'];
    if (!credits || credits.length === 0) return '';
    return credits
      .map((c) => c.name ?? c.artist?.name ?? '')
      .filter((n) => n.length > 0)
      .join(', ');
  }
}
