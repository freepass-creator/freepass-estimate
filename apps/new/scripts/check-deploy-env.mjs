const strict = process.argv.includes('--strict') || ['production', 'preview'].includes(String(process.env.VERCEL_ENV || '').toLowerCase());

function value(name) {
  return String(process.env[name] || '').trim();
}

function enabled(raw) {
  return ['1', 'true', 'yes', 'on'].includes(String(raw || '').trim().toLowerCase());
}

const errors = [];
const warnings = [];

function required(name, { secret = false } = {}) {
  const v = value(name);
  if (!v || /^<.*>$/.test(v)) {
    errors.push(`${name} is required`);
    return '';
  }
  if (secret && v.length < 12) warnings.push(`${name} looks unusually short`);
  return v;
}

const baseUrl = required('FREEPASS_DATA_CONSUMER_BASE_URL');
if (baseUrl && !/^https:\/\//i.test(baseUrl)) {
  errors.push('FREEPASS_DATA_CONSUMER_BASE_URL must use HTTPS');
}

required('FREEPASS_DATA_ESTIMATE_TOKEN', { secret: true });
required('FREEPASS_FIREBASE_PROJECT_ID');

const roles = value('FREEPASS_ESTIMATE_REQUIRED_WRITE_ROLES');
const uids = value('FREEPASS_ESTIMATE_ALLOWED_WRITE_UIDS');
if (!roles && !uids) {
  errors.push('configure FREEPASS_ESTIMATE_REQUIRED_WRITE_ROLES or FREEPASS_ESTIMATE_ALLOWED_WRITE_UIDS');
}
if (enabled(value('FREEPASS_ESTIMATE_ALLOW_ANONYMOUS_WRITES'))) {
  errors.push('FREEPASS_ESTIMATE_ALLOW_ANONYMOUS_WRITES must remain disabled for deployed environments');
}

const legacyMode = value('VITE_FREEPASS_QUOTE_WRITE_MODE').toUpperCase();
if (legacyMode !== 'CANONICAL_ONLY') {
  errors.push('VITE_FREEPASS_QUOTE_WRITE_MODE must be CANONICAL_ONLY; new RTDB Quote writes are forbidden');
}

const agentPin = value('VITE_AGENT_PIN');
if (!agentPin) {
  errors.push('VITE_AGENT_PIN must be explicitly configured for deployed UI gate behavior');
} else {
  warnings.push('VITE_AGENT_PIN is client-visible and must never be treated as server authentication');
}

if (!strict) {
  if (errors.length) {
    console.warn('[deploy-env] local/non-strict environment is incomplete:');
    for (const error of errors) console.warn(' - ' + error);
  }
  for (const warning of warnings) console.warn('[deploy-env] ' + warning);
  console.log('[deploy-env] PASS (non-strict)');
  process.exit(0);
}

if (errors.length) {
  console.error('[deploy-env] FAIL');
  for (const error of errors) console.error(' - ' + error);
  for (const warning of warnings) console.error(' ! ' + warning);
  process.exit(1);
}

for (const warning of warnings) console.warn('[deploy-env] ' + warning);
console.log('[deploy-env] PASS (strict deployed environment)');
