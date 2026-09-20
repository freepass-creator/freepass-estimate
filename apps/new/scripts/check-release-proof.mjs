import handler from '../api/version.js';

function need(condition, message) {
  if (!condition) throw new Error(message);
}

function makeRes() {
  const state = { status: null, headers: {}, body: null, ended: false };
  return {
    state,
    setHeader(name, value) { state.headers[String(name).toLowerCase()] = String(value); },
    status(code) { state.status = code; return this; },
    json(value) { state.body = value; state.ended = true; return this; },
    end() { state.ended = true; return this; },
  };
}

process.env.VERCEL_GIT_COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
process.env.VERCEL_ENV = 'preview';
process.env.VERCEL_URL = 'freepass-estimate-test.vercel.app';

const getRes = makeRes();
handler({ method: 'GET' }, getRes);
need(getRes.state.status === 200, 'GET /api/version must return 200');
need(getRes.state.body?.ok === true, 'version payload ok missing');
need(getRes.state.body?.service === 'freepass-estimate-new', 'service id mismatch');
need(getRes.state.body?.revision === process.env.VERCEL_GIT_COMMIT_SHA, 'revision proof mismatch');
need(getRes.state.headers['cache-control']?.includes('no-store'), 'version endpoint must be no-store');

const headRes = makeRes();
handler({ method: 'HEAD' }, headRes);
need(headRes.state.status === 200, 'HEAD /api/version must return 200');
need(headRes.state.headers['x-freepass-revision'] === process.env.VERCEL_GIT_COMMIT_SHA, 'HEAD revision header missing');

const postRes = makeRes();
handler({ method: 'POST' }, postRes);
need(postRes.state.status === 405, 'unsupported method must return 405');

console.log('release proof endpoint contract: PASS');
