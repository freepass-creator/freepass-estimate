import assert from 'node:assert/strict';
import fs from 'node:fs';

const builder = fs.readFileSync('scripts/build-freepass-vehicle-db.mjs', 'utf8');
assert.ok(!/year\s*:\s*2026/.test(builder), 'Estimate DB builder must not hardcode model year 2026');
assert.ok(/year\s*:\s*null/.test(builder), 'legacy UI DB must keep model year unknown until FreePass Data supplies authority');

for (const file of [
  'src/components/VehicleCascade.vue',
  'src/components/mobile/StepVehicle.vue',
  'src/store.js',
  'src/vehicles.js',
  'src/components/home/VehicleIndex.vue',
]) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(!/\.year\b/.test(text), `${file} unexpectedly depends on legacy model.year`);
}

console.log('PASS no fabricated model year in Estimate legacy DB builder');
