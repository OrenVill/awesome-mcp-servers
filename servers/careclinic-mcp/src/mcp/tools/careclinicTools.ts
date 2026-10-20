import type { CareClinicProxyService } from '../../services/careclinicProxyService.js';
import type { MCPToolCallResult } from '../types/mcpTypes.js';

export class CareClinicTools {
  private proxy: CareClinicProxyService;

  constructor(proxy: CareClinicProxyService) {
    this.proxy = proxy;
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<MCPToolCallResult> {
    return this.proxy.callTool(name, args);
  }
}
