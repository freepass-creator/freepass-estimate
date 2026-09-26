import assert from 'node:assert/strict';
import {
  FREEPASS_DATA_AUTHORITY,
  legacyMasterIdentityGap,
  masterContextFromCanonical,
  masterContextFromEstimateMasterRecord,
  resolveMasterOptions,
  sourceRevisionFromFreePassData,
} from '../src/lib/quote/master-context.js';

const digestA='a'.repeat(64);
const digestB='b'.repeat(64);
const releaseMeta={
  contract:'estimate-newcar-master/v1',
  projectionId:'estimate-newcar-master',
  schemaVersion:'1.0.0',
  authority:FREEPASS_DATA_AUTHORITY,
  releaseId:'rel_20260925_001',
  manifestId:'manifest_001',
  revision:42,
  inputDigest:digestA,
  dataDigest:digestB,
  generatedAt:'2026-09-25T07:00:00.000Z',
  activatedAt:'2026-09-25T07:01:00.000Z',
};

const evidence=sourceRevisionFromFreePassData(releaseMeta);
assert.equal(evidence.sourceRevision,'freepass-data/rel_20260925_001@r42');
assert.equal(evidence.sourceEvidence.dataDigest,digestB);

const canonical={
  candidate:{
    vehicle_model_id:'vm_001',
    model_year_id:'my_2026',
    trim_id:'trim_001',
    powertrain_id:'pt_hev',
  },
};
const context=masterContextFromCanonical({
  canonical,
  exteriorColor:{id:'ext_white'},
  interiorColor:{id:'int_black'},
  releaseMeta,
});
assert.equal(context.vehicleModelId,'vm_001');
assert.equal(context.modelYearId,'my_2026');
assert.equal(context.sourceRevision,evidence.sourceRevision);

const legacyCandidate={
  master_id:'master.123',
  powertrain_seq:2,
  trim_seq:5,
  trim_row_key:'legacy-row-key',
};
assert.deepEqual(
  legacyMasterIdentityGap(legacyCandidate),
  ['vehicleModelId','modelYearId','trimId','powertrainId'],
  'legacy labels/sequences must not be promoted into stable Quote IDs'
);
assert.throws(
  ()=>masterContextFromCanonical({
    canonical:{candidate:legacyCandidate},
    exteriorColor:{id:'ext_white'},
    interiorColor:{id:'int_black'},
    releaseMeta,
  }),
  /vehicleModelId is required/
);

assert.throws(
  ()=>sourceRevisionFromFreePassData({...releaseMeta,authority:'STATIC_SNAPSHOT'}),
  /CANONICAL_ACTIVE/
);
assert.throws(
  ()=>sourceRevisionFromFreePassData({...releaseMeta,dataDigest:'not-a-digest'}),
  /digests are invalid/
);

const record={
  productId:'prod_1',
  vehicleModelId:'vm_001',
  modelYearId:'my_2026',
  trimId:'trim_001',
  powertrainId:'pt_hev',
  modelYear:2026,
  status:'ACTIVE',
  holdReasons:[],
  basePrice:{amount:30000000,currency:'KRW'},
  options:[
    {optionId:'opt_base',name:'베이스',price:{amount:100000,currency:'KRW'},requires:[],excludes:[]},
    {optionId:'opt_plus',name:'플러스',price:{amount:200000,currency:'KRW'},requires:['opt_base'],excludes:[],exclusiveGroupId:'g1'},
    {optionId:'opt_other',name:'기타',price:{amount:300000,currency:'KRW'},requires:[],excludes:['opt_plus'],exclusiveGroupId:'g1'},
  ],
  exteriorColors:[{colorId:'ext_white',name:'화이트',price:{amount:80000,currency:'KRW'}}],
  interiorColors:[{colorId:'int_black',name:'블랙',price:{amount:0,currency:'KRW'}}],
};
assert.throws(()=>resolveMasterOptions(record,['opt_plus']),/requires opt_base/);
assert.throws(()=>resolveMasterOptions(record,['opt_base','opt_plus','opt_other']),/excludes|mutually exclusive/);

const master=masterContextFromEstimateMasterRecord({
  record,
  selectedOptionIds:['opt_base','opt_plus'],
  exteriorColorId:'ext_white',
  interiorColorId:'int_black',
  releaseMeta,
});
assert.deepEqual(master.quoteSnapshot.selectedOptionIds,['opt_base','opt_plus']);
assert.equal(master.quoteSnapshot.vehiclePriceSnapshot.basePrice,30000000);
assert.equal(master.quoteSnapshot.vehiclePriceSnapshot.exteriorColorPrice,80000);
assert.equal(master.sourceRevision,evidence.sourceRevision);

assert.throws(()=>masterContextFromEstimateMasterRecord({
  record:{...record,status:'HOLD',holdReasons:['MODEL_YEAR_UNVERIFIED']},
  selectedOptionIds:[],
  exteriorColorId:'ext_white',
  interiorColorId:'int_black',
  releaseMeta,
}),/HOLD/);

console.log('PASS FreePass Data master identity/release evidence gate');
