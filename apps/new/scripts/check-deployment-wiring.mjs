import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const envCheck = fs.readFileSync(new URL('./check-deploy-env.mjs', import.meta.url), 'utf8');
const workflowPaths = [
  '../../../.github/workflows/ai-core-qa-p0-shadow.yml',
  '../../../.github/workflows/integration-contracts.yml',
  '../../../.github/workflows/newcar-ci.yml',
  '../../../.github/workflows/newcar-ui-screenshots.yml',
];
const workflows = workflowPaths.map((path) => ({
  path,
  content: fs.readFileSync(new URL(path, import.meta.url), 'utf8'),
}));

const errors = [];
function expect(condition, message) {
  if (!condition) errors.push(message);
}

expect(pkg.engines?.node === '24.x', 'package.json must pin Node 24.x');
expect(pkg.scripts?.['build:vercel']?.includes('check-deploy-env.mjs --strict'), 'build:vercel must run strict deploy env validation');
expect(pkg.scripts?.verify?.includes('check:deployment'), 'verify must include check:deployment');
expect(vercel.$schema === 'https://openapi.vercel.sh/vercel.json', 'vercel.json schema missing');
expect(vercel.framework === 'vite', 'Vercel framework must be vite');
expect(vercel.installCommand === 'npm ci', 'Vercel install command must be npm ci');
expect(vercel.buildCommand === 'npm run build:vercel', 'Vercel build command must use build:vercel');
expect(vercel.outputDirectory === 'dist', 'Vercel output directory must be dist');
expect(vite.includes("loadEnv(mode, process.cwd(), '')"), 'local Vite must load server-only .env.local values for same-process API handlers');
expect(vite.includes("'/api/standard-quote-batch': './api/standard-quote-batch.js'"), 'local Vite must expose standard quote batch API');
expect(vite.includes("'/api/issued-quotes': './api/issued-quotes.js'"), 'local Vite must expose canonical Quote write API');
expect(vite.includes("'/api/share-envelopes': './api/share-envelopes.js'"), 'local Vite must expose canonical Share Envelope write API');
expect(!vite.includes("process.env.VITE_AGENT_PIN || '1234'"), 'deployed gate PIN must not silently default to 1234');
expect(envCheck.includes("VITE_FREEPASS_QUOTE_WRITE_MODE must be CANONICAL_ONLY"), 'deploy env guard must block new legacy RTDB Quote writes');
expect(envCheck.includes('FREEPASS_DATA_ESTIMATE_TOKEN'), 'deploy env guard must require FreePass Data token');
expect(envCheck.includes('FREEPASS_ESTIMATE_REQUIRED_WRITE_ROLES'), 'deploy env guard must require a write authorization selector');
for (const workflow of workflows) {
  expect(!/node-version:\s*['"]22['"]/.test(workflow.content), `${workflow.path} must not use Node 22`);
  if (/node-version:/.test(workflow.content)) {
    expect(/node-version:\s*['"]24['"]/.test(workflow.content), `${workflow.path} must use Node 24`);
  }
}

if (errors.length) {
  console.error('[deployment-wiring] FAIL');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('[deployment-wiring] PASS — Local Windows + Vercel deployment contract is wired');
