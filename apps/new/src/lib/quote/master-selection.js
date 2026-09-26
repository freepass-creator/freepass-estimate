import { getActiveEstimateMasterRecord } from '../master/freepass-data-master.js';
import { masterContextFromEstimateMasterRecord } from './master-context.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function required(value, field) {
  const v = String(value ?? '').trim();
  if (!v) throw codedError(`${field} is required`, 'QUOTE_MASTER_SELECTION_INCOMPLETE');
  return v;
}

/**
 * Resolve the immutable FreePass Data master context from the current estimator selection.
 * No label/name fallback is allowed here.
 */
export function masterContextFromSelection({
  master,
  vehicle,
  condition,
} = {}) {
  const productId = required(vehicle?._product_id, 'vehicle._product_id');
  const record = getActiveEstimateMasterRecord(master, productId);

  const selected = Array.isArray(vehicle?._selected_options) ? vehicle._selected_options : [];
  const selectedOptionIds = selected.map((option) =>
    required(option?.stableId, `selected option stableId (${option?.id || '?'})`)
  );

  const exteriorColorId = required(vehicle?.colorExtId, 'vehicle.colorExtId');
  const interiorColorId = required(
    vehicle?.colorIntId ?? condition?.colorIntId,
    'vehicle.colorIntId'
  );

  return masterContextFromEstimateMasterRecord({
    record,
    selectedOptionIds,
    exteriorColorId,
    interiorColorId,
    releaseMeta: master?.meta,
  });
}
