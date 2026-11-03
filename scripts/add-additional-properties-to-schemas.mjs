#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const serversDir = path.join(root, 'servers');

const marker = "type: 'object' as const,";
const inject = "type: 'object' as const,\n        additionalProperties: true,";

let count = 0;
for (const server of fs.readdirSync(serversDir)) {
  const toolsDir = path.join(serversDir, server, 'src', 'mcp', 'tools');
  if (!fs.existsSync(toolsDir)) continue;
  for (const file of fs.readdirSync(toolsDir)) {
    if (!file.endsWith('Tools.ts')) continue;
    const full = path.join(toolsDir, file);
    let src = fs.readFileSync(full, 'utf8');
    if (!src.includes('inputSchema:') || src.includes('additionalProperties: true')) continue;
    const next = src.replaceAll(marker, inject);
    if (next !== src) {
      fs.writeFileSync(full, next);
      count++;
      console.log('updated', path.relative(root, full));
    }
  }
}
console.log(`Done. ${count} file(s).`);
