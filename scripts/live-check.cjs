// Verify the live deploy renders the real sprite art (not fallback boxes) and
// they're clean (no checker) — desktop combat + mobile.
const { chromium, devices } = require('playwright');
const URL = 'https://gl35.github.io/game-waterMargin3D/';

async function bootToCombat(page, isMobile) {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);                 // let the 7.5MB sprites load + process
  const tap = (sel) => isMobile ? page.tap(sel) : page.click(sel);
  await tap('text=Insert Coin'); await page.waitForTimeout(400);
  await tap('text=Fight!');      await page.waitForTimeout(400);
  await tap('text=March Out');   await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.__KN; g.waveIdx = 0; g.hero.x = 595; g.hero.z = 100;
    g.camX = Math.max(0, 595 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(230); await page.keyboard.up('KeyD');
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.filter(e => !e.dead).forEach((e, i) => { e.x = g.hero.x + 100 + i * 80; e.z = g.hero.z + (i % 2 ? 30 : -30); });
    g.hero.invuln = 99;
  });
  await page.waitForTimeout(400);
}

(async () => {
  const s404 = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('response', r => { if (/\/sprites\//.test(r.url()) && r.status() >= 400) s404.push(r.url()); });
  await bootToCombat(page, false);
  await page.screenshot({ path: 'live-check.png' });
  await browser.close();

  const b2 = await chromium.launch();
  const mp = await (await b2.newContext({ ...devices['iPhone 13'] })).newPage();
  await bootToCombat(mp, true);
  await mp.screenshot({ path: 'live-mobile.png' });
  await b2.close();

  console.log('sprite 404s:', s404.length);
  s404.slice(0, 5).forEach(u => console.log('  ' + u));
  console.log('wrote live-check.png (desktop) + live-mobile.png (iPhone)');
})();
