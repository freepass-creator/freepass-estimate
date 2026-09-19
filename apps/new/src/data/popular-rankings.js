// 제조사/모델 인기순 (2024~2025 국내 판매 기준)
// PC index.html 인라인 POPULAR_BRAND/POPULAR_MODELS 와 동일한 값.
// rankBy 는 부분 매칭 — '그랜저' 가 '더 뉴 그랜저' / '더 뉴 그랜저 Hybrid' 둘 다 매칭.

export const POPULAR_BRAND = ['현대', '기아', '제네시스'];

export const POPULAR_MODELS = {
  '현대':    ['그랜저', '캐스퍼', '싼타페', '팰리세이드', '투싼', '쏘나타', '아반떼', '코나', '베뉴', '포터'],
  '기아':    ['쏘렌토', '카니발', '스포티지', 'K5', 'K8', '셀토스', '니로', '모닝', '레이', 'K9'],
  '제네시스': ['GV80', 'G80', 'GV70', 'G90', 'G70'],
};

export function rankBy(str, list) {
  for (let i = 0; i < (list || []).length; i++) {
    if (str?.includes(list[i])) return i;
  }
  return 999;
}

export function sortByRank(items, getStr, list) {
  return items.slice().sort((a, b) => rankBy(getStr(a), list) - rankBy(getStr(b), list));
}
