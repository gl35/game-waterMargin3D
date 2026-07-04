// Render all knights sprites (post-pipeline) onto one contact sheet over a
// magenta backdrop so transparency holes / leftover checker both pop out.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 700 } })).newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'load' });

  await page.evaluate(async () => {
    const mod = await import('/src/scene2d/sprites.js');
    const names = ['npc/songjiang', 'npc/linchong', 'npc/wusong', 'npc/huarong',
      'npc/husanniang', 'npc/likui',
      'enemy/raider', 'enemy/scout', 'enemy/archer', 'enemy/guard',
      'enemy/berserker', 'enemy/captain', 'enemy/warlord'];
    for (const n of names) mod.getSprite(n);
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (names.every(n => mod.getSprite(n))) break;
    }
    document.body.innerHTML = '';
    const cv = document.createElement('canvas');
    cv.width = 1600; cv.height = 700;
    cv.style.cssText = 'position:fixed;inset:0;z-index:99999';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#c0f';
    ctx.fillRect(0, 0, cv.width, cv.height);
    let x = 10;
    for (const n of names) {
      const c = mod.getSprite(n);
      if (!c) continue;
      const scale = 300 / c.height;
      const dw = c.width * scale;
      ctx.drawImage(c, x, n.startsWith('npc') ? 20 : 360, dw, 300);
      ctx.fillStyle = '#000';
      ctx.font = '12px monospace';
      ctx.fillText(n, x, n.startsWith('npc') ? 335 : 675);
      ctx.fillStyle = '#c0f';
      x += dw + 14;
      if (n === 'npc/likui') x = 10;
    }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'kn-sprites.png' });
  await browser.close();
  console.log('wrote kn-sprites.png');
})();
