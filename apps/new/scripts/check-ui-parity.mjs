import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Authority: FreePass Estimate owns product flow; pinned Welrix remains a compatibility guard only for unchanged surfaces.
const root=process.cwd();
const upstream=path.resolve(root,'../../.ui-reference');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');

function visibleHtml(s){
  // Inline scripts are data/controller code. Keep script tags with src because entry topology is UI structure.
  return s.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi,'<script>__FREEPASS_DATA_BINDING__</script>')
    .replace(/[ \t]+$/gm,'').trim();
}

// Read the real top-level SFC template. A lazy /<template>...<\/template>/
// stops at the first nested Vue <template v-if/v-for> closing tag and can report
// false structural drift.
function sfcTemplate(s){
  const re=/<\/?template\b[^>]*>/gi;
  let depth=0;
  let start=-1;
  for(let m;(m=re.exec(s));){
    const tag=m[0];
    const closing=/^<\/template/i.test(tag);
    const selfClosing=/\/>$/.test(tag);
    if(!closing){
      if(depth===0) start=m.index;
      if(!selfClosing) depth++;
      continue;
    }
    depth--;
    if(depth===0 && start>=0) return s.slice(start,re.lastIndex);
    if(depth<0) throw new Error('unbalanced Vue template tags');
  }
  return '';
}

function vueStructure(s){
  return sfcTemplate(s)
    .replace(/<!--[\s\S]*?-->/g,'')
    // Product/brand copy is FreePass-owned. Keep tags, directives, bindings and
    // hierarchy while ignoring text nodes and formatting whitespace.
    .replace(/>[^<]*</g,'><')
    .replace(/>\s+</g,'><')
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

function requireTokens(src,tokens,label){
  for(const token of tokens) assert.ok(src.includes(token),label+' missing: '+token);
}

function guardFreePassOwnedSurface(rel,src){
  const template=sfcTemplate(src);
  assert.ok(template,rel+' top-level template not found');

  if(rel==='mobile/StepVehicle.vue'){
    // Estimate owns this one-screen-one-choice vehicle journey. Guard its
    // semantic stages and data-driven controls instead of forcing an obsolete
    // Welrix template byte-for-byte.
    requireTokens(template,[
      'class="selection-anchor"',
      "subStep === 'brand'",
      "subStep === 'model'",
      "subStep === 'variant'",
      "subStep === 'spec'",
      "subStep === 'trim'",
      "subStep === 'options'",
      "subStep === 'colors'",
      'v-for="b in brands"',
      'v-for="m in models"',
      'v-for="v in variants"',
      'v-for="g in specGroups"',
      'v-for="(t, i) in trims"',
      'v-for="o in availableOptions"',
      'v-for="(c, i) in exteriorColors"',
      '@click="selectBrand(b)"',
      '@click="selectModel(m)"',
      '@click="selectVariant(v)"',
      '@click="selectSpec(g)"',
      '@click="selectTrim(t)"',
      '@click="toggleOption(o.id)"',
    ],rel);
    return;
  }

  if(rel==='mobile/StepConditions.vue'){
    // Contract conditions are FreePass-owned. Guard the shared term contract,
    // mileage/credit choices, role-specific disclosure, and scenario mutation.
    requireTokens(template,[
      'class="sc-title"',
      'v-for="t in TERMS"',
      ':aria-pressed="selectedTerms.includes(t)"',
      '@click="toggleTerm(t)"',
      'v-for="k in KMS"',
      '@click="quoteState.cond.km = k"',
      'v-if="담당자"',
      'v-for="c in CREDITS"',
      '@click="quoteState.cond.credit = c.value"',
      'v-if="!담당자"',
      'quoteState.cond.feeRatePct',
      'quoteState.cond.dep',
      'quoteState.cond.pre',
    ],rel);
    requireTokens(src,[
      "import { QUOTE_TERMS } from '../../lib/quote/terms.js';",
      'const TERMS = QUOTE_TERMS;',
      'function toggleTerm(t)',
    ],rel);
    return;
  }

  if(rel==='mobile/StepExtras.vue'){
    // Service/extras presentation may follow FreePass visual grammar, while
    // preserving every calculation-relevant choice and staff-only delivery input.
    requireTokens(template,[
      'class="se-title"',
      'v-for="s in SVC"',
      '@click="quoteState.cond.svc = s.value"',
      'v-for="i in INS"',
      '@click="quoteState.cond.insProperty = i.value"',
      'v-for="e in EXTRA"',
      '@click="quoteState.cond.extraDriver = e.value"',
      'v-if="담당자"',
      '@change="onRegionChange"',
      'v-for="t in 썬팅들"',
      '@click="quoteState.tint.product = t.name"',
      'v-for="b in 블박들"',
      '@click="quoteState.extras.blackbox = b.name"',
    ],rel);
    return;
  }

  if(rel==='mobile/StepResult.vue'){
    // Result presentation may evolve for readability, but the quote output must
    // retain vehicle summary, term pricing, conditions, and calculation states.
    requireTokens(template,[
      'class="sr-car"',
      'class="sr-terms"',
      'v-for="t in 기간들"',
      'class="sr-term__monthly"',
      'v-if="t.monthly"',
      '계산 중…',
      'v-if="계산못함"',
      'class="sr-cond"',
      'v-for="[k, val] in 조건들"',
      'v-if="공유견적"',
    ],rel);
    return;
  }

  if(rel==='mobile/StickyQuote.vue'){
    // The live quote sheet is FreePass-owned: term count follows the shared
    // quote-term contract and its height follows the actual footer/safe area.
    // Guard the user-facing controls and calculated outputs rather than the old
    // fixed three-term Welrix markup.
    requireTokens(template,[
      'class="sq-summary"',
      ':aria-expanded="expanded"',
      'class="sq-terms"',
      'v-for="c in cards"',
      'class="sq-term-card__check-btn"',
      '@click="onSendToggle(c.idx)"',
      'class="sq-term-card__monthly"',
      'v-if="expanded"',
      'class="sq-table"',
      'class="sq-table__term-select"',
      '@change="onTermChange(c.idx, $event)"',
      'class="sq-pct-input"',
      'class="sq-meta"',
    ],rel);
    return;
  }

  throw new Error('unregistered FreePass-owned UI surface: '+rel);
}

const failures=[];

// Keep the mobile document body locked to the pinned historical information
// architecture. The head is intentionally FreePass-specific and is covered by
// check-mobile-brand-identity.mjs.
{
  const file='mobile.html';
  const body=s=>s.match(/<body\b[\s\S]*?<\/body>/i)?.[0]||'';
  const a=visibleHtml(body(read(path.join(upstream,file))));
  const b=visibleHtml(body(read(path.join(root,file))));
  if(a!==b)failures.push(file+' visible body changed');
}

const upComp=path.join(upstream,'src','components');
const freePassOwned=new Set([
  'mobile/MobileApp.vue',
  'mobile/StepVehicle.vue',
  'mobile/StepConditions.vue',
  'mobile/StepExtras.vue',
  'mobile/StepResult.vue',
  'mobile/StickyQuote.vue',
]);

for(const p of walk(upComp).filter(x=>x.endsWith('.vue'))){
  const rel=path.relative(upComp,p);
  const portableRel=rel.replaceAll(path.sep,'/');
  const local=path.join(root,'src','components',rel);
  if(!fs.existsSync(local)){failures.push('missing component '+rel);continue}

  const upstreamSource=read(p);
  const localSource=read(local);

  if(portableRel==='mobile/MobileApp.vue'){
    // FreePass shell ownership is guarded by action-placement and navigation
    // contracts, not the historical Welrix shell.
    continue;
  }

  if(freePassOwned.has(portableRel)){
    try { guardFreePassOwnedSurface(portableRel,localSource); }
    catch(error){ failures.push(error.message); }
    continue;
  }

  if(vueStructure(upstreamSource)!==vueStructure(localSource)){
    failures.push('component structure changed '+rel);
  }
}

assert.equal(failures.length,0,'UI structure guard failed:\n'+failures.join('\n'));
console.log('PASS UI structure guard — legacy-compatible surfaces pinned; FreePass-owned Estimate surfaces use semantic contracts');
