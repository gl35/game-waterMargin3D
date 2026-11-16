// Animation / feel regressions:
//  1. wave enemies enter from OFF-screen (no popping into view)
//  2. a launcher really lifts the enemy off the floor
//  3. a press made mid-swing is buffered and chains the combo
//  4. the pause card freezes game time; Resume continues it
//  5. a knock-out plays out on the stage before the Continue screen
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };
const SHOTS = process.argv[2] || null;      // optional screenshot prefix

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang', heroXp: { songjiang: 6000 },
      upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {}, relics: {}, relicEq: {} })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(x => /Fight!/.test(x.textContent)).click());
  await page.waitForTimeout(350);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(x => /March Out/.test(x.textContent)).click());
  await page.waitForTimeout(900);

  // ── 1: off-screen spawns ──
  await page.evaluate(() => { const g = window.__KN; g.hero.x = 595; g.camX = Math.max(0, 595 - window.innerWidth * 0.42); });
  const spawn = await page.evaluate(async () => {
    const g = window.__KN;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    for (let i = 0; i < 60 && !g.waveActive; i++) await new Promise(r => requestAnimationFrame(r));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
    const W = window.innerWidth;
    return { n: g.enemies.length, onScreen: g.enemies.filter(e => e.x > g.camX + 10 && e.x < g.camX + W - 10).length };
  });
  if (spawn.n > 0 && spawn.onScreen === 0) ok(`all ${spawn.n} wave enemies enter from off-screen`);
  else bad(`enemies popped into view: ${JSON.stringify(spawn)}`);

  // ── 2: launcher lifts the enemy ──
  const launch = await page.evaluate(async () => {
    const g = window.__KN;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.hero.invuln = 99; g.hero.facing = 1;
    g.enemies.forEach((e, i) => { e.hp = e.hpMax = 9000; e.x = g.hero.x + 70 + i * 60; e.z = g.hero.z; e.stun = 9; });
    let peak = 0, moves = [];
    for (let i = 0; i < 4; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      await sleep(70);
      moves.push(g.hero.attackMove && g.hero.attackMove.name);
      for (let k = 0; k < 14; k++) { await sleep(25); peak = Math.max(peak, ...g.enemies.map(e => e.y || 0)); }
    }
    for (let k = 0; k < 20; k++) { await sleep(25); peak = Math.max(peak, ...g.enemies.map(e => e.y || 0)); }
    await sleep(700);
    return { peak, moves, grounded: g.enemies.every(e => (e.y || 0) === 0 && !(e.launched > 0)) };
  });
  if (launch.peak > 40) ok(`launcher sends the enemy airborne (peak ${Math.round(launch.peak)}px)`);
  else bad(`launch never left the floor: ${JSON.stringify(launch)}`);
  if (launch.grounded) ok('juggled enemies land again'); else bad('enemy stuck in the air');

  // ── 3: buffered attack press chains the combo ──
  await page.waitForTimeout(700);
  const buf = await page.evaluate(async () => {
    const g = window.__KN;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    g.hero.comboStep = 0; g.hero.comboTimer = 0;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    await sleep(50);
    const first = g.hero.attackMove && g.hero.attackMove.name;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));   // pressed MID-swing
    await sleep(190);
    const second = g.hero.attackMove && g.hero.attackMove.name;
    return { first, second };
  });
  if (buf.first === 'jab' && buf.second === 'cross') ok('mid-swing press is buffered (jab → cross)');
  else bad(`attack buffer failed: ${JSON.stringify(buf)}`);

  // ── 4: pause freezes time ──
  await page.waitForTimeout(500);
  await page.click('button:has-text("Pause")');
  await page.waitForTimeout(150);
  const t0 = await page.evaluate(() => window.__KN.time);
  await page.waitForTimeout(600);
  const t1 = await page.evaluate(() => window.__KN.time);
  await page.click('button:has-text("Resume")');
  await page.waitForTimeout(400);
  const t2 = await page.evaluate(() => window.__KN.time);
  if (Math.abs(t1 - t0) < 0.02 && t2 > t1 + 0.2) ok('pause freezes the fight; Resume continues it');
  else bad(`pause broken: t0=${t0} t1=${t1} t2=${t2}`);

  // ── 5: knock-out plays before the Continue screen ──
  await page.evaluate(() => {
    const g = window.__KN;
    g.hero.invuln = 0; g.hero.hp = 1;
    const e = g.enemies.find(en => !en.dead);
    e.stun = 0; e.x = g.hero.x + 50; e.z = g.hero.z; e.atkCdLeft = 0; e.windup = 0.05;
  });
  await page.waitForTimeout(450);
  const ko = await page.evaluate(() => ({ ko: window.__KN.hero.ko, failed: window.__KN.stageFailed,
    canvas: !!document.querySelector('.knights-canvas'), over: !!document.querySelector('.knights-gameover') }));
  if (ko.failed && ko.ko > 0 && ko.canvas && !ko.over) ok('hero is knocked down on stage (no instant cut)');
  else bad(`KO sequence wrong: ${JSON.stringify(ko)}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}-ko.png` });
  await page.waitForTimeout(2600);
  const over = await page.evaluate(() => !!document.querySelector('.knights-gameover'));
  if (over) ok('Continue screen follows the knock-out'); else bad('Continue screen never appeared');

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
