const { chromium } = require('playwright');
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => sessionStorage.setItem('cine_seen', '1'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'inkwash-1.png' });

  // Walk south to see fortress + decorations
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2200);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'inkwash-2-north.png' });

  // Walk east to see more decorations
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyD');
  await page.screenshot({ path: 'inkwash-3-east.png' });

  await browser.close();
  console.log(`Errors: ${errors.length}`);
  errors.forEach(e => console.log('  ' + e));
  process.exit(errors.length > 0 ? 1 : 0);
})();
