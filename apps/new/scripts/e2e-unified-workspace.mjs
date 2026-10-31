// Explicit UI fixture test. This does not certify live supplier price parity.
// Start Vite first, then: PLAYWRIGHT_MODULE=playwright node scripts/e2e-unified-workspace.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fixture } from './fixtures/kamatch-test-reference.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const artifactDir = process.env.ARTIFACT_DIR || 'artifacts/unified-workspace';
mkdirSync(artifactDir, { recursive:true });
const f = fixture();
f.master.meta = { ...f.master.meta, manifestId:'TEST', inputDigest:'a'.repeat(64), dataDigest:'b'.repeat(64), activatedAt:'2026-10-31T00:00:00Z' };
Object.assign(f.master.data[0], { maker:'현대', model:'디 올 뉴 아반떼', modelYear:2026, vehicleModelId:'test-avante', modelYearId:'test-2026', trimId:'test-modern', powertrainId:'test-gasoline', trimName:'모던', powertrainName:'가솔린', configuration:{} });
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}), args:['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport:{width:1440,height:1000}, serviceWorkers:'block' });
  await context.route('**/api/freepass-data-master', route => route.fulfill({json:{ok:true,...f.master}}));
  await context.route('**/api/stock', route => route.fulfill({json:{ok:true,data:[]}}));
  let calculations = 0;
  await context.route('**/api/public-quotes', async route => {
    calculations++;
    const request = route.request().postDataJSON().request;
    const total = 23980000 + (request.차.구성.선택옵션.length ? 450000 : 0) + 330000;
    const offers = [['no-credit','신용 무관'],['income-check','소득 확인'],['credit-required','신용 심사']].map(([id,label],index) => ({
      id,label,status:'ready',priceComponents:{base:23980000,options:request.차.구성.선택옵션.length ? 450000 : 0,exterior:110000,interior:220000,discount:0,items:[]},
      results:request.안들.map(sc => ({월대여료:500000+index*10000+sc.기간*100+request.조건.수수료율*1000,총차량가:total,인수가:12000000,보증금:total*sc.보증금/100,선납금:total*sc.선납/100})),
    }));
    await route.fulfill({json:{ok:true,mode:'PUBLIC_QUOTE_OPTIONS',offers}});
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/index.html');
  await page.locator('.desktop-companion').waitFor({state:'visible'});
  assert.equal(new URL(page.url()).pathname,'/index.html');
  assert.equal(await page.locator('.m-shell').count(),1);
  await page.locator('.sv-brand-card').filter({hasText:'현대'}).click();
  assert.match(await page.locator('.dc-heading h2').innerText(),/현대/);
  await page.locator('.sv-row').filter({hasText:'디 올 뉴 아반떼'}).first().click();
  await page.locator('.sv-row').filter({hasText:'가솔린'}).first().click();
  await page.locator('.sv-trim-card').filter({hasText:'모던'}).first().click();
  for (const group of await page.locator('.sv-color-grid').all()) await group.locator('button:not([disabled])').first().click();
  await page.locator('.m-footer .m-btn--primary:visible').click();
  await page.locator('.sv-title').filter({hasText:'옵션'}).waitFor();
  await page.locator('.sv-opt:not(.is-disabled)').first().click();
  await page.locator('.m-footer .m-btn--primary:visible').click();
  await page.locator('.se-title').waitFor();
  assert.match(await page.locator('.desktop-companion').innerText(),/선루프/);
  await page.screenshot({path:artifactDir+'/desktop-selection.png',fullPage:true});
  await page.locator('.m-footer .m-btn--primary:visible').click();
  await page.locator('.sc-title').waitFor();
  const fee = page.locator('.sc').getByLabel('영업 수수료',{exact:true});
  await fee.fill('2.5'); await fee.blur();
  await page.locator('.m-footer .m-btn--primary:visible').click();
  await page.waitForFunction(() => document.querySelectorAll('.sr-term__monthly b').length === 9);
  const amounts = await page.locator('.sr-term__monthly b').allTextContents();
  assert.deepEqual(await page.locator('.dc-monthly').allTextContents(), amounts.map(value => value.trim()+'원'));
  assert.doesNotMatch(await page.locator('.desktop-companion').innerText(),/카매치|웰릭스|웰스/);
  await page.screenshot({path:artifactDir+'/desktop-result.png',fullPage:true});
  const count = calculations;
  await page.setViewportSize({width:390,height:900});
  assert.equal(await page.locator('.desktop-companion').isVisible(),false);
  assert.deepEqual(await page.locator('.sr-term__monthly b').allTextContents(),amounts);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  await page.screenshot({path:artifactDir+'/mobile-result.png',fullPage:true});
  for (const width of [768,1024,1100]) {
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.locator('.desktop-companion').isVisible(),width >= 1100);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    assert.deepEqual(await page.locator('.sr-term__monthly b').allTextContents(),amounts);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.desktop-companion').waitFor({state:'visible'});
  assert.equal(calculations,count,'resizing the helper must not trigger another calculator');
  assert.deepEqual(errors,[]);
  console.log('PASS unified desktop/mobile picker, live selection summary, identical nine quote amounts, responsive state preservation, no duplicate calculation');
} finally { await browser.close(); }
