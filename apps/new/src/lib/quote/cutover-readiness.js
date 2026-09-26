import {
  QUOTE_READ_RECEIPT_CONTRACT,
  QUOTE_WRITE_RECEIPT_CONTRACT,
} from './quote-repository.js';
import {
  SHARE_ENVELOPE_READ_RECEIPT_CONTRACT,
  SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT,
} from './share-envelope-repository.js';

export const QUOTE_CUTOVER_READINESS_CONTRACT = 'freepass-estimate-quote-cutover-readiness/v4';

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

function validQuoteWriteProbe(probe) {
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

function validQuoteReadProbe(probe) {
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

function sameQuoteRoundTrip(writeProbe, readProbe) {
  const w = writeProbe?.receipt;
  const r = readProbe?.receipt;
  return !!(
    w && r &&
    w.quoteId === r.quoteId &&
    Number(w.quoteVersion) === Number(r.quoteVersion) &&
    w.snapshotHash === r.snapshotHash
  );
}

function validEnvelopeWriteProbe(probe) {
  const r = probe?.receipt;
  return !!(
    probe?.verified === true &&
    validIso(probe?.verifiedAt) &&
    r?.contract === SHARE_ENVELOPE_WRITE_RECEIPT_CONTRACT &&
    ['CREATED', 'EXISTING'].includes(r.status) &&
    typeof r.envelopeId === 'string' && r.envelopeId &&
    Number.isSafeInteger(Number(r.envelopeVersion)) && Number(r.envelopeVersion) > 0 &&
    typeof r.snapshotHash === 'string' && /^[a-f0-9]{64}$/i.test(r.snapshotHash) &&
    typeof r.idempotencyKey === 'string' && r.idempotencyKey
  );
}

function validEnvelopeReadProbe(probe) {
  const r = probe?.receipt;
  const e = r?.envelope;
  return !!(
    probe?.verified === true &&
    validIso(probe?.verifiedAt) &&
    r?.contract === SHARE_ENVELOPE_READ_RECEIPT_CONTRACT &&
    r.status === 'FOUND' &&
    typeof r.envelopeId === 'string' && r.envelopeId &&
    Number.isSafeInteger(Number(r.envelopeVersion)) && Number(r.envelopeVersion) > 0 &&
    typeof r.snapshotHash === 'string' && /^[a-f0-9]{64}$/i.test(r.snapshotHash) &&
    e?.contract === 'freepass-share-envelope/v1' &&
    e.envelopeId === r.envelopeId &&
    Number(e.envelopeVersion) === Number(r.envelopeVersion) &&
    e.snapshotHash === r.snapshotHash &&
    Array.isArray(e.quoteRefs) &&
    e.quoteRefs.length > 0
  );
}

function sameEnvelopeRoundTrip(writeProbe, readProbe) {
  const w = writeProbe?.receipt;
  const r = readProbe?.receipt;
  return !!(
    w && r &&
    w.envelopeId === r.envelopeId &&
    Number(w.envelopeVersion) === Number(r.envelopeVersion) &&
    w.snapshotHash === r.snapshotHash
  );
}

function envelopeReferencesQuote(envelopeReadProbe, quoteReadProbe) {
  const refs = envelopeReadProbe?.receipt?.envelope?.quoteRefs;
  const q = quoteReadProbe?.receipt;
  if (!Array.isArray(refs) || !q) return false;
  return refs.some((ref) =>
    ref?.quoteId === q.quoteId &&
    Number(ref?.quoteVersion) === Number(q.quoteVersion) &&
    ref?.snapshotHash === q.snapshotHash
  );
}

function validLegacyWritePolicy(policy) {
  return !!(
    policy &&
    policy.contract === 'freepass-legacy-quote-write-policy/v1' &&
    policy.mode === 'CANONICAL_ONLY' &&
    policy.legacyNewQuoteWriteBlocked === true
  );
}

function validWriteAccessPolicy(policy) {
  return !!(
    policy &&
    policy.contract === 'freepass-estimate-write-access/v1' &&
    policy.serverVerifiedFirebaseIdTokenRequired === true &&
    policy.anonymousWritesAllowed === false &&
    Array.isArray(policy.requiredRoles) &&
    policy.requiredRoles.length > 0 &&
    policy.requiredRoles.every((role) => typeof role === 'string' && role.trim())
  );
}

/**
 * READY means the entire canonical delivery path is evidenced and the actual
 * legacy writer policy is already in CANONICAL_ONLY mode.
 */
export function evaluateQuoteCutoverReadiness({
  master = null,
  quoteWriteProbe = null,
  quoteReadProbe = null,
  envelopeWriteProbe = null,
  envelopeReadProbe = null,
  canonicalViewerReady = false,
  legacyWritePolicy = null,
  writeAccessPolicy = null,
} = {}) {
  const blockers = [];

  if (!validMasterEvidence(master)) blockers.push(blocker('MASTER_ACTIVE_RELEASE_REQUIRED'));
  if (!validQuoteWriteProbe(quoteWriteProbe)) blockers.push(blocker('QUOTE_WRITE_SHADOW_PROOF_REQUIRED'));
  if (!validQuoteReadProbe(quoteReadProbe)) blockers.push(blocker('QUOTE_READ_SHADOW_PROOF_REQUIRED'));
  if (validQuoteWriteProbe(quoteWriteProbe) && validQuoteReadProbe(quoteReadProbe) &&
      !sameQuoteRoundTrip(quoteWriteProbe, quoteReadProbe)) {
    blockers.push(blocker('QUOTE_SHADOW_ROUNDTRIP_MISMATCH'));
  }

  if (!validEnvelopeWriteProbe(envelopeWriteProbe)) blockers.push(blocker('SHARE_ENVELOPE_WRITE_SHADOW_PROOF_REQUIRED'));
  if (!validEnvelopeReadProbe(envelopeReadProbe)) blockers.push(blocker('SHARE_ENVELOPE_READ_SHADOW_PROOF_REQUIRED'));
  if (validEnvelopeWriteProbe(envelopeWriteProbe) && validEnvelopeReadProbe(envelopeReadProbe) &&
      !sameEnvelopeRoundTrip(envelopeWriteProbe, envelopeReadProbe)) {
    blockers.push(blocker('SHARE_ENVELOPE_SHADOW_ROUNDTRIP_MISMATCH'));
  }

  if (validQuoteReadProbe(quoteReadProbe) && validEnvelopeReadProbe(envelopeReadProbe) &&
      !envelopeReferencesQuote(envelopeReadProbe, quoteReadProbe)) {
    blockers.push(blocker('SHARE_ENVELOPE_QUOTE_REFERENCE_MISMATCH'));
  }

  if (canonicalViewerReady !== true) blockers.push(blocker('CANONICAL_VIEWER_CUTOVER_NOT_READY'));
  if (!validLegacyWritePolicy(legacyWritePolicy)) blockers.push(blocker('LEGACY_WRITE_BLOCK_NOT_READY'));
  if (!validWriteAccessPolicy(writeAccessPolicy)) blockers.push(blocker('CANONICAL_WRITE_AUTH_POLICY_NOT_READY'));

  return Object.freeze({
    contract: QUOTE_CUTOVER_READINESS_CONTRACT,
    status: blockers.length ? 'HOLD' : 'READY',
    gates: Object.freeze({
      masterActiveRelease: validMasterEvidence(master),
      quoteWriteShadowVerified: validQuoteWriteProbe(quoteWriteProbe),
      quoteReadShadowVerified: validQuoteReadProbe(quoteReadProbe),
      quoteShadowRoundTripMatched:
        validQuoteWriteProbe(quoteWriteProbe) && validQuoteReadProbe(quoteReadProbe)
          ? sameQuoteRoundTrip(quoteWriteProbe, quoteReadProbe)
          : false,
      envelopeWriteShadowVerified: validEnvelopeWriteProbe(envelopeWriteProbe),
      envelopeReadShadowVerified: validEnvelopeReadProbe(envelopeReadProbe),
      envelopeShadowRoundTripMatched:
        validEnvelopeWriteProbe(envelopeWriteProbe) && validEnvelopeReadProbe(envelopeReadProbe)
          ? sameEnvelopeRoundTrip(envelopeWriteProbe, envelopeReadProbe)
          : false,
      envelopeReferencesVerifiedQuote:
        validQuoteReadProbe(quoteReadProbe) && validEnvelopeReadProbe(envelopeReadProbe)
          ? envelopeReferencesQuote(envelopeReadProbe, quoteReadProbe)
          : false,
      canonicalViewerReady: canonicalViewerReady === true,
      legacyWriteBlocked: validLegacyWritePolicy(legacyWritePolicy),
      canonicalWriteAuthPolicyReady: validWriteAccessPolicy(writeAccessPolicy),
    }),
    blockers: Object.freeze(blockers),
  });
}
