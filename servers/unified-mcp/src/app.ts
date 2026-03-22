import 'dotenv/config';
import { getMCPConfig } from './config.js';
import { createMCPServer } from './mcp/mcpServer.js';

async function main(): Promise<void> {
  const config = getMCPConfig();
  if (!config.enabled) {
    console.error('MCP server is disabled');
    process.exit(1);
  }

  const mcpServer = await createMCPServer(config);

  const shutdown = async (): Promise<void> => {
    await mcpServer.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

void main();
