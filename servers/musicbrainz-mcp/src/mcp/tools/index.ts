import {
  MusicbrainzTools,
  SEARCH_ARTIST_DEF,
  SEARCH_RELEASE_DEF,
  LOOKUP_ARTIST_DEF,
  type SearchArtistInput,
  type SearchReleaseInput,
  type LookupArtistInput,
} from './musicbrainzTools.js';
import { MusicBrainzService } from '../../services/musicbrainzService.js';
import { getConfig } from '../../config.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
};

export function getMusicbrainzToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
  userAgent?: string;
  minRequestIntervalMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new MusicBrainzService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    userAgent: config.userAgent,
    minRequestIntervalMs: config.minRequestIntervalMs,
  });
  const tools = new MusicbrainzTools(service);
  return [
    {
      ...SEARCH_ARTIST_DEF,
      inputSchema: MusicbrainzTools.getSearchArtistSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchArtist(args as unknown as SearchArtistInput),
    },
    {
      ...SEARCH_RELEASE_DEF,
      inputSchema: MusicbrainzTools.getSearchReleaseSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchRelease(args as unknown as SearchReleaseInput),
    },
    {
      ...LOOKUP_ARTIST_DEF,
      inputSchema: MusicbrainzTools.getLookupArtistSchema().inputSchema,
      execute: (args) =>
        tools.executeLookupArtist(args as unknown as LookupArtistInput),
    },
  ];
}
