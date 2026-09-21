// FreePass Estimate owns this module. No price-table or source-catalog copying.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [mode,consumer]=process.argv.slice(2);
assert.ok(['--check','--apply'].includes(mode)&&consumer,'Usage: node scripts/sync-color-contract.mjs --check|--apply <consumer-root>');
const source=fs.readFileSync(new URL('../src/lib/exterior-paint.js',import.meta.url));
const target=path.resolve(consumer,'src/lib/exterior-paint.js');
if(mode==='--apply')fs.writeFileSync(target,source);
assert.ok(source.equals(fs.readFileSync(target)),'Consumer color contract differs from FreePass Estimate');
console.log('PASS: identical canonical color contract at '+target);
