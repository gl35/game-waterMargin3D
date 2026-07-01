// Verify the PUBLIC deploy actually runs: boot → select → story → stage.
const { chromium } = require('playwright');
const URL = 'https://gl35.github.io/game-waterMargin3D/';
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`404? ${r.url()} ${r.failure()?.errorText}`));

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);
  await page.click('text=Fight!');
  await page.waitForTimeout(500);
  await page.click('text=March Out');
  await page.waitForTimeout(1200);
  const ok = await page.evaluate(() => !!window.__KN);
  await page.screenshot({ path: 'live-check.png' });
  await browser.close();

  console.log(ok ? 'PASS: game boots and runs on the live URL' : 'FAIL: game did not start');
  const real = errors.filter(e => !/favicon/i.test(e));
  console.log(`errors/404s (${real.length}):`);
  real.slice(0, 10).forEach(e => console.log('  ' + e));
  process.exit(ok && real.length === 0 ? 0 : 1);
})();
