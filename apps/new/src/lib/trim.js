// 트림 string 에서 (세부모델, 등급) 분리.
// vehicles.json 에 sub_model 컬럼이 없어 — 등급명 화이트리스트로 휴리스틱 분리.
// 매칭 안 되면 trim 통째 = 세부모델, 등급 = null (단독 그룹).

const GRADE_RE = /\s+(Exclusive|Prestige|Calligraphy|Inspiration|Premium|Modern|Smart|Signature|Limited|Le Blanc|익스클루시브|프레스티지|캘리그래피|시그니처|노블레스|모던|H-Pick|Black Exterior|Black Ink|기본 모델|베스트 셀렉션|스포츠 패키지|풀옵션|트렌디|컴포트 패키지(?:Ⅰ|Ⅱ|III)?|시그니처 블랙|트렌디 블랙)$/i;

export function splitTrim(trim) {
  if (!trim) return { subModel: '', grade: null };
  const m = trim.match(GRADE_RE);
  if (m) {
    return {
      subModel: trim.replace(GRADE_RE, '').trim(),
      grade: m[1],
    };
  }
  return { subModel: trim, grade: null };
}

// trims 배열 → 세부모델별 그룹화 (각 그룹은 최저가 정렬)
export function groupBySubModel(trims) {
  const map = new Map();
  for (const t of trims) {
    const { subModel, grade } = splitTrim(t.trim);
    if (!map.has(subModel)) map.set(subModel, { subModel, items: [] });
    map.get(subModel).items.push({ ...t, grade });
  }
  return [...map.values()]
    .map(g => {
      g.items.sort((a, b) => a.price - b.price);
      g.minPrice = g.items[0].price;
      g.minMonthly = g.items
        .map(i => i.monthly)
        .filter(Boolean)
        .reduce((m, c) => (!m || c < m ? c : m), null);
      g.count = g.items.length;
      g.isHybrid = g.items.some(i => i.isHybrid);
      return g;
    })
    .sort((a, b) => a.minPrice - b.minPrice);
}
