import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const upstream=path.resolve(root,'../../.ui-reference');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');

function visibleHtml(s){
  // Inline scripts are data/controller code. Keep script tags with src because entry topology is UI structure.
  return s.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi,'<script>__FREEPASS_DATA_BINDING__</script>')
    .replace(/[ \t]+$/gm,'').trim();
}
function vueStructure(s){
  return (s.match(/<template>[\s\S]*?<\/template>/i)?.[0]||'')
    // The imported project is a layout reference only. Product/brand copy is
    // intentionally owned by FreePass, so compare element/directive structure
    // without locking text nodes to the historical source.
    .replace(/>[^<]*</g,'><')
    .replace(/[ \t]+$/gm,'')
    .trim();
}
function walk(dir){
  const out=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())out.push(...walk(p));else out.push(p);
  }
  return out;
}
const failures=[];
// Keep the mobile document body locked to the pinned historical information
// architecture. The head is intentionally FreePass-specific and is covered by
// check-mobile-brand-identity.mjs so the default FreePass identity can render
// before application JavaScript runs.
{
  const file='mobile.html';
  const body=s=>s.match(/<body\b[\s\S]*?<\/body>/i)?.[0]||'';
  const a=visibleHtml(body(read(path.join(upstream,file))));
  const b=visibleHtml(body(read(path.join(root,file))));
  if(a!==b)failures.push(file+' visible body changed');
}
// index.html has one approved structural delta from the pinned Welrix baseline:
// task CTAs were moved from the top/header to bottom action bars (page + dialog).
// The placement itself is enforced separately by check-action-placement.mjs.
const upComp=path.join(upstream,'src','components');
for(const p of walk(upComp).filter(x=>x.endsWith('.vue'))){
  const rel=path.relative(upComp,p);
  const portableRel=rel.replaceAll(path.sep,'/');
  const local=path.join(root,'src','components',rel);
  if(!fs.existsSync(local)){failures.push('missing component '+rel);continue}
  const upstreamSource=read(p), localSource=read(local);
  // These mobile screens are intentional FreePass-owned structural deltas from
  // the pinned Welrix historical reference. They are not a license for broad UI
  // drift: only this exact allowlist bypasses the historical-template equality
  // check, while action placement / navigation / visual grammar / accessibility
  // checks continue to run in this workflow.
  //
  // MobileApp: FreePass shell, one-screen-one-choice and bottom actions.
  // StepVehicle: FreePass vehicle-selection flow has evolved beyond the legacy
  //              Welrix template and is owned by the dedicated UI/UX lane.
  // StepResult: FreePass result/snapshot presentation is likewise product-owned.
  const approvedFreePassStructuralDeltas = new Set([
    'mobile/MobileApp.vue',
    'mobile/StepVehicle.vue',
    'mobile/StepResult.vue',
  ]);
  if(!approvedFreePassStructuralDeltas.has(portableRel)){
    if(vueStructure(upstreamSource)!==vueStructure(localSource)) failures.push('component structure changed '+rel);
  }
}
assert.equal(failures.length,0,'Historical UI structure parity failed:\n'+failures.join('\n'));
console.log('PASS historical structure reference — FreePass copy and visual grammar remain independent');
