// 차종(model) → URL slug 단일 매핑.
// 가이드 페이지 라우트(/guide/{slug}.html) 와 이미지 파일명에 공유.
// Hybrid 변형은 베이스와 같은 slug — 트림 비교표 안에서 분기.
export const MODEL_SLUG = {
  // 현대 (10 베이스)
  '더 뉴 캐스퍼': 'casper',
  '아반떼': 'avante',
  '아반떼 Hybrid': 'avante',
  '쏘나타 디 엣지': 'sonata',
  '쏘나타 디 엣지 Hybrid': 'sonata',
  '더 뉴 그랜저': 'grandeur',
  '더 뉴 그랜저 Hybrid': 'grandeur',
  '베뉴': 'venue',
  '코나': 'kona',
  '코나 Hybrid': 'kona',
  '투싼': 'tucson',
  '투싼 Hybrid': 'tucson',
  '싼타페': 'santafe',
  '싼타페 Hybrid': 'santafe',
  '디 올 뉴 팰리세이드': 'palisade',
  '디 올 뉴 팰리세이드 Hybrid': 'palisade',
  '포터2': 'porter',
  // 기아 (10 베이스)
  '모닝': 'morning',
  '레이': 'ray',
  'K5': 'k5',
  'K8': 'k8',
  'K9': 'k9',
  '셀토스': 'seltos',
  '스포티지': 'sportage',
  '쏘렌토': 'sorento',
  '카니발': 'carnival',
  '니로': 'niro',
  // 제네시스 (5)
  'G70': 'g70',
  'G80': 'g80',
  'G90': 'g90',
  'GV70': 'gv70',
  'GV80': 'gv80',
};

// slug → 대표 모델명 (Hybrid가 아닌 베이스)
export const SLUG_BASE_MODEL = {};
for (const [model, slug] of Object.entries(MODEL_SLUG)) {
  if (!model.includes('Hybrid') && !SLUG_BASE_MODEL[slug]) {
    SLUG_BASE_MODEL[slug] = model;
  }
}

// slug → 브랜드 + 한국어 라벨 (tagline 등에 활용)
export const SLUG_META = {
  casper:   { brand: '현대',    tagline: '입문 SUV',     body: 'compact' },
  avante:   { brand: '현대',    tagline: '국민 세단',     body: 'sedan' },
  sonata:   { brand: '현대',    tagline: '중형 세단',     body: 'sedan' },
  grandeur: { brand: '현대',    tagline: '플래그십 세단',  body: 'sedan' },
  venue:    { brand: '현대',    tagline: '소형 SUV',     body: 'compact' },
  kona:     { brand: '현대',    tagline: '준중형 SUV',    body: 'suv-mid' },
  tucson:   { brand: '현대',    tagline: '중형 SUV',     body: 'suv-mid' },
  santafe:  { brand: '현대',    tagline: '중형 SUV',     body: 'suv-large' },
  palisade: { brand: '현대',    tagline: '대형 SUV',     body: 'suv-large' },
  porter:   { brand: '현대',    tagline: '소상공 트럭',   body: 'truck' },
  morning:  { brand: '기아',    tagline: '경형 세단',     body: 'compact' },
  ray:      { brand: '기아',    tagline: '경형 박스',     body: 'compact' },
  k5:       { brand: '기아',    tagline: '중형 세단',     body: 'sedan' },
  k8:       { brand: '기아',    tagline: '준대형 세단',    body: 'sedan' },
  k9:       { brand: '기아',    tagline: '대형 세단',     body: 'sedan' },
  seltos:   { brand: '기아',    tagline: '준중형 SUV',    body: 'suv-mid' },
  sportage: { brand: '기아',    tagline: '중형 SUV',     body: 'suv-mid' },
  sorento:  { brand: '기아',    tagline: '중형 SUV',     body: 'suv-large' },
  carnival: { brand: '기아',    tagline: '미니밴 1위',    body: 'minivan' },
  niro:     { brand: '기아',    tagline: '하이브리드 SUV', body: 'suv-mid' },
  g70:      { brand: '제네시스', tagline: '프리미엄 세단',  body: 'luxury' },
  g80:      { brand: '제네시스', tagline: '비즈니스 세단',  body: 'luxury' },
  g90:      { brand: '제네시스', tagline: '플래그십 세단',  body: 'luxury' },
  gv70:     { brand: '제네시스', tagline: '프리미엄 SUV',  body: 'suv-mid' },
  gv80:     { brand: '제네시스', tagline: '대형 SUV',     body: 'suv-large' },
};

export const ALL_SLUGS = Object.keys(SLUG_META);

// 아직 제조사 공식 KV 못 받은 차종 — fallback 아이콘만 노출
// 현재: 25종 모두 확보 (현대 og:image, 기아/제네시스 SSR)
export const MISSING_IMAGES = new Set([]);

export function imageOf(slug) {
  if (MISSING_IMAGES.has(slug)) return null;
  return `/cars/${slug}.png`;
}
