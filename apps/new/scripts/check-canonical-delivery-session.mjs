import assert from 'node:assert/strict';
import { createCanonicalQuoteDelivery } from '../src/lib/quote/canonical-delivery-session.js';

const quote={
  contract:'freepass-quote/v2',
  quoteId:'q_session',
  quoteVersion:1,
  snapshotHash:'a'.repeat(64),
};
const quoteReceipt={
  contract:'freepass-quote-write-receipt/v1',
  status:'CREATED',
  quoteId:quote.quoteId,
  quoteVersion:quote.quoteVersion,
  snapshotHash:quote.snapshotHash,
  idempotencyKey:`${quote.quoteId}:v1:${quote.snapshotHash}`,
};

let persistArgs=null;
let shareArgs=null;
const result=await createCanonicalQuoteDelivery({
  request:{request:true},
  calculation:{calculation:true},
  vehicle:{vehicle:true},
  condition:{condition:true},
  quoteRepository:{name:'quotes'},
  envelopeRepository:{name:'envelopes'},
  createdAt:'2026-09-26T10:00:00.000Z',
  expiresAt:'2026-10-03T10:00:00.000Z',
  locationLike:{origin:'https://estimate.example.test',pathname:'/mobile.html'},
  persistQuotes:async(args)=>{
    persistArgs=args;
    return {
      quotes:[quote],
      receipts:[quoteReceipt],
      sourceRevision:'freepass-data/rel_session@r1',
    };
  },
  createShare:async(args)=>{
    shareArgs=args;
    return {
      envelope:{
        contract:'freepass-share-envelope/v1',
        envelopeId:'se_session',
        envelopeVersion:1,
        snapshotHash:'b'.repeat(64),
      },
      receipt:{
        contract:'freepass-share-envelope-write-receipt/v1',
        status:'CREATED',
        envelopeId:'se_session',
        envelopeVersion:1,
        snapshotHash:'b'.repeat(64),
        idempotencyKey:'se_session:v1:'+'b'.repeat(64),
      },
      url:'https://estimate.example.test/mobile.html?share=se_session&shareVersion=1',
    };
  },
});

assert.equal(result.contract,'freepass-canonical-quote-delivery/v1');
assert.equal(result.sourceRevision,'freepass-data/rel_session@r1');
assert.equal(result.quotes[0].quoteId,'q_session');
assert.equal(result.envelope.envelopeId,'se_session');
assert.equal(result.url,'https://estimate.example.test/mobile.html?share=se_session&shareVersion=1');

assert.equal(persistArgs.repository.name,'quotes');
assert.equal(persistArgs.request.request,true);
assert.equal(persistArgs.now(),'2026-09-26T10:00:00.000Z');
assert.equal(shareArgs.envelopeRepository.name,'envelopes');
assert.equal(shareArgs.quoteReceipts[0].quoteId,'q_session');
assert.equal(shareArgs.createdAt,'2026-09-26T10:00:00.000Z');
assert.equal(shareArgs.expiresAt,'2026-10-03T10:00:00.000Z');

let shareCalled=false;
await assert.rejects(
  ()=>createCanonicalQuoteDelivery({
    request:{},
    calculation:{},
    vehicle:{},
    quoteRepository:{},
    envelopeRepository:{},
    createdAt:'2026-09-26T10:00:00.000Z',
    expiresAt:'2026-10-03T10:00:00.000Z',
    persistQuotes:async()=>{
      throw Object.assign(new Error('canonical Quote persistence failed'),{
        code:'QUOTE_REPOSITORY_UNAVAILABLE',
      });
    },
    createShare:async()=>{
      shareCalled=true;
      return {};
    },
  }),
  (error)=>error?.code==='QUOTE_REPOSITORY_UNAVAILABLE'
);
assert.equal(shareCalled,false,'Share Envelope must not be created after Quote persistence failure');

console.log('PASS canonical delivery session: Quote persistence -> Envelope persistence -> public share URL');
