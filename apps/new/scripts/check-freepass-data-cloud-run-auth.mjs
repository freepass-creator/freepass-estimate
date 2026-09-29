import assert from 'node:assert/strict';
import {
  clearFreePassDataIdentityCacheForTest,
  createFreePassDataHeaders,
  resolveCloudRunAudience,
} from '../api/_auth/freepass-data-cloud-run.js';

assert.equal(
  resolveCloudRunAudience('https://writer.example.test/v1/commands/x'),
  'https://writer.example.test'
);

await assert.rejects(
  () => createFreePassDataHeaders({
    url: 'https://writer.example.test/v1/commands/x',
    consumerToken: 'consumer-token',
    env: { NODE_ENV: 'production' },
    getOidcToken: async () => '',
  }),
  (error) => error?.code === 'FREEPASS_DATA_CLOUD_RUN_IDENTITY_UNAVAILABLE'
);

await assert.rejects(
  () => createFreePassDataHeaders({
    url: 'https://writer.example.test/v1/commands/x',
    consumerToken: 'consumer-token',
    env: {
      NODE_ENV: 'development',
      FREEPASS_DATA_REQUIRE_CLOUD_RUN_ID_TOKEN: 'true',
      FREEPASS_DATA_CLOUD_RUN_ID_TOKEN: 'must-not-bypass-required-oidc',
    },
    getOidcToken: async () => '',
  }),
  (error) => error?.code === 'FREEPASS_DATA_CLOUD_RUN_IDENTITY_UNAVAILABLE'
);

const staticHeaders = await createFreePassDataHeaders({
  url: 'https://writer.example.test/v1/commands/x',
  consumerToken: 'consumer-token',
  env: {
    NODE_ENV: 'test',
    FREEPASS_DATA_CLOUD_RUN_ID_TOKEN: 'static-id-token',
  },
});
assert.equal(staticHeaders.authorization, 'Bearer consumer-token');
assert.equal(staticHeaders['x-serverless-authorization'], 'Bearer static-id-token');

await assert.rejects(
  () => createFreePassDataHeaders({
    url: 'https://writer.example.test/v1/commands/x',
    consumerToken: 'consumer-token',
    env: {
      NODE_ENV: 'production',
      FREEPASS_DATA_CLOUD_RUN_ID_TOKEN: 'must-not-bypass-production-oidc',
    },
    getOidcToken: async () => '',
  }),
  (error) => error?.code === 'FREEPASS_DATA_CLOUD_RUN_IDENTITY_UNAVAILABLE'
);

clearFreePassDataIdentityCacheForTest();
const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url, init });
  if (url === 'https://sts.googleapis.com/v1/token') {
    return { ok: true, status: 200, json: async () => ({ access_token: 'access', expires_in: 3600 }) };
  }
  if (String(url).includes(':generateIdToken')) {
    return { ok: true, status: 200, json: async () => ({ token: 'minted-id-token' }) };
  }
  throw new Error(`unexpected URL: ${url}`);
};
const env = {
  NODE_ENV: 'production',
  FREEPASS_DATA_GCP_WIF_AUDIENCE: '//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/vercel/providers/estimate',
  FREEPASS_DATA_GCP_CALLER_SERVICE_ACCOUNT_EMAIL: 'estimate-caller@example.iam.gserviceaccount.com',
  VERCEL_OIDC_TOKEN: 'stale.fallback.token',
};
const mintedHeaders = await createFreePassDataHeaders({
  url: 'https://writer.example.test/v1/commands/x',
  consumerToken: 'consumer-token',
  env,
  fetchImpl,
  getOidcToken: async () => 'fresh.request.token',
});
assert.equal(mintedHeaders['x-serverless-authorization'], 'Bearer minted-id-token');
assert.equal(calls.length, 2);
assert.equal(JSON.parse(calls[1].init.body).audience, 'https://writer.example.test');
assert.equal(new URLSearchParams(calls[0].init.body).get('subject_token'), 'fresh.request.token');
assert.ok(calls[0].init.signal, 'STS exchange must have a timeout signal');
assert.ok(calls[1].init.signal, 'ID token mint must have a timeout signal');

await createFreePassDataHeaders({
  url: 'https://writer.example.test/v1/commands/y',
  consumerToken: 'consumer-token',
  env,
  fetchImpl,
  getOidcToken: async () => { throw new Error('temporary Vercel OIDC outage'); },
});
assert.equal(calls.length, 2, 'minted Cloud Run ID token should be cached by audience');

await createFreePassDataHeaders({
  url: 'https://other-writer.example.test/v1/commands/y',
  consumerToken: 'consumer-token',
  env,
  fetchImpl,
  getOidcToken: async () => 'fresh.request.token',
});
assert.equal(calls.length, 4, 'a different destination origin must mint a distinct ID token');

clearFreePassDataIdentityCacheForTest();
await assert.rejects(
  () => createFreePassDataHeaders({
    url: 'https://writer.example.test/v1/commands/x',
    consumerToken: 'consumer-token',
    env,
    fetchImpl: async () => { throw new DOMException('timed out', 'TimeoutError'); },
    getOidcToken: async () => 'fresh.request.token',
  }),
  (error) => error?.code === 'FREEPASS_DATA_CLOUD_RUN_STS_UNAVAILABLE' && error?.status === 503
);

console.log('PASS private Cloud Run auth: fail-closed config + STS ID-token exchange + cache');
