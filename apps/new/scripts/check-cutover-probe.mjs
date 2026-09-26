import assert from 'node:assert/strict';
import { runCutoverProbe } from '../src/lib/quote/cutover-probe.js';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_REPOSITORY_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';

const secureWriteAccessPolicy={
  contract:'freepass-estimate-write-access/v1',
  serverVerifiedFirebaseIdTokenRequired:true,
  anonymousWritesAllowed:false,
  requiredRoles:['staff'],
};

const blockedPolicy={
  contract:'freepass-legacy-quote-write-policy/v1',
  mode:'CANONICAL_ONLY',
  legacyNewQuoteWriteBlocked:true,
};
const allowedPolicy={
  contract:'freepass-legacy-quote-write-policy/v1',
  mode:'LEGACY_ALLOWED',
  legacyNewQuoteWriteBlocked:false,
};

const quote={
  contract:'freepass-quote/v2',
  quoteId:'q_probe_full',
  quoteVersion:1,
  snapshotHash:'c'.repeat(64),
};

const master={
  meta:{
    contract:'estimate-newcar-master/v1',
    projectionId:'estimate-newcar-master',
    schemaVersion:'1.0.0',
    authority:'CANONICAL_ACTIVE',
    releaseId:'rel_probe_full',
    manifestId:'manifest_probe_full',
    revision:11,
    inputDigest:'a'.repeat(64),
    dataDigest:'b'.repeat(64),
    activatedAt:'2026-09-26T06:00:00.000Z',
  },
};

let storedQuote=null;
const quoteRepository={
  contract:QUOTE_REPOSITORY_CONTRACT,
  async put({quote:value,idempotencyKey}){
    storedQuote=value;
    return {
      contract:QUOTE_WRITE_RECEIPT_CONTRACT,status:'CREATED',
      quoteId:value.quoteId,quoteVersion:value.quoteVersion,
      snapshotHash:value.snapshotHash,idempotencyKey,
    };
  },
  async get({quoteId,quoteVersion}){
    return storedQuote
      ? {
          contract:QUOTE_READ_RECEIPT_CONTRACT,status:'FOUND',
          quoteId,quoteVersion,snapshotHash:storedQuote.snapshotHash,quote:storedQuote,
        }
      : {
          contract:QUOTE_READ_RECEIPT_CONTRACT,status:'NOT_FOUND',
          quoteId,quoteVersion,
        };
  },
};

let storedEnvelope=null;
const envelopeRepository={
  contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  async put({envelope:value,idempotencyKey}){
    storedEnvelope=value;
    return {
      contract:SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,status:'CREATED',
      envelopeId:value.envelopeId,envelopeVersion:value.envelopeVersion,
      snapshotHash:value.snapshotHash,idempotencyKey,
    };
  },
  async get({envelopeId,envelopeVersion}){
    return storedEnvelope
      ? {
          contract:SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,status:'FOUND',
          envelopeId,envelopeVersion,snapshotHash:storedEnvelope.snapshotHash,envelope:storedEnvelope,
        }
      : {
          contract:SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,status:'NOT_FOUND',
          envelopeId,envelopeVersion,
        };
  },
};

const times=[
  '2026-09-26T06:01:00.000Z',
  '2026-09-26T06:01:01.000Z',
  '2026-09-26T06:01:02.000Z',
  '2026-09-26T06:01:03.000Z',
  '2026-09-26T06:01:04.000Z',
];

const ready=await runCutoverProbe({
  loadMaster:async()=>master,
  quoteRepository,
  envelopeRepository,
  quote,
  now:()=>times.shift(),
  envelopeExpiresAt:'2026-10-03T06:01:02.000Z',
  canonicalViewerReady:true,
  legacyWritePolicy:blockedPolicy,
  writeAccessPolicy:secureWriteAccessPolicy,
});

assert.equal(ready.contract,'freepass-estimate-cutover-probe/v1');
assert.equal(ready.status,'READY');
assert.equal(ready.master.releaseId,'rel_probe_full');
assert.equal(ready.quote.quoteId,quote.quoteId);
assert.equal(ready.envelope.writeStatus,'CREATED');
assert.equal(ready.readiness.gates.envelopeReferencesVerifiedQuote,true);

const holdTimes=[
  '2026-09-26T06:02:00.000Z',
  '2026-09-26T06:02:01.000Z',
  '2026-09-26T06:02:02.000Z',
  '2026-09-26T06:02:03.000Z',
  '2026-09-26T06:02:04.000Z',
];
const hold=await runCutoverProbe({
  loadMaster:async()=>master,
  quoteRepository,
  envelopeRepository,
  quote,
  now:()=>holdTimes.shift(),
  envelopeExpiresAt:'2026-10-03T06:02:02.000Z',
  canonicalViewerReady:false,
  legacyWritePolicy:allowedPolicy,
  writeAccessPolicy:secureWriteAccessPolicy,
});
assert.equal(hold.status,'HOLD');
assert.deepEqual(
  hold.readiness.blockers.map((x)=>x.code),
  ['CANONICAL_VIEWER_CUTOVER_NOT_READY','LEGACY_WRITE_BLOCK_NOT_READY']
);

let envelopeTouched=false;
await assert.rejects(
  ()=>runCutoverProbe({
    loadMaster:async()=>{ throw Object.assign(new Error('no active master'),{code:'NO_ACTIVE_RELEASE'}); },
    quoteRepository,
    envelopeRepository:{
      ...envelopeRepository,
      async put(){ envelopeTouched=true; throw new Error('must not execute'); },
    },
    quote,
    envelopeExpiresAt:'2026-10-03T06:00:00.000Z',
  }),
  (error)=>error?.code==='NO_ACTIVE_RELEASE'
);
assert.equal(envelopeTouched,false);

console.log('PASS full cutover probe: master -> Quote round-trip -> Envelope round-trip -> readiness v4');
