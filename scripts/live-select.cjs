// Screenshot the LIVE character-select screen (sprite portraits should load
// under the /game-waterMargin3D/ sub-path).
const { chromium } = require('playwright');
(async () => {
  const s404 = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('response', r => { if (/\/sprites\//.test(r.url()) && r.status() >= 400) s404.push(r.url()); });
  await page.goto('https://gl35.github.io/game-waterMargin3D/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(2500);         // sprites download + process
  await page.screenshot({ path: 'live-select.png' });
  await browser.close();
  console.log('sprite 404s:', s404.length);
  console.log('wrote live-select.png');
})();
