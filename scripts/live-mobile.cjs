// Verify touch controls work on the LIVE public URL under iPhone emulation.
const { chromium, devices } = require('playwright');
const URL = 'https://gl35.github.io/game-waterMargin3D/';
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1600);
  await page.tap('text=Insert Coin'); await page.waitForTimeout(400);
  await page.tap('text=Fight!');      await page.waitForTimeout(400);
  await page.tap('text=March Out');   await page.waitForTimeout(1100);

  const controls = await page.evaluate(() => !!document.querySelector('.kn-joy') && document.querySelectorAll('.kn-tbtn').length === 4);
  const x0 = await page.evaluate(() => window.__KN.hero.x);
  await page.evaluate(() => {
    const j = document.querySelector('.kn-joy'); const r = j.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    j.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: cx, clientY: cy, bubbles: true }));
    j.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: cx + 60, clientY: cy, bubbles: true }));
  });
  await page.waitForTimeout(700);
  const x1 = await page.evaluate(() => window.__KN.hero.x);
  await page.screenshot({ path: 'live-mobile.png' });
  await browser.close();

  const moved = x1 - x0 > 20;
  console.log(`controls rendered: ${controls}`);
  console.log(`joystick moved hero: ${moved} (${x0.toFixed(0)} -> ${x1.toFixed(0)})`);
  console.log(`errors: ${errors.length}`);
  errors.slice(0, 5).forEach(e => console.log('  ' + e));
  console.log(controls && moved && errors.length === 0 ? '\nLIVE MOBILE OK' : '\nLIVE MOBILE FAILED');
  process.exit(controls && moved && !errors.length ? 0 : 1);
})();
