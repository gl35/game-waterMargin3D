// Screenshot the halberd wave (stage 1 wave idx 4) to verify the guard
// sprite has no checker slab in-game.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(300);
  await page.click('text=Fight!');
  await page.waitForTimeout(400);
  await page.click('text=March Out');
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const g = window.__KN;
    g.waveIdx = 4;                 // halberd ×2 + raider ×2 at x=3000
    g.hero.x = 2995;
    g.hero.z = 100;
    g.camX = Math.max(0, 2995 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(2500);   // let them walk in
  await page.screenshot({ path: 'kn-5-guards.png' });
  await browser.close();
  console.log('wrote kn-5-guards.png');
})();
