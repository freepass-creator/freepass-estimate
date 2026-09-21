// Resolve the current selection from the same vehicle DB as the picker.
import { exteriorColorsFor } from './exterior-paint.js';
export function selectionSummary(db, state, quote) {
  const snapshot = quote.sharedSnapshot?.vehicle;
  if (snapshot) return {
    vehicle: [snapshot.brand, snapshot.model, snapshot.variant, snapshot.trim_name].filter(Boolean).join(' · '),
    exterior: snapshot.colorExt || '미선택', interior: snapshot.colorInt || '미선택',
    options: Array.isArray(snapshot.options) ? snapshot.options : [],
  };
  const brand = db?.manufacturers?.find(b => b.manufacturer_id === state.manufacturer);
  if (!brand) return null;
  const model = brand.models?.find(m => m.model_id === state.model);
  const variant = model?.variants?.find(v => v.variant_id === state.variant);
  const trim = variant?.trims?.find(t => t.trim_id === state.trim);
  return {
    vehicle: [brand.manufacturer_name, model?.model_name, variant?.variant_name,
      trim && [trim._ui_powertrain_group || trim.group, trim.name].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
    exterior: trim && state.color != null ? exteriorColorsFor(model,trim)[state.color]?.name || '미선택' : '미선택',
    interior: trim ? quote.cond?.colorInt || '미선택' : '미선택',
    options: trim ? [...state.options].map(id => variant.options_master?.[id]?.name).filter(Boolean) : [],
  };
}
