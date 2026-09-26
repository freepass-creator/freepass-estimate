import assert from 'node:assert/strict';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_REPOSITORY_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';
import { buildShareEnvelope } from '../src/lib/quote/share-envelope.js';
import {
  CANONICAL_SHARE_BUNDLE_CONTRACT,
  loadCanonicalShareBundle,
} from '../src/lib/quote/share-bundle.js';

const quotes=[
  {
    contract:'freepass-quote/v2',
    quoteId:'q_bundle_36',
    quoteVersion:1,
    snapshotHash:'a'.repeat(64),
  },
  {
    contract:'freepass-quote/v2',
    quoteId:'q_bundle_60',
    quoteVersion:1,
    snapshotHash:'b'.repeat(64),
  },
];

const envelope=await buildShareEnvelope({
  quoteRefs:quotes.map((q)=>({
    quoteId:q.quoteId,
    quoteVersion:q.quoteVersion,
    snapshotHash:q.snapshotHash,
  })),
  createdAt:'2026-09-26T08:00:00.000Z',
  expiresAt:'2026-10-03T08:00:00.000Z',
});

const envelopeRepository={
  contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  async get({envelopeId,envelopeVersion}){
    if(envelopeId!==envelope.envelopeId){
      return {
        contract:SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
        status:'NOT_FOUND',
        envelopeId,
        envelopeVersion,
      };
    }
    return {
      contract:SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
      status:'FOUND',
      envelopeId:envelope.envelopeId,
      envelopeVersion:envelope.envelopeVersion,
      snapshotHash:envelope.snapshotHash,
      envelope,
    };
  },
};

const byId=new Map(quotes.map((q)=>[q.quoteId,q]));
const quoteRepository={
  contract:QUOTE_REPOSITORY_CONTRACT,
  async get({quoteId,quoteVersion}){
    const q=byId.get(quoteId);
    if(!q){
      return {
        contract:QUOTE_READ_RECEIPT_CONTRACT,
        status:'NOT_FOUND',
        quoteId,
        quoteVersion,
      };
    }
    return {
      contract:QUOTE_READ_RECEIPT_CONTRACT,
      status:'FOUND',
      quoteId:q.quoteId,
      quoteVersion:q.quoteVersion,
      snapshotHash:q.snapshotHash,
      quote:q,
    };
  },
};

const found=await loadCanonicalShareBundle({
  envelopeRepository,
  quoteRepository,
  envelopeId:envelope.envelopeId,
  envelopeVersion:1,
  now:()=> '2026-09-26T08:05:00.000Z',
});
assert.equal(found.contract,CANONICAL_SHARE_BUNDLE_CONTRACT);
assert.equal(found.status,'FOUND');
assert.deepEqual(found.quotes.map((q)=>q.quoteId),['q_bundle_36','q_bundle_60']);

const missing=await loadCanonicalShareBundle({
  envelopeRepository,
  quoteRepository,
  envelopeId:'se_missing',
  now:()=> '2026-09-26T08:05:00.000Z',
});
assert.equal(missing.status,'NOT_FOUND');
assert.equal(missing.quotes.length,0);

const expired=await loadCanonicalShareBundle({
  envelopeRepository,
  quoteRepository,
  envelopeId:envelope.envelopeId,
  now:()=> '2026-10-04T08:05:00.000Z',
});
assert.equal(expired.status,'EXPIRED');
assert.equal(expired.quotes.length,0);

await assert.rejects(
  ()=>loadCanonicalShareBundle({
    envelopeRepository,
    quoteRepository:{
      contract:QUOTE_REPOSITORY_CONTRACT,
      async get({quoteId,quoteVersion}){
        if(quoteId==='q_bundle_36'){
          return {
            contract:QUOTE_READ_RECEIPT_CONTRACT,
            status:'FOUND',
            quoteId,quoteVersion,
            snapshotHash:quotes[0].snapshotHash,
            quote:quotes[0],
          };
        }
        return {
          contract:QUOTE_READ_RECEIPT_CONTRACT,
          status:'NOT_FOUND',
          quoteId,quoteVersion,
        };
      },
    },
    envelopeId:envelope.envelopeId,
    now:()=> '2026-09-26T08:05:00.000Z',
  }),
  (error)=>error?.code==='CANONICAL_SHARE_QUOTE_NOT_FOUND'
);

await assert.rejects(
  ()=>loadCanonicalShareBundle({
    envelopeRepository,
    quoteRepository:{
      contract:QUOTE_REPOSITORY_CONTRACT,
      async get({quoteId,quoteVersion}){
        const q=byId.get(quoteId);
        const changed={...q,snapshotHash:'c'.repeat(64)};
        return {
          contract:QUOTE_READ_RECEIPT_CONTRACT,
          status:'FOUND',
          quoteId,quoteVersion,
          snapshotHash:changed.snapshotHash,
          quote:changed,
        };
      },
    },
    envelopeId:envelope.envelopeId,
    now:()=> '2026-09-26T08:05:00.000Z',
  }),
  (error)=>error?.code==='CANONICAL_SHARE_QUOTE_MISMATCH'
);

console.log('PASS canonical Share bundle: Envelope -> ordered Quote v2 records, expiry + identity fail-closed');
