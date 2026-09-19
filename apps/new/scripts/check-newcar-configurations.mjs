import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {
  resolveCanonicalIdentity,
  configurationAxes,
  driveClass,
} from '../src/lib/newcar/configuration-resolver.js';

const ctx={window:{},console:{log(){},warn(){},error(){}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/vehicle-db.js','utf8'),ctx);
const db=ctx.window.VEHICLE_DB;

function findTrim(id){
  for(const mf of db.manufacturers||[])for(const md of mf.models||[])for(const v of md.variants||[]){
    const t=(v.trims||[]).find(x=>x.trim_id===id);
    if(t)return{mf,md,v,t};
  }
  throw new Error('trim not found: '+id);
}
function optionId(v,t,re){
  const id=(t.available_options||[]).find(id=>re.test(String(v.options_master?.[id]?.name||'')));
  assert.ok(id,`option ${re} not found for ${t.trim_id}`);
  return id;
}
function resolved(id,selected=[]){
  const {v,t}=findTrim(id);
  const r=resolveCanonicalIdentity(t,v.options_master||{},selected);
  assert.ok(r?.candidate,`canonical unresolved: ${id} selected=${selected.join(',')}`);
  return{...r,v,t};
}

// 레이 일반은 밴이 아닌 5인승 승용으로 떨어져야 한다.
{
  const r=resolved('kia_ray_가솔린1.0_트렌디');
  assert.equal(Number(r.candidate.seats),5);
  assert.ok(!/밴/.test(String(r.candidate.body_configuration||'')));
  console.log('PASS ray passenger ->',r.candidate.trim_row_key);
}

// 레이 2인승 밴은 같은 트림명이더라도 2인승 밴 원자여야 한다.
{
  const r=resolved('kia_ray_가솔린1.0_트렌디2인승밴');
  assert.equal(Number(r.candidate.seats),2);
  console.log('PASS ray 2-seat van ->',r.candidate.trim_row_key);
}

// 쏘렌토: 기본은 5인승·비 AWD, 옵션으로 6인승/4WD를 고르면 원자축도 같이 이동해야 한다.
{
  const {v,t}=findTrim('kia_sorento_가솔린2.5터보_노블레스');
  const base=resolveCanonicalIdentity(t,v.options_master||{},[]);
  assert.ok(base?.candidate,'sorento base unresolved');
  assert.equal(Number(base.candidate.seats),5);
  assert.notEqual(driveClass(base.candidate.drivetrain),'all');

  const seat6=optionId(v,t,/^6인승/);
  const awd=optionId(v,t,/^(?:전자식\s*)?(?:4WD|AWD)|^HTRAC/i);

  const six=resolveCanonicalIdentity(t,v.options_master||{},[seat6]);
  assert.ok(six?.candidate,'sorento 6-seat unresolved');
  assert.equal(Number(six.candidate.seats),6);

  const sixAwd=resolveCanonicalIdentity(t,v.options_master||{},[seat6,awd]);
  assert.ok(sixAwd?.candidate,'sorento 6-seat AWD unresolved');
  assert.equal(Number(sixAwd.candidate.seats),6);
  assert.equal(driveClass(sixAwd.candidate.drivetrain),'all');

  console.log('PASS sorento config axes ->',base.candidate.trim_row_key,'=>',sixAwd.candidate.trim_row_key);
}

// K8 3.5: AWD가 옵션인 트림은 선택 전/후 구동 원자가 달라야 한다.
{
  const {v,t}=findTrim('kia_k8_가솔린3.5_노블레스');
  const awd=optionId(v,t,/^AWD\b|^4WD\b/i);
  const base=resolveCanonicalIdentity(t,v.options_master||{},[]);
  const four=resolveCanonicalIdentity(t,v.options_master||{},[awd]);
  assert.ok(base?.candidate,'K8 base unresolved');
  assert.ok(four?.candidate,'K8 AWD unresolved');
  assert.notEqual(driveClass(base.candidate.drivetrain),'all');
  assert.equal(driveClass(four.candidate.drivetrain),'all');
  console.log('PASS K8 AWD axis ->',base.candidate.trim_row_key,'=>',four.candidate.trim_row_key);
}

// 전 트림: 포함옵션은 available_options에 다시 나타나면 안 된다.
let includedOverlap=0;
for(const mf of db.manufacturers||[])for(const md of mf.models||[])for(const v of md.variants||[])for(const t of v.trims||[]){
  const a=new Set(t.available_options||[]);
  for(const id of t._implied_options||[])if(a.has(id))includedOverlap++;
}
assert.equal(includedOverlap,0,'implied option leaked into selectable options');

console.log('PASS representative new-car configuration regression');
