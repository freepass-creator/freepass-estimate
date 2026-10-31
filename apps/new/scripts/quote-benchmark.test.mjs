import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuoteBenchmarkHandler} from '../api/quote-benchmark.js';
import {createKamatchComparisonHandler} from '../api/kamatch-comparison.js';
import {fixture} from './fixtures/kamatch-test-reference.mjs';
import {canonicalizeQuoteRequestFromMaster} from '../api/_master/authoritative-request.js';
function response(){return{code:200,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}}}
test('one pinned master drives both providers and a separately labelled standard draft',async()=>{
 const f=fixture();let loads=0;
 const canonical=canonicalizeQuoteRequestFromMaster(f.request,f.master);
 const welrixLookup=async()=>({ok:true,data:{priceBasis:canonical.priceBasis,priceComponents:{base:23980000,options:450000,exterior:110000,interior:220000,discount:0,items:[]},results:f.request.안들.map(()=>({monthlyRent:600000,deposit:1238000,prepay:0,acquirePrice:13000000,totalCarPrice:24760000}))}});
 const handler=createQuoteBenchmarkHandler({loadMaster:async()=>{loads++;return f.master},welrixLookup,loadReference:async()=>f.reference,loadProfiles:async()=>f.profiles});
 const res=response();await handler({method:'POST',body:{request:f.request}},res);
 assert.equal(res.code,200);assert.equal(loads,1);assert.equal(res.body.sources.welrix.ok,true);assert.equal(res.body.sources.kamatch.ok,true);
 assert.equal(res.body.standard.status,'DRAFT');assert.equal(res.body.standard.results.length,3);assert.equal(res.body.standard.calibration[0].lenderIrrIdentified,false);assert.equal(res.body.standard.calibration[0].analyses.length,2);
});
test('a missing supplier or different source price blocks the standard draft without hiding the available quote',async()=>{
 const f=fixture();const failure=createQuoteBenchmarkHandler({loadMaster:async()=>f.master,welrixLookup:async()=>({ok:true,data:{results:[]}}),kamatchLookup:async()=>({ok:false,error:'카매치 요율 연결 대기'})});
 let res=response();await failure({method:'POST',body:{request:f.request}},res);assert.equal(res.body.standard.status,'BLOCKED');assert.equal(res.body.sources.welrix.ok,true);
 const canonical=canonicalizeQuoteRequestFromMaster(f.request,f.master),data={priceBasis:canonical.priceBasis,results:f.request.안들.map(()=>({monthlyRent:600000,deposit:0,prepay:0,acquirePrice:13000000,totalCarPrice:24760001}))};
 const wrong=createQuoteBenchmarkHandler({loadMaster:async()=>f.master,welrixLookup:async()=>({ok:true,data}),kamatchLookup:async()=>({ok:true,data})});res=response();await wrong({method:'POST',body:{request:f.request}},res);assert.equal(res.body.standard.status,'BLOCKED');
});
