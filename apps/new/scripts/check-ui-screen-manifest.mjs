import fs from 'node:fs';
import assert from 'node:assert/strict';

const m=JSON.parse(fs.readFileSync('../../.ai-core/screens/self-quote.json','utf8'));
assert.equal(m.contract,'ai-core-ui-screen-manifest/v1');
assert.match(m.version,/^1\.\d+\.\d+$/);
assert.match(m.screen_id,/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
assert.equal(m.product_profile,'freepass-product-ui/v1');
for(const id of ['navigation.header','navigation.stepper','navigation.bottom-action','data.card','system.responsive','system.focus']){
  assert.ok(m.feature_ids.includes(id),'Self Quote missing '+id);
}
for(const x of m.contracts.data_api) assert.ok(x.startsWith('C:'));
for(const x of m.contracts.workflow) assert.ok(x.startsWith('D:'));
for(const k of ['viewports','states','input_modes','locales']) assert.ok(Array.isArray(m.verification[k])&&m.verification[k].length>0,k);

const app=fs.readFileSync('src/components/mobile/MobileApp.vue','utf8');
const step=fs.readFileSync('src/components/mobile/StepVehicle.vue','utf8');
for(const marker of ['ui-header','ui-stepper','ui-bottom-action']) assert.ok(app.includes(marker),'Self Quote DOM missing '+marker);
for(const marker of ['sv-brand-card ui-card','sv-row ui-card','sv-trim-card ui-card']) assert.ok(step.includes(marker),'Self Quote card mapping missing '+marker);

console.log(JSON.stringify({status:'PASS',screen:m.screen_id,profile:m.product_profile},null,2));
