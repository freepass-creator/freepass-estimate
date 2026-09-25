import assert from 'node:assert/strict';
import {
  FREEPASS_DATA_AUTHORITY,
  legacyMasterIdentityGap,
  masterContextFromCanonical,
  sourceRevisionFromFreePassData,
} from '../src/lib/quote/master-context.js';

const digestA='a'.repeat(64);
const digestB='b'.repeat(64);
const releaseMeta={
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

console.log('PASS FreePass Data master identity/release evidence gate');
