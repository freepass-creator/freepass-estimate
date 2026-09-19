// 손님용 견적 뷰어 — ?q=<id> 로 접속 시 견적서 풀스크린 표시 (read-only)
// PC viewport: 영업 미리보기와 동일한 official 견적서 (buildOfficialQuoteHtml)
// 모바일: 기존 카드형 모바일 레이아웃
import { loadQuote, markQuoteAccessed } from './firebase/quotes.js';
import { buildOfficialQuoteHtml } from './lib/build-quote-html.js';
import { fmt, krw, guessColor } from './lib/format.js';

const params = new URLSearchParams(location.search);
const quoteId = params.get('q');

if (quoteId) {
  document.documentElement.classList.add('customer-mode');
  bootCustomerView(quoteId);
}

// 모바일 viewport 판정
const isMobile = () => window.innerWidth < 768;

async function bootCustomerView(id) {
  // body 안의 모든 영업용 UI 숨김
  document.addEventListener('DOMContentLoaded', () => {
    document.body.innerHTML = `
      <div id="cv-loading" class="cv-loading">
        <i class="ph ph-spinner"></i>
        <p>견적서를 불러오고 있습니다...</p>
      </div>
    `;
    render(id);
  });
  if (document.readyState !== 'loading') {
    document.body.innerHTML = `<div id="cv-loading" class="cv-loading"><i class="ph ph-spinner"></i><p>견적서를 불러오고 있습니다...</p></div>`;
    render(id);
  }
}

async function render(id) {
  try {
    const quote = await loadQuote(id);
    if (!quote) {
      document.body.innerHTML = `
        <div class="cv-error">
          <i class="ph ph-warning-circle"></i>
          <h2>견적서를 찾을 수 없습니다</h2>
          <p>링크가 만료되었거나 잘못된 견적번호입니다.<br>담당자에게 다시 요청해 주세요.</p>
        </div>`;
      return;
    }
    // 접근 로그 (비동기, 에러 무시)
    markQuoteAccessed(id).catch(() => {});

    // PC viewport — 영업 미리보기와 동일한 official 견적서 렌더
    if (!isMobile()) {
      const today = new Date(quote.created_at || Date.now());
      const expireDate = new Date(quote.expires_at || today.getTime() + 7*86400000);
      const quoteNo = today.toISOString().slice(0,10).replace(/-/g,'') + '-' + (quote.id || '0000').slice(-4);
      document.body.innerHTML = `<div class="cv-shell cv-shell--pc">` +
        buildOfficialQuoteHtml({
          vehicles:      quote.vehicles || [],
          customer:      quote.customer || {},
          staff:         quote.staff || {},
          cond:          quote.cond || {},
          send:          quote.send || [],
          quoteMeta:     { quoteNo, todayStr: today.toLocaleDateString('ko-KR'), expireStr: expireDate.toLocaleDateString('ko-KR') },
          companyConfig: { name: '웰릭스 모빌리티', logo_url: '/welrix-ci.png' },
          showLogo:      true,
        }) +
      `</div>`;
      return;
    }
    // 모바일 viewport — 기존 카드형 레이아웃 (아래 코드 그대로)

    const expireDate = new Date(quote.expires_at || quote.created_at + 7*86400000);
    const expireStr = expireDate.toLocaleDateString('ko-KR');
    const createdStr = new Date(quote.created_at).toLocaleDateString('ko-KR');

    const vehicles = quote.vehicles || [];
    const sendArr = quote.send || [true, true, true, true];
    const cond = quote.cond || {};
    const customer = quote.customer || {};
    const staff = quote.staff || {};

    // 가로 비교표 (차종 2+ 일 때)
    const visibleTerms = (vehicles[0]?.monthly || []).filter((m) => sendArr[m.idx] !== false).map(m => m.idx);
    function termCell(veh, termIdx) {
      const m = (veh.monthly || []).find(x => x.idx === termIdx);
      if (!m) return { val: Infinity };
      return { val: m.monthly, raw: m };
    }
    const compareTableHtml = vehicles.length > 1 ? `
      <div class="qd-section">
        <div class="qd-section__label">COMPARISON</div>
        <div class="qd-compare">
          <table>
            <thead>
              <tr>
                <th class="row-label"></th>
                ${vehicles.map(veh => `
                  <th><span class="brand-tiny">${veh.brand || ''}</span>${veh.model || ''}<br>${veh.trim_name || ''}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              <tr class="price"><th>차량가</th>${vehicles.map(v => `<td>${fmt(v.totalKrw || 0)}</td>`).join('')}</tr>
              <tr><th>외장</th>${vehicles.map(v => `<td>${v.colorExt || '-'}</td>`).join('')}</tr>
              <tr><th>옵션</th>${vehicles.map(v => `<td>${(v.options || []).length ? (v.options.length + '개') : '-'}</td>`).join('')}</tr>
              ${visibleTerms.map(termIdx => {
                const cells = vehicles.map(v => termCell(v, termIdx));
                const minVal = Math.min(...cells.map(c => c.val));
                const termLabel = vehicles[0]?.monthly?.find(m => m.idx === termIdx)?.term + '개월';
                return `
                  <tr class="term">
                    <th>${termLabel}</th>
                    ${cells.map(c => {
                      if (!c.raw) return '<td>-</td>';
                      const isBest = c.val === minVal;
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

    const vehicleCards = vehicles.map((veh, vIdx) => {
      const sent = (veh.monthly || []).filter((m) => sendArr[m.idx] !== false);
      const bestIdx = sent.length > 1 ? sent.reduce((b, m) => m.monthly < b.monthly ? m : b, sent[0]).idx : -1;
      const extColorHex = guessColor(veh.colorExt);
      const intColorHex = guessColor(veh.colorInt);
      const opts = veh.options || [];
      // 차량별 부가 (작게 하단에)
      const tintFee = veh.snapshot?.tintFee || 0;
      const deliveryFee = veh.snapshot?.deliveryFee || 0;
      const extrasList = veh.snapshot?.extras || {};
      const extrasNames = [extrasList.blackbox, extrasList.navi, extrasList.hipass].filter(Boolean);
      const sideBits = [];
      if (tintFee) sideBits.push(`선팅 ${veh.snapshot?.tint?.product || ''}`);
      if (deliveryFee) sideBits.push(`탁송 ${veh.snapshot?.deliveryCity || ''}`);
      if (extrasNames.length) sideBits.push(`용품 ${extrasNames.length}종`);
      return `
        <div class="qd-section qd-section--card">
          <div class="qd-section__label">VEHICLE ${vehicles.length > 1 ? (vIdx + 1) + ' / ' + vehicles.length : ''}</div>
          <div class="qd-vehicle">
            <div class="qd-vehicle__top">
              <div>
                <div class="qd-vehicle__title">${veh.brand || ''}</div>
                <div class="qd-vehicle__name">${veh.model || ''} ${veh.trim_name || ''}</div>
                <div class="qd-vehicle__sub">${(veh.variant || '')}</div>
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
                ${opts.map(o => `<span class="opt-chip">${o}</span>`).join('')}
              </div>
            ` : ''}
            ${sideBits.length ? `
              <div class="qd-vehicle__side">${sideBits.map(s => `<span>${s}</span>`).join(' · ')}</div>
            ` : ''}
          </div>
          ${vehicles.length === 1 ? `
            <div class="qd-monthly" style="margin-top:14px;">
              ${sent.map(m => `
                <div class="qd-monthly__row ${m.idx === bestIdx ? 'best' : ''}">
                  ${m.idx === bestIdx ? '<span class="qd-monthly__badge">BEST</span>' : ''}
                  <div class="qd-monthly__term">${m.term}<em>개월</em></div>
                  <div class="qd-monthly__cond">
                    보증금 <b>${m.dep}%</b> · 선납 <b>${m.pre}%</b><br>
                    만기인수 ${(m.residualPct*100).toFixed(0)}%
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

    document.body.innerHTML = `
      <div class="cv-shell">
        <div class="quote-doc">
          <div class="qd-hero">
            <div class="qd-hero__brand">WELRIX MOBILITY</div>
            <div class="qd-hero__title">신차 장기렌터카 견적서</div>
            <div class="qd-hero__meta">
              <span><b>견적일</b> ${createdStr}</span>
              <span><b>유효</b> ${expireStr}까지</span>
            </div>
          </div>

          <div class="qd-section">
            <div class="qd-people">
              <div class="qd-people__col">
                <h4>고객</h4>
                <div class="name">${customer.name || 'VIP 고객'} 님</div>
              </div>
              <div class="qd-people__col">
                <h4>담당자</h4>
                <div class="name">${staff.name || '웰릭스 모빌리티'}</div>
                <div class="tel">${staff.tel || ''}</div>
              </div>
            </div>
          </div>

          <div class="qd-section">
            <div class="qd-section__label">CONDITION</div>
            <div class="qd-info-grid">
              <div class="qd-info-card">
                <h5>견적 조건</h5>
                <div class="kv"><span class="k">약정주행</span><span class="v">${cond.km}만km/년</span></div>
                <div class="kv"><span class="k">보증금</span><span class="v">${cond.dep}%</span></div>
                <div class="kv"><span class="k">선납금</span><span class="v">${cond.pre}%</span></div>
              </div>
              <div class="qd-info-card">
                <h5>보험 · 정비</h5>
                <div class="kv"><span class="k">대물</span><span class="v">${cond.insProperty || '1억'}</span></div>
                <div class="kv"><span class="k">추가운전자</span><span class="v">${cond.extraDriver || '없음'}</span></div>
                <div class="kv"><span class="k">정비</span><span class="v">${cond.svc || '-'}</span></div>
                <div class="kv"><span class="k">긴급출동</span><span class="v">5회/년</span></div>
              </div>
            </div>
          </div>

          ${compareTableHtml}

          ${vehicleCards}

          <div class="qd-section">
            <div class="qd-section__label">NOTES</div>
            <ul class="qd-notes">
              <li>상기 견적은 제조사 사정·조세정책 등에 의해 변경될 수 있습니다.</li>
              <li>당사 심사결과에 따라 보증계약이 추가될 수 있습니다.</li>
              <li>월 대여료에 자동차보험·정비·검사·자동차세가 모두 포함됩니다.</li>
              <li>중도해지 시 수수료가 발생됩니다 (기간별 상이).</li>
            </ul>
          </div>

          <div class="qd-footer">
            <div class="qd-footer__bank">
              <span class="label">계약금 입금</span> <b>신한은행 140-013-750928 웰릭스모빌리티㈜</b>
            </div>
            <div class="qd-footer__sign">
              <div class="staff">담당 · <b>${staff.name || '웰릭스 모빌리티'}</b></div>
              <div class="tel">${staff.tel || ''}</div>
            </div>
          </div>
        </div>

        <div class="cv-cta">
          <a href="tel:${staff.tel || ''}" class="cv-cta__call">
            <i class="ph ph-phone-call"></i> 담당자 전화 문의
          </a>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('[customer-view]', e);
    document.body.innerHTML = `
      <div class="cv-error">
        <i class="ph ph-warning-circle"></i>
        <h2>견적서 로딩 실패</h2>
        <p>일시적인 오류입니다. 잠시 후 다시 시도해 주세요.<br><small>${e.message || e}</small></p>
      </div>`;
  }
}

