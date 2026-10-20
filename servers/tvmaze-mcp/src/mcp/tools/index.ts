import {
  TvmazeTools,
  SEARCH_SHOWS_DEF,
  GET_SHOW_DEF,
  GET_SHOW_EPISODES_DEF,
  type SearchShowsInput,
  type GetShowInput,
  type GetShowEpisodesInput,
} from './tvmazeTools.js';
import { TvmazeService } from '../../services/tvmazeService.js';
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

export function getTvmazeToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new TvmazeService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new TvmazeTools(service);
  return [
    {
      ...SEARCH_SHOWS_DEF,
      inputSchema: TvmazeTools.getSearchShowsSchema().inputSchema,
      execute: (args) => tools.executeSearchShows(args as unknown as SearchShowsInput),
    },
    {
      ...GET_SHOW_DEF,
      inputSchema: TvmazeTools.getShowSchema().inputSchema,
      execute: (args) => tools.executeGetShow(args as unknown as GetShowInput),
    },
    {
      ...GET_SHOW_EPISODES_DEF,
      inputSchema: TvmazeTools.getShowEpisodesSchema().inputSchema,
      execute: (args) =>
        tools.executeGetShowEpisodes(args as unknown as GetShowEpisodesInput),
    },
  ];
}
