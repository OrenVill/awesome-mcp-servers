import {
  HackerNewsTools,
  GET_TOP_STORIES_DEF,
  GET_STORY_DEF,
  GET_COMMENTS_DEF,
  SEARCH_HN_DEF,
  type GetTopStoriesInput,
  type GetStoryInput,
  type GetCommentsInput,
  type SearchHNInput,
} from './hackerNewsTools.js';
import { HackerNewsService } from '../../services/hackerNewsService.js';
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

export function getHackerNewsToolDefinitions(apiConfig?: {
  firebaseBaseUrl?: string;
  algoliaBaseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new HackerNewsService({
    firebaseBase: config.firebaseBaseUrl ?? 'https://hacker-news.firebaseio.com/v0',
    algoliaBase: config.algoliaBaseUrl ?? 'https://hn.algolia.com/api/v1',
    timeout: config.timeoutMs ?? 15000,
  });
  const tools = new HackerNewsTools(service);
  return [
    {
      ...GET_TOP_STORIES_DEF,
      inputSchema: HackerNewsTools.getTopStoriesSchema().inputSchema,
      execute: (args) =>
        tools.executeGetTopStories(args as unknown as GetTopStoriesInput),
    },
    {
      ...GET_STORY_DEF,
      inputSchema: HackerNewsTools.getStorySchema().inputSchema,
      execute: (args) =>
        tools.executeGetStory(args as unknown as GetStoryInput),
    },
    {
      ...GET_COMMENTS_DEF,
      inputSchema: HackerNewsTools.getCommentsSchema().inputSchema,
      execute: (args) =>
        tools.executeGetComments(args as unknown as GetCommentsInput),
    },
    {
      ...SEARCH_HN_DEF,
      inputSchema: HackerNewsTools.getSearchHNSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchHN(args as unknown as SearchHNInput),
    },
  ];
}
