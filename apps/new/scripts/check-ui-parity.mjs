import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Authority: FreePass Estimate owns its complete UI structure.
const root=process.cwd();
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');

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

const mobileHtml=read(path.join(root,'mobile.html'));
requireTokens(mobileHtml,[
  '<div id="m-app"></div>',
  '<script type="module" src="/src/mobile.js"></script>',
], 'mobile.html');

const localComp=path.join(root,'src','components');
const criticalOwned=new Set([
  'mobile/StepVehicle.vue',
  'mobile/StepConditions.vue',
  'mobile/StepExtras.vue',
  'mobile/StepResult.vue',
  'mobile/StickyQuote.vue',
]);

const allComponents=walk(localComp).filter(x=>x.endsWith('.vue'));
assert.ok(allComponents.length>0,'no Vue components found');

for(const p of allComponents){
  const rel=path.relative(localComp,p).replaceAll(path.sep,'/');
  const source=read(p);
  const template=sfcTemplate(source);

  if(!template){
    failures.push(rel+' top-level template not found');
    continue;
  }

  if(criticalOwned.has(rel)){
    try { guardFreePassOwnedSurface(rel,source); }
    catch(error){ failures.push(error.message); }
  }
}

requireTokens(read(path.join(localComp,'mobile','MobileApp.vue')),[
  'class="m-shell"',
  'class="m-main"',
  'class="m-footer"',
], 'mobile/MobileApp.vue');

assert.equal(failures.length,0,'UI structure guard failed:\n'+failures.join('\n'));
console.log('PASS UI structure guard — FreePass Estimate local semantic contracts only');
