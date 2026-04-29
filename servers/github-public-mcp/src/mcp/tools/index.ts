import {
  GithubTools,
  GET_REPO_DEF,
  GET_USER_DEF,
  LIST_REPO_ISSUES_DEF,
  LIST_REPO_RELEASES_DEF,
  SEARCH_REPOS_DEF,
  type GetRepoInput,
  type GetUserInput,
  type ListRepoIssuesInput,
  type ListRepoReleasesInput,
  type SearchReposInput,
} from './githubTools.js';
import { GithubService } from '../../services/githubService.js';
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

export function getGithubToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new GithubService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new GithubTools(service);
  return [
    {
      ...GET_REPO_DEF,
      inputSchema: GithubTools.getGetRepoSchema().inputSchema,
      execute: (args) => tools.executeGetRepo(args as unknown as GetRepoInput),
    },
    {
      ...GET_USER_DEF,
      inputSchema: GithubTools.getGetUserSchema().inputSchema,
      execute: (args) => tools.executeGetUser(args as unknown as GetUserInput),
    },
    {
      ...LIST_REPO_ISSUES_DEF,
      inputSchema: GithubTools.getListRepoIssuesSchema().inputSchema,
      execute: (args) =>
        tools.executeListRepoIssues(args as unknown as ListRepoIssuesInput),
    },
    {
      ...LIST_REPO_RELEASES_DEF,
      inputSchema: GithubTools.getListRepoReleasesSchema().inputSchema,
      execute: (args) =>
        tools.executeListRepoReleases(args as unknown as ListRepoReleasesInput),
    },
    {
      ...SEARCH_REPOS_DEF,
      inputSchema: GithubTools.getSearchReposSchema().inputSchema,
      execute: (args) => tools.executeSearchRepos(args as unknown as SearchReposInput),
    },
  ];
}
