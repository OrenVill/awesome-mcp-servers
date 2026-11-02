#!/usr/bin/env node
/**
 * Remove JSON Schema `required` entries for fields that have batch plural counterparts
 * (batchStringProperties / batchNumberProperties), so agents can pass `queries` without `query`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const serversDir = path.join(root, 'servers');

const IRREGULAR = {
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

function defaultPlural(singular) {
  if (IRREGULAR[singular]) return IRREGULAR[singular];
  if (singular.endsWith('y') && singular.length > 1 && !/[aeiou]y$/i.test(singular)) {
    return `${singular.slice(0, -1)}ies`;
  }
  if (singular.endsWith('s') || singular.endsWith('x') || singular.endsWith('ch')) {
    return `${singular}es`;
  }
  return `${singular}s`;
}

function hasBatchField(content, singular) {
  return (
    content.includes(`batchStringProperties('${singular}'`) ||
    content.includes(`batchNumberProperties('${singular}'`) ||
    content.includes(`batchCoordinateProperties('${singular}'`)
  );
}

function stripRequired(content) {
  return content.replace(/\n(\s+)required: \[([^\]]+)\],/g, (match, indent, inner) => {
    const fields = inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    const kept = fields.filter((f) => !hasBatchField(content, f));
    if (kept.length === fields.length) return match;
    if (kept.length === 0) return '';
    return `\n${indent}required: [${kept.map((f) => `'${f}'`).join(', ')}],`;
  });
}

let changed = 0;
for (const server of fs.readdirSync(serversDir)) {
  const toolsDir = path.join(serversDir, server, 'src', 'mcp', 'tools');
  if (!fs.existsSync(toolsDir)) continue;
  for (const file of fs.readdirSync(toolsDir)) {
    if (!file.endsWith('Tools.ts')) continue;
    const full = path.join(toolsDir, file);
    const src = fs.readFileSync(full, 'utf8');
    if (!src.includes('batchStringProperties') && !src.includes('batchNumberProperties')) continue;
    const next = stripRequired(src);
    if (next !== src) {
      fs.writeFileSync(full, next);
      changed++;
      console.log('updated', path.relative(root, full));
    }
  }
}
console.log(`Done. ${changed} file(s) updated.`);
