import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// Desktop release proof: aligned fields, five-term amounts, provider failure, and manual retry.

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

  await page.setViewportSize({ width: 2560, height: 1080 });
  const wideFormLayout = await page.evaluate(() => {
    const panel = document.querySelector('.quote-panel')?.getBoundingClientRect();
    const panelStyle = document.querySelector('.quote-panel')
      ? getComputedStyle(document.querySelector('.quote-panel'))
      : null;
    const top = document.querySelector('.cs-form')?.getBoundingClientRect();
    const bottom = document.querySelector('.qp-form--conds')?.getBoundingClientRect();
    return {
      panelContentLeft: (panel?.left || 0) + parseFloat(panelStyle?.paddingLeft || '0'),
      topLeft: top?.left || 0,
      bottomLeft: bottom?.left || 0,
      topWidth: top?.width || 0,
      bottomWidth: bottom?.width || 0,
    };
  });
  await page.setViewportSize({ width: 1920, height: 1080 });

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
      const topLabel = field.querySelector('label');
      const bottomLabel = bottomFields[index]?.querySelector('label');
      const topLabelRect = topLabel?.getBoundingClientRect();
      const bottomLabelRect = bottomLabel?.getBoundingClientRect();
      return {
        fieldLeftDelta: Math.abs((topField?.left || 0) - (bottomField?.left || 0)),
        fieldWidthDelta: Math.abs((topField?.width || 0) - (bottomField?.width || 0)),
        controlLeftDelta: Math.abs((topControl?.left || 0) - (bottomControl?.left || 0)),
        controlWidthDelta: Math.abs((topControl?.width || 0) - (bottomControl?.width || 0)),
        topLabelGap: Math.abs((topControl?.left || 0) - (topLabelRect?.right || 0)),
        bottomLabelGap: Math.abs((bottomControl?.left || 0) - (bottomLabelRect?.right || 0)),
        topLabelAlign: topLabel ? getComputedStyle(topLabel).textAlign : '',
        bottomLabelAlign: bottomLabel ? getComputedStyle(bottomLabel).textAlign : '',
      };
    });
  });

  ok(JSON.stringify(normalizedTerms) === JSON.stringify(['12\uac1c\uc6d4', '24\uac1c\uc6d4', '36\uac1c\uc6d4', '48\uac1c\uc6d4', '60\uac1c\uc6d4']),
    `\uc57d\uc815 \uae30\uac04 \ubd88\uc77c\uce58: ${normalizedTerms.join(', ')}`);
  ok(wideFormLayout.topWidth <= 1360.5 && wideFormLayout.bottomWidth <= 1360.5 &&
    Math.abs(wideFormLayout.topLeft - wideFormLayout.panelContentLeft) <= 1 &&
    Math.abs(wideFormLayout.bottomLeft - wideFormLayout.panelContentLeft) <= 1,
  `\uc640\uc774\ub4dc \ud654\uba74 \ud3fc \ucd5c\ub300\ud3ed/\uc88c\uce21 \uc815\ub82c \ubd88\uc77c\uce58: ${JSON.stringify(wideFormLayout)}`);
  ok(formAlignment.length === 4 && formAlignment.every((item) =>
    item.fieldLeftDelta <= 1 && item.fieldWidthDelta <= 1 &&
    item.controlLeftDelta <= 1 && item.controlWidthDelta <= 1 &&
    Math.abs(item.topLabelGap - 8) <= 1 && Math.abs(item.bottomLabelGap - 8) <= 1 &&
    item.topLabelAlign === 'right' && item.bottomLabelAlign === 'right'),
  `\uc0c1\ub2e8 \uc785\ub825\ubd80 \uc815\ub82c \ubd88\uc77c\uce58: ${JSON.stringify(formAlignment)}`);
  ok(quoteResponses.some((response) => response.status === 200),
    `\ud45c\uc900 \uacac\uc801 API 200 \uc751\ub2f5 \uc5c6\uc74c: ${JSON.stringify(quoteResponses)}`);

  // 입력 변경 중 공급자 오류가 나면 금액을 비우고 오류를 보인 뒤,
  // 다음 입력 변경에서 같은 정본 API로 다시 계산되어야 한다.
  const quoteRoute = '**/api/standard-quote';
  await page.route(quoteRoute, (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, code: 'STANDARD_QUOTE_TEST_FAILURE', error: '\uc77c\uc2dc\uc801 \uacac\uc801 \uc2e4\ud328' }),
  }));
  const feeInput = page.locator('.cs-form .cs-field').nth(3).locator('input');
  await feeInput.fill('6.9');
  await feeInput.dispatchEvent('change');
  await page.waitForFunction(() =>
    document.querySelector('#quote-doc')?.textContent?.includes('\uc9c0\uae08\uc740 \uacac\uc801\uc744 \uacc4\uc0b0\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4'),
  );
  await page.waitForFunction(() =>
    [...document.querySelectorAll('#reference-grid .term-card__monthly')]
      .every((node) => (node.textContent || '').includes('\u2014')),
  );
  const errorText = (await page.locator('#quote-doc').innerText()).replace(/\s+/g, ' ').trim();
  await page.unroute(quoteRoute);

  const retryResponse = page.waitForResponse((response) =>
    response.url().includes('/api/standard-quote') && response.status() === 200,
  );
  await feeInput.fill('7');
  await feeInput.dispatchEvent('change');
  await retryResponse;
  await page.waitForFunction(() => {
    const values = [...document.querySelectorAll('#reference-grid .term-card__monthly')];
    return values.length === 5 && values.every((node) => /[0-9,]+\s*\uc6d0/.test(node.textContent || ''));
  });
  await page.waitForFunction(() => {
    const values = [...document.querySelectorAll('#terms-grid .term-card__monthly')];
    return values.length === 5 && values.every((node) => /[0-9,]+\s*\uc6d0/.test(node.textContent || ''));
  });
  const retriedMonthly = (await page.locator('#reference-grid .term-card__monthly').allTextContents())
    .map((value) => value.replace(/\s+/g, ' ').trim());
  const customerMonthly = (await page.locator('#terms-grid .term-card__monthly').allTextContents())
    .map((value) => value.replace(/\s+/g, ' ').trim());
  ok(JSON.stringify(retriedMonthly) === JSON.stringify(normalizedMonthly),
    `\uc7ac\uc2dc\ub3c4 \ud6c4 \uacac\uc801\uae08\uc561 \ubd88\uc77c\uce58: ${JSON.stringify({ normalizedMonthly, retriedMonthly })}`);
  ok(JSON.stringify(customerMonthly) === JSON.stringify(normalizedMonthly),
    `\uc190\ub2d8 \ubc1c\uc1a1\uc6a9 5\uac1c \uae30\uac04 \ud45c\uc2dc \ubd88\uc77c\uce58: ${JSON.stringify({ normalizedMonthly, customerMonthly })}`);

  const relevantRequestFailures = requestFailures.filter((request) =>
    !request.url.includes('cdn.jsdelivr.net') && !request.url.includes('unpkg.com') && !request.url.includes('cdnjs.cloudflare.com'),
  );
  ok(relevantRequestFailures.length === 0, `\uc694\uccad \uc2e4\ud328: ${JSON.stringify(relevantRequestFailures)}`);
  const relevantConsoleErrors = consoleErrors.filter((message) =>
    !message.includes('Refused to apply style from') &&
    !message.includes('cdn.jsdelivr.net') &&
    !message.includes('[quote-provider]') &&
    !message.includes('status of 503') &&
    !message.includes('\ud45c\uc900 \uacac\uc801 \uc11c\ubc84 \uc751\ub2f5 503'),
  );
  ok(relevantConsoleErrors.length === 0, `\ucf58\uc194 \uc624\ub958: ${relevantConsoleErrors.join(' | ')}`);

  await feeInput.blur();
  const screenshot = path.resolve(out, 'freepass-desktop-five-term-quotes.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({
    ok: true,
    terms: normalizedTerms,
    monthly: normalizedMonthly,
    wideFormLayout,
    formAlignment,
    errorRetry: { errorText, retriedMonthly, customerMonthly },
    quoteResponses,
    screenshot,
  }, null, 2));
} finally {
  await browser.close();
}
