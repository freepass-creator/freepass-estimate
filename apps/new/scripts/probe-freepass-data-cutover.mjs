import { fetchFreePassDataMaster } from '../api/freepass-data-master.js';
import {
  forwardIssuedQuoteCommand,
} from '../api/issued-quotes.js';
import {
  fetchIssuedQuoteReceipt,
} from '../api/issued-quote.js';
import {
  forwardShareEnvelopeCommand,
} from '../api/share-envelopes.js';
import {
  fetchShareEnvelopeReceipt,
} from '../api/share-envelope.js';
import {
  QUOTE_REPOSITORY_CONTRACT,
} from '../src/lib/quote/quote-repository.js';
import {
  SHARE_ENVELOPE_REPOSITORY_CONTRACT,
} from '../src/lib/quote/share-envelope-repository.js';
import { runCutoverProbe } from '../src/lib/quote/cutover-probe.js';
import { legacyQuoteWriteBlockEvidence } from '../src/lib/quote/legacy-write-policy.js';
import { resolveEstimateWriteAccessPolicy } from '../api/_auth/estimate-write-access.js';

function fail(message, code = 'CUTOVER_PROBE_CONFIG_INVALID') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function flag(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function fixtureQuote() {
  const raw = String(process.env.FREEPASS_ESTIMATE_SHADOW_QUOTE_JSON || '').trim();
  if (!raw) {
    fail('FREEPASS_ESTIMATE_SHADOW_QUOTE_JSON is required');
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    fail('FREEPASS_ESTIMATE_SHADOW_QUOTE_JSON must be valid JSON');
  }
  if (
    !value ||
    value.contract !== 'freepass-quote/v2' ||
    typeof value.quoteId !== 'string' ||
    !Number.isSafeInteger(Number(value.quoteVersion)) ||
    !/^[a-f0-9]{64}$/i.test(value.snapshotHash || '')
  ) {
    fail('shadow fixture must be an issued freepass-quote/v2');
  }
  return value;
}

function expiry(now = Date.now()) {
  const explicit = String(process.env.FREEPASS_ESTIMATE_SHADOW_ENVELOPE_EXPIRES_AT || '').trim();
  if (explicit) {
    if (!Number.isFinite(Date.parse(explicit))) {
      fail('FREEPASS_ESTIMATE_SHADOW_ENVELOPE_EXPIRES_AT must be an ISO timestamp');
    }
    return explicit;
  }
  return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
}

const quoteRepository = Object.freeze({
  contract: QUOTE_REPOSITORY_CONTRACT,
  async put({ quote, idempotencyKey }) {
    return forwardIssuedQuoteCommand({
      body: {
        command: 'PUT_ISSUED_QUOTE',
        contract: QUOTE_REPOSITORY_CONTRACT,
        idempotencyKey,
        quote,
      },
      requestIdempotencyKey: idempotencyKey,
      env: process.env,
    });
  },
  async get({ quoteId, quoteVersion }) {
    return fetchIssuedQuoteReceipt({
      quoteId,
      quoteVersion,
      env: process.env,
    });
  },
});

const envelopeRepository = Object.freeze({
  contract: SHARE_ENVELOPE_REPOSITORY_CONTRACT,
  async put({ envelope, idempotencyKey }) {
    return forwardShareEnvelopeCommand({
      body: {
        command: 'PUT_SHARE_ENVELOPE',
        contract: SHARE_ENVELOPE_REPOSITORY_CONTRACT,
        idempotencyKey,
        envelope,
      },
      requestIdempotencyKey: idempotencyKey,
      env: process.env,
    });
  },
  async get({ envelopeId, envelopeVersion }) {
    return fetchShareEnvelopeReceipt({
      envelopeId,
      envelopeVersion,
      env: process.env,
    });
  },
});

try {
  const result = await runCutoverProbe({
    loadMaster: () => fetchFreePassDataMaster({ env: process.env }),
    quoteRepository,
    envelopeRepository,
    quote: fixtureQuote(),
    envelopeExpiresAt: expiry(),
    canonicalViewerReady: flag('FREEPASS_CANONICAL_VIEWER_READY'),
    legacyWritePolicy: legacyQuoteWriteBlockEvidence({
      globalMode: process.env.FREEPASS_QUOTE_WRITE_MODE,
      viteMode: '',
    }),
    writeAccessPolicy: resolveEstimateWriteAccessPolicy(process.env),
  });

  // Deliberately emit only IDs, hashes, release evidence and gate results.
  // Service tokens and the full Quote/Envelope payloads are never printed.
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  if (flag('FREEPASS_REQUIRE_CUTOVER_READY') && result.status !== 'READY') {
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(JSON.stringify({
    ok: false,
    code: error?.code || 'CUTOVER_PROBE_FAILED',
    error: error?.message || 'cutover probe failed',
  }) + '\n');
  process.exitCode = 1;
}
