const { webkit } = require('playwright');

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  try {
    await page.goto('https://game-omega-ochre.vercel.app');
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('Navigation error', err);
  }
  await browser.close();
})();
