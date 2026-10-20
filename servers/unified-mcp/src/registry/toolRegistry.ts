export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{
      type: string;
      text?: string;
      resource?: {
        uri: string;
        text?: string;
        mimeType?: string;
      };
    }>;
  }>;
};

export { LazyToolRegistry, createLazyToolRegistry, type ToolCatalogEntry } from './lazyToolRegistry.js';
