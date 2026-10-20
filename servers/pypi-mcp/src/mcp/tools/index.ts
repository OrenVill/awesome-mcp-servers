import {
  PypiTools,
  GET_PACKAGE_DEF,
  SEARCH_PACKAGES_DEF,
  type GetPackageInput,
  type SearchPackagesInput,
} from './pypiTools.js';
import { PypiService } from '../../services/pypiService.js';
import { getConfig } from '../../config.js';

export type PypiToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
};

export function getPypiToolDefinitions(apiConfig?: {
  baseUrl?: string;
  simpleIndexUrl?: string;
  timeoutMs?: number;
  searchMaxResults?: number;
}): PypiToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new PypiService({
    baseUrl: config.baseUrl,
    simpleIndexUrl: config.simpleIndexUrl,
    timeout: config.timeoutMs,
  });
  const tools = new PypiTools(service, config.searchMaxResults);
  return [
    {
      ...GET_PACKAGE_DEF,
      inputSchema: PypiTools.getGetPackageSchema().inputSchema,
      execute: (args) => tools.executeGetPackage(args as unknown as GetPackageInput),
    },
    {
      ...SEARCH_PACKAGES_DEF,
      inputSchema: PypiTools.getSearchPackagesSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchPackages(args as unknown as SearchPackagesInput),
    },
  ];
}

export {
  PypiTools,
  GET_PACKAGE_DEF,
  SEARCH_PACKAGES_DEF,
  type GetPackageInput,
  type SearchPackagesInput,
} from './pypiTools.js';
