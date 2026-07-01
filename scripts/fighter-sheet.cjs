// Render the articulated-fighter frame sheets for several characters onto one
// image, over a dark backdrop, to verify limbs + weapon arm actually move.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('http://localhost:5173', { waitUntil: 'load' });

  await page.evaluate(async () => {
    const mod = await import('/src/knights/fighter.js');
    const keys = ['songjiang', 'linchong', 'huarong', 'likui', 'husanniang', 'raider'];
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;background:#241a14;overflow:auto;padding:8px';
    document.body.appendChild(wrap);
    for (const k of keys) {
      const label = document.createElement('div');
      label.textContent = k;
      label.style.cssText = 'color:#ffd676;font:bold 14px monospace;margin:6px 0 2px';
      wrap.appendChild(label);
      const sheet = mod.generateSheet(k, 104, 140);
      sheet.style.cssText = 'display:block;background:#160f0a;border:1px solid #3a2a1a';
      wrap.appendChild(sheet);
    }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'fighter-sheet.png', fullPage: true });
  await browser.close();
  console.log('wrote fighter-sheet.png');
})();
