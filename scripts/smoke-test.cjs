const { chromium } = require('playwright');
(async () => {
  const errors = [];
  const consoleMessages = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('console', m => consoleMessages.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // Skip the cinematic
  const skipBtn = await page.$('.cine-skip');
  if (skipBtn) {
    console.log('cinematic visible — clicking skip');
    await skipBtn.click();
    await page.waitForTimeout(1500);
  }

  // Screenshot the gameplay
  await page.screenshot({ path: 'smoke-game.png', fullPage: false });

  // Try moving the hero
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'smoke-after-move.png', fullPage: false });

  // Try an attack
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'smoke-after-attack.png', fullPage: false });

  // Re-load cinematic
  await page.evaluate(() => sessionStorage.removeItem('cine_seen'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'smoke-cine-1.png', fullPage: false });

  await browser.close();

  console.log(`\nConsole messages (${consoleMessages.length}):`);
  consoleMessages.slice(0, 30).forEach(m => console.log('  ' + m));
  console.log(`\nErrors (${errors.length}):`);
  errors.forEach(e => console.log('  ' + e));
  process.exit(errors.length > 0 ? 1 : 0);
})();
