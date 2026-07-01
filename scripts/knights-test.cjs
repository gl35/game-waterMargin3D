// Knights of Liangshan end-to-end check:
//  1. boot → title → select → stage
//  2. floor band: hold W → hero z must reach Z_MIN and feet sit ~30% screen Y
//  3. archer wave: steer at nearest archer, verify we can close to melee
//     range and land a hit (their hp drops)
const { chromium } = require('playwright');

const fail = [];
const ok = (msg) => console.log('  PASS  ' + msg);
const bad = (msg) => { console.log('  FAIL  ' + msg); fail.push(msg); };

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // Title → select → fight
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'kn-select.png' });
  await page.click('text=Fight!');
  await page.waitForTimeout(400);
  await page.click('text=March Out');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'kn-1-start.png' });

  const state0 = await page.evaluate(() => {
    const g = window.__KN;
    return g ? { z: g.hero.z, x: g.hero.x, h: window.innerHeight } : null;
  });
  if (!state0) { bad('game state hook missing'); }
  else ok(`stage started, hero z=${state0.z.toFixed(0)} x=${state0.x.toFixed(0)}`);

  // ── Floor band: walk all the way up ──
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyW');
  const topState = await page.evaluate(() => {
    const g = window.__KN;
    const h = window.innerHeight;
    const floorYTop = h * 0.30, floorYBot = h * 0.92;
    const feetY = floorYTop + (g.hero.z / 200) * (floorYBot - floorYTop);
    return { z: g.hero.z, feetY, centerY: h / 2, h };
  });
  if (topState.z <= 1) ok(`held W → hero z reached ${topState.z.toFixed(1)} (Z_MIN)`);
  else bad(`held W → hero z stuck at ${topState.z.toFixed(1)}, expected ~0`);
  if (topState.feetY < topState.centerY - 40)
    ok(`feet at y=${topState.feetY.toFixed(0)}px, well above center ${topState.centerY}px`);
  else
    bad(`feet at y=${topState.feetY.toFixed(0)}px, NOT above center ${topState.centerY}px`);
  await page.screenshot({ path: 'kn-2-top.png' });

  // back to bottom
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyS');
  const botZ = await page.evaluate(() => window.__KN.hero.z);
  if (botZ >= 199) ok(`held S → hero z reached ${botZ.toFixed(1)} (Z_MAX)`);
  else bad(`held S → hero z stuck at ${botZ.toFixed(1)}, expected ~200`);
  await page.screenshot({ path: 'kn-3-bottom.png' });

  // ── Archer engagement: jump to the archer wave and brawl ──
  await page.evaluate(() => {
    const g = window.__KN;
    g.waveIdx = 2;                       // wave at x=1800: 2 archers + 2 raiders
    g.hero.x = 1795;
    g.hero.z = 100;
    g.camX = Math.max(0, 1795 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD');     // step over the trigger line
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);

  const spawned = await page.evaluate(() => {
    const g = window.__KN;
    return g.enemies.filter(e => !e.dead).map(e => ({ t: e.typeId, x: e.x | 0, z: e.z | 0 }));
  });
  const archCount = spawned.filter(e => e.t === 'archer').length;
  if (archCount >= 2) ok(`wave spawned with ${archCount} archers: ${JSON.stringify(spawned)}`);
  else bad(`expected archers in wave, got ${JSON.stringify(spawned)}`);

  // Steer toward nearest archer for up to 8s; when close, attack.
  let minDx = 1e9, minDz = 1e9, landedHit = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const s = await page.evaluate(() => {
      const g = window.__KN;
      const h = g.hero;
      const arch = g.enemies.filter(e => !e.dead && e.typeId === 'archer')
        .sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x))[0];
      if (!arch) return null;
      return { dx: arch.x - h.x, dz: arch.z - h.z, hp: arch.hp, hpMax: arch.hpMax };
    });
    if (!s) break; // all archers dead
    minDx = Math.min(minDx, Math.abs(s.dx));
    minDz = Math.min(minDz, Math.abs(s.dz));
    if (s.hp < s.hpMax) { landedHit = true; break; }
    // steer
    if (s.dx > 14) { await page.keyboard.down('KeyD'); await page.keyboard.up('KeyA'); }
    else if (s.dx < -14) { await page.keyboard.down('KeyA'); await page.keyboard.up('KeyD'); }
    else { await page.keyboard.up('KeyA'); await page.keyboard.up('KeyD'); }
    if (s.dz > 12) { await page.keyboard.down('KeyS'); await page.keyboard.up('KeyW'); }
    else if (s.dz < -12) { await page.keyboard.down('KeyW'); await page.keyboard.up('KeyS'); }
    else { await page.keyboard.up('KeyW'); await page.keyboard.up('KeyS'); }
    if (Math.abs(s.dx) < 90 && Math.abs(s.dz) < 30) await page.keyboard.press('KeyJ');
    await page.waitForTimeout(110);
  }
  for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) await page.keyboard.up(k);
  await page.screenshot({ path: 'kn-4-archers.png' });

  if (landedHit) ok(`closed on archer and landed a hit (minDx=${minDx | 0}, minDz=${minDz | 0})`);
  else if (minDx === 1e9) ok('archers already dead before chase (other mobs?)');
  else bad(`never landed a hit on an archer (minDx=${minDx | 0}, minDz=${minDz | 0})`);

  await browser.close();

  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 10).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
