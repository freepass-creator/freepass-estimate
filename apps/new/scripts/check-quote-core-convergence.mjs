import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');
const LEGACY_DIRECT_ALLOWLIST = new Set();

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:js|mjs|vue)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(process.cwd(), file).split(path.sep).join('/');
}

const files = walk(ROOT);
const directCalc = [];
const directWelrix = [];

const runtimeEntrypoint = fs.readFileSync(path.resolve('quote.js'), 'utf8');
if (/from\s*['"]\.\/src\/lib\/calc\.js['"]/.test(runtimeEntrypoint)) {
  console.error('[quote-core-convergence] runtime quote.js must not import legacy calc.js');
  process.exit(1);
}

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const name = rel(file);

  const importsLegacyCalc =
    /(?:from\s*['"][^'"]*lib\/calc\.js['"]|import\s*\(\s*['"][^'"]*lib\/calc\.js['"]\s*\))/.test(source);
  if (importsLegacyCalc) directCalc.push(name);

  if (/from\s*['"][^'"]*quote\/engines\/welrix\.js['"]/.test(source)) {
    directWelrix.push(name);
  }
}

const unexpectedCalc = directCalc.filter((file) => !LEGACY_DIRECT_ALLOWLIST.has(file));
if (unexpectedCalc.length) {
  console.error('[quote-core-convergence] runtime imports from legacy src/lib/calc.js are forbidden:');
  for (const file of unexpectedCalc) console.error(' - ' + file);
  process.exit(1);
}

if (directWelrix.length) {
  console.error('[quote-core-convergence] direct legacy Welrix engine imports are forbidden:');
  for (const file of directWelrix) console.error(' - ' + file);
  process.exit(1);
}

const retiredWelrixEngine = path.resolve('src/lib/quote/engines/welrix.js');
if (fs.existsSync(retiredWelrixEngine)) {
  console.error('[quote-core-convergence] retired direct Welrix engine must not be reintroduced');
  process.exit(1);
}

const homeWidget = fs.readFileSync(path.resolve('src/components/home/QuoteWidget.vue'), 'utf8');
for (const required of [
  "from '../../lib/quote/calculate.js'",
  "from '../../lib/quote/preview-request.js'",
]) {
  if (!homeWidget.includes(required)) {
    console.error('[quote-core-convergence] QuoteWidget must use canonical Quote Core: ' + required);
    process.exit(1);
  }
}
if (/\bcalcQuote\b/.test(homeWidget)) {
  console.error('[quote-core-convergence] QuoteWidget regressed to calcQuote');
  process.exit(1);
}

const standardPriceTable = fs.readFileSync(path.resolve('src/components/StandardPriceTable.vue'), 'utf8');
for (const required of [
  "from '../lib/quote/preview-request.js'",
  "from '../lib/quote/preview-calculate.js'",
]) {
  if (!standardPriceTable.includes(required)) {
    console.error('[quote-core-convergence] StandardPriceTable must use canonical Quote Core: ' + required);
    process.exit(1);
  }
}
if (/\bcalcQuote\b/.test(standardPriceTable)) {
  console.error('[quote-core-convergence] StandardPriceTable regressed to calcQuote');
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'PASS',
  canonicalized: [
    'src/components/home/QuoteWidget.vue',
    'src/components/StandardPriceTable.vue',
  ],
  remainingMigrationDebt: [],
}));
