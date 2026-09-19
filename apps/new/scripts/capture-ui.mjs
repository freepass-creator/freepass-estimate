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
  await snap(page,'new-mobile-01-brand');

  await page.locator('.sv-brand-card').first().click();
  await page.waitForSelector('.sv-row',{timeout:10000});
  await page.waitForTimeout(250);
  await snap(page,'new-mobile-02-model');

  await page.locator('.sv-row').first().click();
  await page.waitForTimeout(250);
  await snap(page,'new-mobile-03-powertrain');

  const nextRow=page.locator('.sv-row').first();
  if(await nextRow.count()){
    await nextRow.click();
    await page.waitForTimeout(300);
    await snap(page,'new-mobile-04-after-powertrain');
  }
  await page.close();
}

await browser.close();
