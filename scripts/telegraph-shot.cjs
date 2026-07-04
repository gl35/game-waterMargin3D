// Capture a frame mid-telegraph: a crowd of enemies winding up their strikes
// (warning rings closing) around the hero.
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
    g.waveIdx = 4; g.hero.x = 2995; g.hero.z = 100;     // halberd + raider wave
    g.camX = Math.max(0, 2995 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  await page.waitForTimeout(1800);
  // Force every live enemy into the middle of a wind-up, frozen, around the hero.
  await page.evaluate(() => {
    const g = window.__KN;
    g.hero.invuln = 99;                                  // don't actually get hit
    g.enemies.filter(e => !e.dead).forEach((e, i) => {
      e.x = g.hero.x + (i % 2 ? 120 : -120) + (i * 8);
      e.z = g.hero.z + (i % 2 ? 24 : -24);
      e.windup = e.windupMax * 0.5; e.atkAnim = 0.3; e.stun = 0;
    });
  });
  await page.waitForTimeout(60);
  await page.screenshot({ path: 'telegraph-shot.png' });
  await browser.close();
  console.log('wrote telegraph-shot.png');
})();
