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
function vueTemplate(s){
  return (s.match(/<template>[\s\S]*?<\/template>/i)?.[0]||'').replace(/[ \t]+$/gm,'').trim();
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
// Keep the mobile document body locked to the pinned Welrix information
// architecture. The head is intentionally channel-specific and is covered by
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
  // MobileApp is the approved FreePass shell delta:
  // - dynamic channel branding
  // - one-screen-one-choice auto advance
  // - top is informational / bottom is actionable
  // Its action placement is enforced by check-action-placement.mjs + Playwright.
  if(portableRel!=='mobile/MobileApp.vue'){
    if(vueTemplate(upstreamSource)!==vueTemplate(localSource)) failures.push('component template changed '+rel);
  }
}
assert.equal(failures.length,0,'Welrix visible UI parity failed:\n'+failures.join('\n'));
console.log('PASS structure parity — Welrix information architecture retained; FreePass visual grammar allowed');
