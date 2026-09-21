import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { applySalesMainAxisBridge, resolveBridgeProviderSelection } from '../src/lib/sales-main-axis-bridge.js';

const step=fs.readFileSync('src/components/mobile/StepVehicle.vue','utf8');
const app=fs.readFileSync('src/components/mobile/MobileApp.vue','utf8');
const dbSource=fs.readFileSync('public/sales-welrix-db.js','utf8');
const bridge=JSON.parse(fs.readFileSync('public/data/freepass-newcar/sales-main-axis-bridge.json','utf8'));
const externalAdapter=fs.readFileSync('api/external-quote.js','utf8');

assert.equal(bridge.schema,'freepass-sales-main-axis-bridge/v2');
assert.equal(bridge.stats.provider_trims,443);
assert.equal(bridge.stats.suppressed_provider_axis_rows,131);
assert.ok(bridge.stats.redirect_provider_axis_rows >= 131);

assert.ok(step.includes('const powertrainChoices = computed'),'powertrain choice builder missing');
assert.ok(step.includes("trim._ui_powertrain_group || ''"),'powertrain must use canonical UI group');
assert.ok(step.includes('function selectPowertrain(choice)'),'powertrain selection handler missing');
assert.ok(step.includes("commitSelection('variant:' + choice.key, 'trim')"),'powertrain must advance directly to trim');
assert.ok(!step.includes("subStep === 'spec'"),'separate spec screen must not return');
assert.ok(app.includes("const VEHICLE_SUB_STEPS = ['brand', 'model', 'variant', 'trim', 'colors', 'options'];"),
  'vehicle substeps must not contain separate spec screen');

const ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(dbSource,ctx);
const db=ctx.window.VEHICLE_DB;
let originalTrims=0;
for(const mf of db.manufacturers||[])for(const md of mf.models||[])for(const v of md.variants||[]) originalTrims+=(v.trims||[]).length;
assert.equal(originalTrims,443,'provider source trim count drift');

applySalesMainAxisBridge(db,bridge);

function model(name){
  for(const mf of db.manufacturers||[]){
    const md=(mf.models||[]).find(x=>x.model_name===name);
    if(md)return md;
  }
  throw new Error('model not found: '+name);
}
function variant(modelName,re){
  const v=(model(modelName).variants||[]).find(x=>re.test(x.variant_name));
  if(!v)throw new Error('variant not found: '+modelName+' '+re);
  return v;
}
function groups(v){
  return [...new Set((v.trims||[]).map(t=>t._ui_powertrain_group||''))].sort();
}
function axisOptionNames(v){
  const ids=[...new Set((v.trims||[]).flatMap(t=>t._main_axis_option_ids||[]))];
  return ids.map(id=>v.options_master?.[id]?.name).filter(Boolean);
}
function has(re,arr){return arr.some(x=>re.test(x));}

// Fixed values are not choices: Avante must not expose seat/drive or provider operational groups.
for(const v of model('아반떼').variants||[]){
  assert.deepEqual(groups(v),[''],'Avante fixed/operational group leaked into powertrain');
  assert.ok(!has(/인승|2WD|4WD|AWD|FWD|RWD/i,axisOptionNames(v)),'Avante invented a seat/drive option');
}

// Option axes belong ONLY to Options.
{
  const v=variant('쏘렌토',/가솔린 2\.5/);
  assert.deepEqual(groups(v),[''],'Sorento gas seat/drive option leaked into powertrain');
  const opts=axisOptionNames(v);
  assert.ok(has(/^6인승/,opts),'Sorento 6-seat option missing');
  assert.ok(has(/^7인승/,opts),'Sorento 7-seat option missing');
  assert.ok(has(/4WD|AWD|HTRAC/i,opts),'Sorento 4WD option missing');
}
{
  const v=variant('싼타페',/가솔린 2\.5/);
  assert.deepEqual(groups(v),[''],'Santa Fe seat/drive option leaked into powertrain');
  const opts=axisOptionNames(v);
  assert.ok(has(/^6인승/,opts) && has(/^7인승/,opts),'Santa Fe seat options missing');
  assert.ok(has(/HTRAC|4WD|AWD/i,opts),'Santa Fe HTRAC option missing');
}
{
  const v=variant('K8',/가솔린 3\.5/);
  assert.deepEqual(groups(v),[''],'K8 AWD option leaked into powertrain');
  assert.ok(has(/AWD|4WD/i,axisOptionNames(v)),'K8 AWD option missing');
}

// Real base configuration axes stay at Powertrain; option drive stays in Options.
{
  const v=variant('팰리세이드',/가솔린 2\.5/);
  assert.deepEqual(groups(v),['7인승','9인승'],'Palisade real seat configuration must remain in powertrain');
  assert.ok(has(/HTRAC|4WD|AWD/i,axisOptionNames(v)),'Palisade HTRAC option missing');
}
{
  const v=variant('카니발',/가솔린 3\.5/);
  assert.deepEqual(groups(v),['7인승','9인승'],'Carnival real seat configuration must remain in powertrain');
  assert.ok(!has(/^6인승|^7인승|^9인승/,axisOptionNames(v)),'Carnival base seats were incorrectly converted to options');
}

// Axis options must be first-class Options and must resolve to the matching provider completed row.
{
  const v=variant('쏘렌토',/가솔린 2\.5/);
  const trim=(v.trims||[]).find(t=>t.name==='노블레스' && (t._ui_powertrain_group||'')==='');
  assert.ok(trim,'Sorento canonical base trim missing');
  const axisIds=trim._main_axis_option_ids || [];
  assert.ok(axisIds.length>=3,'Sorento canonical axis options were not injected');
  assert.deepEqual((trim.available_options||[]).slice(0,axisIds.length),axisIds,'configuration options must be first in Options');

  const six=axisIds.find(id=>/^6인승/.test(v.options_master[id]?.name||''));
  const four=axisIds.find(id=>/4WD|AWD|HTRAC/i.test(v.options_master[id]?.name||''));
  assert.ok(six && four,'Sorento seat/drive axis option ids missing');

  const resolved=resolveBridgeProviderSelection(trim,v.options_master,[six,four]);
  assert.ok(resolved?.candidate?.api_model,'Sorento option combination did not resolve to provider row');
  assert.match(resolved.candidate.api_model,/6인승/);
  assert.match(resolved.candidate.api_model,/4WD/);
  const expectedAbsorbed=Math.round((Number(v.options_master[six].price)+Number(v.options_master[four].price))*10000);
  assert.equal(resolved.absorbedWon,expectedAbsorbed,'provider-completed row must absorb seat/drive option price');

  const seatGroup=(v.exclusive_groups||[]).find(g=>g.id.includes('main-axis:seats:') && g.members.includes(six));
  assert.ok(seatGroup && seatGroup.members.length>=2,'seat options must be mutually exclusive');
}

assert.ok(externalAdapter.includes('sales-main-axis-bridge.json'),'main external adapter must load axis bridge');
assert.ok(externalAdapter.includes('by_canonical_product_id'),'main external adapter must resolve bridge by canonical product');
assert.ok(externalAdapter.includes('resolveProviderCandidate(candidates, axes)'),'main external adapter must use canonical resolver for bridged candidates');

// Legacy provider-combination links must redirect to base row + options.
{
  const key='쏘렌토 6인승 2.5 가솔린 터보 4WD 노블레스';
  const r=bridge.redirect_provider_trim_ids?.[key];
  assert.ok(r,'legacy provider redirect missing');
  assert.equal(r.base_provider_trim_id,'쏘렌토 5인승 2.5 가솔린 터보 2WD 노블레스');
  assert.equal(r.axis_option_ids.length,2);
}

console.log(JSON.stringify({
  status:'PASS',
  sourceProviderTrims:originalTrims,
  suppressedProviderAxisRows:bridge.stats.suppressed_provider_axis_rows,
  legacyRedirects:bridge.stats.redirect_provider_axis_rows,
  examples:{
    avante:'engine only',
    sorento:'engine only; seats/4WD in options',
    santafe:'engine only; seats/HTRAC in options',
    k8:'engine only; AWD in options',
    palisade:'7/9 seats in powertrain; HTRAC in options',
    carnival:'7/9 seats in powertrain'
  }
},null,2));
