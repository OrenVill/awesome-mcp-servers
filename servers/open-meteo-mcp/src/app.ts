import 'dotenv/config';

import { createMCPServer, getDefaultMCPConfig } from './mcp/mcpServer.js';

async function main(): Promise<void> {
  const config = getDefaultMCPConfig();
  if (!config.enabled) {
    console.error('MCP server disabled (ENABLE_MCP_SERVER=false)');
    process.exit(0);
  }

  const server = await createMCPServer(config);

  const shutdown = async (signal: string) => {
    console.error(`\n${signal} received, shutting down...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
