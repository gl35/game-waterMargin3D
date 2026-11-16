// Captures a burst of action frames for eyeballing animation.
// usage: node scripts/anim-shot.cjs [outPrefix] [heroId]
const { chromium } = require('playwright');
const prefix = process.argv[2] || 'anim';
const hero = process.argv[3] || 'songjiang';
(async () => {
  const errors = [];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('http://localhost:5173', { waitUntil: 'load' });
  await p.evaluate((h) => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass'], coins: 0, hero: h, heroXp: { [h]: 6000 },
      upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {}, relics: {}, relicEq: {} })), hero);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(2500);
  await p.click('text=Insert Coin'); await p.waitForTimeout(400);
  await p.evaluate((h) => {
    const ids = ['songjiang', 'linchong', 'wusong', 'huarong', 'husanniang', 'likui'];
    document.querySelectorAll('.knights-hero-card')[Math.max(0, ids.indexOf(h))].click();
  }, hero);
  await p.waitForTimeout(200);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /Fight!/.test(x.textContent)).click());
  await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /March Out/.test(x.textContent)).click());
  await p.waitForTimeout(1200);
  const shot = (n) => p.screenshot({ path: `${prefix}-${n}.png`, clip: { x: 140, y: 120, width: 1000, height: 560 } });
  // walk
  await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await shot('1walk');
  await p.waitForTimeout(2600); await p.keyboard.up('KeyD');
  await p.waitForTimeout(900); await shot('2wave');
  // bring enemies close and combo
  await p.evaluate(() => { const g = window.__KN; g.hero.invuln = 99;
    g.enemies.forEach((e, i) => { e.x = g.hero.x + 80 + i * 14; e.z = g.hero.z + (i % 3 - 1) * 14; e.hp = e.hpMax = 4000; }); });
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press('KeyJ'); await p.waitForTimeout(70); await shot('3hit' + i); await p.waitForTimeout(190);
  }
  await p.waitForTimeout(150); await shot('4launch');
  await p.waitForTimeout(500);
  await p.keyboard.press('KeyL'); await p.waitForTimeout(160); await shot('5magicA');
  await p.waitForTimeout(260); await shot('5magicB');
  await p.waitForTimeout(700);
  await p.keyboard.press('ShiftLeft'); await p.waitForTimeout(90); await shot('6dash');
  await p.waitForTimeout(500);
  await p.keyboard.press('KeyK'); await p.waitForTimeout(200); await p.keyboard.press('KeyJ'); await p.waitForTimeout(90); await shot('7air');
  await p.waitForTimeout(700);
  await p.evaluate(() => { const g = window.__KN; g.enemies.forEach(e => { e.hp = 1; }); });
  await p.keyboard.press('KeyL'); await p.waitForTimeout(330); await shot('8kill');
  await b.close();
  console.log('errors:', errors.length, errors.slice(0, 5));
})();
