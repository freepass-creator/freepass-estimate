// 다중 차종 견적서 HTML 빌더 (SSOT) — quote.js 의 renderMultiQuoteDoc 에서 추출.
// 손님에게 나가는 "다중 차종 견적서 — 모바일 카드형" (.qd-* 클래스, public/quote-doc.css) 를 그대로 생성.
// 부작용 없음(pure): vehicles + 부가 정보(cust/staff/cond/send/회사설정) 를 받아 HTML 문자열만 반환.
// quote.js(영업 견적바구니) 와 StandardPriceTable.vue(표준견적) 가 공유 → 견적서 양식 일치 보장.
import { fmt, krw, fmtTel, guessColor } from './format.js';

/**
 * 다중 차종 견적서 HTML 생성.
 * @param {object}   args
 * @param {object[]} args.vehicles      — 차량 스냅샷 배열. 각 항목:
 *        { id?, brand, model, trim_name, variant?, totalKrw, colorExt?, colorInt?,
 *          options?: string[], snapshot?: { tintFee, deliveryFee, accessoryFee, tint:{product}, deliveryCity, extras:{blackbox,navi,hipass} },
 *          monthly: [{ idx, term, dep, pre, monthly, residualAmt, residualPct }] }
 * @param {object}   args.customer      — { name, tel }
 * @param {object}   args.staff         — { name, tel }
 * @param {object}   args.cond          — { credit, km, dep, pre, insProperty, extraDriver, svc }
 * @param {object}   args.send          — { [idx]: boolean } 발송 체크 (false 면 제외). 미지정 시 전부 발송.
 * @param {object}   [args.companyConfig] — { name, logo_url }
 * @param {boolean}  [args.showLogo=true]
 * @param {boolean}  [args.removable=false] — true 면 각 차량 카드에 제외 버튼([data-cart-id]) 추가 (견적바구니 전용)
 * @returns {string} 견적서 HTML
 */
export function buildMultiQuoteHtml({
  vehicles,
  customer = {},
  staff = {},
  cond = {},
  send = {},
  companyConfig = {},
  showLogo = true,
  removable = false,
}) {
  const today = new Date();
  const todayStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s/g, '.').replace(/\.$/, '');
  const expire = new Date(today.getTime() + 7 * 86400000);
  const expireStr = expire.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.\s/g, '.').replace(/\.$/, '');
  const quoteNo = todayStr.replace(/\./g, '') + '-' + String(Date.now()).slice(-4);

  const sentFlags = send || {};

  // === 비교표 (가로) — 차종이 2+ 일 때만 표시 ===
  const visibleTerms = (vehicles[0]?.monthly || []).filter((m) => sentFlags[m.idx] !== false).map((m) => m.idx);

  function termCell(veh, termIdx) {
    const m = (veh.monthly || []).find((x) => x.idx === termIdx);
    if (!m) return { html: '<td>-</td>', val: Infinity };
    return { val: m.monthly, raw: m, idx: termIdx };
  }

  const compareTableHtml = vehicles.length > 1 ? `
    <div class="qd-section">
      <div class="qd-section__label">COMPARISON</div>
      <div class="qd-compare">
        <table>
          <thead>
            <tr>
              <th class="row-label"></th>
              ${vehicles.map((veh) => `
                <th>
                  <span class="brand-tiny">${veh.brand || ''}</span>
                  ${veh.model || ''}<br>${veh.trim_name || ''}
                </th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="price">
              <th>차량가</th>
              ${vehicles.map((veh) => `<td>${fmt(veh.totalKrw || 0)}</td>`).join('')}
            </tr>
            <tr>
              <th>외장</th>
              ${vehicles.map((veh) => `<td>${veh.colorExt || '-'}</td>`).join('')}
            </tr>
            <tr>
              <th>옵션</th>
              ${vehicles.map((veh) => `<td>${(veh.options || []).length ? (veh.options.length + '개') : '-'}</td>`).join('')}
            </tr>
            ${visibleTerms.map((termIdx) => {
              const cells = vehicles.map((v) => termCell(v, termIdx));
              const minVal = Math.min(...cells.map((c) => c.val));
              const termLabel = vehicles[0]?.monthly?.find((m) => m.idx === termIdx)?.term + '개월';
              return `
                <tr class="term">
                  <th>${termLabel}</th>
                  ${cells.map((c) => {
                    if (!c.raw) return '<td>-</td>';
                    const isBest = c.val === minVal && vehicles.length > 1;
                    return `<td class="${isBest ? 'cell-best' : ''}">
                      <span class="${isBest ? 'best-mark' : ''}">${fmt(c.val)}</span>${isBest ? '<span class="best-tag">BEST</span>' : ''}
                    </td>`;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  ` : '';

  // === 차량 카드 (디테일, 차량 정보에 집중) ===
  const vehicleCards = vehicles.map((veh, vIdx) => {
    const sent = (veh.monthly || []).filter((m) => sentFlags[m.idx] !== false);
    const bestIdx = sent.length > 1 ? sent.reduce((b, m) => (m.monthly < b.monthly ? m : b), sent[0]).idx : -1;
    const extColorHex = guessColor(veh.colorExt);
    const intColorHex = guessColor(veh.colorInt);
    const opts = veh.options || [];
    // 차량별 부가 (선팅/탁송/용품) — 카드 하단 작게
    const tintFee = veh.snapshot?.tintFee || 0;
    const deliveryFee = veh.snapshot?.deliveryFee || 0;
    const extrasList = veh.snapshot?.extras || {};
    const extrasNames = [extrasList.blackbox, extrasList.navi, extrasList.hipass].filter(Boolean);
    const sideBits = [];
    if (tintFee) sideBits.push(`선팅 ${veh.snapshot?.tint?.product || ''}`);
    if (deliveryFee) sideBits.push(`탁송 ${veh.snapshot?.deliveryCity || ''}`);
    if (extrasNames.length) sideBits.push(`용품 ${extrasNames.length}종`);
    const removeBtn = (removable && vehicles.length > 1)
      ? `<button class="qd-vehicle__remove" data-cart-id="${veh.id}" title="제외"><i class="ph ph-x"></i></button>`
      : '';
    return `
      <div class="qd-section qd-section--card" data-vehicle-idx="${vIdx}">
        <div class="qd-section__label">VEHICLE ${vehicles.length > 1 ? (vIdx + 1) + ' / ' + vehicles.length : ''}</div>
        <div class="qd-vehicle">
          ${removeBtn}
          <div class="qd-vehicle__top">
            <div>
              <div class="qd-vehicle__title">${veh.brand || ''}</div>
              <div class="qd-vehicle__name">${veh.model || ''} ${veh.trim_name || ''}</div>
              <div class="qd-vehicle__sub">${[veh.variant].filter(Boolean).join(' · ')}</div>
            </div>
            <div class="qd-vehicle__price">
              <div class="label">TOTAL</div>
              <div class="value">${krw(veh.totalKrw || 0)}</div>
            </div>
          </div>
          <div class="qd-vehicle__rows">
            <div class="qd-vehicle__row"><span class="k">외장</span><span class="v color"><span class="swatch" style="background:${extColorHex}"></span>${veh.colorExt || '-'}</span></div>
            <div class="qd-vehicle__row"><span class="k">내장</span><span class="v color"><span class="swatch" style="background:${intColorHex}"></span>${veh.colorInt || '-'}</span></div>
          </div>
          ${opts.length ? `
            <div class="qd-vehicle__opts">
              <div class="qd-vehicle__opts-label">옵션</div>
              ${opts.map((o) => `<span class="opt-chip">${o}</span>`).join('')}
            </div>
          ` : ''}
          ${sideBits.length ? `
            <div class="qd-vehicle__side">
              ${sideBits.map((s) => `<span>${s}</span>`).join(' · ')}
            </div>
          ` : ''}
        </div>
        <!-- 월 대여료 (이 차종 한정) — 단일 차종일 때만 노출, 다중일 때는 위 비교표가 대신 -->
        ${vehicles.length === 1 ? `
          <div class="qd-monthly" style="margin-top:14px;">
            ${sent.map((m) => `
              <div class="qd-monthly__row ${m.idx === bestIdx ? 'best' : ''}">
                ${m.idx === bestIdx ? '<span class="qd-monthly__badge">BEST</span>' : ''}
                <div class="qd-monthly__term">${m.term}<em>개월</em></div>
                <div class="qd-monthly__cond">
                  보증금 <b>${m.dep}%</b> · 선납 <b>${m.pre}%</b><br>
                  만기인수 ${((m.residualPct || 0) * 100).toFixed(0)}%
                </div>
                <div class="qd-monthly__price">
                  <span class="price">${fmt(m.monthly)}</span><span class="unit">원</span>
                  <div class="residual">만기 ${fmt(m.residualAmt)}원</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const logoUrl = companyConfig.logo_url;
  return `
    <div class="quote-doc">
      <div class="qd-hero">
        ${showLogo && logoUrl ? `<img class="qd-hero__logo" src="${logoUrl}" alt="${companyConfig.name || ''}" />` : ''}
        <div class="qd-hero__title">신차 장기렌터카 견적서</div>
        <div class="qd-hero__meta">
          <span><b>견적번호</b> ${quoteNo}</span>
          <span><b>유효기간</b> ${expireStr}까지</span>
        </div>
      </div>

      <div class="qd-section">
        <div class="qd-people">
          <div class="qd-people__col">
            <h4>고객</h4>
            <div class="name">${[customer.name ? `${customer.name} 님` : '', fmtTel(customer.tel)].filter(Boolean).join(' · ') || '-'}</div>
          </div>
          <div class="qd-people__col">
            <h4>담당자</h4>
            <div class="name">${[staff.name, fmtTel(staff.tel)].filter(Boolean).join(' · ') || '-'}</div>
          </div>
        </div>
      </div>

      <!-- 공통 견적 조건 -->
      <div class="qd-section">
        <div class="qd-section__label">CONDITION</div>
        <div class="qd-info-grid">
          <div class="qd-info-card">
            <h5>견적 조건</h5>
            <div class="kv"><span class="k">신용등급</span><span class="v">${cond.credit || ''}</span></div>
            <div class="kv"><span class="k">약정주행</span><span class="v">${cond.km || ''}만km/년</span></div>
            <div class="kv"><span class="k">보증금</span><span class="v">${cond.dep ?? ''}%</span></div>
            <div class="kv"><span class="k">선납금</span><span class="v">${cond.pre ?? ''}%</span></div>
          </div>
          <div class="qd-info-card">
            <h5>보험 · 정비</h5>
            <div class="kv"><span class="k">대물</span><span class="v">${cond.insProperty || '1억'}</span></div>
            <div class="kv"><span class="k">추가운전자</span><span class="v">${cond.extraDriver || '없음'}</span></div>
            <div class="kv"><span class="k">정비</span><span class="v">${cond.svc || ''}</span></div>
            <div class="kv"><span class="k">긴급출동</span><span class="v">5회/년</span></div>
          </div>
        </div>
      </div>

      ${compareTableHtml}

      ${vehicleCards}

      <!-- 공통 노트 -->
      <div class="qd-section">
        <div class="qd-section__label">NOTES</div>
        <ul class="qd-notes">
          <li>상기 견적은 제조사 사정·조세정책 등에 의해 변경될 수 있습니다.</li>
          <li>당사 심사결과에 따라 보증계약(보증/선납금, 공동임차인)이 추가될 수 있습니다.</li>
          <li>월 대여료에 자동차보험·정비·검사·자동차세가 모두 포함됩니다.</li>
          <li>중도해지 시 수수료가 발생됩니다 (기간별 상이, 약정서 참고).</li>
        </ul>
      </div>

      <div class="qd-section">
        <div class="qd-section__label">REQUIRED DOCUMENTS</div>
        <div class="qd-docs">
          <div class="qd-docs__item"><b>공통</b>주민등록등본 · 운전면허증 · 운전경력증명원 · 인감증명서 · 소득/재산 증빙 · 자동이체통장</div>
          <div class="qd-docs__item"><b>사업자</b>사업자등록증 · 법인등기부등본 · 법인인감증명서</div>
          <div class="qd-docs__item"><b>추가운전자</b>주민등록등본 · 운전면허증 · 운전경력증명원</div>
        </div>
      </div>

      ${showLogo ? `<div class="qd-footer">
        <div class="qd-footer__bank">
          <span class="label">계약금 입금</span> <b>신한은행 140-013-750928 웰릭스모빌리티㈜</b>
        </div>
      </div>` : ''}
    </div>
  `;
}
