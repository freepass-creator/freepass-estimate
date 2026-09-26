import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('src/firebase/quotes.js','utf8');

assert.ok(
  source.includes("import { assertLegacyQuoteWriteAllowed } from '../lib/quote/legacy-write-policy.js';"),
  'legacy Quote writer must import cutover policy'
);

const saveStart=source.indexOf('export async function saveQuote(payload)');
const saveEnd=source.indexOf('export async function loadQuote',saveStart);
assert.ok(saveStart>=0&&saveEnd>saveStart,'saveQuote function boundary missing');
const saveBody=source.slice(saveStart,saveEnd);

const guardIndex=saveBody.indexOf('assertLegacyQuoteWriteAllowed();');
const authIndex=saveBody.indexOf('await waitAuth();');
const rtdbGetIndex=saveBody.indexOf('await get(');
const rtdbSetIndex=saveBody.indexOf('await set(');

assert.ok(guardIndex>=0,'saveQuote must enforce legacy write cutover policy');
assert.ok(authIndex>guardIndex,'cutover guard must run before Firebase auth');
assert.ok(rtdbGetIndex>guardIndex,'cutover guard must run before legacy RTDB collision read');
assert.ok(rtdbSetIndex>guardIndex,'cutover guard must run before legacy RTDB write');

const loadStart=source.indexOf('export async function loadQuote');
const accessStart=source.indexOf('export async function markQuoteAccessed',loadStart);
const loadBody=source.slice(loadStart,accessStart);
assert.ok(loadBody.includes('welrix_quotes/'),'legacy compatibility reader must remain available');
assert.ok(!loadBody.includes('assertLegacyQuoteWriteAllowed'),'legacy reader must not be disabled by new-write cutover');

console.log('PASS legacy RTDB cutover boundary: new root writes guarded, historical reader preserved');
