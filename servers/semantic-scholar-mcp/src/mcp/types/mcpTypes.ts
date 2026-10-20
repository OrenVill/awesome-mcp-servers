// MCP Tool Schema Definitions
export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// MCP Response Format
export interface MCPContentItem {
  type: 'text';
  text: string;
}

export interface MCPToolCallResult {
  content: MCPContentItem[];
}

// Transport Configuration
export interface MCPServerConfig {
  enabled: boolean;
  transports: {
    stdio: boolean;
    http: boolean;
  };
  httpPort?: number;
  serverName: string;
  serverVersion: string;
}

// Error Codes
export enum MCPErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  API_ERROR = 'API_ERROR',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export function createMCPErrorResult(
  code: MCPErrorCode,
  message: string
): MCPToolCallResult {
  return {
    content: [{ type: 'text', text: `Error (${code}): ${message}` }],
  };
}
