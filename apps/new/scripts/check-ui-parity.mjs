import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(p, 'utf8');
const mobileHtml = read('mobile.html');
const mobileEntry = read('src/mobile.js');
const mobileShell = read('src/components/mobile/MobileApp.vue');
const vehicle = read('src/components/mobile/StepVehicle.vue');
const theme = read('src/lib/brand-theme.js');
const tokens = read('src/styles/tokens.css');
const uiBaseline = read('../../docs/UI_BASELINE.md');

assert.ok(mobileHtml.includes('<title>프리패스모빌리티 · 신차 장기렌터카 견적</title>'),
  'mobile default identity must be FreePass');
assert.ok(mobileHtml.includes('/freepass-manifest.webmanifest'),
  'mobile default manifest must be FreePass');
assert.ok(!mobileHtml.includes('<script src="/welrix-db.js"></script>'),
  'mobile shell must not hardcode the generated mixed catalog');
assert.ok(mobileEntry.includes("'/sales-welrix-db.js'"),
  'Sales profile must load verified Welrix provider catalog through FreePass shell');
assert.ok(mobileShell.includes("cfg.value.company_id === 'welrix'"),
  'channel branding must remain config driven');
assert.ok(mobileShell.includes("'프리패스모빌리티'"),
  'FreePass shell brand must remain explicit');
assert.ok(vehicle.includes('sv-brand-card') && vehicle.includes('sv-trim-card'),
  'FreePass vehicle selection grammar missing');
assert.ok(theme.includes("freepass?'프리패스모빌리티'"),
  'FreePass theme authority missing');
assert.ok(tokens.includes('--brand:      #1b2a4a;'),
  'FreePass brand token baseline drift');
assert.ok(uiBaseline.includes('Current canonical source:'),
  'UI baseline must identify current FreePass canonical source');
assert.ok(uiBaseline.includes('Welrix UI는 historical reference'),
  'Welrix must remain lineage/reference, not current UI authority');

console.log(JSON.stringify({
  status: 'PASS',
  uiAuthority: 'freepass-estimate',
  historicalLineage: 'welrixtable',
  salesCatalog: 'welrix-sales-443',
  calculationAuthority: 'welrix',
}, null, 2));
