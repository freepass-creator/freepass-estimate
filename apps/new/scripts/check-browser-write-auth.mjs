import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  createFirebaseAuthenticatedQuoteRepository,
  createFirebaseAuthenticatedShareEnvelopeRepository,
} from '../src/lib/quote/repositories/firebase-authenticated.js';
import {
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import {
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';

let quoteAuthHeader=null;
let quoteProviderCalls=0;
const quoteRepo=createFirebaseAuthenticatedQuoteRepository({
  authTokenProvider:async()=>{
    quoteProviderCalls+=1;
    return 'firebase-id-token';
  },
  fetchImpl:async(_url,init)=>{
    quoteAuthHeader=init.headers.authorization;
    const posted=JSON.parse(init.body);
    return {
      ok:true,
      status:200,
      json:async()=>({
        contract:QUOTE_WRITE_RECEIPT_CONTRACT,
        status:'CREATED',
        quoteId:posted.quote.quoteId,
        quoteVersion:posted.quote.quoteVersion,
        snapshotHash:posted.quote.snapshotHash,
        idempotencyKey:posted.idempotencyKey,
      }),
    };
  },
});

const quote={
  contract:'freepass-quote/v2',
  quoteId:'q_auth',
  quoteVersion:1,
  snapshotHash:'a'.repeat(64),
};
await quoteRepo.put({
  quote,
  idempotencyKey:`${quote.quoteId}:v1:${quote.snapshotHash}`,
});
assert.equal(quoteProviderCalls,1);
assert.equal(quoteAuthHeader,'Bearer firebase-id-token');

let envelopeAuthHeader=null;
let envelopeProviderCalls=0;
const envelopeRepo=createFirebaseAuthenticatedShareEnvelopeRepository({
  authTokenProvider:async()=>{
    envelopeProviderCalls+=1;
    return 'firebase-id-token-2';
  },
  fetchImpl:async(_url,init)=>{
    envelopeAuthHeader=init.headers.authorization;
    const posted=JSON.parse(init.body);
    return {
      ok:true,
      status:200,
      json:async()=>({
        contract:SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
        status:'CREATED',
        envelopeId:posted.envelope.envelopeId,
        envelopeVersion:posted.envelope.envelopeVersion,
        snapshotHash:posted.envelope.snapshotHash,
        idempotencyKey:posted.idempotencyKey,
      }),
    };
  },
});

const envelope={
  contract:'freepass-share-envelope/v1',
  envelopeId:'se_auth',
  envelopeVersion:1,
  snapshotHash:'b'.repeat(64),
};
await envelopeRepo.put({
  envelope,
  idempotencyKey:`${envelope.envelopeId}:v1:${envelope.snapshotHash}`,
});
assert.equal(envelopeProviderCalls,1);
assert.equal(envelopeAuthHeader,'Bearer firebase-id-token-2');

const tokenSource=fs.readFileSync('src/firebase/id-token.js','utf8');
assert.ok(tokenSource.includes('await waitAuth()'),'caller token helper must wait for Firebase auth');
assert.ok(tokenSource.includes('getIdToken(user, forceRefresh)'),'caller token helper must use Firebase ID token');

console.log('PASS browser canonical write auth: Firebase caller ID token injected per request');
