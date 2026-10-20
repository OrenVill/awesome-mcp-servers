import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { getConfig } from '../config.js';
import { providerProcessEnvSatisfied } from './providerEnv.js';
import { PROVIDERS } from './providers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const config = getConfig();
  const tools: Array<{
    name: string;
    description: string;
    keywords: string[];
    inputSchema: object;
    provider: string;
  }> = [];

  for (const provider of PROVIDERS) {
    if (!providerProcessEnvSatisfied(provider)) {
      console.error(
        `[unified-mcp] Catalog skip ${provider.id} (missing process env: ${provider.requiredProcessEnv?.join(', ') ?? ''})`
      );
      continue;
    }
    let defs;
    try {
      defs = await provider.loadTools(config.api);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[unified-mcp] Catalog skip ${provider.id} (${msg})`);
      continue;
    }
    for (const def of defs) {
      tools.push({
        name: def.name,
        description: def.description,
        keywords: def.keywords ?? [],
        inputSchema: def.inputSchema,
        provider: provider.id,
      });
    }
  }

  const catalog = {
    version: 1,
    generatedAt: new Date().toISOString(),
    providerCount: PROVIDERS.length,
    toolCount: tools.length,
    tools,
  };

  const outPath = resolve(__dirname, 'tool-catalog.json');
  writeFileSync(outPath, JSON.stringify(catalog));
  console.error(
    `[unified-mcp] Wrote tool catalog: ${tools.length} tools from ${PROVIDERS.length} providers → ${outPath}`
  );
}

main().catch((err) => {
  console.error('[unified-mcp] generateCatalog failed:', err);
  process.exit(1);
});
