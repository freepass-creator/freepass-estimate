import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const root = path.resolve(process.cwd(), '..', '..');
const manifestPath = path.join(process.cwd(), 'api/_standard/pricing-engine-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.contract, 'freepass-pricing-engine-manifest/v1');
assert.equal(manifest.engine_id, 'freepass-standard-newcar');
assert.match(String(manifest.algorithm_version || ''), /^\d+\.\d+\.\d+$/);
assert.match(String(manifest.source_digest || ''), /^[a-f0-9]{64}$/);
assert.match(String(manifest.policy_digest || ''), /^[a-f0-9]{64}$/);

function digest(files) {
  const hash = crypto.createHash('sha256');
  for (const logicalPath of files) {
    const abs = path.join(root, logicalPath);
    assert.ok(fs.existsSync(abs), `engine manifest file missing: ${logicalPath}`);
    hash.update(logicalPath + '\n');
    hash.update(fs.readFileSync(abs, 'utf8'));
    hash.update('\n');
  }
  return hash.digest('hex');
}

const sourceDigest = digest(manifest.source_files || []);
const policyDigest = digest(manifest.policy_files || []);
assert.equal(sourceDigest, manifest.source_digest, 'Standard engine source digest drift — bump/reseal engine manifest');
assert.equal(policyDigest, manifest.policy_digest, 'Standard engine policy digest drift — bump/reseal engine manifest');

const expectedVersion =
  `${manifest.engine_id.replace('freepass-standard-newcar','freepass-standard/newcar')}@${manifest.algorithm_version}` +
  `+src.${sourceDigest.slice(0,12)}.policy.${policyDigest.slice(0,12)}`;
assert.equal(manifest.version, expectedVersion, 'Standard pricing engine version string must derive from manifest digests');

console.log('PASS Standard pricing engine source/policy manifest', manifest.version);
