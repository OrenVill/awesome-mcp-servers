export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPContentItem {
  type: 'text';
  text: string;
}

export interface MCPToolCallResult {
  content: MCPContentItem[];
}

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

export enum MCPErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  API_ERROR = 'API_ERROR',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export const CARECLINIC_MISSING_BEARER_MESSAGE =
  'CareClinic requires your own OAuth access token. Set the CARECLINIC_BEARER_TOKEN environment variable to a bearer token for your CareClinic account (see servers/careclinic-mcp/README.md). Each user must use their own token — this server does not share credentials.';

export function createMCPErrorResult(
  code: MCPErrorCode,
  message: string
): MCPToolCallResult {
  return {
    content: [{ type: 'text', text: `Error (${code}): ${message}` }],
  };
}
