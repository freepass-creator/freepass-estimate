import assert from 'node:assert/strict';
import { buildShareEnvelope } from '../src/lib/quote/share-envelope.js';
import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
  persistShareEnvelope,
  readShareEnvelope,
  shareEnvelopeIdempotencyKey,
} from '../src/lib/quote/share-envelope-repository.js';
import { createFreePassDataShareEnvelopeRepository } from '../src/lib/quote/repositories/freepass-data-share-envelope.js';
import {
  forwardShareEnvelopeCommand,
  resolveShareEnvelopeWriteConfig,
} from '../api/share-envelopes.js';
import {
  fetchShareEnvelopeReceipt,
  resolveShareEnvelopeReadConfig,
} from '../api/share-envelope.js';

const token='x'.repeat(40);
const envelope=await buildShareEnvelope({
  quoteRefs:[
    {quoteId:'q_36',quoteVersion:1,snapshotHash:'a'.repeat(64)},
    {quoteId:'q_60',quoteVersion:1,snapshotHash:'b'.repeat(64)},
  ],
  createdAt:'2026-09-26T06:00:00.000Z',
  expiresAt:'2026-10-03T06:00:00.000Z',
});
const key=shareEnvelopeIdempotencyKey(envelope);

let stored=null;
const memory={
  contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  async put({envelope:value,idempotencyKey}){
    const exists=stored!=null;
    if(!exists) stored=value;
    return {
      contract:SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
      status:exists?'EXISTING':'CREATED',
      envelopeId:value.envelopeId,
      envelopeVersion:value.envelopeVersion,
      snapshotHash:value.snapshotHash,
      idempotencyKey,
    };
  },
  async get({envelopeId,envelopeVersion}){
    if(!stored||stored.envelopeId!==envelopeId||(envelopeVersion!=null&&stored.envelopeVersion!==envelopeVersion)){
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
      envelopeId:stored.envelopeId,
      envelopeVersion:stored.envelopeVersion,
      snapshotHash:stored.snapshotHash,
      envelope:stored,
    };
  },
};

const first=await persistShareEnvelope(memory,envelope);
assert.equal(first.status,'CREATED');
const second=await persistShareEnvelope(memory,envelope);
assert.equal(second.status,'EXISTING');
const loaded=await readShareEnvelope(memory,{envelopeId:envelope.envelopeId,envelopeVersion:1});
assert.equal(loaded.snapshotHash,envelope.snapshotHash);

await assert.rejects(
  ()=>persistShareEnvelope(memory,{...envelope,expiresAt:'2026-10-04T06:00:00.000Z'}),
  (error)=>error?.code==='SHARE_ENVELOPE_INTEGRITY_MISMATCH'
);

assert.throws(
  ()=>resolveShareEnvelopeWriteConfig({NODE_ENV:'production'}),
  /not configured/
);
assert.throws(
  ()=>resolveShareEnvelopeReadConfig({NODE_ENV:'production'}),
  /not configured/
);

const writeCfg=resolveShareEnvelopeWriteConfig({
  NODE_ENV:'production',
  FREEPASS_DATA_CONSUMER_BASE_URL:'https://data.example.test/',
  FREEPASS_DATA_ESTIMATE_TOKEN:token,
});
assert.equal(writeCfg.url,'https://data.example.test/v1/commands/freepass-estimate/share-envelopes');

const readCfg=resolveShareEnvelopeReadConfig({
  NODE_ENV:'production',
  FREEPASS_DATA_CONSUMER_BASE_URL:'https://data.example.test/',
  FREEPASS_DATA_ESTIMATE_TOKEN:token,
});
assert.equal(readCfg.url,'https://data.example.test/v1/consumers/freepass-estimate/share-envelopes');

const expectedWriteReceipt={
  contract:SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
  status:'CREATED',
  envelopeId:envelope.envelopeId,
  envelopeVersion:envelope.envelopeVersion,
  snapshotHash:envelope.snapshotHash,
  idempotencyKey:key,
};

let writeCaptured=null;
const forwarded=await forwardShareEnvelopeCommand({
  body:{
    command:'PUT_SHARE_ENVELOPE',
    contract:SHARE_ENVELOPE_REPOSITORY_CONTRACT,
    idempotencyKey:key,
    envelope,
  },
  requestIdempotencyKey:key,
  env:{
    NODE_ENV:'production',
    FREEPASS_DATA_SHARE_ENVELOPE_COMMAND_URL:'https://data.example.test/envelopes',
    FREEPASS_DATA_ESTIMATE_TOKEN:token,
  },
  fetchImpl:async(url,init)=>{
    writeCaptured={url,init};
    return {ok:true,status:200,json:async()=>expectedWriteReceipt};
  },
});
assert.equal(forwarded.envelopeId,envelope.envelopeId);
assert.equal(writeCaptured.init.headers.authorization,`Bearer ${token}`);

const expectedReadReceipt={
  contract:SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  status:'FOUND',
  envelopeId:envelope.envelopeId,
  envelopeVersion:envelope.envelopeVersion,
  snapshotHash:envelope.snapshotHash,
  envelope,
};

let readCaptured=null;
const fetched=await fetchShareEnvelopeReceipt({
  envelopeId:envelope.envelopeId,
  envelopeVersion:1,
  env:{
    NODE_ENV:'production',
    FREEPASS_DATA_SHARE_ENVELOPE_READ_BASE_URL:'https://data.example.test/envelopes',
    FREEPASS_DATA_ESTIMATE_TOKEN:token,
  },
  fetchImpl:async(url,init)=>{
    readCaptured={url,init};
    return {ok:true,status:200,json:async()=>expectedReadReceipt};
  },
});
assert.equal(fetched.status,'FOUND');
assert.equal(readCaptured.init.headers.authorization,`Bearer ${token}`);
assert.ok(readCaptured.url.includes(encodeURIComponent(envelope.envelopeId)));

const missing=await fetchShareEnvelopeReceipt({
  envelopeId:'se_missing',
  env:{
    NODE_ENV:'production',
    FREEPASS_DATA_SHARE_ENVELOPE_READ_BASE_URL:'https://data.example.test/envelopes',
    FREEPASS_DATA_ESTIMATE_TOKEN:token,
  },
  fetchImpl:async()=>({ok:false,status:404,json:async()=>({code:'NOT_FOUND'})}),
});
assert.equal(missing.status,'NOT_FOUND');

let browserWrites=0;
let browserReads=0;
const browserRepo=createFreePassDataShareEnvelopeRepository({
  fetchImpl:async(url,init)=>{
    if(init?.method==='POST'){
      browserWrites+=1;
      return {ok:true,status:200,json:async()=>expectedWriteReceipt};
    }
    browserReads+=1;
    return {ok:true,status:200,json:async()=>expectedReadReceipt};
  },
});
await persistShareEnvelope(browserRepo,envelope);
await readShareEnvelope(browserRepo,{envelopeId:envelope.envelopeId,envelopeVersion:1});
assert.equal(browserWrites,1);
assert.equal(browserReads,1);

console.log('PASS Share Envelope persistence: immutable hash + write/read receipts + server-only Data token');
