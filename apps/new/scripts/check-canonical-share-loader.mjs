import assert from 'node:assert/strict';
import { createCanonicalShareBundleLoader } from '../src/lib/quote/share-bundle-loader.js';
import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_REPOSITORY_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';
import { buildShareEnvelope } from '../src/lib/quote/share-envelope.js';

const quote={
  contract:'freepass-quote/v2',
  quoteId:'q_loader',
  quoteVersion:1,
  snapshotHash:'a'.repeat(64),
};

const envelope=await buildShareEnvelope({
  quoteRefs:[{
    quoteId:quote.quoteId,
    quoteVersion:quote.quoteVersion,
    snapshotHash:quote.snapshotHash,
  }],
  createdAt:'2026-09-26T09:00:00.000Z',
  expiresAt:'2026-10-03T09:00:00.000Z',
});

let quoteFactoryCalls=0;
let envelopeFactoryCalls=0;

const loader=createCanonicalShareBundleLoader({
  quoteRepositoryFactory:()=>{
    quoteFactoryCalls+=1;
    return {
      contract:QUOTE_REPOSITORY_CONTRACT,
      async get({quoteId,quoteVersion}){
        return {
          contract:QUOTE_READ_RECEIPT_CONTRACT,
          status:'FOUND',
          quoteId,
          quoteVersion,
          snapshotHash:quote.snapshotHash,
          quote,
        };
      },
    };
  },
  envelopeRepositoryFactory:()=>{
    envelopeFactoryCalls+=1;
    return {
      contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
      async get({envelopeId,envelopeVersion}){
        return {
          contract:SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
          status:'FOUND',
          envelopeId,
          envelopeVersion:envelopeVersion??1,
          snapshotHash:envelope.snapshotHash,
          envelope,
        };
      },
    };
  },
  now:()=> '2026-09-26T09:05:00.000Z',
});

assert.equal(loader.contract,'freepass-canonical-share-loader/v1');
assert.equal(quoteFactoryCalls,1);
assert.equal(envelopeFactoryCalls,1);

const result=await loader.load({
  envelopeId:envelope.envelopeId,
  envelopeVersion:1,
});
assert.equal(result.status,'FOUND');
assert.equal(result.quotes[0].quoteId,quote.quoteId);

const suppliedQuoteRepo={
  contract:QUOTE_REPOSITORY_CONTRACT,
  async get({quoteId,quoteVersion}){
    return {
      contract:QUOTE_READ_RECEIPT_CONTRACT,
      status:'FOUND',
      quoteId,quoteVersion,
      snapshotHash:quote.snapshotHash,
      quote,
    };
  },
};
const suppliedEnvelopeRepo={
  contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  async get({envelopeId,envelopeVersion}){
    return {
      contract:SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
      status:'FOUND',
      envelopeId,envelopeVersion:envelopeVersion??1,
      snapshotHash:envelope.snapshotHash,
      envelope,
    };
  },
};

const supplied=createCanonicalShareBundleLoader({
  quoteRepository:suppliedQuoteRepo,
  envelopeRepository:suppliedEnvelopeRepo,
  quoteRepositoryFactory:()=>{throw new Error('factory must not run');},
  envelopeRepositoryFactory:()=>{throw new Error('factory must not run');},
  now:()=> '2026-09-26T09:05:00.000Z',
});
const suppliedResult=await supplied.load({envelopeId:envelope.envelopeId});
assert.equal(suppliedResult.status,'FOUND');

console.log('PASS canonical Share loader: one browser-safe seam for F/U viewer handoff');
