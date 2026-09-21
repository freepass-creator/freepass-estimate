import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/index.html';
const out = process.env.ARTIFACT_DIR || 'artifacts/desktop-five-term';
fs.mkdirSync(out, { recursive: true });

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

async function selectFirstValue(page, sectionSelector) {
  const button = page.locator(`${sectionSelector} .cdd__btn`);
  await button.waitFor({ state: 'visible' });
  await button.click();
  const option = page.locator(`${sectionSelector} .cdd__opt`).first();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, locale: 'ko-KR' });
  const consoleErrors = [];
  const requestFailures = [];
  const quoteResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push({
    url: request.url(),
    error: request.failure()?.errorText || '',
  }));
  page.on('response', (response) => {
    if (response.url().includes('/api/standard-quote')) {
      quoteResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await selectFirstValue(page, '#sec-manufacturer');
  await selectFirstValue(page, '#sec-model');
  await selectFirstValue(page, '#sec-variant');
  await selectFirstValue(page, '#sec-trim');

  await page.waitForFunction(() => {
    const monthly = [...document.querySelectorAll('#reference-grid .term-card__monthly')];
    return monthly.length === 5 && monthly.every((node) => /[0-9,]+\s*\uc6d0/.test(node.textContent || ''));
  });

  const terms = await page.locator('#reference-grid .ref-term-label').allTextContents();
  const monthly = await page.locator('#reference-grid .term-card__monthly').allTextContents();
  const normalizedTerms = terms.map((value) => value.trim());
  const normalizedMonthly = monthly.map((value) => value.replace(/\s+/g, ' ').trim());
  const formAlignment = await page.evaluate(() => {
    const topFields = [...document.querySelectorAll('.cs-form .cs-field')];
    const bottomFields = [...document.querySelectorAll('.qp-form--conds .qc-field')];
    const topControls = topFields.map((field) =>
      field.querySelector(':scope > input, :scope > .qc-pct')?.getBoundingClientRect(),
    );
    const bottomControls = bottomFields.map((field) =>
      field.querySelector(':scope > select, :scope > .qc-pct')?.getBoundingClientRect(),
    );
    return topFields.map((field, index) => {
      const topField = field.getBoundingClientRect();
      const bottomField = bottomFields[index]?.getBoundingClientRect();
      const topControl = topControls[index];
      const bottomControl = bottomControls[index];
      return {
        fieldLeftDelta: Math.abs((topField?.left || 0) - (bottomField?.left || 0)),
        fieldWidthDelta: Math.abs((topField?.width || 0) - (bottomField?.width || 0)),
        controlLeftDelta: Math.abs((topControl?.left || 0) - (bottomControl?.left || 0)),
        controlWidthDelta: Math.abs((topControl?.width || 0) - (bottomControl?.width || 0)),
      };
    });
  });

  ok(JSON.stringify(normalizedTerms) === JSON.stringify(['12\uac1c\uc6d4', '24\uac1c\uc6d4', '36\uac1c\uc6d4', '48\uac1c\uc6d4', '60\uac1c\uc6d4']),
    `\uc57d\uc815 \uae30\uac04 \ubd88\uc77c\uce58: ${normalizedTerms.join(', ')}`);
  ok(formAlignment.length === 4 && formAlignment.every((item) =>
    item.fieldLeftDelta <= 1 && item.fieldWidthDelta <= 1 &&
    item.controlLeftDelta <= 1 && item.controlWidthDelta <= 1),
  `\uc0c1\ub2e8 \uc785\ub825\ubd80 \uc815\ub82c \ubd88\uc77c\uce58: ${JSON.stringify(formAlignment)}`);
  ok(quoteResponses.some((response) => response.status === 200),
    `\ud45c\uc900 \uacac\uc801 API 200 \uc751\ub2f5 \uc5c6\uc74c: ${JSON.stringify(quoteResponses)}`);
  const relevantRequestFailures = requestFailures.filter((request) =>
    !request.url.includes('cdn.jsdelivr.net') && !request.url.includes('unpkg.com') && !request.url.includes('cdnjs.cloudflare.com'),
  );
  ok(relevantRequestFailures.length === 0, `\uc694\uccad \uc2e4\ud328: ${JSON.stringify(relevantRequestFailures)}`);
  const relevantConsoleErrors = consoleErrors.filter((message) =>
    !message.includes('Refused to apply style from') && !message.includes('cdn.jsdelivr.net'),
  );
  ok(relevantConsoleErrors.length === 0, `\ucf58\uc194 \uc624\ub958: ${relevantConsoleErrors.join(' | ')}`);

  const screenshot = path.resolve(out, 'freepass-desktop-five-term-quotes.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({ ok: true, terms: normalizedTerms, monthly: normalizedMonthly, formAlignment, quoteResponses, screenshot }, null, 2));
} finally {
  await browser.close();
}
