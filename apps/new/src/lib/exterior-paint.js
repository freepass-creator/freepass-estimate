// Canonical FreePass Estimate contract; copy unchanged to downstream consumers.
// Original catalog files and confirmed quote snapshots remain untouched.
export function colorPriceLabel(won) {
  if (!Number.isFinite(won) || won < 0) return '추가금 확인 필요';
  return won === 0 ? '추가금 없음' : '+' + won.toLocaleString('ko-KR') + '원';
}
const key = name => String(name || '').replace(/\s+/g, '').toLowerCase();
const optionColorKey = name => key(name).replace(/(?:외장컬러|외장색상)$/, '');
export function exteriorColorsFor(model, trim) {
  return Array.isArray(trim?._exterior_colors) ? trim._exterior_colors : (model?.exterior_colors || []);
}
export function normalizeExteriorPaint(db) {
  const moved = [];
  for (const brand of db?.manufacturers || []) for (const model of brand.models || []) {
    for (const variant of model.variants || []) {
      const matches = Object.entries(variant.options_master || {}).flatMap(([id,opt]) => {
        const index = (model.exterior_colors || []).findIndex(c => key(c.name) === optionColorKey(opt.name));
        return index < 0 ? [] : [{id,opt,index}];
      });
      if (!matches.length) continue;
      if (new Set(matches.map(x=>x.index)).size !== matches.length) throw new Error('외장색 옵션 중복: '+model.model_name);
      for (const trim of variant.trims || []) {
        const available = new Set(trim.available_options || []);
        trim._exterior_colors = exteriorColorsFor(model, trim).map(color => {
          const match = matches.find(x => optionColorKey(x.opt.name) === key(color.name));
          if (!match) return {...color};
          const price = match.opt.price;
          if (!Number.isFinite(price) || price < 0) throw new Error('외장색 추가금 미확인: '+color.name);
          if (color.price && color.price !== price) throw new Error('외장색 추가금 충돌: '+color.name);
          return {...color, price, _price_won: price * 10000, _paintUnavailable: !available.has(match.id)};
        });
        trim.available_options = [...available].filter(id => !matches.some(x=>x.id===id));
      }
      for (const {id,opt,index} of matches) {
        (variant._paint_options ||= {})[id] = index;
        delete variant.options_master[id];
        moved.push({model:model.model_id,variant:variant.variant_id,id,color:opt.name,price:opt.price});
      }
    }
  }
  return moved;
}
export function restorePaintSelection(db, state) {
  state.colorNotice = '';
  const model = db?.manufacturers?.find(b=>b.manufacturer_id===state.manufacturer)?.models?.find(m=>m.model_id===state.model);
  const variant = model?.variants?.find(v=>v.variant_id===state.variant);
  const trim = variant?.trims?.find(t=>t.trim_id===state.trim);
  const paint = variant?._paint_options || {};
  const selectedPaint = [...(state.options || [])].filter(id=>Object.hasOwn(paint,id));
  if (state.color == null && selectedPaint.length === 1) {
    const name = model.exterior_colors[paint[selectedPaint[0]]]?.name;
    const index = exteriorColorsFor(model,trim).findIndex(c=>key(c.name)===key(name));
    state.color = index < 0 ? null : index;
    if (index < 0) state.colorNotice = '이 트림의 외장색 정보를 확인할 수 없습니다. 외장색을 다시 선택해 주세요.';
  }
  if (state.color == null && selectedPaint.length > 1) state.colorNotice = '이전 견적에 외장색이 여러 개 선택되어 있습니다. 외장색을 다시 선택해 주세요.';
  if (state.color != null && exteriorColorsFor(model,trim)[state.color]?._paintUnavailable) {
    state.color = null;
    state.colorNotice = '이 트림에서 선택할 수 없는 외장색입니다. 외장색을 다시 선택해 주세요.';
  }
  for (const id of selectedPaint) state.options.delete(id);
}
