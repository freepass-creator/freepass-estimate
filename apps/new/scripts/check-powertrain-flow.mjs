import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const step=fs.readFileSync('src/components/mobile/StepVehicle.vue','utf8');
const app=fs.readFileSync('src/components/mobile/MobileApp.vue','utf8');
const dbSource=fs.readFileSync('public/sales-welrix-db.js','utf8');

assert.ok(step.includes('const powertrainChoices = computed'),'combined powertrain choice builder missing');
assert.ok(step.includes('function selectPowertrain(choice)'),'combined powertrain selection handler missing');
assert.ok(step.includes("commitSelection('variant:' + choice.key, 'trim')"),'powertrain must advance directly to trim');
assert.ok(!step.includes("subStep === 'spec'"),'separate spec screen must not return');
assert.ok(!step.includes('function selectSpec('),'separate spec action must not return');
assert.ok(app.includes("const VEHICLE_SUB_STEPS = ['brand', 'model', 'variant', 'trim', 'colors', 'options'];"),
  'vehicle substeps must not contain separate spec screen');
assert.ok(!app.includes("'brand', 'model', 'variant', 'spec', 'trim'"),'legacy spec navigation returned');

const ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(dbSource,ctx);
const db=ctx.window.VEHICLE_DB;
assert.ok(db?.manufacturers?.length,'Sales Welrix DB failed to load');

let trims=0;
let choices=0;
const duplicateLabels=[];
const sample=[];
for(const manufacturer of db.manufacturers||[]){
  for(const model of manufacturer.models||[]){
    const labels=new Set();
    for(const variant of model.variants||[]){
      const available=variant.trims||[];
      trims+=available.length;
      const groups=new Map();
      for(const trim of available){
        const group=trim.group||'';
        if(!groups.has(group)) groups.set(group,[]);
        groups.get(group).push(trim);
      }
      for(const [group,groupTrims] of groups){
        choices++;
        const showGroup=!!group&&group!=='일반';
        const label=[variant.variant_name,showGroup?group:''].filter(Boolean).join(' · ');
        if(labels.has(label)) duplicateLabels.push({brand:manufacturer.manufacturer_name,model:model.model_name,label});
        labels.add(label);
        if(['싼타페','팰리세이드','카니발','GV80'].includes(model.model_name)){
          sample.push({model:model.model_name,label,count:groupTrims.length});
        }
      }
    }
  }
}
assert.equal(trims,443,'combined powertrain flow must preserve all 443 provider trims');
assert.deepEqual(duplicateLabels,[],'combined powertrain labels must be unique within a model');

console.log(JSON.stringify({
  status:'PASS',
  flow:['brand','model','powertrain(engine+seat+drive)','trim','colors','options'],
  trims,
  powertrainChoices:choices,
  duplicateLabels:0,
  samples:sample.slice(0,8)
},null,2));
