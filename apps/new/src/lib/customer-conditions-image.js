import { isCommissionMark, requestCommissionMark } from './commission-mark.js';
export async function prepareCustomerConditionsImage(source, { agentPoints, reference: savedReference, isCurrent }) {
  if (!source || !isCurrent()) throw new Error('견적 계산 완료 후 다시 눌러 주세요.');
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;left:-10000px;top:0;width:${source.getBoundingClientRect().width}px;background:white;`;
  const documentNode = source.cloneNode(true);
  documentNode.style.width = '100%';
  // Keep the full vehicle specification; simplify only financing details.
  documentNode.querySelectorAll('.sr-snapshot,.sr-cond__title,.sr-note').forEach((node) => node.remove());
  const carPriceLabel = documentNode.querySelector('.sr-car__total span');
  if (carPriceLabel) carPriceLabel.textContent = '= 신차 총가격';
  for (const row of documentNode.querySelectorAll('.sr-term')) {
    row.querySelectorAll('.sr-term__sub').forEach((node, i) => { if (i > 0) node.remove(); });
    row.style.cssText = 'padding:12px;gap:8px;';
    row.querySelector('.sr-term__left').style.flex = '1 1 120px';
    const amount = row.querySelector('.sr-term__monthly b');
    if (amount) amount.style.fontSize = '24px';
  }
  const offers = documentNode.querySelector('.sr-offers');
  if (offers) {
    const financeRows = [...documentNode.querySelectorAll('.sr-term__sub')];
    const financeLabels = [...new Set(financeRows.map(node => node.textContent.trim()))];
    if (financeLabels.length === 1) {
      const finance = document.createElement('p');
      finance.textContent = financeLabels[0] + ' · 월 렌트료';
      finance.style.cssText = 'font-size:12px;color:#667085;margin:12px 0;';
      offers.before(finance); financeRows.forEach(node => node.remove());
    }
    offers.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;';
    for (const offer of offers.querySelectorAll('.sr-offer')) {
      const heading = offer.querySelector('.sr-offer__title');
      heading.style.cssText = 'font-size:15px;line-height:1.4;min-height:44px;margin:0 0 8px;';
      const hint = offer.querySelector('.sr-offer__hint');
      if (hint) { hint.style.cssText = 'display:block;font-size:10px;font-weight:400;color:#98a2b3;'; heading.append(hint); }
      for (const row of offer.querySelectorAll('.sr-term')) {
        row.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;padding:10px 6px;gap:6px;';
        row.querySelector('.sr-term__left').style.flex = '0 0 auto';
        row.querySelector('.sr-term__label').style.fontSize = '12px';
        const monthly = row.querySelector('.sr-term__monthly'), amount = monthly.querySelector('b');
        monthly.style.cssText = 'margin:0;text-align:left;line-height:1.4;font-size:11px;';
        if (amount) { amount.style.cssText = 'font-size:18px;white-space:nowrap;letter-spacing:-.5px;'; monthly.replaceChildren(amount, document.createTextNode('원')); }
      }
    }
  }
  const title = documentNode.querySelector('.sr-title');
  title.style.cssText = 'font-size:16px;font-weight:500;color:#98a2b3;margin:0;flex:1;';
  const conditions = documentNode.querySelector('.sr-cond');
  const conditionText = [...conditions.querySelectorAll('.sr-cond__row')].map(row => [...row.children].map(node => node.textContent.trim()).join(' ')).join(' · ');
  conditions.textContent = conditionText;
  conditions.style.cssText = 'display:block;font-size:12px;line-height:1.6;color:#667085;';
  const note = document.createElement('p');
  note.textContent = '기간별 상세 금액과 이용 조건은 공유 링크에서 확인해 주세요.';
  note.style.cssText = 'font-size:12px;line-height:1.6;color:#667085;margin:12px 0 0;';
  documentNode.append(note);
  wrapper.append(documentNode); document.body.append(wrapper);
  try {
    const mark = isCommissionMark(savedReference) ? savedReference : Number.isFinite(agentPoints) ? await requestCommissionMark(agentPoints) : null;
    if (!isCurrent()) throw new Error('견적이 변경됐습니다. 계산 완료 후 다시 눌러 주세요.');
    if (mark) {
      const reference = document.createElement('p');
      reference.textContent = `참조 ${mark}`;
      reference.style.cssText = 'margin:12px 0 0;text-align:right;font-family:monospace;font-size:10px;line-height:1.5;color:#98a2b3;letter-spacing:1px;';
      documentNode.append(reference);
    }
    return { element: documentNode, cleanup: () => wrapper.remove() };
  } catch (error) { wrapper.remove(); throw error; }
}
