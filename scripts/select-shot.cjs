// Screenshot the character-select screen (should show real sprite portraits).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(1500);            // let hero sprites load + paint
  await page.screenshot({ path: 'kn-select.png' });
  await browser.close();
  console.log('wrote kn-select.png');
})();
