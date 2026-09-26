import assert from 'node:assert/strict';
import { createFirebaseCanonicalQuoteDelivery } from '../src/lib/quote/firebase-canonical-delivery.js';

let quoteFactoryCalls=0;
let envelopeFactoryCalls=0;
let deliveryArgs=null;

const result=await createFirebaseCanonicalQuoteDelivery({
  request:{r:true},
  calculation:{c:true},
  vehicle:{v:true},
  createdAt:'2026-09-26T10:30:00.000Z',
  expiresAt:'2026-10-03T10:30:00.000Z',
  quoteRepositoryFactory:()=>{
    quoteFactoryCalls+=1;
    return {kind:'quote-repo'};
  },
  envelopeRepositoryFactory:()=>{
    envelopeFactoryCalls+=1;
    return {kind:'envelope-repo'};
  },
  delivery:async(args)=>{
    deliveryArgs=args;
    return {
      contract:'freepass-canonical-quote-delivery/v1',
      url:'https://estimate.example.test/?share=se_facade',
    };
  },
});

assert.equal(quoteFactoryCalls,1);
assert.equal(envelopeFactoryCalls,1);
assert.equal(deliveryArgs.quoteRepository.kind,'quote-repo');
assert.equal(deliveryArgs.envelopeRepository.kind,'envelope-repo');
assert.equal(deliveryArgs.request.r,true);
assert.equal(result.url,'https://estimate.example.test/?share=se_facade');

let badFactoryCalled=false;
await assert.rejects(
  ()=>createFirebaseCanonicalQuoteDelivery({
    quoteRepository:{kind:'supplied-quote'},
    envelopeRepository:{kind:'supplied-envelope'},
    quoteRepositoryFactory:()=>{
      badFactoryCalled=true;
      throw new Error('must not call');
    },
    envelopeRepositoryFactory:()=>{
      badFactoryCalled=true;
      throw new Error('must not call');
    },
    delivery:async(args)=>{
      assert.equal(args.quoteRepository.kind,'supplied-quote');
      assert.equal(args.envelopeRepository.kind,'supplied-envelope');
      throw Object.assign(new Error('downstream failed'),{code:'DOWNSTREAM_FAILED'});
    },
  }),
  (error)=>error?.code==='DOWNSTREAM_FAILED'
);
assert.equal(badFactoryCalled,false);

console.log('PASS Firebase canonical delivery facade: one F/UI call, Integration owns auth/repository wiring');
