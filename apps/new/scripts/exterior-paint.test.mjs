import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeExteriorPaint,restorePaintSelection} from '../src/lib/exterior-paint.js';
const fixture=()=>({manufacturers:[{manufacturer_id:'b',models:[{model_id:'m',exterior_colors:[{name:'펄',price:0},{name:'매트',price:0}],variants:[{variant_id:'v',options_master:{p:{name:'펄',price:8},m:{name:'매트',price:40},sun:{name:'선루프',price:100}},trims:[{trim_id:'t',available_options:['p','m','sun']},{trim_id:'black',available_options:['sun']}]}]}]}]});
test('paint migrates per trim, equipment remains, source prices are not pooled',()=>{
 const db=fixture(),model=db.manufacturers[0].models[0],v=model.variants[0];
 const other=structuredClone(v);other.variant_id='other';other.options_master.p.price=10;model.variants.push(other);
 assert.equal(normalizeExteriorPaint(db).length,4);
 assert.equal(v.trims[0]._exterior_colors[0].price,8);assert.equal(other.trims[0]._exterior_colors[0].price,10);
 assert.equal(v.trims[0]._exterior_colors[0]._price_won,80000);
 assert.equal(v.trims[1]._exterior_colors[0]._paintUnavailable,true);
 assert.deepEqual(v.trims[0].available_options,['sun']);assert.equal(v.options_master.sun.price,100);
 assert.equal(model.exterior_colors[0].price,0);assert.equal(normalizeExteriorPaint(db).length,0);
});
test('legacy restore uses trim order and explicitly reports missing trim color',()=>{
 const db=fixture(),trim=db.manufacturers[0].models[0].variants[0].trims[0];
 trim._exterior_colors=[{name:'매트',price:0},{name:'펄',price:0}];
 normalizeExteriorPaint(db);
 const s={manufacturer:'b',model:'m',variant:'v',trim:'t',color:null,options:new Set(['p'])};
 restorePaintSelection(db,s);assert.equal(s.color,1);assert.equal(s.colorNotice,'');
 trim._exterior_colors=[];s.color=null;s.options=new Set(['p']);restorePaintSelection(db,s);
 assert.equal(s.color,null);assert.match(s.colorNotice,/다시 선택/);
});
test('legacy explicit, ambiguous, unavailable and unselected colors are handled',()=>{
 const db=fixture();normalizeExteriorPaint(db);
 const state=(options,color=null,trim='t')=>({manufacturer:'b',model:'m',variant:'v',trim,color,options:new Set(options)});
 const one=state(['p']);restorePaintSelection(db,one);assert.equal(one.color,0);assert.equal(one.options.size,0);
 const explicit=state(['p'],1);restorePaintSelection(db,explicit);assert.equal(explicit.color,1);
 const ambiguous=state(['p','m']);restorePaintSelection(db,ambiguous);assert.equal(ambiguous.color,null);assert.match(ambiguous.colorNotice,/다시 선택/);
 const unavailable=state(['p'],null,'black');restorePaintSelection(db,unavailable);assert.equal(unavailable.color,null);assert.match(unavailable.colorNotice,/선택할 수 없는/);
 const empty=state([]);restorePaintSelection(db,empty);assert.equal(empty.color,null);
});
