// 포맷터 SSOT — 전 컴포넌트가 import 해서 사용. 인라인 재정의 금지.
// Intl.NumberFormat 은 무거우므로 모듈 레벨 싱글톤 (매 호출마다 new 생성 X)

const _KRW_FMT = new Intl.NumberFormat('ko-KR');
export const fmt = (n) => _KRW_FMT.format(Math.round(n || 0));
export const krw = (n) => `${fmt(n)}원`;

// 점진적 하이픈 — 입력 중에도 자동 적용 (PC 의 견적서 표시도 동일 결과)
export function fmtTel(tel) {
  if (!tel) return '';
  const d = String(tel).replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  // 휴대폰 010/011~019
  if (/^01[016789]/.test(d)) {
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  }
  // 02 (서울)
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0,2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
    return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6)}`;
  }
  // 0XX (031~064 지역번호)
  if (/^0[3-6]/.test(d)) {
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  }
  // 1544/1588 등 대표번호
  if (/^1[5-9]/.test(d)) {
    if (d.length <= 4) return d;
    return `${d.slice(0,4)}-${d.slice(4)}`;
  }
  return d;
}

export function guessColor(name) {
  if (!name) return '#e5e5e5';
  const n = name.toLowerCase();
  if (n.includes('블랙') || n.includes('어비스') || n.includes('잉크')) return '#1a1a1a';
  if (n.includes('화이트') || n.includes('아틀라스') || n.includes('스노우')) return '#f5f5f5';
  if (n.includes('펄')) {
    if (n.includes('블루') || n.includes('네이비')) return '#3a5d8f';
    if (n.includes('레드') || n.includes('적')) return '#a83232';
    return '#e8e6e1';
  }
  if (n.includes('그레이') || n.includes('그래핀') || n.includes('실버')) return '#9aa0a6';
  if (n.includes('블루') || n.includes('네이비') || n.includes('스카이')) return '#3a5d8f';
  if (n.includes('레드') || n.includes('적') || n.includes('루비')) return '#a83232';
  if (n.includes('그린') || n.includes('미라지') || n.includes('세이지')) return '#4a6d4e';
  if (n.includes('베이지') || n.includes('샌드')) return '#c9b896';
  if (n.includes('브라운') || n.includes('초콜릿')) return '#5c3d28';
  if (n.includes('매트')) return '#444';
  if (n.includes('투톤')) return 'linear-gradient(90deg, #1a1a1a 50%, #e8e6e1 50%)';
  if (n.includes('아마존')) return '#5a6b58';
  if (n.includes('사이버')) return '#4a4f5a';
  if (n.includes('에코트로닉')) return '#7d8a93';
  return '#9aa0a6';
}
