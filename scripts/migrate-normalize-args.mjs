#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkTools() {
  const out = [];
  const serversDir = path.join(root, 'servers');
  for (const name of fs.readdirSync(serversDir)) {
    const dir = path.join(serversDir, name, 'src', 'mcp', 'tools');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('Tools.ts')) out.push(path.join(dir, f));
    }
  }
  return out;
}

const STRING_REPLACE = /const \{ items, isBatch \} = normalizeToArray\(args\.(\w+)\);/g;

for (const file of walkTools()) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('@awesome-mcp/mcp-schema-helpers')) continue;
  if (!STRING_REPLACE.test(src)) continue;
  STRING_REPLACE.lastIndex = 0;
  const next = src.replace(STRING_REPLACE, (m, field) => {
    return `const ${field}Batch = normalizeStringArgFromArgs(args as Record<string, unknown>, '${field}');
    if ('field' in ${field}Batch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(${field}Batch));
    }
    const { items, isBatch } = ${field}Batch;`;
  });
  if (next === src) continue;
  if (!src.includes('normalizeStringArgFromArgs')) {
    src = src.replace(
      '  normalizeToArray,\n} from',
      '  normalizeToArray,\n  normalizeStringArgFromArgs,\n} from'
    );
  }
  fs.writeFileSync(file, src.replace(STRING_REPLACE, (m, field) => {
    return `const ${field}Batch = normalizeStringArgFromArgs(args as Record<string, unknown>, '${field}');
    if ('field' in ${field}Batch) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(${field}Batch));
    }
    const { items, isBatch } = ${field}Batch;`;
  }));
  console.log('resolve batch', path.relative(root, file));
}
