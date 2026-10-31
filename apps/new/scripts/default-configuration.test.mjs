import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultColorIndex } from '../src/lib/exterior-paint.js';
import { kamatchExtraOptions } from '../api/_kamatch/condition-costs.js';
test('default colors prefer an available no-surcharge color; paid-only lists retain known lowest price',()=>{
  assert.equal(defaultColorIndex([{price:10},{price:0,_paintUnavailable:true},{price:0},{price:0}]),2);
  assert.equal(defaultColorIndex([{_price_won:300000},{_price_won:110000}]),1);
  assert.equal(defaultColorIndex([{name:'price unknown'},{price:0,_paintUnavailable:true}]),null);
});
test('metropolitan and basic supplies use reviewed provider baselines without foreign-product surcharge',()=>{
  const baselines={deliveryFee:82500,tintFee:66000,dashcamFee:154000};
  const costs={deliveryFee:130000,tintFee:105000,dashcamFee:180000,basis:{delivery:'LAUNCH_REGION:수도권',tint:'COMPAT_FIXED:루마 일반',dashcam:'COMPAT_FIXED:파인뷰 SF500'}};
  const basic=kamatchExtraOptions(costs,baselines);
  assert.ok(basic.every(row=>row.amount===row.baseline&&!row.removed));
  const upgraded=kamatchExtraOptions({...costs,tintFee:280000,basis:{...costs.basis,tint:'COMPAT_FIXED:루마 마스타급'}},baselines);
  assert.equal(upgraded[1].amount,280000);
  const removed=kamatchExtraOptions({...costs,dashcamFee:0,basis:{...costs.basis,dashcam:'NONE'}},baselines);
  assert.equal(removed[2].removed,true);assert.equal(removed[2].baseline,154000);
});
