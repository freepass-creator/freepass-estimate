import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const OUT = process.env.ARTIFACT_DIR || 'artifacts/ui-visual-audit';
fs.mkdirSync(OUT, { recursive: true });

const report = { generatedAt: new Date().toISOString(), mobile: [], desktop: [], responsive: [] };

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitTitle(page, text) {
  await page.waitForFunction((expected) => {
    const node = document.querySelector('.sv-title, .sc-title, .se-title, .sr-title');
    return (node?.textContent || '').includes(expected);
  }, text, { timeout: 10000 });
}

async function metrics(page, label) {
  const data = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const doc = document.documentElement;
    const body = document.body;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const targetSelectors = 'button, a[href], input, select, summary, [role="button"][tabindex]';
    const smallTargets = [...document.querySelectorAll(targetSelectors)]
      .filter(visible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: String(el.className || ''),
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
          width: el.offsetWidth,
          height: el.offsetHeight,
        };
      })
      .filter((x) => x.width < 44 || x.height < 44);

    const footer = document.querySelector('.m-footer')?.getBoundingClientRect();
    const main = document.querySelector('.m-main')?.getBoundingClientRect();

    return {
      viewport: { width: innerWidth, height: innerHeight },
      html: { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth },
      body: { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth },
      tokens: {
        title: root.getPropertyValue('--fs-2xl').trim(),
        body: root.getPropertyValue('--fs-base').trim(),
        support: root.getPropertyValue('--fs-sm').trim(),
        input: root.getPropertyValue('--h-input').trim(),
        cta: root.getPropertyValue('--h-cta').trim(),
        chip: root.getPropertyValue('--h-chip').trim(),
        radius: root.getPropertyValue('--r-card').trim(),
      },
      smallTargets,
      footer: footer ? { top: footer.top, bottom: footer.bottom, height: footer.height } : null,
      mainBottom: main?.bottom ?? null,
    };
  });

  ok(data.html.scrollWidth <= data.html.clientWidth + 1, label + ': html horizontal overflow');
  ok(data.body.scrollWidth <= data.body.clientWidth + 1, label + ': body horizontal overflow');
  return data;
}

async function capture(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function enterVehicleFlow(page) {
  await page.waitForSelector('.sv-brand-card', { timeout: 10000 });
  const hyundai = page.locator('.sv-brand-card').filter({ hasText: '현대' });
  if (await hyundai.count()) await hyundai.first().click();
  else await page.locator('.sv-brand-card').first().click();

  await waitTitle(page, '어떤 모델');
  const santa = page.locator('.sv-row').filter({ hasText: '싼타페' });
  if (await santa.count()) await santa.first().click();
  else await page.locator('.sv-row').first().click();

  await waitTitle(page, '파워트레인');
  await page.locator('.sv-row').first().click();

  if ((await page.locator('.sv-title').first().textContent() || '').includes('인승·구동')) {
    await page.locator('.sv-row').first().click();
  }

  await page.waitForSelector('.sv-trim-card', { timeout: 10000 });
  await page.locator('.sv-trim-card').first().click();

  await page.waitForFunction(() => {
    const text = document.querySelector('.sv-title')?.textContent || '';
    return text.includes('색상') || text.includes('옵션');
  }, null, { timeout: 10000 });
}

async function advanceMobileToResult(page) {
  await enterVehicleFlow(page);

  let title = await page.locator('.sv-title').first().textContent();
  if ((title || '').includes('색상')) {
    if (await page.locator('.sv-color-card:not(:disabled)').count()) {
      await page.locator('.sv-color-card:not(:disabled)').first().click();
    }
    await page.locator('.m-footer .m-btn--primary:visible').click();
    await waitTitle(page, '옵션');
  }

  if (await page.locator('.sv-opt:not(.is-disabled)').count()) {
    await page.locator('.sv-opt:not(.is-disabled)').first().click();
  }

  await page.locator('.m-footer .m-btn--primary:visible').click();
  await page.waitForSelector('.sc-title');

  await page.locator('.m-footer .m-btn--primary:visible').click();
  await page.waitForSelector('.se-title');

  await page.locator('.m-footer .m-btn--primary:visible').click();
  await page.waitForSelector('.sr-title');
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [360, 390, 412]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'ko-KR' });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(`${BASE}/mobile.html?force=mobile`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sv-brand-card');
    const initial = await metrics(page, `mobile-${width}-brand`);
    await capture(page, `mobile-${width}-01-brand`);

    await enterVehicleFlow(page);
    const configure = await metrics(page, `mobile-${width}-configure`);
    await capture(page, `mobile-${width}-02-configure`);

    // Continue from current color/options screen to conditions/extras/result.
    let current = await page.locator('.sv-title').first().textContent();
    if ((current || '').includes('색상')) {
      if (await page.locator('.sv-color-card:not(:disabled)').count()) {
        await page.locator('.sv-color-card:not(:disabled)').first().click();
      }
      await page.locator('.m-footer .m-btn--primary:visible').click();
      await waitTitle(page, '옵션');
    }
    if (await page.locator('.sv-opt:not(.is-disabled)').count()) {
      await page.locator('.sv-opt:not(.is-disabled)').first().click();
    }

    await page.locator('.m-footer .m-btn--primary:visible').click();
    await page.waitForSelector('.sc-title');
    const conditions = await metrics(page, `mobile-${width}-conditions`);
    const selectedCondition = await page.evaluate(() => {
      const el = document.querySelector('.sc-chip.is-selected');
      if (!el) return null;
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color, fontWeight: s.fontWeight };
    });
    const stickyA11y = await page.evaluate(() => {
      const summary = document.querySelector('.sq-summary');
      const check = document.querySelector('.sq-term-card__check-btn');
      const rect = (el) => el ? ({ width: el.offsetWidth, height: el.offsetHeight }) : null;
      return {
        summaryTabIndex: summary?.tabIndex ?? null,
        summary: rect(summary),
        check: rect(check),
      };
    });
    await capture(page, `mobile-${width}-03-conditions`);

    let stickyExpanded = null;
    if (await page.locator('.sq-summary').count()) {
      await page.locator('.sq-summary').click();
      await page.waitForSelector('.sq-detail');
      stickyExpanded = await page.evaluate(() => {
        const detail = document.querySelector('.sq-detail');
        const cell = document.querySelector('.sq-table tbody td');
        const head = document.querySelector('.sq-table thead th');
        const style = (el) => el ? getComputedStyle(el) : null;
        return {
          detailBorderTop: style(detail)?.borderTopWidth || null,
          cellBorderBottom: style(cell)?.borderBottomWidth || null,
          headBorderBottom: style(head)?.borderBottomWidth || null,
          headFontSize: style(head)?.fontSize || null,
        };
      });
      await capture(page, `mobile-${width}-03b-livequote-expanded`);
      await page.locator('.sq-summary').click();
    }

    await page.locator('.m-footer .m-btn--primary:visible').click();
    await page.waitForSelector('.se-title');
    const extras = await metrics(page, `mobile-${width}-extras`);
    const selectedExtra = await page.evaluate(() => {
      const el = document.querySelector('.se-chip.is-selected');
      if (!el) return null;
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color, fontWeight: s.fontWeight };
    });
    await capture(page, `mobile-${width}-04-extras`);

    await page.locator('.m-footer .m-btn--primary:visible').click();
    await page.waitForSelector('.sr-title');
    await page.waitForTimeout(250);
    const result = await metrics(page, `mobile-${width}-result`);
    const resultSurface = await page.evaluate(() => {
      const el = document.querySelector('.sr-term');
      if (!el) return null;
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color, boxShadow: s.boxShadow };
    });
    await capture(page, `mobile-${width}-05-result`);

    report.mobile.push({
      width,
      initial,
      configure,
      conditions,
      extras,
      result,
      resultSurface,
      selectedCondition,
      selectedExtra,
      stickyA11y,
      stickyExpanded,
      consoleErrors: consoleErrors.filter((x) => !x.includes('Failed to load resource')),
    });

    await context.close();
  }

  // Single responsive shell boundary: <=1024 mobile, >=1025 desktop.
  for (const width of [834, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR' });
    const page = await context.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/mobile\.html/, { timeout: 10000 });
    const path = new URL(page.url()).pathname;
    ok(path.endsWith('/mobile.html'), `responsive-${width}: index did not converge to mobile shell: ${path}`);
    report.responsive.push({ width, path });
    await context.close();
  }

    {
    const width = 1025;
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR' });
    const page = await context.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.global-topbar');
    const path = new URL(page.url()).pathname;
    ok(path.endsWith('/index.html'), `responsive-${width}: desktop shell unexpectedly redirected: ${path}`);
    report.responsive.push({ width, path });
    await context.close();
  }

    for (const width of [1280, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR' });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.global-topbar');
    // Static shell appears before the vehicle builder is hydrated. A screenshot of
    // that intermediate state is not a valid visual receipt.
    await page.waitForFunction(() => {
      const nodes = document.querySelectorAll('.wrap .card, .wrap .step-dd, .wrap .cdd__btn');
      return [...nodes].some((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
      });
    }, null, { timeout: 10000 });
    const data = await page.evaluate(() => {
      const root = document.documentElement;
      const firstVisible = (selector) => [...document.querySelectorAll(selector)].find((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
      }) || null;
      const action = firstVisible('.bottom-action');
      const select = firstVisible('.cdd__btn, .step-dd');
      const card = firstVisible('.card, .trim-row, .color-card');
      const vehicleLabel = firstVisible('.wrap .step-title, .wrap .step-title-text');
      const vehiclePanel = firstVisible('.wrap');
      const rect = (el) => el ? el.getBoundingClientRect() : null;
      const css = (el) => el ? getComputedStyle(el) : null;
      return {
        overflow: {
          html: [root.scrollWidth, root.clientWidth],
          body: [document.body.scrollWidth, document.body.clientWidth],
        },
        shell: {
          columns: getComputedStyle(document.body).gridTemplateColumns,
          hiddenContractDisplay: getComputedStyle(document.getElementById('contract-panel-root')).display,
        },
        action: action ? { height: rect(action).height, fontSize: css(action).fontSize, radius: css(action).borderRadius } : null,
        select: select ? { height: rect(select).height, fontSize: css(select).fontSize, radius: css(select).borderRadius } : null,
        card: card ? { radius: css(card).borderRadius, padding: css(card).padding } : null,
        vehicleLabel: vehicleLabel ? {
          fontSize: css(vehicleLabel).fontSize,
          fontWeight: css(vehicleLabel).fontWeight,
          color: css(vehicleLabel).color,
        } : null,
        vehiclePanel: vehiclePanel ? {
          radius: css(vehiclePanel).borderRadius,
          background: css(vehiclePanel).backgroundColor,
          boxShadow: css(vehiclePanel).boxShadow,
        } : null,
        topbarActions: document.querySelectorAll('.global-topbar button, .global-topbar a[href]').length,
        topbarBrand: {
          src: document.querySelector('.global-topbar__brand img')?.getAttribute('src') || '',
          alt: document.querySelector('.global-topbar__brand img')?.getAttribute('alt') || '',
        },
        title: document.title,
      };
    });
    ok(data.overflow.html[0] <= data.overflow.html[1] + 1, `desktop-${width}: html horizontal overflow`);
    ok(data.overflow.body[0] <= data.overflow.body[1] + 1, `desktop-${width}: body horizontal overflow`);
    const shellCols = data.shell.columns.split(/\s+/).map(Number).filter(Number.isFinite);
    ok(shellCols.length === 2, `desktop-${width}: expected two grid columns, got ${data.shell.columns}`);
    const shellRatio = shellCols[0] / shellCols[1];
    ok(shellRatio > 0.37 && shellRatio < 0.41,
      `desktop-${width}: 28:72 shell ratio drift ${shellRatio.toFixed(3)} from ${data.shell.columns}`);
    ok(data.shell.hiddenContractDisplay === 'none',
      `desktop-${width}: hidden contract/chat surface reappeared`);
    ok(data.title.startsWith('프리패스모빌리티'), `desktop-${width}: stale browser title ${data.title}`);
    await capture(page, `desktop-${width}-01-initial`);
    report.desktop.push({ width, ...data, consoleErrors: consoleErrors.filter((x) => !x.includes('Failed to load resource')) });
    await context.close();
  }

  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

  // These are the current Admin-derived UI contracts; fail the visual job if
  // the rendered CSS silently drifts from them.
  for (const entry of report.mobile) {
    ok(entry.initial.tokens.title === '20px', `mobile-${entry.width}: title token drift ${entry.initial.tokens.title}`);
    ok(entry.initial.tokens.body === '14px', `mobile-${entry.width}: body token drift ${entry.initial.tokens.body}`);
    ok(entry.initial.tokens.support === '12px', `mobile-${entry.width}: support token drift ${entry.initial.tokens.support}`);
    ok(entry.initial.tokens.input === '44px', `mobile-${entry.width}: input token drift`);
    ok(entry.initial.tokens.cta === '44px', `mobile-${entry.width}: CTA token drift`);
    ok(entry.initial.tokens.chip === '44px', `mobile-${entry.width}: chip token drift`);
    ok(entry.initial.tokens.radius === '6px', `mobile-${entry.width}: card radius token drift`);
    ok(entry.initial.smallTargets.length === 0,
      `mobile-${entry.width}: sub-44px visible target(s): ${JSON.stringify(entry.initial.smallTargets)}`);
    ok(entry.conditions.smallTargets.length === 0,
      `mobile-${entry.width}: condition sub-44px target(s): ${JSON.stringify(entry.conditions.smallTargets)}`);
    ok(entry.extras.smallTargets.length === 0,
      `mobile-${entry.width}: extras sub-44px target(s): ${JSON.stringify(entry.extras.smallTargets)}`);
    if (entry.selectedCondition) {
      ok(entry.selectedCondition.background === 'rgb(27, 42, 74)',
        `mobile-${entry.width}: selected condition control is not solid FreePass primary: ${entry.selectedCondition.background}`);
      ok(entry.selectedCondition.color === 'rgb(255, 255, 255)',
        `mobile-${entry.width}: selected condition control text contrast drift: ${entry.selectedCondition.color}`);
    }
    if (entry.selectedExtra) {
      ok(entry.selectedExtra.background === 'rgb(27, 42, 74)',
        `mobile-${entry.width}: selected extra control is not solid FreePass primary: ${entry.selectedExtra.background}`);
      ok(entry.selectedExtra.color === 'rgb(255, 255, 255)',
        `mobile-${entry.width}: selected extra control text contrast drift: ${entry.selectedExtra.color}`);
    }
    if (entry.resultSurface) {
      ok(entry.resultSurface.background === 'rgb(247, 249, 252)',
        `mobile-${entry.width}: result cards must stay neutral, got ${entry.resultSurface.background}`);
    }
    ok(entry.stickyA11y.summaryTabIndex === 0, `mobile-${entry.width}: live quote summary is not keyboard-focusable`);
    if (entry.stickyA11y.summary) ok(entry.stickyA11y.summary.height >= 44, `mobile-${entry.width}: live quote summary <44px`);
    if (entry.stickyA11y.check) {
      ok(entry.stickyA11y.check.width >= 44 && entry.stickyA11y.check.height >= 44,
        `mobile-${entry.width}: term send toggle <44px`);
    }
    if (entry.stickyExpanded) {
      ok(entry.stickyExpanded.detailBorderTop === '0px',
        `mobile-${entry.width}: expanded quote detail divider reappeared`);
      ok(entry.stickyExpanded.cellBorderBottom === '0px',
        `mobile-${entry.width}: expanded quote row lines reappeared`);
      ok(entry.stickyExpanded.headBorderBottom === '0px',
        `mobile-${entry.width}: expanded quote header line reappeared`);
      ok(entry.stickyExpanded.headFontSize === '12px',
        `mobile-${entry.width}: expanded quote header support scale drift ${entry.stickyExpanded.headFontSize}`);
    }
  }

  for (const entry of report.desktop) {
    if (entry.action) {
      ok(Math.round(entry.action.height) === 36, `desktop-${entry.width}: bottom action height drift ${entry.action.height}`);
      ok(entry.action.fontSize === '14px', `desktop-${entry.width}: bottom action font drift ${entry.action.fontSize}`);
      ok(entry.action.radius === '6px', `desktop-${entry.width}: bottom action radius drift ${entry.action.radius}`);
    }
    if (entry.select) {
      ok(Math.round(entry.select.height) === 36, `desktop-${entry.width}: select height drift ${entry.select.height}`);
      ok(entry.select.fontSize === '14px', `desktop-${entry.width}: select font drift ${entry.select.fontSize}`);
      ok(entry.select.radius === '6px', `desktop-${entry.width}: select radius drift ${entry.select.radius}`);
    }
    if (entry.vehicleLabel) {
      ok(entry.vehicleLabel.fontSize === '12px',
        `desktop-${entry.width}: vehicle step label must use support scale, got ${entry.vehicleLabel.fontSize}`);
    }
    if (entry.vehiclePanel) {
      ok(entry.vehiclePanel.radius === '8px',
        `desktop-${entry.width}: vehicle panel radius drift ${entry.vehiclePanel.radius}`);
      ok(entry.vehiclePanel.background === 'rgb(255, 255, 255)',
        `desktop-${entry.width}: vehicle panel surface drift ${entry.vehiclePanel.background}`);
    }
    ok(entry.topbarActions === 0, `desktop-${entry.width}: topbar action reappeared`);
    ok(entry.topbarBrand.src === '/freepass-wordmark.svg' && entry.topbarBrand.alt === '프리패스모빌리티',
      `desktop-${entry.width}: stale visible brand ${JSON.stringify(entry.topbarBrand)}`);
    ok(!entry.consoleErrors.some((x) => x.includes('[email protected]') || x.includes('strict MIME checking')),
      `desktop-${entry.width}: font stylesheet failed`);
  }

  console.log(JSON.stringify({ ok: true, out: OUT, mobile: report.mobile.map(x => x.width), desktop: report.desktop.map(x => x.width) }, null, 2));
} finally {
  await browser.close();
}
