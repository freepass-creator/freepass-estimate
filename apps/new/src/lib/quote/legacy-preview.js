import { resolveCatalogPreviewContext, buildCatalogPreviewRequest } from './preview-request.js';
import { calculateStandardPreviewBatch } from './preview-calculate.js';

export function legacyVehiclePreviewKey(vehicle) {
  return [
    String(vehicle?.brand || '').trim(),
    String(vehicle?.model || '').trim(),
    String(vehicle?.trim || '').trim(),
    Math.round(Number(vehicle?.price) || 0),
  ].join('|');
}

export async function calculateLegacyStandardPreviews(
  vehicles,
  {
    term = 60,
    depositPct = 10,
    prepaymentPct = 0,
    credit = '중신용',
    mileage = '2만km',
    maintenance = '웰스 Basic',
    liability = '1억',
    extraDriver = '없음',
    feeRatePct = 5,
    deliveryFee = 0,
    tintFee = 0,
    dashcamFee = 0,
    naviFee = 0,
    hipassFee = 0,
    discount = 0,
    signal,
  } = {},
) {
  const list = Array.isArray(vehicles) ? vehicles.filter(Boolean) : [];
  if (!list.length) return new Map();

  const prepared = [];
  const output = new Map();

  for (const vehicle of list) {
    const key = legacyVehiclePreviewKey(vehicle);
    try {
      const { manufacturer, model, variant, trim } = resolveCatalogPreviewContext(vehicle);
      const request = buildCatalogPreviewRequest({
        manufacturer,
        model,
        variant,
        trim,
        scenarios: [{ term, depositPct, prepaymentPct }],
        conditions: {
          credit,
          mileage,
          maintenance,
          liability,
          extraDriver,
          feeRatePct,
          deliveryFee,
          tintFee,
          dashcamFee,
          naviFee,
          hipassFee,
          discount,
        },
      });
      prepared.push({ key, request });
    } catch {
      output.set(key, null);
    }
  }

  if (!prepared.length) return output;

  const results = await calculateStandardPreviewBatch(
    prepared.map((entry) => entry.request),
    { signal },
  );

  prepared.forEach((entry, index) => {
    const result = results[index];
    const row = result?.ok ? result.결과?.[0] : null;
    output.set(entry.key, row ? Object.freeze({
      monthly: row.월대여료 ?? null,
      depositAmt: row.보증금 ?? null,
      prepaymentAmt: row.선납금 ?? null,
      residualPct: row._잔가율 ?? null,
      residualAmt: row.인수가 ?? null,
    }) : null);
  });

  return output;
}
