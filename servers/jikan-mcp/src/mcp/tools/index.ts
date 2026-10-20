import {
  JikanTools,
  SEARCH_ANIME_DEF,
  GET_ANIME_DEF,
  GET_TOP_ANIME_DEF,
  type SearchAnimeInput,
  type GetAnimeInput,
  type GetTopAnimeInput,
} from './jikanTools.js';
import { JikanService } from '../../services/jikanService.js';
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

export function getJikanToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
  minRequestIntervalMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new JikanService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
    minRequestIntervalMs: config.minRequestIntervalMs,
  });
  const tools = new JikanTools(service);
  return [
    {
      ...SEARCH_ANIME_DEF,
      inputSchema: JikanTools.getSearchAnimeSchema().inputSchema,
      execute: (args) => tools.executeSearchAnime(args as unknown as SearchAnimeInput),
    },
    {
      ...GET_ANIME_DEF,
      inputSchema: JikanTools.getAnimeSchema().inputSchema,
      execute: (args) => tools.executeGetAnime(args as unknown as GetAnimeInput),
    },
    {
      ...GET_TOP_ANIME_DEF,
      inputSchema: JikanTools.getTopAnimeSchema().inputSchema,
      execute: (args) => tools.executeGetTopAnime(args as unknown as GetTopAnimeInput),
    },
  ];
}
