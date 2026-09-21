import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { normalizeExteriorPaint, colorPriceLabel } from '../src/lib/exterior-paint.js';
const context = {window:{}};
vm.runInNewContext(fs.readFileSync('public/welrix-db.js','utf8'),context);
const db=context.window.VEHICLE_DB;
const before=JSON.stringify(db);
assert.equal(normalizeExteriorPaint(db).length,0,'canonical catalog must already classify paint');
assert.equal(JSON.stringify(db),before,'canonical source prices must remain unchanged');
let paid=0;
const key=s=>s.replace(/\s+/g,'');
for(const b of db.manufacturers) for(const m of b.models) for(const v of m.variants) for(const t of v.trims){
 const colors=t._exterior_colors||m.exterior_colors||[];
 for(const c of colors){
  if(c.price>0){paid++;assert.match(colorPriceLabel(c.price*10000),/^\+[\d,]+원$/);}
  for(const id of t.available_options||[])assert.notEqual(key(v.options_master[id]?.name||''),key(c.name),'paint duplicated in equipment');
 }
}
assert.ok(paid>0);
assert.equal(colorPriceLabel(80000),'+80,000원');
assert.equal(colorPriceLabel(400000),'+400,000원');
assert.equal(colorPriceLabel(0),'추가금 없음');
assert.equal(colorPriceLabel(NaN),'추가금 확인 필요');
console.log(`PASS: ${paid} paid trim/color entries, no duplicate equipment, explicit price labels`);
