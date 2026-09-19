import { chromium } from 'playwright';
import fs from 'node:fs';

const base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
const out='ui-captures';
fs.mkdirSync(out,{recursive:true});

const browser=await chromium.launch({headless:true});

async function snap(page,name){
  await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
  console.log('CAPTURE',name,page.url());
}
async function assertNoVehicleNext(page,label){
  const buttons=page.locator('footer.m-footer .m-btn--primary');
  if(await buttons.count()) throw new Error(label+': single-choice screen must not show a Next primary button');
}

{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.goto(base+'/index.html',{waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  await snap(page,'new-web-initial');
  await page.close();
}

{
  const page=await browser.newPage({
    viewport:{width:390,height:844},
    deviceScaleFactor:1,
    isMobile:true,
    hasTouch:true,
  });
  await page.goto(base+'/mobile.html',{waitUntil:'networkidle'});
  await page.waitForSelector('.sv-brand-card',{timeout:15000});
  await page.waitForTimeout(300);

  const brandText=(await page.locator('.m-brand').innerText()).trim();
  if(!/프리패스모빌리티/.test(brandText)) throw new Error('FreePass mobile header branding not applied: '+brandText);
  await assertNoVehicleNext(page,'brand');
  await snap(page,'new-mobile-01-brand');

  await page.locator('.sv-brand-card').first().click();
  await page.waitForSelector('.sv-row',{timeout:10000});
  await page.waitForTimeout(200);
  await assertNoVehicleNext(page,'model');
  // MODEL_AXIS_ASSERTION_V2 — Hybrid/Electric belong to powertrain, not model rows.
  const modelLabels=await page.locator('.sv-row__label').allInnerTexts();
  const badModel=modelLabels.find((x)=>/\s(?:Hybrid|Electric|HEV|EV)$/i.test(x.trim()));
  if(badModel) throw new Error('Hybrid/Electric leaked into model axis: '+badModel);
  await snap(page,'new-mobile-02-model');

  await page.locator('.sv-row').first().click();
  await page.waitForTimeout(200);
  await assertNoVehicleNext(page,'powertrain');
  await snap(page,'new-mobile-03-powertrain');

  await page.locator('.sv-row').first().click();
  await page.waitForTimeout(250);
  const subAfterPower=await page.locator('.sv-section').count();
  if(!subAfterPower) throw new Error('No vehicle step after powertrain selection');
  await assertNoVehicleNext(page,'spec/trim');
  await snap(page,'new-mobile-04-trim-or-spec');

  // If an intermediate spec step exists, choose it first.
  if(await page.locator('.sv-title').filter({hasText:'인승·구동방식을 골라주세요'}).count()){
    await page.locator('.sv-row').first().click();
    await page.waitForTimeout(200);
    await assertNoVehicleNext(page,'trim');
  }

  const trim=page.locator('.sv-trim-card').first();
  await trim.waitFor({state:'visible',timeout:10000});
  await trim.click();
  await page.waitForTimeout(300);

  // Trim is also a single choice: selection itself advances to colors (or options when no colors exist).
  const advanced=await page.locator('.sv-title').filter({hasText:/색상을|옵션을/}).count();
  if(!advanced) throw new Error('trim selection did not auto-advance to colors/options');
  await snap(page,'new-mobile-05-after-trim');
  await page.close();
}

await browser.close();
