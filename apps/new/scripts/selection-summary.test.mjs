import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionSummary } from '../src/lib/selection-summary.js';
const db={manufacturers:[{manufacturer_id:'b',manufacturer_name:'제조사',models:[{model_id:'m',model_name:'차량',exterior_colors:[{name:'화이트'}],variants:[{variant_id:'v',variant_name:'가솔린',trims:[{trim_id:'t',name:'기본'}],options_master:{a:{name:'선루프'},b:{name:'주차 보조'}}}]}]}]};
const state={manufacturer:'b',model:'m',variant:'v',trim:'t',color:0,options:new Set(['a','b'])};
test('keeps exterior, interior and every option together',()=>{
 const s=selectionSummary(db,state,{cond:{colorInt:'블랙'}});
 assert.equal(s.exterior,'화이트');assert.equal(s.interior,'블랙');assert.deepEqual(s.options,['선루프','주차 보조']);assert.match(s.vehicle,/차량.*가솔린.*기본/);
});
test('changing model hides stale trim colors and options',()=>{
 const s=selectionSummary(db,{...state,model:null,variant:null,trim:null},{cond:{colorInt:'old'}});
 assert.equal(s.vehicle,'제조사');assert.equal(s.interior,'미선택');assert.equal(s.exterior,'미선택');assert.deepEqual(s.options,[]);
});
test('shared confirmed quote uses snapshot, not current draft',()=>{
 const s=selectionSummary(db,state,{sharedSnapshot:{vehicle:{model:'공유 차량',colorExt:'블루',colorInt:'브라운',options:['공유 옵션']}}});
 assert.equal(s.vehicle,'공유 차량');assert.equal(s.exterior,'블루');assert.deepEqual(s.options,['공유 옵션']);
});
test('empty selection has no summary',()=>assert.equal(selectionSummary(db,{},{}),null));
