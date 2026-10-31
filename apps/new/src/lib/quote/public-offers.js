// Public eligibility categories. Supplier identity stays in server integration code.
export const PUBLIC_OFFERS = Object.freeze([
  Object.freeze({id:'no-credit',label:'신용 무관'}),
  Object.freeze({id:'income-check',label:'소득 확인'}),
  Object.freeze({id:'credit-required',label:'신용 심사'}),
]);
export function publicOfferDefinition(id){return PUBLIC_OFFERS.find(offer=>offer.id===id)||null;}
