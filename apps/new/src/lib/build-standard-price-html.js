// 웰릭스 표준 가격표 HTML 빌더 (SSOT) — StandardPriceTable.vue 전용.
// 체크한 트림들을 "쭉 정리한" 가격표 한 장(행=트림, 열=차량가/36·48·60개월)으로 생성.
// 손님 개별 견적서(build-multi-quote-html.js, 견적바구니용 비교표+상세카드)와는 별개.
// 부작용 없음(pure): rows + 조건/회사설정을 받아 HTML 문자열만 반환.
import { fmt, fmtTel } from './format.js';

const TERMS = [36, 48, 60];

/**
 * 표준 가격표 HTML 생성.
 * @param {object}   args
 * @param {object[]} args.rows  — 선택된 트림 배열. 각 항목:
 *        { brand, model, trim, price, monthlies: [m36, m48, m60] }  (monthly 는 원 단위 숫자 or null)
 * @param {object}   args.cond  — 표준 조건 표기용 { credit, km, dep, pre, insProperty, svc }
 * @param {object}   [args.staff] — 담당자 { name, tel } (고객명은 표기 안 함)
 * @param {object}   [args.companyConfig] — { name, logo_url }
 * @param {boolean}  [args.showLogo=true]
 * @param {string}   [args.dateStr] — 기준일 표기 (미지정 시 생략)
 * @returns {string} 가격표 HTML (.spq-doc)
 */
export function buildStandardPriceHtml({ rows, cond = {}, staff = {}, companyConfig = {}, showLogo = true, dateStr = '' }) {
  if (!rows || !rows.length) return '';

  // 브랜드 → 모델 순으로 그룹핑 (연속 동일 그룹 묶음). 입력 순서(vehicles.json) 유지.
  const groups = [];
  let cur = null;
  for (const r of rows) {
    const key = `${r.brand}||${r.model}`;
    if (!cur || cur.key !== key) {
      cur = { key, brand: r.brand, model: r.model, items: [] };
      groups.push(cur);
    }
    cur.items.push(r);
  }

  const brands = [...new Set(rows.map(r => r.brand))];
  const brandLabel = brands.join(' · ');

  const cell = (m) => m != null ? `${fmt(m)}<small>원</small>` : '—';

  const bodyRows = groups.map(g => {
    const head = `
      <tr class="spq-group">
        <td colspan="5"><span class="spq-group__brand">${g.brand}</span>${g.model}</td>
      </tr>`;
    const items = g.items.map(r => `
      <tr>
        <td class="spq-trim">${r.trim || ''}</td>
        <td class="spq-num spq-num--price">${fmt(r.price || 0)}<small>원</small></td>
        <td class="spq-num">${cell(r.monthlies?.[0])}</td>
        <td class="spq-num">${cell(r.monthlies?.[1])}</td>
        <td class="spq-num">${cell(r.monthlies?.[2])}</td>
      </tr>`).join('');
    return head + items;
  }).join('');

  const logoUrl = companyConfig.logo_url;
  const staffName = (staff.name || '').trim();
  const staffTel = (staff.tel || '').trim();
  const staffHtml = (staffName || staffTel)
    ? `<div class="spq-staff"><span class="spq-staff__k">담당</span>${[staffName, staffTel ? fmtTel(staffTel) : ''].filter(Boolean).join(' · ')}</div>`
    : '';
  const condTxt = [
    cond.credit || '중신용',
    `보증금 ${cond.dep ?? 10}%`,
    `선납 ${cond.pre ?? 0}%`,
    `약정 ${cond.km || 2}만km/년`,
    `보험 대물 ${cond.insProperty || '1억'}`,
    cond.svc || '웰스 Basic',
  ].join(' · ');

  return `
    <div class="spq-doc">
      <header class="spq-hero">
        ${showLogo && logoUrl ? `<img class="spq-hero__logo" src="${logoUrl}" alt="${companyConfig.name || ''}" />` : ''}
        <div class="spq-hero__title">신차 장기렌터카 표준 가격표</div>
        <div class="spq-hero__meta">${[brandLabel, dateStr ? `${dateStr} 기준` : ''].filter(Boolean).join(' · ')}</div>
      </header>

      <div class="spq-bar">
        <div class="spq-cond">표준 조건 &nbsp;<b>${condTxt}</b></div>
        ${staffHtml}
      </div>

      <table class="spq-table">
        <thead>
          <tr>
            <th class="spq-th-trim">차종 · 트림</th>
            <th>차량가</th>
            ${TERMS.map(t => `<th>${t}개월</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>

      <div class="spq-foot">
        <ul>
          <li>월 대여료에 <b>자동차보험 · 정비 · 검사 · 자동차세</b>가 모두 포함됩니다.</li>
          <li>상기 금액은 제조사 사정 · 조세정책 등에 따라 변경될 수 있으며, 심사결과에 따라 조건이 달라질 수 있습니다.</li>
        </ul>
        ${showLogo ? `<div class="spq-foot__bank"><span>계약금 입금</span> <b>신한은행 140-013-750928 웰릭스모빌리티㈜</b></div>` : ''}
      </div>
    </div>
  `;
}

// 가격표 전용 CSS — 인쇄 새 탭 / 오프스크린 캡쳐에 인라인 주입 (자체 완결, quote-doc.css 불필요)
export const STANDARD_PRICE_CSS = `
.spq-doc {
  width: 760px; max-width: 100%; margin: 0 auto;
  background: #fff; color: var(--ink-1, #0a0a0a);
  font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
  padding: 28px 30px 24px;
  font-variant-numeric: tabular-nums;
}
.spq-hero { text-align: center; padding-bottom: 14px; border-bottom: 2px solid var(--brand, #0D4E8B); }
.spq-hero__logo { height: 26px; width: auto; object-fit: contain; margin-bottom: 10px; }
.spq-hero__title { font-size: 19px; font-weight: 800; letter-spacing: -0.4px; color: var(--ink-1, #0a0a0a); }
.spq-hero__meta { font-size: 12px; color: var(--ink-3, #737373); margin-top: 5px; }
.spq-bar {
  display: flex; align-items: stretch; gap: 8px; margin: 14px 0 12px;
}
.spq-cond {
  flex: 1; min-width: 0;
  font-size: 11.5px; color: var(--ink-3, #737373);
  background: var(--bg-soft, #fafafa);
  padding: 9px 12px; border-radius: 6px;
  display: flex; align-items: center;
}
.spq-cond b { color: var(--ink-2, #404040); font-weight: 600; }
.spq-staff {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; color: var(--ink-1, #0a0a0a);
  background: var(--brand-50, #eef4fa);
  border: 1px solid var(--brand-100, #cfdce7);
  padding: 9px 14px; border-radius: 6px; white-space: nowrap;
}
.spq-staff__k {
  font-size: 10px; font-weight: 600; color: var(--brand, #0D4E8B);
  letter-spacing: 0.3px;
}
.spq-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.spq-table thead th {
  background: var(--ink-1, #0a0a0a); color: #fff;
  font-weight: 600; font-size: 11px; letter-spacing: 0.2px;
  padding: 9px 10px; text-align: right; white-space: nowrap;
}
.spq-table thead th.spq-th-trim { text-align: left; }
.spq-group td {
  background: var(--brand-50, #eef4fa);
  font-weight: 700; font-size: 12px; color: var(--ink-1, #0a0a0a);
  padding: 7px 10px; letter-spacing: -0.2px;
  border-top: 1px solid var(--brand-100, #cfdce7);
}
.spq-group__brand {
  display: inline-block; font-size: 10px; font-weight: 600;
  color: var(--brand, #0D4E8B); margin-right: 7px; letter-spacing: 0.3px;
}
.spq-table tbody tr:not(.spq-group) { border-bottom: 1px solid var(--line, #f0f0f0); }
.spq-table tbody td { padding: 8px 10px; }
.spq-trim { color: var(--ink-2, #404040); font-size: 11.5px; }
.spq-num { text-align: right; white-space: nowrap; color: var(--ink-1, #0a0a0a); font-weight: 600; }
.spq-num small { font-size: 9px; color: var(--ink-4, #a3a3a3); font-weight: 400; margin-left: 1px; }
.spq-num--price { color: var(--ink-2, #404040); font-weight: 500; }
.spq-table tbody td.spq-num:nth-child(n+3) { color: var(--brand, #0D4E8B); }
.spq-foot { margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--line-2, #e5e5e5); }
.spq-foot ul { margin: 0 0 10px; padding-left: 16px; }
.spq-foot li { font-size: 10.5px; color: var(--ink-3, #737373); line-height: 1.6; }
.spq-foot li b { color: var(--ink-2, #404040); font-weight: 600; }
.spq-foot__bank { font-size: 11px; color: var(--ink-2, #404040); }
.spq-foot__bank span { color: var(--ink-4, #a3a3a3); margin-right: 4px; }
.spq-foot__bank b { color: var(--ink-1, #0a0a0a); font-weight: 600; }
@media print { .spq-doc { padding: 16px 18px; } }
`;
