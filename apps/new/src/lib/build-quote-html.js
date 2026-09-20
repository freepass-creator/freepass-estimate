// 공식 견적서 HTML 빌더 (pure function) — 영업 미리보기, 출력, 손님 PC 뷰 공통 사용
// args 로 받은 데이터로만 빌드.

import { fmt, krw, fmtTel, guessColor } from './format.js';

const MAKER_LOGOS = {
  '현대': 'https://cdn.simpleicons.org/hyundai/002C5F',
  '기아':  'https://cdn.simpleicons.org/kia/05141F',
  '제네시스': '/genesis.svg',
};

/**
 * @param {object} a
 * @param {Array}  a.vehicles      cart-style vehicles ([{brand, model, trim_name, variant, fuel, displacement_cc, totalKrw, monthly[], snapshot, options, colorExt, colorInt, trim_price_manwon, options_price_manwon}])
 * @param {object} a.customer      { name, tel }
 * @param {object} a.staff         { name, tel }
 * @param {object} a.cond          { credit, km, svc, insProperty, extraDriver, ... }
 * @param {Array}  a.send          [bool, bool, bool] - 시나리오 발송 여부
 * @param {object} a.quoteMeta     { quoteNo, todayStr, expireStr }
 * @param {object} a.companyConfig { name, logo_url }
 * @param {boolean} a.showLogo     CI 노출 여부
 */
export function buildOfficialQuoteHtml(a) {
  const { vehicles = [], customer = {}, staff = {}, cond = {}, send = [], quoteMeta = {}, companyConfig = {}, showLogo = true } = a;
  const { quoteNo = '', todayStr = '', expireStr = '' } = quoteMeta;

  const vehicleBlocks = vehicles.map((veh, vIdx) => {
    const sent = (veh.monthly || []).filter((m) => send[m.idx] !== false);
    const bestVal = sent.length > 1 ? Math.min(...sent.map(m => m.monthly)) : -1;
    const trimKrw = (veh.trim_price_manwon || 0) * 10000;
    const optsKrw = (veh.options_price_manwon || 0) * 10000;
    const tintFee = veh.snapshot?.tintFee || 0;
    const deliveryFee = veh.snapshot?.deliveryFee || 0;
    const extras = veh.snapshot?.extras || {};
    const extrasNames = [extras.blackbox, extras.navi, extras.hipass].filter(Boolean);

    const logoUrl = MAKER_LOGOS[veh.brand];

    return `
      <div class="ofq-section">
        ${vehicles.length > 1 ? `
          <div class="ofq-vehicle-head">
            <span>견적 ${vIdx + 1} / ${vehicles.length}</span>
            <span class="sep">|</span>
            <b>${veh.brand || ''} ${veh.model || ''}</b>
            <span class="sep">·</span>
            <span>${veh.trim_name || ''}</span>
          </div>
        ` : ''}
        <div class="ofq-section__title"><i class="ph ph-car"></i>차량 정보</div>
        <div class="ofq-vcard">
          <div class="ofq-vcard__head">
            <div class="ofq-vcard__title">
              ${logoUrl ? `<img class="vlogo" src="${logoUrl}" alt="${veh.brand}" />` : ''}
              <div>
                <div class="vname">${[veh.brand, veh.model, veh.variant, veh.trim_name].filter(Boolean).join(' ')}</div>
                <div class="vmeta">${[veh.fuel, veh.displacement_cc ? veh.displacement_cc + 'cc' : null].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div class="ofq-vcard__total">
              <div class="label">총 차량가격</div>
              <div class="value">${krw(veh.totalKrw || 0)}</div>
              <div class="breakdown">
                트림 <b>${krw(trimKrw)}</b>${optsKrw ? ` · 옵션 +<b>${krw(optsKrw)}</b>` : ''}
              </div>
            </div>
          </div>

          ${(veh.options || []).length ? `
            <div class="ofq-vcard__row">
              <span class="row-key"><i class="ph ph-list-checks"></i>옵션</span>
              <div class="qp-opt-chips">${veh.options.map(o => `<span class="badge badge--brand">${o}</span>`).join('')}</div>
            </div>
          ` : ''}

          <div class="ofq-meta-grid">
            <div class="meta-item">
              <span class="meta-key">외장 색상</span>
              <span class="meta-val">${veh.colorExt
                ? `<span class="swatch-dot" style="background:${guessColor(veh.colorExt)}"></span>${veh.colorExt}`
                : `<span class="meta-empty">미선택</span>`}</span>
            </div>
            <div class="meta-item">
              <span class="meta-key">내장 색상</span>
              <span class="meta-val">${veh.colorInt
                ? `<span class="swatch-dot" style="background:${guessColor(veh.colorInt)}"></span>${veh.colorInt}`
                : `<span class="meta-empty">미선택</span>`}</span>
            </div>
            <div class="meta-item">
              <span class="meta-key">탁송</span>
              <span class="meta-val">${(deliveryFee && veh.snapshot?.deliveryCity)
                ? veh.snapshot.deliveryCity
                : `<span class="meta-empty">미선택</span>`}</span>
            </div>
            <div class="meta-item">
              <span class="meta-key">선팅</span>
              <span class="meta-val">${(tintFee && veh.snapshot?.tint?.product)
                ? veh.snapshot.tint.product
                : `<span class="meta-empty">미선택</span>`}</span>
            </div>
            ${extrasNames.length ? `
            <div class="meta-item">
              <span class="meta-key">용품</span>
              <span class="meta-val">${extrasNames.join(', ')}</span>
            </div>` : ''}
          </div>
        </div>

        <div class="ofq-section__title" style="margin-top:14px;"><i class="ph ph-calendar-blank"></i>계약 정보 (월 대여료) <span class="unit">VAT 포함</span></div>
        <div class="ofq-table-wrap">
          <table class="ofq-table ofq-terms-table">
            <thead>
              <tr>
                <th class="row-label">구분</th>
                ${sent.map(m => `<th>${m.term}개월</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${cond.discount ? `<tr><th class="row-label">추가할인</th>${sent.map(() => `<td style="color:#e1141e;font-weight:600;">−${fmt(cond.discount)}만원</td>`).join('')}</tr>` : ''}
              <tr><th class="row-label">약정주행</th>${sent.map(() => `<td>${cond.km}만km/년</td>`).join('')}</tr>
              <tr><th class="row-label">만기처리</th>${sent.map(() => `<td>만기 협의</td>`).join('')}</tr>
              <tr><th class="row-label">만기인수금액</th>${sent.map(m => `<td>${(m.residualPct*100).toFixed(0)}% · ${fmt(m.residualAmt)}원</td>`).join('')}</tr>
              <tr><th class="row-label">정비서비스</th>${sent.map(() => `<td>${cond.svc}</td>`).join('')}</tr>
              <tr><th class="row-label">보증금</th>${sent.map(m => `<td>${m.dep}% · ${fmt(m.depAmt)}원</td>`).join('')}</tr>
              <tr><th class="row-label">선납금</th>${sent.map(m => `<td>${m.pre}% · ${fmt(m.preAmt)}원</td>`).join('')}</tr>
              <tr class="monthly">
                <th class="row-label">월 대여료</th>
                ${sent.map(m => `<td class="${m.monthly === bestVal && sent.length > 1 ? 'best' : ''}">${fmt(m.monthly)}원</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  const cfgLogoUrl = companyConfig.logo_url;
  const showLogoImg = showLogo && cfgLogoUrl;

  return `
    <div class="quote-doc official">
      <div class="ofq-hero">
        <div class="ofq-hero__left">
          ${showLogoImg ? `<img class="ofq-hero__logo" src="${cfgLogoUrl}" alt="${companyConfig.name || ''}" />` : ''}
          <div class="title">신차 장기렌터카 견적서</div>
        </div>
        <div class="ofq-hero__right">
          <div><b>견적번호</b> ${quoteNo}</div>
          <div><b>견적일자</b> ${todayStr}</div>
          <div><b>유효기간</b> ${expireStr} 까지</div>
        </div>
      </div>

      <div class="ofq-infobar">
        <div class="ofq-infobar__item">
          <span class="ofq-infobar__label">수신</span>
          <span class="ofq-infobar__value">${[customer.name ? `<b>${customer.name}</b> 귀하` : '', fmtTel(customer.tel)].filter(Boolean).join(' · ') || '-'}</span>
        </div>
        <div class="ofq-infobar__divider"></div>
        <div class="ofq-infobar__item">
          <span class="ofq-infobar__label">담당</span>
          <span class="ofq-infobar__value">${[staff.name, fmtTel(staff.tel)].filter(Boolean).join(' · ') || '-'}</span>
        </div>
      </div>

      ${vehicleBlocks}

      <div class="ofq-section">
        <div class="ofq-section__title"><i class="ph ph-shield-check"></i>보험가입 내역 <span class="unit">사고처리 1544-3871</span></div>
        <div class="ofq-table-wrap">
          <table class="ofq-table ofq-ins-table">
            <tr>
              <th>운전연령</th><td>만 26세 이상</td>
              <th>대인 Ⅰ/Ⅱ</th><td>무한</td>
              <th>대물</th><td>${cond.insProperty || '1억'}</td>
              <th>자손</th><td>1억</td>
            </tr>
            <tr>
              <th>무보험자상해</th><td>2억</td>
              <th>사고면책금</th><td>30만원~</td>
              <th>임직원특약</th><td>미가입</td>
              <th>추가운전자</th><td>${cond.extraDriver || '없음'}</td>
            </tr>
            <tr>
              <th>긴급출동</th><td colspan="7" class="full">가입 (5회/년, 10km · 등본/가족관계증명서 직계가족 1인 추가비용 없음, 그 외 1인 5만원)</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="ofq-section">
        <div class="ofq-section__title"><i class="ph ph-wrench"></i>부가서비스 · 정비상품 (${cond.svc || '웰스 Basic'})</div>
        <div class="ofq-table-wrap">
          <table class="ofq-table ofq-svc-table">
            <thead>
              <tr>
                <th>정비 방식</th><th>정비 주기</th><th>소모품 교환</th>
                <th>사고처리</th><th>검사대행</th><th>사고대차</th><th>고장대차</th>
              </tr>
            </thead>
            <tbody>
              ${cond.svc === '웰스 Self' ? `
              <tr>
                <td>정비제외 (고객 자체정비)</td><td>없음</td>
                <td>없음</td><td>지원</td><td>O</td><td>X</td><td>X</td>
              </tr>` : `
              <tr>
                <td>방문 점검 (정비사 방문)</td><td>6개월 1회</td>
                <td>엔진오일 등 한정</td><td>지원</td><td>O</td><td>X</td><td>X</td>
              </tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="ofq-section">
        <div class="ofq-section__title"><i class="ph ph-file-text"></i>제출서류 안내</div>
        <div class="ofq-table-wrap">
          <table class="ofq-table ofq-docs-table">
            <tr>
              <th>공통</th>
              <td>① 주민등록등본 ② 운전면허증 사본 ③ 운전경력증명원 ④ 인감증명서 ⑤ 소득/재산 증빙 서류 ⑥ 자동이체통장 사본
                  <br><small>* 소득서류 — 개인: 건강보험납입증명서·급여통장 사본 / 사업자: 부가세과세표준증명원·소득금액증명원</small></td>
            </tr>
            <tr><th>사업자</th><td>① 사업자등록증 사본 ② 법인등기부등본 ③ 법인인감증명서</td></tr>
            <tr><th>추가운전자</th><td>① 주민등록등본 ② 운전면허증 사본 ③ 운전경력증명원</td></tr>
          </table>
        </div>
      </div>

      <div class="ofq-section">
        <div class="ofq-section__title"><i class="ph ph-note-pencil"></i>주요 계약사항</div>
        <ol class="ofq-notes">
          <li>상기 견적은 제조사 사정, 조세정책 등에 의해 변경될 수 있습니다.</li>
          <li>당사 심사결과에 따라 신용 또는 보증계약(보증/선납금, 공동임차인)이 추가될 수 있습니다.</li>
          <li>월 대여료에는 자동차 보험료, 정비서비스/차량검사비, 자동차세가 포함됩니다.</li>
          <li>중도해지 시 중도해지수수료가 발생되며, 기간별 상이합니다. (약정서 참고)</li>
        </ol>
        ${showLogo ? `<div class="ofq-footer__bank">
          <span>계약금 입금계좌</span> · <b>신한은행 140-013-750928 웰릭스모빌리티㈜</b>
        </div>` : ''}
      </div>

      <div class="ofq-spacer"></div>

      ${showLogo ? (() => {
        const ci = companyConfig.company_info || {};
        const parts = [
          ci.full_name && `<b>${ci.full_name}</b>`,
          ci.ceo && `대표 ${ci.ceo}`,
          ci.biz_no && `사업자 ${ci.biz_no}`,
          ci.address,
          ci.phone && `T ${ci.phone}`,
          ci.fax && `F ${ci.fax}`,
          ci.email,
          ci.homepage,
        ].filter(Boolean);
        return parts.length ? `
        <div class="ofq-footer">
          <div class="ofq-footer__company">${parts.join(' · ')}</div>
        </div>` : '';
      })() : ''}
    </div>
  `;
}
