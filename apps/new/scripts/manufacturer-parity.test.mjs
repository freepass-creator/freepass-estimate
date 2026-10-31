import test from 'node:test';
import assert from 'node:assert/strict';
import {auditManufacturerRecord,auditProvidedQuote} from '../api/_master/manufacturer-parity.js';
const record={productId:'test',maker:'기아',model:'test',modelYear:2026,powertrainName:'test',trimName:'test',priceBasis:'test',basePrice:{amount:30000000,currency:'KRW'},options:[{optionId:'roof',name:'선루프',price:{amount:500000,currency:'KRW'},requires:[],excludes:[],exclusiveGroupId:null}],exteriorColors:[],interiorColors:[]};
const evidence=()=>({productId:'test',sourceUrl:'https://www.kia.com/kr/vehicles/test/price',observedAt:new Date().toISOString(),effectiveFrom:'2026-10-01',record:structuredClone(record)});
test('requires official source freshness, identical price basis and option rules at zero-won tolerance',()=>{
 const e=evidence();assert.equal(auditManufacturerRecord(record,e).status,'VERIFIED');
 e.record.basePrice.amount++;assert.equal(auditManufacturerRecord(record,e).status,'MISMATCH');
 e.record=structuredClone(record);e.record.options[0].requires=['other'];assert.ok(auditManufacturerRecord(record,e).findings.some(f=>f.path.endsWith('requires')));
 e.sourceUrl='https://non-manufacturer.example/price';assert.equal(auditManufacturerRecord(record,e).status,'MISMATCH');
 assert.equal(auditManufacturerRecord(record,null).status,'UNVERIFIED');
});
test('provided quote comparison rejects different full inputs and a one-won output error',()=>{
 const a={request:{productId:'test',fee:3.5,deposit:10,prepay:5},results:[{monthlyRent:500000,deposit:3000000,prepay:1500000,acquirePrice:18000000,totalCarPrice:30000000}]},b=structuredClone(a);
 assert.equal(auditProvidedQuote(a,b).status,'VERIFIED');b.results[0].monthlyRent++;assert.equal(auditProvidedQuote(a,b).findings[0].differenceWon,1);
 b.request.fee=3.6;assert.equal(auditProvidedQuote(a,b).status,'INPUT_MISMATCH');
});
