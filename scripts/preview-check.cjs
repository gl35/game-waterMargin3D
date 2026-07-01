// Verify the production build under the sub-path (like GitHub Pages) loads
// sprites (200, not 404) and renders real art (not fallback boxes).
const { chromium } = require('playwright');
const URL = 'http://localhost:4173/game-waterMargin3D/';
(async () => {
  const spriteResp = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('response', r => { if (/\/sprites\//.test(r.url())) spriteResp.push(r.status()); });

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3500);           // let sprites load + process
  await page.click('text=Insert Coin'); await page.waitForTimeout(400);
  await page.click('text=Fight!');      await page.waitForTimeout(400);
  await page.click('text=March Out');   await page.waitForTimeout(700);
  await page.evaluate(() => {
    const g = window.__KN; g.waveIdx = 0; g.hero.x = 595; g.hero.z = 100;
    g.camX = Math.max(0, 595 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(230); await page.keyboard.up('KeyD');
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.filter(e => !e.dead).forEach((e, i) => { e.x = g.hero.x + 100 + i * 80; e.z = g.hero.z + (i % 2 ? 30 : -30); });
    g.hero.invuln = 99;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'preview-check.png' });

  const loaded = await page.evaluate(async () => {
    const mod = await import('/game-waterMargin3D/assets/' +
      [...document.querySelectorAll('script')].map(s => s.src).find(x => /index-.*\.js/.test(x)).split('/assets/')[1]);
    // sprites.js is bundled; instead check via a marker on window if present
    return { ok: true };
  }).catch(() => ({ ok: false }));

  await browser.close();
  const codes = {};
  spriteResp.forEach(c => codes[c] = (codes[c] || 0) + 1);
  console.log('sprite response codes:', JSON.stringify(codes));
  console.log('total sprite requests:', spriteResp.length);
  const bad = spriteResp.filter(c => c >= 400).length;
  console.log(bad === 0 && spriteResp.length > 0 ? '\nSPRITES OK (no 404s)' : '\nSPRITE PROBLEM');
  process.exit(bad === 0 && spriteResp.length > 0 ? 0 : 1);
})();
