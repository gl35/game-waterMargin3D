// Probe how the sprite pipeline processed the enemy sprites: did the
// flood fill erase the edge-connected checker, and what opaque
// neutral-light residue remains (enclosed regions)?
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'load' });

  const result = await page.evaluate(async () => {
    const mod = await import('/src/scene2d/sprites.js');
    const names = ['enemy/archer', 'enemy/raider', 'enemy/scout', 'enemy/guard',
      'enemy/berserker', 'enemy/captain', 'enemy/warlord',
      'npc/songjiang', 'npc/linchong', 'npc/wusong', 'npc/huarong', 'npc/husanniang', 'npc/likui'];
    for (const n of names) mod.getSprite(n);
    // wait for loads
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (names.every(n => mod.getSprite(n))) break;
    }
    const out = {};
    for (const n of names) {
      const c = mod.getSprite(n);
      if (!c) { out[n] = 'NOT LOADED'; continue; }
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let opaque = 0, neutralLight = 0;
      for (let i = 0; i < img.length; i += 4) {
        if (img[i + 3] >= 24) {
          opaque++;
          const r = img[i], g = img[i + 1], b = img[i + 2];
          if (Math.max(r, g, b) - Math.min(r, g, b) <= 30 && r + g + b > 390) neutralLight++;
        }
      }
      const total = c.width * c.height;
      // corners opaque?
      const corner = (x, y) => img[(y * c.width + x) * 4 + 3] >= 24;
      out[n] = {
        w: c.width, h: c.height,
        opaquePct: +(100 * opaque / total).toFixed(1),
        neutralLightPctOfOpaque: opaque ? +(100 * neutralLight / opaque).toFixed(1) : 0,
        corners: [corner(0, 0), corner(c.width - 1, 0), corner(0, c.height - 1), corner(c.width - 1, c.height - 1)],
      };
    }
    return out;
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
