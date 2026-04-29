import {
  MdnTools,
  SEARCH_MDN_DEF,
  GET_DOC_DEF,
  GET_BROWSER_COMPAT_DEF,
  type SearchMdnInput,
  type GetDocInput,
  type GetBrowserCompatInput,
} from './mdnTools.js';
import { MdnService } from '../../services/mdnService.js';
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

export function getMdnToolDefinitions(apiConfig?: {
  searchBaseUrl?: string;
  docsBaseUrl?: string;
  timeoutMs?: number;
}): RegistryToolDefinition[] {
  const config = apiConfig ?? getConfig().api;
  const service = new MdnService({
    searchBase: config.searchBaseUrl,
    docsBase: config.docsBaseUrl,
    timeout: config.timeoutMs,
  });
  const tools = new MdnTools(service);
  return [
    {
      ...SEARCH_MDN_DEF,
      inputSchema: MdnTools.getSearchMdnSchema().inputSchema,
      execute: (args) => tools.executeSearchMdn(args as unknown as SearchMdnInput),
    },
    {
      ...GET_DOC_DEF,
      inputSchema: MdnTools.getGetDocSchema().inputSchema,
      execute: (args) => tools.executeGetDoc(args as unknown as GetDocInput),
    },
    {
      ...GET_BROWSER_COMPAT_DEF,
      inputSchema: MdnTools.getGetBrowserCompatSchema().inputSchema,
      execute: (args) =>
        tools.executeGetBrowserCompat(args as unknown as GetBrowserCompatInput),
    },
  ];
}
