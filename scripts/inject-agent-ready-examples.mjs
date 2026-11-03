#!/usr/bin/env node
/**
 * Injects inputSchema.description + inputSchema.examples for batch tool schemas
 * (Agent Readiness complex-schema-simplified).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const serversDir = path.join(root, 'servers');

const IMPORT_NAMES = new Set([
  'AGENT_READY_BATCH_DESCRIPTION',
  'buildAgentReadyExamples',
  'defaultStringBatchOptions',
  'stringBatchInputExamples',
  'coordinateBatchInputExamples',
  'dualStringBatchInputExamples',
  'mergeInputExamples',
]);

function plural(singular) {
  const irregular = {
    query: 'queries',
    storyId: 'storyIds',
    nameOrCode: 'namesOrCodes',
    event_id: 'event_ids',
    question_id: 'question_ids',
    country_code: 'country_codes',
    indicator_id: 'indicator_ids',
    isbn: 'isbns',
    issn: 'issns',
    username: 'usernames',
    prefix: 'prefixes',
    mbid: 'mbids',
    code: 'codes',
    to: 'tos',
    key: 'keys',
    type: 'types',
    id: 'ids',
    repo: 'repos',
    slug: 'slugs',
    title: 'titles',
    name: 'names',
    date: 'dates',
    pmid: 'pmids',
    timezone: 'timezones',
    icao24: 'icao24s',
  };
  if (irregular[singular]) return irregular[singular];
  if (singular.endsWith('y') && singular.length > 1 && !/[aeiou]y$/i.test(singular)) {
    return `${singular.slice(0, -1)}ies`;
  }
  if (singular.endsWith('s') || singular.endsWith('x') || singular.endsWith('ch')) {
    return `${singular}es`;
  }
  return `${singular}s`;
}

function analyzePropertiesBlock(block) {
  const stringSingulars = [
    ...block.matchAll(/batchStringProperties\(\s*'([^']+)'/g),
  ].map((m) => m[1]);
  const coordMatch = block.match(
    /batchCoordinateProperties\(\s*'([^']+)',\s*'([^']+)'(?:,\s*\{([^}]*)\})?/
  );
  let coordinate;
  if (coordMatch) {
    coordinate = { latKey: coordMatch[1], lonKey: coordMatch[2] };
    const opts = coordMatch[3] ?? '';
    const lonPl = opts.match(/lonPlural:\s*'([^']+)'/);
    if (lonPl) coordinate.lonPlural = lonPl[1];
  }
  const numberSingulars = [
    ...block.matchAll(/batchNumberProperties\(\s*'([^']+)'/g),
  ].map((m) => m[1]);
  return { stringSingulars, numberSingulars, coordinate };
}

function examplesExpression(analysis) {
  const { stringSingulars, coordinate } = analysis;
  const uniq = [...new Set(stringSingulars)];
  const hasDual = uniq.includes('country_code') && uniq.includes('indicator_id');
  if (hasDual) {
    return `dualStringBatchInputExamples('country_code', 'indicator_id', defaultStringBatchOptions('country_code'), defaultStringBatchOptions('indicator_id'))`;
  }
  const parts = [];
  for (const s of uniq) {
    parts.push(`stringBatchInputExamples('${s}', defaultStringBatchOptions('${s}'))`);
  }
  if (coordinate) {
    const opts = [];
    if (coordinate.lonPlural) opts.push(`lonPlural: '${coordinate.lonPlural}'`);
    const optStr = opts.length ? `, { ${opts.join(', ')} }` : '';
    parts.push(
      `coordinateBatchInputExamples('${coordinate.latKey}', '${coordinate.lonKey}'${optStr})`
    );
  }
  const numberSingulars = [...new Set(analysis.numberSingulars ?? [])].filter(
    (n) => !coordinate || (n !== coordinate.latKey && n !== coordinate.lonKey)
  );
  for (const n of numberSingulars) {
    parts.push(
      `numberBatchInputExamples('${n}', defaultNumberBatchRange('${n}'), defaultNumberBatchOptions('${n}'))`
    );
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `mergeInputExamples(${parts.join(', ')})`;
}

function injectIntoFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes('batchStringProperties') && !src.includes('batchCoordinateProperties')) {
    return false;
  }

  const marker = "type: 'object' as const,";
  let changed = false;
  let searchFrom = 0;
  while (true) {
    const typeIdx = src.indexOf(marker, searchFrom);
    if (typeIdx === -1) break;
    const schemaStart = src.lastIndexOf('inputSchema:', typeIdx);
    if (schemaStart === -1 || typeIdx - schemaStart > 120) {
      searchFrom = typeIdx + marker.length;
      continue;
    }
    const afterType = src.slice(typeIdx, typeIdx + 400);
    if (/examples\s*:/.test(afterType)) {
      searchFrom = typeIdx + marker.length;
      continue;
    }
    const propIdx = src.indexOf('properties:', typeIdx);
    if (propIdx === -1 || propIdx - typeIdx > 200) {
      searchFrom = typeIdx + marker.length;
      continue;
    }
    let depth = 0;
    let propEnd = propIdx + 'properties:'.length;
    for (let i = propIdx; i < src.length; i++) {
      if (src[i] === '{') depth++;
      if (src[i] === '}') {
        depth--;
        if (depth === 0 && i > propIdx) {
          propEnd = i + 1;
          break;
        }
      }
    }
    const propBlock = src.slice(propIdx, propEnd);
    const analysis = analyzePropertiesBlock(propBlock);
    const expr = examplesExpression(analysis);
    if (!expr) {
      searchFrom = typeIdx + marker.length;
      continue;
    }
    const injection = `\n        additionalProperties: true,\n        description: AGENT_READY_BATCH_DESCRIPTION,\n        examples: ${expr},`;
    src = src.slice(0, typeIdx + marker.length) + injection + src.slice(typeIdx + marker.length);
    changed = true;
    searchFrom = typeIdx + marker.length + injection.length + 100;
  }

  if (!changed) return false;

  if (!src.includes('@awesome-mcp/mcp-schema-helpers')) {
    return false;
  }

  const needImports = [
    'AGENT_READY_BATCH_DESCRIPTION',
    'buildAgentReadyExamples',
    'defaultStringBatchOptions',
    'stringBatchInputExamples',
    'coordinateBatchInputExamples',
    'dualStringBatchInputExamples',
    'mergeInputExamples',
    'numberBatchInputExamples',
    'defaultNumberBatchRange',
    'defaultNumberBatchOptions',
  ].filter((name) => src.includes(name));

  const importRe =
    /import \{([^}]+)\} from '@awesome-mcp\/mcp-schema-helpers';/;
  const m = src.match(importRe);
  if (m) {
    const existing = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [...new Set([...existing, ...needImports])].sort();
    src = src.replace(
      importRe,
      `import {\n  ${merged.join(',\n  ')},\n} from '@awesome-mcp/mcp-schema-helpers';`
    );
  }

  fs.writeFileSync(filePath, src);
  return true;
}

let count = 0;
for (const server of fs.readdirSync(serversDir)) {
  if (server === 'mcp-schema-helpers' || server === 'unified-mcp') continue;
  const toolsDir = path.join(serversDir, server, 'src', 'mcp', 'tools');
  if (!fs.existsSync(toolsDir)) continue;
  for (const file of fs.readdirSync(toolsDir)) {
    if (!file.endsWith('Tools.ts')) continue;
    if (injectIntoFile(path.join(toolsDir, file))) {
      count++;
      console.log('updated', path.join('servers', server, 'src/mcp/tools', file));
    }
  }
}
console.log(`Done. ${count} tool file(s) updated.`);
