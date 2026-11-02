#!/usr/bin/env node
/**
 * git filter-branch --msg-filter helper: strip Cursor agent metadata from commit messages.
 */
import fs from 'fs';

let msg = fs.readFileSync(0, 'utf8');

const lines = msg.split('\n').filter((line) => {
  if (/^Co-authored-by:\s*Cursor Agent/i.test(line)) return false;
  if (/^Made-with:\s*Cursor/i.test(line)) return false;
  return true;
});

msg = lines.join('\n');
msg = msg.replace(/addd rules for claude and cursor/i, 'add rules for Claude Code and workspace rules');
msg = msg.replace(/ \(Cursor compat\)/gi, ' (multi-session HTTP compat)');
msg = msg.replace(/Made with \[Cursor\]\([^)]+\)/gi, '');
msg = msg.replace(/\n{3,}/g, '\n\n');

process.stdout.write(msg.endsWith('\n') ? msg : `${msg}\n`);
