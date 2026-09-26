import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const roots=['src','api'];
const legacyQuoteToken='welrix_quotes/';
const allowedLegacyQuotePath='src/firebase/quotes.js';

function walk(root){
  const out=[];
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const p=path.join(root,entry.name);
    if(entry.isDirectory()) out.push(...walk(p));
    else if(/\.(?:js|mjs|ts|vue)$/.test(entry.name)) out.push(p.replaceAll('\\','/'));
  }
  return out;
}

const hits=[];
for(const root of roots){
  for(const file of walk(root)){
    const text=fs.readFileSync(file,'utf8');
    if(text.includes(legacyQuoteToken)) hits.push(file);
  }
}

assert.deepEqual(
  hits,
  [allowedLegacyQuotePath],
  'legacy welrix_quotes/* access must stay isolated to src/firebase/quotes.js during migration'
);

const legacy=fs.readFileSync(allowedLegacyQuotePath,'utf8');
assert.ok(
  legacy.includes('assertLegacyQuoteWriteAllowed();'),
  'isolated legacy Quote writer must enforce cutover policy'
);
assert.ok(
  legacy.includes('export async function loadQuote'),
  'legacy compatibility reader must remain explicit during migration'
);

console.log('PASS legacy Quote inventory: single isolated RTDB boundary, guarded writer + preserved reader');
