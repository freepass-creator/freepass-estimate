import test from 'node:test';
import assert from 'node:assert/strict';
import {projectBenchmarkOffers} from '../api/_private/public-offers.js';
const row=monthlyRent=>({monthlyRent,deposit:100,prepay:50,acquirePrice:1000,totalCarPrice:2000});
test('public categories map to the intended calculations and never expose supplier names or private errors',()=>{
 const answer={standard:{status:'DRAFT',results:[row(100)]},sources:{kamatch:{ok:true,data:{results:[row(200)]}},welrix:{ok:true,data:{results:[row(300)]}}}};
 const offers=projectBenchmarkOffers(answer);
 assert.deepEqual(offers.map(o=>o.label),['신용 무관','소득 확인','신용 심사']);
 assert.deepEqual(offers.map(o=>o.results[0].월대여료),[100,200,300]);
 assert.doesNotMatch(JSON.stringify(offers),/카매치|웰릭스|kamatch|welrix/i);
 answer.sources.kamatch={ok:false,error:'카매치 원본 비공개 오류'};answer.standard={status:'BLOCKED',error:'웰릭스/카매치 오류'};
 const partial=projectBenchmarkOffers(answer);assert.equal(partial[0].status,'unavailable');assert.equal(partial[0].results.length,0);assert.equal(partial[2].status,'ready');assert.doesNotMatch(JSON.stringify(partial),/카매치|웰릭스|kamatch|welrix/i);
});

test('public API returns only eligibility categories, even when internal responses contain supplier identities',async()=>{
 const {createPublicQuotesHandler}=await import('../api/public-quotes.js');
 const {fixture}=await import('./fixtures/kamatch-test-reference.mjs');
 const {canonicalizeQuoteRequestFromMaster}=await import('../api/_master/authoritative-request.js');
 const f=fixture(),canonical=canonicalizeQuoteRequestFromMaster(f.request,f.master);
 const data={priceBasis:canonical.priceBasis,bankName:'웰릭스 카매치 welrix kamatch',source:'https://kamatch.kr/',priceComponents:{base:23980000,options:450000,exterior:110000,interior:220000,discount:0,items:[]},results:f.request.안들.map(()=>({monthlyRent:600000,deposit:1238000,prepay:0,acquirePrice:13000000,totalCarPrice:24760000}))};
 const handler=createPublicQuotesHandler({loadMaster:async()=>f.master,welrixLookup:async()=>({ok:true,data:structuredClone(data)}),kamatchLookup:async()=>({ok:true,data:structuredClone(data)})});
 const response={code:200,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await handler({method:'POST',body:{request:f.request}},response);
 assert.equal(response.code,200);assert.equal(response.body.offers.length,3);assert.doesNotMatch(JSON.stringify(response.body),/카매치|웰릭스|kamatch|welrix/i);
});
