const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass', 'magistrate_wall', 'hidden_court'], coins: 0, hero: 'songjiang' })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('.knights-stage-card')].map(c => ({
      name: c.querySelector('.knights-stage-name')?.textContent,
      disabled: c.disabled,
      locked: c.className.includes('locked'),
    })));
  console.log(JSON.stringify(cards, null, 2));
  await browser.close();
})();
