import assert from 'node:assert/strict';
import { buildShareEnvelope } from '../src/lib/quote/share-envelope.js';
import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';
import {
  buildCanonicalShareUrl,
  classifyPublicShareLink,
  loadPublicShareFromMigratingLink,
} from '../src/lib/quote/share-migration.js';

const envelope=await buildShareEnvelope({
  quoteRefs:[
    {quoteId:'q_36',quoteVersion:1,snapshotHash:'a'.repeat(64)},
    {quoteId:'q_60',quoteVersion:1,snapshotHash:'b'.repeat(64)},
  ],
  createdAt:'2026-09-26T06:00:00.000Z',
  expiresAt:'2026-10-03T06:00:00.000Z',
});

assert.deepEqual(
  classifyPublicShareLink(`?share=${envelope.envelopeId}&shareVersion=1`),
  {kind:'CANONICAL_ENVELOPE',envelopeId:envelope.envelopeId,envelopeVersion:1}
);
assert.deepEqual(
  classifyPublicShareLink('?quote=q_direct&quoteVersion=2'),
  {kind:'DIRECT_QUOTE',quoteId:'q_direct',quoteVersion:2}
);
assert.deepEqual(
  classifyPublicShareLink('?q=legacy123'),
  {kind:'LEGACY',legacyId:'legacy123'}
);
assert.throws(
  ()=>classifyPublicShareLink('?share=se_x&q=legacy123'),
  (error)=>error?.code==='SHARE_LINK_AMBIGUOUS'
);

const url=buildCanonicalShareUrl({
  envelopeId:envelope.envelopeId,
  envelopeVersion:1,
  locationLike:{origin:'https://estimate.example.test',pathname:'/mobile.html'},
});
assert.equal(
  url,
  `https://estimate.example.test/mobile.html?share=${envelope.envelopeId}&shareVersion=1`
);

let legacyCalls=0;
let envelopeReads=0;
const envelopeRepository={
  contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  async get({envelopeId,envelopeVersion}){
    envelopeReads+=1;
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

const canonical=await loadPublicShareFromMigratingLink({
  search:`?share=${envelope.envelopeId}&shareVersion=1`,
  envelopeRepository,
  legacyLoader:async()=>{
    legacyCalls+=1;
    return {legacy:true};
  },
});
assert.equal(canonical.kind,'CANONICAL_ENVELOPE');
assert.equal(canonical.status,'FOUND');
assert.equal(canonical.value.envelopeId,envelope.envelopeId);
assert.equal(envelopeReads,1);
assert.equal(legacyCalls,0);

const missing=await loadPublicShareFromMigratingLink({
  search:'?share=se_missing',
  envelopeRepository:{
    contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
    async get({envelopeId,envelopeVersion}){
      return {
        contract:SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
        status:'NOT_FOUND',
        envelopeId,
        envelopeVersion,
      };
    },
  },
  legacyLoader:async()=>{
    legacyCalls+=1;
    return {legacy:true};
  },
});
assert.equal(missing.status,'NOT_FOUND');
assert.equal(legacyCalls,0,'canonical Envelope NOT_FOUND must never fallback to RTDB');

await assert.rejects(
  ()=>loadPublicShareFromMigratingLink({
    search:'?share=se_down',
    envelopeRepository:{
      contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
      async get(){
        throw Object.assign(new Error('canonical Envelope read failed'),{
          code:'SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE',
        });
      },
    },
    legacyLoader:async()=>{
      legacyCalls+=1;
      return {legacy:true};
    },
  }),
  (error)=>error?.code==='SHARE_ENVELOPE_REPOSITORY_UNAVAILABLE'
);
assert.equal(legacyCalls,0,'canonical Envelope errors must never fallback to RTDB');

const legacy=await loadPublicShareFromMigratingLink({
  search:'?q=legacy123',
  envelopeRepository,
  legacyLoader:async(id)=>{
    legacyCalls+=1;
    return {quote_id:id,legacy:true};
  },
});
assert.equal(legacy.kind,'LEGACY');
assert.equal(legacy.value.quote_id,'legacy123');
assert.equal(legacyCalls,1);

console.log('PASS public share migration: Envelope namespace + legacy compatibility without fallback');
