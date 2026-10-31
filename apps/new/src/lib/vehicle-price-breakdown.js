// Only show a sum that reconciles with the quoted vehicle total.
export function vehiclePriceBreakdown(vehicle, interiorPrice, total) {
  const p = vehicle?.priceBreakdown || {
    base: Math.round(Number(vehicle?.trim_price_manwon) * 10000),
    options: Math.round(Number(vehicle?.options_price_manwon) * 10000),
    exterior: Math.round(Number(vehicle?.color_price_manwon) * 10000),
    interior: Number(interiorPrice || 0),
    discount: 0,
    items: (vehicle?._selected_options || []).map(o => ({ name: o.name, price: o.price_won })),
  };
  const keys = ['base', 'options', 'exterior', 'interior'];
  const discount = p.discount ?? 0;
  if (!Number.isSafeInteger(discount) || discount < 0 || !keys.every(k => Number.isSafeInteger(p[k]) && p[k] >= 0) || p.base <= 0 || keys.reduce((sum, k) => sum + p[k], 0) - discount !== total) return null;
  const items = Array.isArray(p.items) ? p.items.filter(o => typeof o.name === 'string' && Number.isSafeInteger(o.price) && o.price >= 0).map(o => ({ name: o.name, price: o.price })) : [];
  return { discount, ...Object.fromEntries(keys.map(k => [k, p[k]])), items: items.reduce((sum, o) => sum + o.price, 0) === p.options ? items : [] };
}
