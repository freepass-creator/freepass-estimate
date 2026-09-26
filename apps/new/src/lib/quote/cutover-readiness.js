import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from './quote-repository.js';

export const QUOTE_CUTOVER_READINESS_CONTRACT = 'freepass-estimate-quote-cutover-readiness/v1';

function blocker(code, detail = null) {
  return Object.freeze({ code, detail });
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validMasterEvidence(master) {
  const meta = master?.meta;
  return !!(
    meta &&
    meta.contract === 'estimate-newcar-master/v1' &&
    meta.projectionId === 'estimate-newcar-master' &&
    meta.schemaVersion === '1.0.0' &&
    meta.authority === 'CANONICAL_ACTIVE' &&
    typeof meta.releaseId === 'string' && meta.releaseId.trim() &&
    typeof meta.manifestId === 'string' && meta.manifestId.trim() &&
    Number.isSafeInteger(meta.revision) && meta.revision > 0 &&
    /^[a-f0-9]{64}$/i.test(meta.inputDigest || '') &&
    /^[a-f0-9]{64}$/i.test(meta.dataDigest || '') &&
    validIso(meta.activatedAt)
  );
}

function validWriteProbe(probe) {
  const r = probe?.receipt;
  return !!(
    probe?.verified === true &&
    validIso(probe?.verifiedAt) &&
    r?.contract === QUOTE_WRITE_RECEIPT_CONTRACT &&
    ['CREATED', 'EXISTING'].includes(r.status) &&
    typeof r.quoteId === 'string' && r.quoteId &&
    Number.isSafeInteger(Number(r.quoteVersion)) && Number(r.quoteVersion) > 0 &&
    typeof r.snapshotHash === 'string' && /^[a-f0-9]{64}$/i.test(r.snapshotHash) &&
    typeof r.idempotencyKey === 'string' && r.idempotencyKey
  );
}

function validReadProbe(probe) {
  const r = probe?.receipt;
  return !!(
    probe?.verified === true &&
    validIso(probe?.verifiedAt) &&
    r?.contract === QUOTE_READ_RECEIPT_CONTRACT &&
    r.status === 'FOUND' &&
    typeof r.quoteId === 'string' && r.quoteId &&
    Number.isSafeInteger(Number(r.quoteVersion)) && Number(r.quoteVersion) > 0 &&
    typeof r.snapshotHash === 'string' && /^[a-f0-9]{64}$/i.test(r.snapshotHash) &&
    r.quote?.contract === 'freepass-quote/v2' &&
    r.quote.quoteId === r.quoteId &&
    Number(r.quote.quoteVersion) === Number(r.quoteVersion) &&
    r.quote.snapshotHash === r.snapshotHash
  );
}

function sameProbeQuote(writeProbe, readProbe) {
  const w = writeProbe?.receipt;
  const r = readProbe?.receipt;
  return !!(
    w && r &&
    w.quoteId === r.quoteId &&
    Number(w.quoteVersion) === Number(r.quoteVersion) &&
    w.snapshotHash === r.snapshotHash
  );
}

/**
 * Pure cutover gate.
 *
 * It does not perform network calls and does not enable a runtime switch.
 * Operations must feed it real shadow evidence collected from FreePass Data.
 */
export function evaluateQuoteCutoverReadiness({
  master = null,
  writeProbe = null,
  readProbe = null,
  canonicalViewerReady = false,
  legacyWriteBlockReady = false,
} = {}) {
  const blockers = [];

  if (!validMasterEvidence(master)) {
    blockers.push(blocker('MASTER_ACTIVE_RELEASE_REQUIRED'));
  }
  if (!validWriteProbe(writeProbe)) {
    blockers.push(blocker('QUOTE_WRITE_SHADOW_PROOF_REQUIRED'));
  }
  if (!validReadProbe(readProbe)) {
    blockers.push(blocker('QUOTE_READ_SHADOW_PROOF_REQUIRED'));
  }
  if (validWriteProbe(writeProbe) && validReadProbe(readProbe) && !sameProbeQuote(writeProbe, readProbe)) {
    blockers.push(blocker('QUOTE_SHADOW_ROUNDTRIP_MISMATCH'));
  }
  if (canonicalViewerReady !== true) {
    blockers.push(blocker('CANONICAL_VIEWER_CUTOVER_NOT_READY'));
  }
  if (legacyWriteBlockReady !== true) {
    blockers.push(blocker('LEGACY_WRITE_BLOCK_NOT_READY'));
  }

  return Object.freeze({
    contract: QUOTE_CUTOVER_READINESS_CONTRACT,
    status: blockers.length ? 'HOLD' : 'READY',
    gates: Object.freeze({
      masterActiveRelease: validMasterEvidence(master),
      writeShadowVerified: validWriteProbe(writeProbe),
      readShadowVerified: validReadProbe(readProbe),
      shadowRoundTripMatched: validWriteProbe(writeProbe) && validReadProbe(readProbe)
        ? sameProbeQuote(writeProbe, readProbe)
        : false,
      canonicalViewerReady: canonicalViewerReady === true,
      legacyWriteBlockReady: legacyWriteBlockReady === true,
    }),
    blockers: Object.freeze(blockers),
  });
}
