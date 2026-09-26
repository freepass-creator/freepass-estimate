import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import {
  verifyFirebaseIdToken,
  decodeFirebaseIdTokenUnverified,
} from '../api/_auth/firebase-id-token.js';
import {
  assertEstimateWriteIdentity,
  authorizeEstimateWriteRequest,
  resolveEstimateWriteAccessPolicy,
} from '../api/_auth/estimate-write-access.js';

const projectId='freepasserp3';
const issuer=`https://securetoken.google.com/${projectId}`;
const nowSeconds=Math.floor(Date.parse('2026-09-26T10:00:00.000Z')/1000);
const nowMs=nowSeconds*1000;

const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const publicPem=publicKey.export({type:'spki',format:'pem'});

function b64json(value){
  return Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
}
function signToken(payload,{kid='test-key'}={}){
  const head=b64json({alg:'RS256',typ:'JWT',kid});
  const body=b64json(payload);
  const signingInput=`${head}.${body}`;
  const signer=createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const sig=signer.sign(privateKey).toString('base64url');
  return `${signingInput}.${sig}`;
}
function payload(overrides={}){
  return {
    aud:projectId,
    iss:issuer,
    sub:'uid_123',
    exp:nowSeconds+3600,
    iat:nowSeconds-60,
    auth_time:nowSeconds-120,
    firebase:{sign_in_provider:'password'},
    ...overrides,
  };
}

const token=signToken(payload());
const decoded=decodeFirebaseIdTokenUnverified(token);
assert.equal(decoded.header.alg,'RS256');
assert.equal(decoded.payload.sub,'uid_123');

const verified=await verifyFirebaseIdToken(token,{
  projectId,
  certs:{'test-key':publicPem},
  nowMs,
});
assert.equal(verified.uid,'uid_123');
assert.equal(verified.isAnonymous,false);
assert.equal(verified.projectId,projectId);

await assert.rejects(
  ()=>verifyFirebaseIdToken(signToken(payload({aud:'other-project'})),{
    projectId,certs:{'test-key':publicPem},nowMs,
  }),
  (error)=>error?.code==='FIREBASE_ID_TOKEN_INVALID'
);

await assert.rejects(
  ()=>verifyFirebaseIdToken(signToken(payload({exp:nowSeconds-100})),{
    projectId,certs:{'test-key':publicPem},nowMs,clockSkewSeconds:0,
  }),
  (error)=>error?.code==='FIREBASE_ID_TOKEN_EXPIRED'
);

const {privateKey:otherPrivate}=generateKeyPairSync('rsa',{modulusLength:2048});
function signWithOtherKey(value){
  const head=b64json({alg:'RS256',typ:'JWT',kid:'test-key'});
  const body=b64json(value);
  const signingInput=`${head}.${body}`;
  const signer=createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(otherPrivate).toString('base64url')}`;
}
await assert.rejects(
  ()=>verifyFirebaseIdToken(signWithOtherKey(payload()),{
    projectId,certs:{'test-key':publicPem},nowMs,
  }),
  (error)=>error?.code==='FIREBASE_ID_TOKEN_INVALID'
);

const defaultPolicy=resolveEstimateWriteAccessPolicy({});
assert.equal(defaultPolicy.serverVerifiedFirebaseIdTokenRequired,true);
assert.equal(defaultPolicy.anonymousWritesAllowed,false);

assert.throws(
  ()=>assertEstimateWriteIdentity({
    uid:'anon_1',
    isAnonymous:true,
    claims:{firebase:{sign_in_provider:'anonymous'}},
  },defaultPolicy),
  (error)=>error?.code==='ESTIMATE_WRITE_ANONYMOUS_FORBIDDEN'
);

const anonAllowed=resolveEstimateWriteAccessPolicy({
  FREEPASS_ESTIMATE_ALLOW_ANONYMOUS_WRITES:'true',
});
const anonIdentity=assertEstimateWriteIdentity({
  uid:'anon_1',
  isAnonymous:true,
  claims:{firebase:{sign_in_provider:'anonymous'}},
},anonAllowed);
assert.equal(anonIdentity.anonymous,true);

const rolePolicy=resolveEstimateWriteAccessPolicy({
  FREEPASS_ESTIMATE_REQUIRED_WRITE_ROLES:'staff,admin',
});
assert.throws(
  ()=>assertEstimateWriteIdentity({
    uid:'user_1',
    isAnonymous:false,
    claims:{role:'viewer'},
  },rolePolicy),
  (error)=>error?.code==='ESTIMATE_WRITE_ROLE_FORBIDDEN'
);
assert.equal(
  assertEstimateWriteIdentity({
    uid:'staff_1',
    isAnonymous:false,
    claims:{role:'staff'},
  },rolePolicy).role,
  'staff'
);

let verifyCalls=0;
const authorized=await authorizeEstimateWriteRequest(
  {headers:{authorization:'Bearer test'}},
  {
    env:{
      FREEPASS_FIREBASE_PROJECT_ID:projectId,
      FREEPASS_ESTIMATE_REQUIRED_WRITE_ROLES:'staff',
    },
    verifyRequest:async(_req,options)=>{
      verifyCalls+=1;
      assert.equal(options.projectId,projectId);
      return {uid:'staff_1',isAnonymous:false,claims:{role:'staff'}};
    },
  }
);
assert.equal(verifyCalls,1);
assert.equal(authorized.uid,'staff_1');

console.log('PASS canonical write auth: signed Firebase identity + anonymous/role authorization policy');
