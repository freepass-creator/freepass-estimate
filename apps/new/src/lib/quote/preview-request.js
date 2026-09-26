import { QUOTE_REQUEST_CONTRACT, LEGACY_QUOTE_VERSION } from './contracts.js';

export const QUOTE_PREVIEW_PURPOSE = 'PRICE_PREVIEW';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw codedError(`${field} is required`, 'QUOTE_PREVIEW_INPUT_INVALID');
  return text;
}

function nonNegativeMoney(value, field) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw codedError(`${field} must be a non-negative finite number`, 'QUOTE_PREVIEW_INPUT_INVALID');
  }
  return Math.round(n);
}

function zeroPriceColor(colors, field) {
  const candidates = (Array.isArray(colors) ? colors : [])
    .filter((color) =>
      String(color?._stable_color_id || '').trim() &&
      nonNegativeMoney(color?._price_won ?? ((Number(color?.price) || 0) * 10000), field) === 0
    )
    .slice()
    .sort((a, b) => String(a._stable_color_id).localeCompare(String(b._stable_color_id)));

  if (!candidates.length) {
    throw codedError(
      `zero-price ${field} with stable identity is required for preview`,
      'QUOTE_PREVIEW_COLOR_UNRESOLVED'
    );
  }
  return candidates[0];
}

function selectedOptionsFromCatalog(variant, selectedOptionIds) {
  const master = variant?.options_master || {};
  return [...new Set(selectedOptionIds || [])]
    .sort()
    .map((id) => {
      const option = master[id];
      if (!option) {
        throw codedError(`catalog option not found: ${id}`, 'QUOTE_PREVIEW_OPTION_UNRESOLVED');
      }
      const stableId = requiredText(option._stable_option_id, `stable option id (${id})`);
      return Object.freeze({
        id,
        stableId,
        name: String(option.name || '').trim(),
        price_won: nonNegativeMoney((Number(option.price) || 0) * 10000, `option price (${id})`),
      });
    });
}


function normalized(value) {
  return String(value ?? '').toLowerCase()
    .replace(/hybrid|electric|하이브리드|일렉트릭|전기차/gi, '')
    .replace(/[\s·,()\[\]{}_"'’”&+.-]/g, '');
}

function catalogContexts(db) {
  const out = [];
  for (const manufacturer of db?.manufacturers || []) {
    for (const model of manufacturer?.models || []) {
      for (const variant of model?.variants || []) {
        for (const trim of variant?.trims || []) {
          if (trim?.operating === false) continue;
          out.push({ manufacturer, model, variant, trim });
        }
      }
    }
  }
  return out;
}

export function resolveCatalogPreviewContext(legacyVehicle, db = globalThis.window?.VEHICLE_DB) {
  if (!legacyVehicle || !db) {
    throw codedError('legacy vehicle and catalog are required', 'QUOTE_PREVIEW_IDENTITY_UNRESOLVED');
  }

  const brand = String(legacyVehicle.brand || '').trim();
  const price = nonNegativeMoney(legacyVehicle.price, 'legacy vehicle price');
  const legacyModels = [legacyVehicle.model, legacyVehicle.name].map(normalized).filter(Boolean);
  const legacyTrim = normalized(legacyVehicle.trim);
  const legacyEngine = normalized(legacyVehicle.engine_label || legacyVehicle.fuel);

  const candidates = catalogContexts(db)
    .filter(({ manufacturer, trim }) =>
      manufacturer?.manufacturer_name === brand &&
      nonNegativeMoney((Number(trim?.base_price_5) || 0) * 10000, 'catalog price') === price
    )
    .map((context) => {
      const modelName = normalized(context.model?.model_name);
      const trimName = normalized(context.trim?.name);
      const variantName = normalized(context.variant?.variant_name);
      const engineName = normalized(context.trim?.engine || context.variant?.variant_name);

      let score = 0;
      if (legacyModels.some((name) => name === modelName)) score += 40;
      else if (legacyModels.some((name) => name && modelName && (name.includes(modelName) || modelName.includes(name)))) score += 20;

      if (legacyTrim && trimName) {
        if (legacyTrim === trimName) score += 60;
        else if (legacyTrim.includes(trimName) || trimName.includes(legacyTrim)) score += 35;
      }
      if (legacyTrim && variantName && legacyTrim.includes(variantName)) score += 10;
      if (legacyEngine && engineName && (legacyEngine.includes(engineName) || engineName.includes(legacyEngine))) score += 5;

      return { context, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    throw codedError('legacy vehicle cannot be resolved to canonical catalog product', 'QUOTE_PREVIEW_IDENTITY_UNRESOLVED');
  }
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    throw codedError('legacy vehicle resolves to multiple canonical catalog products', 'QUOTE_PREVIEW_IDENTITY_AMBIGUOUS');
  }
  return candidates[0].context;
}

export function buildCatalogPreviewRequest({
  manufacturer,
  model,
  variant,
  trim,
  selectedOptionIds = [],
  scenarios = [],
  conditions = {},
} = {}) {
  const productId = requiredText(trim?._product_id || trim?.trim_id, 'productId');
  const exterior = zeroPriceColor(trim?._exterior_colors, 'exterior color');
  const interior = zeroPriceColor(trim?._interior_colors, 'interior color');
  const selectedOptions = selectedOptionsFromCatalog(variant, selectedOptionIds);

  if (!Array.isArray(scenarios) || !scenarios.length) {
    throw codedError('at least one preview scenario is required', 'QUOTE_PREVIEW_INPUT_INVALID');
  }

  return Object.freeze({
    계약: QUOTE_REQUEST_CONTRACT,
    버전: LEGACY_QUOTE_VERSION,
    목적: QUOTE_PREVIEW_PURPOSE,
    차: {
      종류: '신차',
      키: productId,
      상품키: productId,
      브랜드: requiredText(manufacturer?.manufacturer_name, 'manufacturer'),
      모델: requiredText(model?.model_name, 'model'),
      파워트레인: requiredText(variant?.variant_name, 'powertrain'),
      트림: requiredText(trim?.name, 'trim'),
      배기량: Number(variant?.displacement_cc || 0),
      연료: String(variant?.fuel || '').trim(),
      가격: {
        // Display/catalog prices are deliberately not trusted here.
        // /api/standard-quote rebuilds every vehicle price component from FreePass Data.
        트림: 0,
        옵션: 0,
        외장색: 0,
        내장색: 0,
        할인: nonNegativeMoney(conditions.discount || 0, 'discount'),
        표준계산차량가: 0,
        기준전: 0,
        기준후: 0,
        기준명: '',
      },
      구성: {
        기본축: trim?._base_axes || {},
        colorExtId: requiredText(exterior._stable_color_id, 'exteriorColorId'),
        colorIntId: requiredText(interior._stable_color_id, 'interiorColorId'),
        선택옵션: selectedOptions,
      },
      차량가: 0,
      옵션가: 0,
      색추가금: 0,
      할인: nonNegativeMoney(conditions.discount || 0, 'discount'),
    },
    조건: {
      신용: conditions.credit || '중신용',
      주행: conditions.mileage || '2만km',
      정비: conditions.maintenance || '웰스 Basic',
      대물: conditions.liability || '1억',
      추가운전자: conditions.extraDriver || '없음',
      탁송비: nonNegativeMoney(conditions.deliveryFee || 0, 'deliveryFee'),
      썬팅비: nonNegativeMoney(conditions.tintFee || 0, 'tintFee'),
      블박비: nonNegativeMoney(conditions.dashcamFee || 0, 'dashcamFee'),
      수수료율: Number(conditions.feeRatePct || 0),
    },
    안들: scenarios.map((scenario) => Object.freeze({
      기간: Number(scenario.term),
      보증금: Number(scenario.depositPct || 0),
      선납: Number(scenario.prepaymentPct || 0),
    })),
  });
}
