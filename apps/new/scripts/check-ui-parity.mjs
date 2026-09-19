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
function vueStyles(s){
  return [...s.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('\n').replace(/[ \t]+$/gm,'').trim();
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
for(const file of ['index.html','mobile.html']){
  const a=visibleHtml(read(path.join(upstream,file)));
  const b=visibleHtml(read(path.join(root,file)));
  if(a!==b)failures.push(file+' visible HTML changed');
}
const upComp=path.join(upstream,'src','components');
for(const p of walk(upComp).filter(x=>x.endsWith('.vue'))){
  const rel=path.relative(upComp,p);
  const local=path.join(root,'src','components',rel);
  if(!fs.existsSync(local)){failures.push('missing component '+rel);continue}
  const upstreamSource=read(p), localSource=read(local);
  if(vueStyles(upstreamSource)!==vueStyles(localSource)) failures.push('component style changed '+rel);
  // MobileApp is the approved FreePass delta: dynamic channel branding + one-screen-one-choice footer behavior.
  // All other component templates remain locked to the pinned Welrix visible structure.
  if(rel!=='mobile/MobileApp.vue' && vueTemplate(upstreamSource)!==vueTemplate(localSource))
    failures.push('component template changed '+rel);
}
const upStyles=path.join(upstream,'src','styles');
for(const p of walk(upStyles)){
  const rel=path.relative(upStyles,p),local=path.join(root,'src','styles',rel);
  if(!fs.existsSync(local)||read(p)!==read(local))failures.push('style changed '+rel);
}
assert.equal(failures.length,0,'Welrix visible UI parity failed:\n'+failures.join('\n'));
console.log('PASS visible UI parity — inherited layout/styles locked; approved FreePass mobile flow delta allowed');
