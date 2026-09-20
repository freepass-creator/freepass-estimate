// Production revision proof endpoint.
// Release completion is verified against the actual served revision, not only Git/CI/deploy state.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ ok: false, error: 'GET/HEAD only' });
    return;
  }

  const revision =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.COMMIT_SHA ||
    null;

  const payload = {
    ok: true,
    service: 'freepass-estimate-new',
    revision,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
    deployment_url: process.env.VERCEL_URL || null,
  };

  if (req.method === 'HEAD') {
    if (revision) res.setHeader('X-FreePass-Revision', revision);
    res.status(200).end();
    return;
  }

  res.status(200).json(payload);
}
