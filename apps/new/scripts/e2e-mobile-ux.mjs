import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173/mobile.html?force=mobile';
const out = process.env.ARTIFACT_DIR || 'artifacts/mobile-ux';
fs.mkdirSync(out, { recursive: true });

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function noHorizontalOverflow(page, label) {
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    bodySw: document.body.scrollWidth,
  }));
  ok(r.sw <= r.cw + 1 && r.bodySw <= r.cw + 1,
    `${label}: 가로 overflow (html ${r.sw}/${r.cw}, body ${r.bodySw})`);
}
async function clickFirst(locator, label) {
  ok(await locator.count() > 0, label + ': 항목 없음');
  await locator.first().click();
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ko-KR',
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:5173' });
  await context.addInitScript(() => {
    try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch {}
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('requestfailed', (r) => requestFailures.push({ url: r.url(), error: r.failure()?.errorText || '' }));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sv-brand-card');
  await noHorizontalOverflow(page, '제조사');

  // UI hierarchy / action placement / prepared navigation
  const ui = await page.evaluate(() => {
    const css = (sel) => getComputedStyle(document.querySelector(sel));
    const root = getComputedStyle(document.documentElement);
    return {
      title: css('.sv-title').fontSize,
      titleWeight: css('.sv-title').fontWeight,
      ctaToken: root.getPropertyValue('--h-cta').trim(),
      headerActionCount: document.querySelectorAll('.m-header button, .m-header a[href]').length,
      preparedNextCount: document.querySelectorAll('.m-footer .m-btn--primary').length,
    };
  });
  ok(ui.title === '22px', '페이지 타이틀 규격이 22px 아님: ' + ui.title);
  ok(+ui.titleWeight >= 700, '페이지 타이틀 굵기 부족');
  ok(ui.ctaToken === '48px', '하단 CTA 토큰이 48px 아님: ' + ui.ctaToken);
  ok(ui.headerActionCount === 0, '상단 헤더에 업무 CTA가 남아 있음: ' + ui.headerActionCount);
  ok(ui.preparedNextCount >= 1, '자동전진 단계에서도 Next 인프라가 준비되어 있어야 함');

  // 제조사 → 모델 → 파워트레인 → (있으면 인승/구동) → 트림
  await page.locator('.sv-brand-card').filter({ hasText: '현대' }).click();
  await page.waitForFunction(() => document.querySelector('.sv-title')?.textContent?.includes('어떤 모델'));
  const santa = page.locator('.sv-row').filter({ hasText: '싼타페' });
  if (await santa.count()) await santa.first().click();
  else await clickFirst(page.locator('.sv-row'), '모델');

  await page.waitForFunction(() => document.querySelector('.sv-title')?.textContent?.includes('파워트레인'));
  await clickFirst(page.locator('.sv-row'), '파워트레인');

  if (await page.locator('.sv-title').filter({ hasText: '인승·구동방식' }).count()) {
    await clickFirst(page.locator('.sv-row'), '인승·구동');
  }
  await page.waitForSelector('.sv-trim-card');
  await clickFirst(page.locator('.sv-trim-card'), '트림');

  // 단일선택 트림은 즉시 다음 구성 단계로 이동한다.
  // 색상이 있으면 색상, 없으면 옵션으로 이동하며 계산 완료 전 공유 CTA는 노출하지 않는다.
  await page.waitForFunction(() => {
    const t = document.querySelector('.sv-title')?.textContent || '';
    return t.includes('색상') || t.includes('옵션');
  });
  const shareDuringCalc = await page.locator('.m-footer button').filter({ hasText: '공유' }).count();
  ok(shareDuringCalc === 0, '계산 완료 전 공유 CTA가 노출됨');

  const afterTrimTitle = await page.locator('.sv-title').first().textContent();
  if ((afterTrimTitle || '').includes('색상')) {
    if (await page.locator('.sv-color-card').count()) await page.locator('.sv-color-card').first().click();
    await noHorizontalOverflow(page, '색상');
    await page.locator('.m-footer .m-btn--primary:visible').click();
    await page.waitForFunction(() => document.querySelector('.sv-title')?.textContent?.includes('옵션'));
  }
  if (await page.locator('.sv-opt:not(.is-disabled)').count()) {
    await page.locator('.sv-opt:not(.is-disabled)').first().click();
  }

  // 옵션 화면 실제 스크롤 + 하단 고정 영역이 콘텐츠를 가리지 않는지
  const beforeScroll = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    ch: document.documentElement.clientHeight,
  }));
  ok(beforeScroll.sh > beforeScroll.ch, '옵션 화면이 긴데도 문서 스크롤 높이가 생기지 않음');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const scrollCheck = await page.evaluate(() => {
    const sticky = document.querySelector('.sq')?.getBoundingClientRect();
    const last = document.querySelector('.sv-total')?.getBoundingClientRect();
    return { y: window.scrollY, stickyTop: sticky?.top ?? 9999, lastBottom: last?.bottom ?? 0 };
  });
  ok(scrollCheck.y > 0, '본문 스크롤이 실제로 움직이지 않음');
  ok(scrollCheck.lastBottom <= scrollCheck.stickyTop + 2,
    `하단 견적판이 마지막 콘텐츠를 가림: last=${scrollCheck.lastBottom}, sticky=${scrollCheck.stickyTop}`);
  await noHorizontalOverflow(page, '옵션');

  // 조건
  await page.locator('.m-footer .m-btn--primary').click();
  await page.waitForFunction(() => document.querySelector('.sc-title')?.textContent?.includes('계약 조건'));
  const km3 = page.locator('.sc-chip').filter({ hasText: '3만km/년' });
  if (await km3.count()) await km3.click();

  // 기간을 하나 빼도 이후 화면/재진입에서 되살아나면 안 된다.
  const term48 = page.locator('.sc-chip').filter({ hasText: '48개월' });
  if (await term48.count()) await term48.click();
  ok(await page.locator('.sc-field').first().locator('.sc-chip.is-selected').count() === 4,
    '5개 기간 중 1개 해제 후 선택 수가 4가 아님');

  // 용품/서비스
  await page.locator('.m-footer .m-btn--primary').click();
  await page.waitForFunction(() => document.querySelector('.se-title')?.textContent?.includes('옵션·서비스'));
  const selfCare = page.locator('.se-card').filter({ hasText: '웰스 Self' });
  if (await selfCare.count()) await selfCare.click();
  const liability = page.locator('.se-chip').filter({ hasText: '5억' });
  if (await liability.count()) await liability.click();
  const driver = page.locator('.se-chip').filter({ hasText: '1명' });
  if (await driver.count()) await driver.click();

  // 견적 결과
  await page.locator('.m-footer .m-btn--primary').click();
  await page.waitForSelector('.sr-title');
  await page.waitForFunction(() => document.querySelectorAll('.sr-term__monthly b').length > 0, null, { timeout: 20000 });
  const monthly = await page.locator('.sr-term__monthly b').allTextContents();
  ok(monthly.length === 4 && monthly.every(Boolean), '선택한 4개 기간만 결과에 나와야 함: ' + JSON.stringify(monthly));

  // 최종 결과를 끝까지 스크롤했을 때 조건/안내문이 고정 footer 뒤에 가리지 않아야 한다.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  const resultBottom = await page.evaluate(() => {
    const note = document.querySelector('.sr-note')?.getBoundingClientRect();
    const footer = document.querySelector('.m-footer')?.getBoundingClientRect();
    return { noteBottom: note?.bottom ?? 0, footerTop: footer?.top ?? innerHeight };
  });
  ok(resultBottom.noteBottom <= resultBottom.footerTop + 2,
    `최종 견적 하단 안내가 footer에 가림: note=${resultBottom.noteBottom}, footer=${resultBottom.footerTop}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('.m-footer button')];
    const b = buttons.find((x) => (x.textContent || '').includes('공유'));
    return b && !b.disabled;
  }, null, { timeout: 5000 });
  const shareButton = page.locator('.m-footer button').filter({ hasText: '공유' }).first();
  ok(await shareButton.isEnabled(), '계산 완료 후 하단 공유 버튼이 활성화되지 않음');
  await noHorizontalOverflow(page, '견적결과');
  await page.screenshot({ path: `${out}/01-result-390.png`, fullPage: true });

  // 공유 URL 생성 — 업무 액션은 하단에서 실행
  await shareButton.click();
  await page.waitForTimeout(200);
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  ok(sharedUrl.includes('qs='), '공유 URL에 Snapshot(qs) 없음');
  ok(sharedUrl.includes('force=mobile'), '공유 URL에 force=mobile 없음');
  ok(!sharedUrl.includes('staff='), '공유 URL에 staff 권한 누출');
  ok(sharedUrl.length < 4000, '공유 URL이 지나치게 김: ' + sharedUrl.length);

  // 받은 사람이 열었을 때 API 재계산 없이 같은 금액
  const page2 = await context.newPage();
  let estimateCalls = 0;
  const isQuoteApi = (url) => /\/api\/(?:estimate|standard-quote|external-quote)(?:[/?]|$)/.test(url);
  page2.on('request', (r) => { if (isQuoteApi(r.url())) estimateCalls++; });
  await page2.goto(sharedUrl, { waitUntil: 'networkidle' });
  await page2.waitForSelector('.sr-snapshot');
  await page2.waitForTimeout(500);
  const received = await page2.locator('.sr-term__monthly b').allTextContents();
  ok(JSON.stringify(received) === JSON.stringify(monthly),
    '공유받은 견적 금액이 원본과 다름: ' + JSON.stringify({ monthly, received }));
  ok(estimateCalls === 0, '공유받은 Snapshot을 열자마자 재계산 API 호출함: ' + estimateCalls);
  ok(await page2.locator('.sr-term').count() === 4, '공유 견적에서 선택하지 않은 기간이 되살아남');
  await noHorizontalOverflow(page2, '공유견적');

  await page2.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page2.waitForTimeout(100);
  const sharedBottom = await page2.evaluate(() => {
    const note = document.querySelector('.sr-note')?.getBoundingClientRect();
    const footer = document.querySelector('.m-footer')?.getBoundingClientRect();
    return { noteBottom: note?.bottom ?? 0, footerTop: footer?.top ?? innerHeight };
  });
  ok(sharedBottom.noteBottom <= sharedBottom.footerTop + 2,
    `공유 견적 하단 안내가 footer에 가림: note=${sharedBottom.noteBottom}, footer=${sharedBottom.footerTop}`);
  await page2.evaluate(() => window.scrollTo(0, 0));
  await page2.waitForTimeout(100);
  await page2.screenshot({ path: `${out}/02-shared-snapshot.png`, fullPage: true });

  // 공유받은 것을 다시 공유해도 Snapshot 유지 — 공유 CTA도 하단
  await page2.locator('.m-footer button').filter({ hasText: '공유' }).first().click();
  await page2.waitForTimeout(150);
  const reShared = await page2.evaluate(() => navigator.clipboard.readText());
  ok(reShared.includes('qs='), '재공유 시 Snapshot 유실');

  // 조건 변경을 누른 뒤에만 새 계산
  await page2.locator('.m-footer .m-btn--soft').filter({ hasText: '조건 변경' }).click();
  await page2.waitForFunction(() => document.querySelector('.sv-title')?.textContent?.includes('옵션'));
  await page2.waitForFunction(() => performance.getEntriesByType('resource').some((x) =>
    /\/api\/(?:estimate|standard-quote|external-quote)(?:[/?]|$)/.test(x.name)
  ), null, { timeout: 10000 });
  ok(estimateCalls >= 1, '조건 변경 후 새 견적 API가 호출되지 않음');

  // 320px 폭 — 헤더/카드/가로 overflow 확인
  const narrow = await context.newPage();
  await narrow.setViewportSize({ width: 320, height: 740 });
  await narrow.goto(BASE, { waitUntil: 'networkidle' });
  await narrow.waitForSelector('.sv-brand-card');
  await noHorizontalOverflow(narrow, '320px 제조사');
  const headerFits = await narrow.evaluate(() => {
    const h = document.querySelector('.m-header');
    return h.scrollWidth <= h.clientWidth + 1;
  });
  ok(headerFits, '320px에서 헤더 액션이 넘침');
  await narrow.screenshot({ path: `${out}/03-brand-320.png`, fullPage: true });

  // PC 담당자 견적기 초기 상태 — 빈 화면처럼 보이지 않고 선택 안내가 있어야 한다.
  const desktop = await context.newPage();
  await desktop.setViewportSize({ width: 1440, height: 1000 });
  await desktop.goto('http://127.0.0.1:5173/index.html', { waitUntil: 'networkidle' });
  await desktop.waitForSelector('.qp-empty-guide');
  ok(await desktop.locator('.qp-empty-guide').isVisible(), 'PC 초기 상태 안내가 보이지 않음');
  await desktop.screenshot({ path: `${out}/04-desktop-index-1440.png`, fullPage: true });

  // 고객 링크를 PC에서 열었을 때도 단일 열 컨셉은 유지하되 540px 읽기 폭을 사용한다.
  const wideMobile = await context.newPage();
  await wideMobile.setViewportSize({ width: 1440, height: 1000 });
  await wideMobile.goto(BASE, { waitUntil: 'networkidle' });
  await wideMobile.waitForSelector('.sv-brand-card');
  const wideWidth = await wideMobile.locator('#m-app').evaluate((el) => el.getBoundingClientRect().width);
  ok(wideWidth >= 530 && wideWidth <= 542, 'PC 고객용 견적 폭이 540px 규격이 아님: ' + wideWidth);
  await wideMobile.screenshot({ path: `${out}/05-mobile-web-wide-1440.png`, fullPage: true });

  /* 외부 CDN이 headless Chromium의 CORP 정책으로 막히는 것은 앱 로직 오류가 아니다.
     대신 localhost의 앱 JS/CSS/API가 실패하면 반드시 실패시킨다. */
  const coreFailures = requestFailures.filter((x) => x.url.startsWith('http://127.0.0.1:5173/'));
  const realConsoleErrors = consoleErrors.filter((x) => !x.includes('ERR_BLOCKED_BY_RESPONSE.NotSameOrigin'));
  ok(coreFailures.length === 0, '앱 핵심 리소스 실패: ' + JSON.stringify(coreFailures));
  ok(realConsoleErrors.length === 0, '브라우저 콘솔 오류: ' + realConsoleErrors.join(' | '));
  console.log(JSON.stringify({
    ok: true,
    monthly,
    sharedUrlLength: sharedUrl.length,
    estimateCallsAfterEdit: estimateCalls,
    scrollY: scrollCheck.y,
    ui,
    externalResourceWarnings: requestFailures.filter((x) => !x.url.startsWith('http://127.0.0.1:5173/')),
  }, null, 2));
} finally {
  await browser.close();
}
