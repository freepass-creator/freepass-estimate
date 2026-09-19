import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as contracts from '../src/lib/quote/contracts.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../verification-manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.schema, 'freepass-verification-manifest/v1');

const values = new Set();
for (const item of manifest.contracts || []) {
  assert.ok(item?.export, 'manifest contract export missing');
  assert.ok(item?.checker, 'manifest checker missing');
  const value = contracts[item.export];
  assert.equal(typeof value, 'string', 'unknown contract export: ' + item.export);
  assert.ok(value.startsWith('freepass-'), 'contract id must be semantic: ' + item.export);
  assert.ok(!values.has(value), 'duplicate contract id: ' + value);
  values.add(value);

  const source = fs.readFileSync(new URL('../' + item.checker, import.meta.url), 'utf8');
  assert.ok(source.includes(item.export),
    item.checker + ' does not bind current contract symbol ' + item.export);
}

console.log('verification manifest: PASS — every canonical contract is bound to an explicit checker');
