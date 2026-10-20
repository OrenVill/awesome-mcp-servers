import {
  NpmRegistryTools,
  GET_PACKAGE_DEF,
  SEARCH_PACKAGES_DEF,
  type GetPackageInput,
  type SearchPackagesInput,
} from './npmRegistryTools.js';
import { NpmRegistryService } from '../../services/npmRegistryService.js';
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

export function getNpmRegistryToolDefinitions(apiConfig?: {
  baseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new NpmRegistryService({
    baseUrl: config.baseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new NpmRegistryTools(service);
  return [
    {
      ...GET_PACKAGE_DEF,
      inputSchema: NpmRegistryTools.getGetPackageSchema().inputSchema,
      execute: (args) => tools.executeGetPackage(args as unknown as GetPackageInput),
    },
    {
      ...SEARCH_PACKAGES_DEF,
      inputSchema: NpmRegistryTools.getSearchPackagesSchema().inputSchema,
      execute: (args) =>
        tools.executeSearchPackages(args as unknown as SearchPackagesInput),
    },
  ];
}

export {
  NpmRegistryTools,
  GET_PACKAGE_DEF,
  SEARCH_PACKAGES_DEF,
  type GetPackageInput,
  type SearchPackagesInput,
} from './npmRegistryTools.js';
