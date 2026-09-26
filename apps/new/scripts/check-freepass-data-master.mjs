import assert from 'node:assert/strict';
import {
  assertMasterResponse,
  fetchFreePassDataMaster,
  resolveFreePassDataMasterConfig,
} from '../api/freepass-data-master.js';
import {
  getActiveEstimateMasterRecord,
  loadEstimateNewcarMaster,
  normalizeEstimateMasterResponse,
} from '../src/lib/master/freepass-data-master.js';

const token='x'.repeat(40);
const meta={
  contract:'estimate-newcar-master/v1',
  projectionId:'estimate-newcar-master',
  schemaVersion:'1.0.0',
  authority:'CANONICAL_ACTIVE',
  releaseId:'rel_estimate-master-001',
  manifestId:'manifest_estimate-master-001',
  revision:12,
  inputDigest:'a'.repeat(64),
  dataDigest:'b'.repeat(64),
  generatedAt:'2026-09-25T08:00:00.000Z',
  activatedAt:'2026-09-25T08:01:00.000Z',
};
const record={
  productId:'prod_1',
  vehicleModelId:'vm_1',
  modelYearId:'my_2026',
  trimId:'trim_1',
  powertrainId:'pt_1',
  modelYear:2026,
  status:'ACTIVE',
  holdReasons:[],
  options:[],
  exteriorColors:[{colorId:'ext_1',name:'화이트',price:{amount:0,currency:'KRW'}}],
  interiorColors:[{colorId:'int_1',name:'블랙',price:{amount:0,currency:'KRW'}}],
};
const payload={data:[record],meta};

assert.throws(
  ()=>resolveFreePassDataMasterConfig({NODE_ENV:'production'}),
  /not configured/
);
assert.throws(
  ()=>resolveFreePassDataMasterConfig({
    NODE_ENV:'production',
    FREEPASS_DATA_CONSUMER_BASE_URL:'http://data.internal',
    FREEPASS_DATA_ESTIMATE_TOKEN:token,
  }),
  /HTTPS/
);

const cfg=resolveFreePassDataMasterConfig({
  NODE_ENV:'production',
  FREEPASS_DATA_CONSUMER_BASE_URL:'https://data.example.test/',
  FREEPASS_DATA_ESTIMATE_TOKEN:token,
});
assert.equal(cfg.url,'https://data.example.test/v1/consumers/freepass-estimate/estimate-newcar-master');
assert.equal(cfg.token,token);

let captured=null;
const serverResult=await fetchFreePassDataMaster({
  env:{
    NODE_ENV:'production',
    FREEPASS_DATA_CONSUMER_BASE_URL:'https://data.example.test',
    FREEPASS_DATA_ESTIMATE_TOKEN:token,
  },
  fetchImpl:async (url,init)=>{
    captured={url,init};
    return {ok:true,status:200,json:async()=>payload};
  },
});
assert.equal(serverResult.meta.releaseId,meta.releaseId);
assert.equal(captured.init.headers.authorization,`Bearer ${token}`);
assert.ok(!JSON.stringify(serverResult).includes(token),'service token must never be returned in payload');

assert.throws(
  ()=>assertMasterResponse({data:[record],meta:{...meta,authority:'STATIC'}}),
  /contract\/evidence mismatch/
);

const browserPayload={ok:true,...payload};
const normalized=normalizeEstimateMasterResponse(browserPayload);
assert.equal(normalized.byProductId.get('prod_1').trimId,'trim_1');
assert.equal(getActiveEstimateMasterRecord(normalized,'prod_1').status,'ACTIVE');

await assert.rejects(
  ()=>loadEstimateNewcarMaster({
    fetchImpl:async()=>({ok:false,status:503,json:async()=>({code:'NO_ACTIVE_RELEASE',error:'no release'})}),
  }),
  /no release/
);

const loaded=await loadEstimateNewcarMaster({
  fetchImpl:async (url,init)=>{
    assert.equal(url,'/api/freepass-data-master');
    assert.equal(init.method,'GET');
    assert.equal(init.headers.authorization,undefined,'browser must not send FreePass Data service token');
    return {ok:true,status:200,json:async()=>browserPayload};
  },
});
assert.equal(loaded.meta.dataDigest,meta.dataDigest);

assert.throws(
  ()=>normalizeEstimateMasterResponse({ok:true,data:[record,{...record}],meta}),
  /duplicate Estimate master productId/
);
const holdRecord={
  ...record,
  vehicleModelId:null,
  modelYearId:null,
  trimId:null,
  powertrainId:null,
  modelYear:null,
  status:'HOLD',
  holdReasons:['MODEL_YEAR_UNVERIFIED','STABLE_ID_UNVERIFIED'],
};
const holdMaster=normalizeEstimateMasterResponse({ok:true,data:[holdRecord],meta});
assert.equal(holdMaster.byProductId.get('prod_1').modelYearId,null);
assert.throws(()=>getActiveEstimateMasterRecord(holdMaster,'prod_1'),/HOLD/);

console.log('PASS FreePass Data Estimate master proxy/client security boundary');
