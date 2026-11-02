#!/usr/bin/env node
/**
 * Migrates tool files from oneOf stringOrArraySchema to @awesome-mcp/mcp-schema-helpers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const serversDir = path.join(root, 'servers');

const IMPORT_LINE =
  "import {\n  BATCH_SEPARATOR,\n  batchStringProperties,\n  batchNumberProperties,\n  resolveStringBatch,\n  resolveNumberBatch,\n  formatInputFieldError,\n  normalizeToArray,\n} from '@awesome-mcp/mcp-schema-helpers';\n";

function findToolFiles() {
  const files = [];
  for (const name of fs.readdirSync(serversDir)) {
    if (name === 'mcp-schema-helpers' || name === 'unified-mcp') continue;
    const toolsDir = path.join(serversDir, name, 'src', 'mcp', 'tools');
    if (!fs.existsSync(toolsDir)) continue;
    for (const f of fs.readdirSync(toolsDir)) {
      if (f.endsWith('Tools.ts')) {
        const full = path.join(toolsDir, f);
        if (fs.readFileSync(full, 'utf8').includes('stringOrArraySchema')) {
          files.push(full);
        }
      }
    }
  }
  return files;
}

function stripLocalHelpers(src) {
  return src
    .replace(
      /\/\*\*[\s\S]*?Normalize a scalar-or-array[\s\S]*?function normalizeToArray[\s\S]*?\}\n\n/,
      ''
    )
    .replace(/\/\*\* JSON-Schema fragment[\s\S]*?function stringOrArraySchema[\s\S]*?\}\n\n/g, '')
    .replace(/\/\*\* JSON-Schema fragment[\s\S]*?function numberOrArraySchema[\s\S]*?\}\n\n/g, '')
    .replace(/const BATCH_SEPARATOR = '\\n\\n---\\n\\n';\n\n/g, '');
}

function addImport(src) {
  if (src.includes('@awesome-mcp/mcp-schema-helpers')) return src;
  const m = src.match(/^import[\s\S]*?from '\.\.\/types\/mcpTypes\.js';\n/m);
  if (!m) throw new Error('No mcpTypes import');
  return src.replace(m[0], m[0] + IMPORT_LINE);
}

function replaceStringOrArraySchema(src) {
  return src.replace(/(\n\s+)(\w+): stringOrArraySchema\(([\s\S]*?)\),/g, (match, indent, field, descBody) => {
    const desc = descBody.trim().replace(/\s+/g, ' ');
    return `${indent}...batchStringProperties('${field}', ${desc}),`;
  });
}

function replaceNumberOrArraySchema(src) {
  return src.replace(
    /(\n\s+)(\w+): numberOrArraySchema\(\s*\n?\s*('(?:\\.|[^'\\])*'|`[^`]*`|"[^"]*")\s*,\s*\{\s*minimum:\s*(-?\d+(?:\.\d+)?),\s*maximum:\s*(-?\d+(?:\.\d+)?)\s*\}\s*\),/g,
    (match, indent, field, desc, min, max) => {
      return `${indent}...batchNumberProperties('${field}', ${desc}, { minimum: ${min}, maximum: ${max} }),`;
    }
  );
}

function replaceNumberOrArraySchemaSimple(src) {
  return src.replace(
    /(\n\s+)(\w+): numberOrArraySchema\(([\s\S]*?)\),/g,
    (match, indent, field, rest) => {
      const descMatch = rest.match(/^[\s\n]*('(?:\\.|[^'\\])*'|`[^`]*`|"[^"]*")/);
      const rangeMatch = rest.match(/\{\s*minimum:\s*(-?\d+(?:\.\d+)?),\s*maximum:\s*(-?\d+(?:\.\d+)?)\s*\}/);
      if (!descMatch || !rangeMatch) {
        console.warn('Could not parse numberOrArraySchema for', field);
        return match;
      }
      return `${indent}...batchNumberProperties('${field}', ${descMatch[1]}, { minimum: ${rangeMatch[1]}, maximum: ${rangeMatch[2]} }),`;
    }
  );
}

function addPackageDep(serverName) {
  const pkgPath = path.join(serversDir, serverName, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies = pkg.dependencies ?? {};
  if (!pkg.dependencies['@awesome-mcp/mcp-schema-helpers']) {
    pkg.dependencies['@awesome-mcp/mcp-schema-helpers'] = '*';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

function replaceNormalizeStringBatch(src, field) {
  const plural = field.endsWith('y') ? field.slice(0, -1) + 'ies' : field + 's';
  const patterns = [
    new RegExp(
      `const \\{ items, isBatch \\} = normalizeToArray\\(args\\.${field}\\);\\s*\\n\\s*if \\(items\\.length === 0 \\|\\| items\\.some\\([^)]*\\)\\) \\{\\s*\\n\\s*return createMCPErrorResult\\([^;]+;\\s*\\n\\s*\\}`,
      'g'
    ),
  ];
  for (const re of patterns) {
    if (re.test(src)) {
      src = src.replace(re, () => {
        return `const ${field}Resolved = resolveStringBatch(args as Record<string, unknown>, '${field}');
    if ('field' in ${field}Resolved) {
      return createMCPErrorResult(MCPErrorCode.INVALID_INPUT, formatInputFieldError(${field}Resolved));
    }
    const { items, isBatch } = ${field}Resolved;`;
      });
    }
  }
  return src;
}

for (const file of findToolFiles()) {
  const serverName = file.split(path.sep)[file.split(path.sep).indexOf('servers') + 1];
  addPackageDep(serverName);
  let src = fs.readFileSync(file, 'utf8');
  src = stripLocalHelpers(src);
  src = addImport(src);
  src = replaceStringOrArraySchema(src);
  src = replaceNumberOrArraySchemaSimple(src);
  fs.writeFileSync(file, src);
  console.log('Updated schema helpers in', path.relative(root, file));
}

console.log('Done. Review resolveStringBatch migrations manually for execute handlers.');
