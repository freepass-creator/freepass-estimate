function text(value, field) {
  const out = String(value ?? '').trim();
  if (!out) {
    const error = new Error(`${field} is required`);
    error.code = 'ESTIMATE_MASTER_UI_PROJECTION_INVALID';
    throw error;
  }
  return out;
}

function moneyWon(value, field) {
  const amount = Number(value?.amount);
  if (!Number.isSafeInteger(amount) || amount < 0 || value?.currency !== 'KRW') {
    const error = new Error(`${field} must be KRW money`);
    error.code = 'ESTIMATE_MASTER_UI_PROJECTION_INVALID';
    throw error;
  }
  return amount;
}

function uiPrice(won) {
  return won / 10000;
}

function manufacturerId(maker) {
  return `maker:${encodeURIComponent(maker)}`;
}

function groupLabel(configuration = {}) {
  return [
    configuration.bodyConfiguration,
    configuration.seats ? `${configuration.seats}인승` : null,
    configuration.drivetrain,
  ].filter(Boolean).join(' · ');
}

function colorToUi(color, kind) {
  return Object.freeze({
    name: text(color?.name, `${kind}.name`),
    code: String(color?.code ?? color?.colorId ?? '').trim() || text(color?.colorId, `${kind}.colorId`),
    price: uiPrice(moneyWon(color?.price, `${kind}.price`)),
    _price_won: moneyWon(color?.price, `${kind}.price`),
    _stable_color_id: text(color?.colorId, `${kind}.colorId`),
  });
}

function optionToUi(option, productId) {
  const optionId = text(option?.optionId, 'option.optionId');
  const won = moneyWon(option?.price, 'option.price');
  return {
    optionId,
    value: Object.freeze({
      name: text(option?.name, 'option.name'),
      price: uiPrice(won),
      trim_prices: Object.freeze({ [productId]: uiPrice(won) }),
      _price_won: won,
      _stable_option_id: optionId,
      requires: Object.freeze([...(option?.requires || [])]),
      excludes: Object.freeze([...(option?.excludes || [])]),
      exclusive_group_id: option?.exclusiveGroupId || null,
    }),
  };
}

function mergeOption(existing, incoming, productId) {
  if (!existing) return incoming;
  if (existing.name !== incoming.name) {
    const error = new Error(`option identity conflict: ${incoming._stable_option_id}`);
    error.code = 'ESTIMATE_MASTER_UI_PROJECTION_INVALID';
    throw error;
  }
  return Object.freeze({
    ...existing,
    trim_prices: Object.freeze({
      ...(existing.trim_prices || {}),
      [productId]: incoming.price,
    }),
    requires: Object.freeze([...new Set([...(existing.requires || []), ...(incoming.requires || [])])]),
    excludes: Object.freeze([...new Set([...(existing.excludes || []), ...(incoming.excludes || [])])]),
    exclusive_group_id: existing.exclusive_group_id || incoming.exclusive_group_id || null,
  });
}

function unionColors(existing, additions) {
  const byId = new Map(existing.map((color) => [color._stable_color_id, color]));
  for (const color of additions) if (!byId.has(color._stable_color_id)) byId.set(color._stable_color_id, color);
  return [...byId.values()];
}

/**
 * Browser-only compatibility projection.
 *
 * Authority remains FreePass Data. This function only reshapes one verified
 * estimate-newcar-master ACTIVE release into the legacy VEHICLE_DB hierarchy
 * expected by current UI components. It does not invent stable IDs, prices,
 * model years or option/color identities.
 */
export function buildVehicleDbFromEstimateMaster(master) {
  const records = Array.isArray(master?.records) ? master.records : [];
  const meta = master?.meta || {};
  if (!records.length || meta.authority !== 'CANONICAL_ACTIVE' || meta.projectionId !== 'estimate-newcar-master') {
    const error = new Error('verified Estimate master release is required');
    error.code = 'ESTIMATE_MASTER_UI_PROJECTION_UNAVAILABLE';
    throw error;
  }

  const makers = new Map();
  const modelYearByVehicleModel = new Map();

  for (const record of records) {
    if (record?.status !== 'ACTIVE') continue;

    const productId = text(record.productId, 'productId');
    const vehicleModelId = text(record.vehicleModelId, 'vehicleModelId');
    const modelYearId = text(record.modelYearId, 'modelYearId');
    const trimId = text(record.trimId, 'trimId');
    const powertrainId = text(record.powertrainId, 'powertrainId');
    const maker = text(record.maker, 'maker');
    const modelName = text(record.model, 'model');
    const powertrainName = text(record.powertrainName, 'powertrainName');
    const trimName = text(record.trimName, 'trimName');

    if (!Number.isSafeInteger(record.modelYear)) {
      const error = new Error(`ACTIVE modelYear invalid: ${productId}`);
      error.code = 'ESTIMATE_MASTER_UI_PROJECTION_INVALID';
      throw error;
    }

    const priorModelYearId = modelYearByVehicleModel.get(vehicleModelId);
    if (priorModelYearId && priorModelYearId !== modelYearId) {
      const error = new Error(`multiple active model years require an explicit UI year axis: ${vehicleModelId}`);
      error.code = 'ESTIMATE_MASTER_UI_MODEL_YEAR_AXIS_REQUIRED';
      throw error;
    }
    modelYearByVehicleModel.set(vehicleModelId, modelYearId);

    let manufacturer = makers.get(maker);
    if (!manufacturer) {
      manufacturer = {
        manufacturer_id: manufacturerId(maker),
        manufacturer_name: maker,
        models: new Map(),
      };
      makers.set(maker, manufacturer);
    }

    let model = manufacturer.models.get(vehicleModelId);
    if (!model) {
      model = {
        model_id: vehicleModelId,
        model_name: modelName,
        year: record.modelYear,
        model_year_id: modelYearId,
        variants: new Map(),
        exterior_colors: [],
      };
      manufacturer.models.set(vehicleModelId, model);
    } else if (model.model_name !== modelName || model.model_year_id !== modelYearId || model.year !== record.modelYear) {
      const error = new Error(`vehicle model identity conflict: ${vehicleModelId}`);
      error.code = 'ESTIMATE_MASTER_UI_PROJECTION_INVALID';
      throw error;
    }

    let variant = model.variants.get(powertrainId);
    if (!variant) {
      variant = {
        variant_id: powertrainId,
        variant_name: powertrainName,
        trims: [],
        options_master: {},
        exclusive_groups: [],
        option_excludes: {},
      };
      model.variants.set(powertrainId, variant);
    } else if (variant.variant_name !== powertrainName) {
      const error = new Error(`powertrain identity conflict: ${powertrainId}`);
      error.code = 'ESTIMATE_MASTER_UI_PROJECTION_INVALID';
      throw error;
    }

    const exterior = (record.exteriorColors || []).map((color) => colorToUi(color, 'exteriorColor'));
    const interior = (record.interiorColors || []).map((color) => colorToUi(color, 'interiorColor'));
    model.exterior_colors = unionColors(model.exterior_colors, exterior);

    const optionIds = [];
    const groupMembers = new Map();
    for (const option of record.options || []) {
      const { optionId, value } = optionToUi(option, productId);
      optionIds.push(optionId);
      variant.options_master[optionId] = mergeOption(variant.options_master[optionId], value, productId);
      for (const excluded of value.excludes || []) {
        const list = variant.option_excludes[optionId] || [];
        variant.option_excludes[optionId] = [...new Set([...list, excluded])];
      }
      if (value.exclusive_group_id) {
        const set = groupMembers.get(value.exclusive_group_id) || new Set();
        set.add(optionId);
        groupMembers.set(value.exclusive_group_id, set);
      }
    }

    for (const [groupId, members] of groupMembers.entries()) {
      const existing = variant.exclusive_groups.find((group) => group.id === groupId);
      if (existing) {
        existing.members = [...new Set([...existing.members, ...members])];
      } else {
        variant.exclusive_groups.push({ id: groupId, label: '택1', members: [...members] });
      }
    }

    const baseWon = moneyWon(record.basePrice, 'basePrice');
    const beforeWon = record.priceBefore ? moneyWon(record.priceBefore, 'priceBefore') : null;
    const afterWon = record.priceAfter ? moneyWon(record.priceAfter, 'priceAfter') : null;

    variant.trims.push(Object.freeze({
      trim_id: productId,
      name: trimName,
      seats: record.configuration?.seats ?? 0,
      base_price_5: uiPrice(baseWon),
      base_price_3_5: uiPrice(baseWon),
      available_options: Object.freeze(optionIds),
      group: groupLabel(record.configuration),
      operating: true,
      _product_id: productId,
      _stable_trim_id: trimId,
      _vehicle_model_id: vehicleModelId,
      _model_year_id: modelYearId,
      _powertrain_id: powertrainId,
      _price_before_won: beforeWon,
      _price_after_won: afterWon,
      _price_basis: record.priceBasis || null,
      _base_axes: Object.freeze({
        drivetrain: record.configuration?.drivetrain ?? null,
        seats: record.configuration?.seats ?? null,
        body_configuration: record.configuration?.bodyConfiguration ?? null,
      }),
      _exterior_colors: Object.freeze(exterior),
      _interior_colors: Object.freeze(interior),
    }));
  }

  const manufacturers = [...makers.values()].map((manufacturer) => Object.freeze({
    manufacturer_id: manufacturer.manufacturer_id,
    manufacturer_name: manufacturer.manufacturer_name,
    models: Object.freeze([...manufacturer.models.values()].map((model) => Object.freeze({
      model_id: model.model_id,
      model_name: model.model_name,
      year: model.year,
      model_year_id: model.model_year_id,
      exterior_colors: Object.freeze(model.exterior_colors),
      variants: Object.freeze([...model.variants.values()].map((variant) => Object.freeze({
        ...variant,
        trims: Object.freeze([...variant.trims]),
        options_master: Object.freeze({ ...variant.options_master }),
        exclusive_groups: Object.freeze(variant.exclusive_groups.map((group) => Object.freeze({
          ...group,
          members: Object.freeze([...group.members]),
        }))),
        option_excludes: Object.freeze(Object.fromEntries(
          Object.entries(variant.option_excludes).map(([id, values]) => [id, Object.freeze([...values])])
        )),
      }))),
    }))),
  }));

  if (!manufacturers.length) {
    const error = new Error('Estimate master has no ACTIVE records');
    error.code = 'ESTIMATE_MASTER_UI_PROJECTION_EMPTY';
    throw error;
  }

  return Object.freeze({
    vehicleDb: Object.freeze({ manufacturers: Object.freeze(manufacturers) }),
    meta: Object.freeze({
      source: 'freepass-data/estimate-newcar-master',
      authority: meta.authority,
      projection_id: meta.projectionId,
      release_id: meta.releaseId,
      manifest_id: meta.manifestId,
      revision: meta.revision,
      data_digest: meta.dataDigest,
      activated_at: meta.activatedAt,
      active_product_count: records.filter((record) => record?.status === 'ACTIVE').length,
      hold_product_count: records.filter((record) => record?.status === 'HOLD').length,
    }),
  });
}
