// Verify on the LIVE URL (iPhone): after a wave spawns, the hero can advance.
const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  await page.goto('https://gl35.github.io/game-waterMargin3D/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.tap('text=Insert Coin'); await page.waitForTimeout(400);
  await page.tap('text=Fight!');      await page.waitForTimeout(400);
  await page.tap('text=March Out');   await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.__KN; g.hero.x = 585; g.camX = Math.max(0, 585 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  const w = await page.evaluate(() => ({ lockX: window.__KN.waveLockX, atX: window.__KN.stage.waves[0].atX, x: window.__KN.hero.x }));
  await page.keyboard.down('KeyD'); await page.waitForTimeout(2500); await page.keyboard.up('KeyD');
  const endX = await page.evaluate(() => window.__KN.hero.x);
  await page.screenshot({ path: 'live-move.png' });
  await browser.close();
  const arena = w.lockX - w.atX, adv = endX - w.x;
  console.log(`arena=${arena|0} advanced=${adv|0} (${w.x|0} -> ${endX|0})`);
  console.log(arena >= 560 && adv > 350 ? 'LIVE MOVE OK' : 'LIVE MOVE FAILED');
  process.exit(arena >= 560 && adv > 350 ? 0 : 1);
})();
