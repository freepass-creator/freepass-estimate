import assert from 'node:assert/strict';
import { createCanonicalShareDelivery } from '../src/lib/quote/delivery-runtime.js';
import {
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';

const quotes=[
  {
    contract:'freepass-quote/v2',
    quoteId:'q_delivery_36',
    quoteVersion:1,
    snapshotHash:'a'.repeat(64),
  },
  {
    contract:'freepass-quote/v2',
    quoteId:'q_delivery_60',
    quoteVersion:1,
    snapshotHash:'b'.repeat(64),
  },
];

const quoteReceipts=quotes.map((q)=>({
  contract:'freepass-quote-write-receipt/v1',
  status:'CREATED',
  quoteId:q.quoteId,
  quoteVersion:q.quoteVersion,
  snapshotHash:q.snapshotHash,
  idempotencyKey:`${q.quoteId}:v${q.quoteVersion}:${q.snapshotHash}`,
}));

let stored=null;
const envelopeRepository={
  contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  async put({envelope,idempotencyKey}){
    stored=envelope;
    return {
      contract:SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
      status:'CREATED',
      envelopeId:envelope.envelopeId,
      envelopeVersion:envelope.envelopeVersion,
      snapshotHash:envelope.snapshotHash,
      idempotencyKey,
    };
  },
};

const result=await createCanonicalShareDelivery({
  quotes,
  quoteReceipts,
  envelopeRepository,
  createdAt:'2026-09-26T07:00:00.000Z',
  expiresAt:'2026-10-03T07:00:00.000Z',
  locationLike:{
    origin:'https://estimate.example.test',
    pathname:'/mobile.html',
  },
});

assert.equal(result.contract,'freepass-canonical-share-delivery/v1');
assert.equal(result.quoteRefs.length,2);
assert.equal(stored.quoteRefs[0].quoteId,'q_delivery_36');
assert.ok(result.url.startsWith('https://estimate.example.test/mobile.html?share='));
assert.ok(result.url.includes('shareVersion=1'));
assert.equal(result.receipt.envelopeId,result.envelope.envelopeId);

await assert.rejects(
  ()=>createCanonicalShareDelivery({
    quotes,
    quoteReceipts:[
      quoteReceipts[0],
      {...quoteReceipts[1],snapshotHash:'c'.repeat(64)},
    ],
    envelopeRepository,
    createdAt:'2026-09-26T07:00:00.000Z',
    expiresAt:'2026-10-03T07:00:00.000Z',
    locationLike:{origin:'https://estimate.example.test',pathname:'/'},
  }),
  (error)=>error?.code==='SHARE_ENVELOPE_QUOTE_RECEIPT_MISMATCH'
);

let writeCalled=false;
await assert.rejects(
  ()=>createCanonicalShareDelivery({
    quotes,
    quoteReceipts,
    envelopeRepository:{
      contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
      async put(){
        writeCalled=true;
        throw Object.assign(new Error('canonical envelope repository unavailable'),{
          code:'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE',
        });
      },
    },
    createdAt:'2026-09-26T07:00:00.000Z',
    expiresAt:'2026-10-03T07:00:00.000Z',
    locationLike:{origin:'https://estimate.example.test',pathname:'/'},
  }),
  (error)=>error?.code==='SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE'
);
assert.equal(writeCalled,true);

console.log('PASS canonical delivery runtime: persisted Quotes -> Envelope -> canonical public URL');
