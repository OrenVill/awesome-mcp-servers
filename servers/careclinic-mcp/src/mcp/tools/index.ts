import { getConfig } from '../../config.js';
import { CareClinicProxyService } from '../../services/careclinicProxyService.js';
import { CareClinicTools } from './careclinicTools.js';

export type RegistryToolDefinition = {
  name: string;
  description: string;
  inputSchema: object;
  keywords: string[];
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
};

/** Registry helper for standalone or unified-mcp (unified hides provider unless CARECLINIC_BEARER_TOKEN is set). */
export async function getCareclinicToolDefinitions(
  apiConfig?: ReturnType<typeof getConfig>['api']
): Promise<RegistryToolDefinition[]> {
  const config = apiConfig ?? getConfig().api;
  const proxy = new CareClinicProxyService(config);
  const tools = await proxy.listTools();
  const careclinicTools = new CareClinicTools(proxy);

  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
    keywords: proxy.toolKeywords(tool.name),
    execute: (args) => careclinicTools.executeTool(tool.name, args),
  }));
}
