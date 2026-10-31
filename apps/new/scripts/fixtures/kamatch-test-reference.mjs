import { readFileSync } from 'node:fs';
const testSettings=JSON.parse(readFileSync(new URL('../../api/_kamatch/policy.snapshot.json',import.meta.url),'utf8')).settings;
// Synthetic test data only. Never loaded by application routes.
import { KAMATCH_APP_DIGEST, tableDigest } from '../../api/_kamatch/reference.js';
const money=amount=>({amount,currency:'KRW'});
export function fixture() {
  const reference={schema:'kamatch-authenticated-reference/v1',source:'https://kamatch.kr/',capturedAt:new Date().toISOString(),application:{sha256:KAMATCH_APP_DIGEST},tables:{
    '/api/vehicles':[{brand:'현대',model:'아반떼',lineup:'가솔린',trim:'모던',visible:true,residualGrade:'A',residualGradeGeneral:'B',gaesoIndex:1.1715,gaesoIndexGeneral:1.072,
      autoTax:18000,autoTaxGeneral:19000,insurance:110000,insuranceGeneral:120000,etcCost36:10000,etcCost48:11000,etcCost60:12000,etcCost36General:13000,etcCost48General:14000,etcCost60General:15000,extraMonthlyFee:1000}],
    '/api/fee-rates':[], '/api/model-fee-rates':[{model:'아반떼',rate:.07}],
    '/api/commission-rates':['low','general'].flatMap(creditType=>['dealer','special'].flatMap(deliveryType=>[0,5,10,20,30].map(depositRate=>({creditType,deliveryType,depositRate,rate:depositRate===5?7.5:6.5})))),
    '/api/residual-grade-rates':['A','B'].flatMap(grade=>[20000,30000].flatMap(mileage=>[36,48,60].map(term=>({grade,mileage,term,rate:term===36?79:term===48?69:59})))),
    '/api/gaeso-reg-rates':[{gaesoIndex:1.1715,regFeeRate:8.55},{gaesoIndex:1.072,regFeeRate:7}], '/api/residual-rates':[], '/api/supplies-prices':{},
    '/api/commission-settings':{...testSettings,productInterestRate:8,corpCommissionLow5:3,corpCommissionLow10:4,corpCommissionGeneral5:2,corpCommissionGeneral10:3,corpCommissionLow5Special:2.5,defaultInsurance:100000,defaultEtcCost:15000},
  }};
  // Normalize canonical origin to the browser collector's value.
  reference.source='https://kamatch.kr';
  const profile={brand:'현대',model:'아반떼',lineup:'가솔린',trim:'모던',vehicleType:'sedan',insuranceProperty:'1억',baselines:{deliveryFee:82500,tintFee:77000,dashcamFee:180000}};
  const profiles={schema:'freepass-kamatch-mapping/v1',applicationDigest:KAMATCH_APP_DIGEST,tablesDigest:tableDigest(reference),products:{FNJS4RMT1:profile}};
  const master={meta:{contract:'estimate-newcar-master/v1',authority:'CANONICAL_ACTIVE',projectionId:'estimate-newcar-master',schemaVersion:'1.0.0',releaseId:'TEST_FIXTURE_NOT_OPERATIONAL',revision:1},data:[{
    productId:'FNJS4RMT1',status:'ACTIVE',basePrice:money(23980000),options:[{optionId:'roof',name:'선루프',price:money(450000),requires:[],excludes:[]}],exteriorColors:[{colorId:'ext',name:'유료 외장',price:money(110000)}],interiorColors:[{colorId:'int',name:'유료 내장',price:money(220000)}],
  }]};
  const request={차:{종류:'신차',키:'FNJS4RMT1',상품키:'FNJS4RMT1',가격:{트림:1,옵션:2,외장색:3,내장색:4,할인:0},구성:{선택옵션:[{id:'roof',stableId:'roof',price_won:1}],colorExtId:'ext',colorIntId:'int'}},조건:{신용:'저신용',주행:'3만km',수수료정책:'company-1-agent-5/v1',영업수수료P:2,수수료율:3,정비:'정비 제외',대물:'1억',추가운전자:'없음',비용:{deliveryFee:82500,tintFee:77000,dashcamFee:180000,naviFee:0,hipassFee:0}},안들:[36,48,60].map(기간=>({기간,보증금:5,선납:0}))};
  return {reference,profiles,profile,master,request};
}
