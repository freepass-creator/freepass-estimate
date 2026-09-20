import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const profile=JSON.parse(read('../../.ai-core/freepass-product-ui.json'));
const tokens=read('src/styles/tokens.css');
const step=read('src/components/mobile/StepVehicle.vue');
const app=read('src/components/mobile/MobileApp.vue');
const haptics=read('src/lib/haptics.js');
const html=read('mobile.html');

assert.equal(profile.contract,'freepass-product-ui-profile-binding/v1');
assert.equal(profile.version,'1.0.0');
assert.equal(profile.ai_core.revision,'01e6bb7e0cd08e6390b452892516fd204ed64090');
assert.ok(profile.surfaces.includes('self-quote'));

for(const marker of [
  '--brand:      #1b2a4a',
  '--brand-700:  #0f1b35',
  '--brand-50:   #e6ecf5',
  '--ink-1: #212529',
  '--ink-2: #5c6268',
  '--line:  #eceef0',
  '--r-card: 12px',
  '--r-chip: 10px'
]) assert.ok(tokens.includes(marker),'Self Quote token drift: '+marker);

assert.ok(step.includes("? 0 : 160"),'Single-choice commit must be 160ms');
assert.ok(tokens.includes('fp-step-in 160ms'),'Step entry must be 160ms');
assert.ok(tokens.includes('scale(.965)'),'Pressed depth must match FreePass profile');
for(const marker of ['subtle: 7','selection: 12','primary: 18','72 - elapsed',"addEventListener('pointerdown'"]){
  assert.ok(haptics.includes(marker),'Self Quote haptic drift: '+marker);
}
assert.ok(app.includes('overflow-y: auto'),'Self Quote must keep one bounded vertical scroll owner');
assert.ok(app.includes('touch-action: pan-y'),'Self Quote touch scroll contract missing');
assert.ok(html.includes('height: 100dvh'),'Self Quote dynamic viewport contract missing');

for (const marker of ['ui-header','ui-stepper','ui-bottom-action','ui-button primary','ui-button secondary']) {
  assert.ok(app.includes(marker),'Self Quote AI Core shell semantic missing: ' + marker);
}
for (const marker of ['sv-brand-card ui-card','sv-row ui-card','sv-trim-card ui-card','sv-opt ui-card','sv-color-card ui-card']) {
  assert.ok(step.includes(marker),'Self Quote AI Core card semantic missing: ' + marker);
}

console.log(JSON.stringify({
 status:'PASS',
 profile:profile.version,
 aiCoreRevision:profile.ai_core.revision,
 surface:'self-quote',
 choiceCommitMs:160,
 stepEntryMs:160,
 hapticsMs:profile.interaction.hapticsMs
},null,2));
