import { buildShareEnvelopeFromPersistedQuotes } from './share-envelope.js';
import {
  verifyQuoteShadowRoundTrip,
  verifyShareEnvelopeShadowRoundTrip,
} from './shadow-roundtrip.js';
import { evaluateQuoteCutoverReadiness } from './cutover-readiness.js';

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function iso(value, field) {
  const v = String(value ?? '').trim();
  if (!v || !Number.isFinite(Date.parse(v))) {
    throw codedError(`${field} must be an ISO timestamp`, 'CUTOVER_PROBE_INVALID');
  }
  return v;
}

/**
 * Executes the full canonical delivery shadow probe without touching legacy storage.
 *
 * This orchestrator is dependency-injected so production composition can supply
 * real FreePass Data repositories while CI can use deterministic fakes.
 */
export async function runCutoverProbe({
  loadMaster,
  quoteRepository,
  envelopeRepository,
  quote,
  now = () => new Date().toISOString(),
  envelopeExpiresAt,
  canonicalViewerReady = false,
  legacyWritePolicy = null,
  writeAccessPolicy = null,
} = {}) {
  if (typeof loadMaster !== 'function') {
    throw codedError('FreePass Data master loader is required', 'CUTOVER_PROBE_INVALID');
  }
  if (!quoteRepository || !envelopeRepository) {
    throw codedError('canonical Quote and Envelope repositories are required', 'CUTOVER_PROBE_INVALID');
  }
  if (!quote || quote.contract !== 'freepass-quote/v2') {
    throw codedError('issued Quote v2 fixture is required', 'CUTOVER_PROBE_INVALID');
  }
  if (typeof now !== 'function') {
    throw codedError('clock is unavailable', 'CUTOVER_PROBE_INVALID');
  }

  const master = await loadMaster();

  const quoteProof = await verifyQuoteShadowRoundTrip({
    repository: quoteRepository,
    quote,
    now,
  });

  const envelopeCreatedAt = iso(now(), 'envelopeCreatedAt');
  const expiresAt = iso(envelopeExpiresAt, 'envelopeExpiresAt');
  if (Date.parse(expiresAt) <= Date.parse(envelopeCreatedAt)) {
    throw codedError('envelopeExpiresAt must be after envelopeCreatedAt', 'CUTOVER_PROBE_INVALID');
  }

  const envelope = await buildShareEnvelopeFromPersistedQuotes({
    quotes: [quote],
    receipts: [quoteProof.writeProbe.receipt],
    createdAt: envelopeCreatedAt,
    expiresAt,
  });

  const envelopeProof = await verifyShareEnvelopeShadowRoundTrip({
    repository: envelopeRepository,
    envelope,
    now,
  });

  const readiness = evaluateQuoteCutoverReadiness({
    master,
    quoteWriteProbe: quoteProof.writeProbe,
    quoteReadProbe: quoteProof.readProbe,
    envelopeWriteProbe: envelopeProof.writeProbe,
    envelopeReadProbe: envelopeProof.readProbe,
    canonicalViewerReady,
    legacyWritePolicy,
    writeAccessPolicy,
  });

  return Object.freeze({
    contract: 'freepass-estimate-cutover-probe/v1',
    status: readiness.status,
    master: Object.freeze({
      contract: master?.meta?.contract || null,
      authority: master?.meta?.authority || null,
      releaseId: master?.meta?.releaseId || null,
      revision: master?.meta?.revision ?? null,
      dataDigest: master?.meta?.dataDigest || null,
    }),
    quote: Object.freeze({
      quoteId: quote.quoteId,
      quoteVersion: quote.quoteVersion,
      snapshotHash: quote.snapshotHash,
      writeStatus: quoteProof.writeProbe.receipt.status,
      readVerified: quoteProof.readProbe.verified === true,
    }),
    envelope: Object.freeze({
      envelopeId: envelope.envelopeId,
      envelopeVersion: envelope.envelopeVersion,
      snapshotHash: envelope.snapshotHash,
      writeStatus: envelopeProof.writeProbe.receipt.status,
      readVerified: envelopeProof.readProbe.verified === true,
    }),
    readiness,
  });
}
