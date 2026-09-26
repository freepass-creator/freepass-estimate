import fs from 'node:fs';
import assert from 'node:assert/strict';

const index = fs.readFileSync('src/lib/quote/index.js', 'utf8');
assert.ok(index.includes("const 캐시허용 = 이름 === '표준'"), 'external quote cache must remain disabled');
assert.ok(index.includes('견적상태.pricingEngine = null'), 'pricing engine evidence must be cleared before/after invalid calculation');

const legacy = fs.readFileSync('quote.js', 'utf8');
assert.ok(legacy.includes('state.quotePricingEngine = 답.pricingEngine || null'), 'legacy runtime must retain engine evidence');
assert.ok(legacy.includes('state.quotePricingEngine = null'), 'legacy runtime must clear stale engine evidence');

const builder = fs.readFileSync('scripts/build-freepass-vehicle-db.mjs', 'utf8');
assert.ok(builder.includes('_source_option_id:rawId'), 'raw option identity must be preserved');
assert.ok(builder.includes('_stable_option_id:'), 'stable option identity must be preserved');
assert.ok(builder.includes('_source_color_code'), 'source color code must be preserved');
assert.ok(builder.includes('_stable_color_id'), 'stable color identity must be preserved');

const mobile = fs.readFileSync('src/components/mobile/StepVehicle.vue', 'utf8');
assert.ok(mobile.includes('stableId: optionsMaster.value[id]?._stable_option_id || null'), 'mobile option selection must carry stable ID');
assert.ok(mobile.includes('colorExtId'), 'mobile exterior selection must carry stable ID');

const web = fs.readFileSync('index.html', 'utf8');
assert.ok(web.includes('stableId: om?.[id]?._stable_option_id || null'), 'web option selection must carry stable ID');
assert.ok(web.includes('colorExtId:'), 'web exterior selection must carry stable ID');

console.log('PASS quote runtime cache/evidence/provenance boundary');
