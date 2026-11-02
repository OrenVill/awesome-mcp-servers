#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const serversDir = path.join(root, 'servers');

function walkTools() {
  const out = [];
  for (const name of fs.readdirSync(serversDir)) {
    const dir = path.join(serversDir, name, 'src', 'mcp', 'tools');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('Tools.ts')) out.push(path.join(dir, f));
    }
  }
  return out;
}

function cleanup(src) {
  if (!src.includes('@awesome-mcp/mcp-schema-helpers')) return src;

  src = src.replace(/\nfunction normalizeToArray<[\s\S]*?\n\}\n/g, '\n');
  src = src.replace(/\nfunction stringOrArraySchema\([\s\S]*?\n\}\n/g, '\n');
  src = src.replace(/\nfunction numberOrArraySchema\([\s\S]*?\n\}\n/g, '\n');
  src = src.replace(/\nconst BATCH_SEPARATOR = '\\n\\n---\\n\\n';\n/g, '\n');

  // Remaining stringOrArraySchema calls
  src = src.replace(/(\n\s+)(\w+): stringOrArraySchema\(([\s\S]*?)\),/g, (m, indent, field, descBody) => {
    const desc = descBody.trim().replace(/\s+/g, ' ');
    return `${indent}...batchStringProperties('${field}', ${desc}),`;
  });

  src = src.replace(
    /(\n\s+)(\w+): numberOrArraySchema\(\s*([^,]+),\s*\{\s*minimum:\s*(-?\d+(?:\.\d+)?),\s*maximum:\s*(-?\d+(?:\.\d+)?)\s*\}\s*\),/g,
    (m, indent, field, desc, min, max) =>
      `${indent}...batchNumberProperties('${field}', ${desc.trim()}, { minimum: ${min}, maximum: ${max} }),`
  );

  return src;
}

function ensureImport(src) {
  if (!src.includes('oneOf') && !src.includes('stringOrArraySchema') && !src.includes('numberOrArraySchema')) {
    return src;
  }
  if (src.includes('@awesome-mcp/mcp-schema-helpers')) return src;
  const m = src.match(/^import[\s\S]*?from '\.\.\/types\/mcpTypes\.js';\n/m);
  if (!m) return src;
  const IMPORT =
    "import {\n  BATCH_SEPARATOR,\n  batchStringProperties,\n  batchNumberProperties,\n  resolveStringBatch,\n  resolveNumberBatch,\n  formatInputFieldError,\n  normalizeToArray,\n} from '@awesome-mcp/mcp-schema-helpers';\n";
  return src.replace(m[0], m[0] + IMPORT);
}

function addDep(file) {
  const serverName = file.split(path.sep)[file.split(path.sep).indexOf('servers') + 1];
  const pkgPath = path.join(serversDir, serverName, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies = pkg.dependencies ?? {};
  if (!pkg.dependencies['@awesome-mcp/mcp-schema-helpers']) {
    pkg.dependencies['@awesome-mcp/mcp-schema-helpers'] = '*';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

for (const file of walkTools()) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('oneOf') && !src.includes('stringOrArraySchema') && !src.includes('numberOrArraySchema')) {
    continue;
  }
  addDep(file);
  src = ensureImport(src);
  src = cleanup(src);
  fs.writeFileSync(file, src);
  console.log('cleaned', path.relative(root, file));
}
