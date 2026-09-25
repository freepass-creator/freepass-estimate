import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const roots = [
  'src/lib/quote',
  'api',
];

const forbidden = [
  "firebase/database",
  "getDatabase(",
  "databaseURL",
  "welrix_quotes/",
];

function filesUnder(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const p = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(p));
    else if (/\.(?:js|mjs|ts)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const violations = [];
for (const root of roots) {
  for (const file of filesUnder(root)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const token of forbidden) {
      if (text.includes(token)) violations.push(`${file}: ${token}`);
    }
  }
}

assert.deepEqual(
  violations,
  [],
  'Quote core/API must not depend on RTDB. Legacy RTDB code must remain isolated outside the quote core migration boundary.'
);

const adapter = fs.readFileSync('src/lib/quote/repositories/freepass-data.js', 'utf8');
assert.ok(adapter.includes('PUT_ISSUED_QUOTE'), 'FreePass Data command adapter missing');
assert.ok(!adapter.includes('firebase/firestore'), 'consumer adapter must not write Firestore collections directly');

console.log('PASS Quote storage boundary: no RTDB/direct Firestore in quote core');
