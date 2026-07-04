// iPhone: after a wave spawns, the hero must still be able to advance forward
// (the bug pinned it near screen-center because the arena was screen-relative).
const { chromium, devices } = require('playwright');
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); process.exitCode = 1; };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.tap('text=Insert Coin'); await page.waitForTimeout(400);
  await page.tap('text=Fight!');      await page.waitForTimeout(400);
  await page.tap('text=March Out');   await page.waitForTimeout(1000);

  // Walk up to wave 0's trigger (atX = 600) and cross it.
  await page.evaluate(() => {
    const g = window.__KN; g.hero.x = 585; g.hero.z = 100;
    g.camX = Math.max(0, 585 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);

  const wave = await page.evaluate(() => {
    const g = window.__KN;
    return { active: g.waveActive, lockX: g.waveLockX, atX: g.stage.waves[0].atX, x: g.hero.x, iw: window.innerWidth };
  });
  if (wave.active) ok(`wave active on iPhone (iw=${wave.iw}, lockX=${wave.lockX | 0}, atX=${wave.atX})`);
  else bad('wave did not activate');
  const arena = wave.lockX - wave.atX;
  if (arena >= 560) ok(`arena width is ${arena | 0} world units (screen-independent)`);
  else bad(`arena too small: ${arena | 0} units (the bug)`);

  // Now hold right and see how far the hero can advance.
  const startX = wave.x;
  await page.keyboard.down('KeyD'); await page.waitForTimeout(2500); await page.keyboard.up('KeyD');
  const endX = await page.evaluate(() => window.__KN.hero.x);
  const advanced = endX - startX;
  await page.screenshot({ path: 'mobile-move.png' });
  if (advanced > 350) ok(`hero advanced ${advanced | 0} units past the wave line (${startX | 0} → ${endX | 0})`);
  else bad(`hero pinned: only advanced ${advanced | 0} units (${startX | 0} → ${endX | 0})`);

  await browser.close();
  console.log(process.exitCode ? '\nFAILED' : '\nALL CHECKS PASSED');
})();
