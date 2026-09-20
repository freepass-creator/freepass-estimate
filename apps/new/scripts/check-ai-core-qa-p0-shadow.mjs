import fs from 'node:fs';

const readJson = path => JSON.parse(fs.readFileSync(path,'utf8'));
const read = path => fs.readFileSync(path,'utf8');
const fail = (condition,message) => { if(!condition) throw new Error(message); };

const shadow = readJson('contracts/ai-core/qa-p0.shadow.json');
const manifest = readJson('verification-manifest.json');
const pkg = readJson('package.json');
const workflow = read('../../.github/workflows/newcar-ci.yml');
const contractsSource = read('src/lib/quote/contracts.js');

fail(shadow.core_source.revision === '584026ecaaac40073aeac5a775a5144bf704d0c8','QA_CORE_CANDIDATE_REVISION_DRIFT');
fail(manifest.schema === 'freepass-verification-manifest/v1','ESTIMATE_VERIFICATION_MANIFEST_SCHEMA_DRIFT');
fail(Array.isArray(manifest.contracts) && manifest.contracts.length >= 6,'ESTIMATE_VERIFICATION_CONTRACT_SET_TOO_SMALL');

const seen = new Set();
for(const entry of manifest.contracts){
  fail(typeof entry.export === 'string' && entry.export,'ESTIMATE_CONTRACT_EXPORT_REQUIRED');
  fail(typeof entry.checker === 'string' && entry.checker,'ESTIMATE_CONTRACT_CHECKER_REQUIRED');
  fail(!seen.has(entry.export),'ESTIMATE_CONTRACT_EXPORT_DUPLICATE:'+entry.export);
  seen.add(entry.export);
  fail(contractsSource.includes(`export const ${entry.export}`),'ESTIMATE_CONTRACT_EXPORT_MISSING:'+entry.export);
  fail(fs.existsSync(entry.checker),'ESTIMATE_CONTRACT_CHECKER_FILE_MISSING:'+entry.checker);
  const checker = read(entry.checker);
  fail(checker.includes(entry.export),'ESTIMATE_CONTRACT_CHECKER_BINDING_STALE:'+entry.export);
}

fail(typeof pkg.scripts?.verify === 'string','ESTIMATE_VERIFY_ENTRYPOINT_MISSING');
fail(pkg.scripts.verify.includes('check:verification'),'ESTIMATE_VERIFY_OMITS_VERIFICATION_FRESHNESS');
fail(typeof pkg.scripts?.['check:verification'] === 'string','ESTIMATE_VERIFICATION_SCRIPT_MISSING');
fail(workflow.includes('Verification manifest freshness'),'ESTIMATE_CI_VERIFICATION_STEP_MISSING');
fail(workflow.includes('npm run check:verification'),'ESTIMATE_CI_VERIFICATION_COMMAND_MISSING');
fail(workflow.includes('Release revision proof contract'),'ESTIMATE_RELEASE_PROOF_STEP_MISSING');

const releaseChecker = read('scripts/check-release-proof.mjs');
fail(releaseChecker.includes('/api/version') || releaseChecker.includes('api/version'),'ESTIMATE_RELEASE_REVISION_ENDPOINT_NOT_CHECKED');
fail(releaseChecker.includes('HOLD') || releaseChecker.includes('production'),'ESTIMATE_RELEASE_PROOF_BOUNDARY_MISSING');

console.log(JSON.stringify({
  status:'SHADOW_PARITY',
  projected_contracts:manifest.contracts.length,
  checker_freshness_bound:true,
  unified_verify_bound:true,
  ci_bound:true,
  production_proven:false,
  proof_level:'SYNTHETIC'
},null,2));
