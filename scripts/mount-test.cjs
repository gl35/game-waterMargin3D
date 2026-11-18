// Mounted combat:
//  1. the hero starts on horseback; the charge (Shift) tramples enemies
//  2. striking a foe mid wind-up is a CLASH (their blow is cancelled)
//  3. enough blows throw the rider; clearing the wave brings the horse back
//  4. the boss rides, charges down a lane, and is unhorsed at low health
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };
const SHOTS = process.argv[2] || null;

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass'], coins: 0, hero: 'linchong', heroXp: { linchong: 6000 },
      upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {}, relics: {}, relicEq: {} })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const click = (re) => page.evaluate((src) =>
    [...document.querySelectorAll('button')].find(x => new RegExp(src).test(x.textContent)).click(), re);
  await click('Insert Coin'); await page.waitForTimeout(350);
  await page.evaluate(() => document.querySelectorAll('.knights-hero-card')[1].click());
  await page.waitForTimeout(200);
  await click('Fight!'); await page.waitForTimeout(350);
  await click('March Out'); await page.waitForTimeout(900);

  const start = await page.evaluate(() => ({ m: window.__KN.hero.mounted, hp: window.__KN.hero.horseHp }));
  if (start.m && start.hp === 4) ok('hero rides into battle (horse 4/4)'); else bad(`not mounted: ${JSON.stringify(start)}`);

  // into wave 1
  await page.evaluate(() => { const g = window.__KN; g.hero.x = 595; g.camX = Math.max(0, 595 - window.innerWidth * 0.42); });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  await page.waitForTimeout(300);

  // ── 1: trample ──
  const hp0 = await page.evaluate(() => {
    const g = window.__KN; g.hero.invuln = 0; g.hero.facing = 1;
    g.enemies.forEach((e, i) => { e.hp = e.hpMax = 6000; e.stun = 30; e.spawnT = 0; e.z = g.hero.z; e.x = g.hero.x + 120 + i * 60; });
    return g.enemies.map(e => e.hp);
  });
  await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(700);
  const hp1 = await page.evaluate(() => window.__KN.enemies.map(e => e.hp));
  const trampled = hp1.filter((v, i) => v < hp0[i]).length;
  if (trampled >= 2) ok(`the charge trampled ${trampled} enemies`); else bad(`charge hit ${trampled}: ${hp0} → ${hp1}`);

  // ── 2: clash ──
  await page.waitForTimeout(600);
  const clash = await page.evaluate(async () => {
    const g = window.__KN; const h = g.hero;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const e = g.enemies.find(en => !en.dead);
    g.enemies.forEach(en => { if (en !== e) { en.x = h.x - 500; en.stun = 30; } });
    h.facing = 1; e.launched = 0; e.y = 0; e.vy = 0;
    e.x = h.x + 80; e.z = h.z; e.stun = 0; e.windup = 5; e.windupMax = 5;
    const hh = h.hp;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    await sleep(260);
    return { fx: g.vfx.some(v => v.kind === 'clash'), windup: e.windup, heroHurt: h.hp < hh };
  });
  if (clash.fx && clash.windup <= 0 && !clash.heroHurt) ok('striking a wind-up is a CLASH: the enemy blow is cancelled');
  else bad(`clash wrong: ${JSON.stringify(clash)}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}-clash.png` });

  // ── 3: thrown from the saddle, then the horse returns ──
  const thrown = await page.evaluate(async () => {
    const g = window.__KN; const h = g.hero;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 4; i++) {
      h.invuln = 0;
      const e = g.enemies.find(en => !en.dead);
      e.launched = 0; e.y = 0; e.stun = 0; e.x = h.x + 50; e.z = h.z; e.atkCdLeft = 0; e.windup = 0.03;
      await sleep(300);
    }
    return { mounted: h.mounted, alive: h.hp > 0, horseActor: g.actors.some(a => a.sprite === 'world/horse') };
  });
  if (!thrown.mounted && thrown.alive) ok('four blows throw the rider from the saddle'); else bad(`unhorse wrong: ${JSON.stringify(thrown)}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}-foot.png` });
  await page.evaluate(() => { const g = window.__KN; g.hero.invuln = 999; g.enemies.forEach(e => { e.dead = true; e.deadT = g.time; }); });
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => ({ m: window.__KN.hero.mounted, hp: window.__KN.hero.horseHp }));
  if (back.m && back.hp === 4) ok('the horse returns when the wave is cleared'); else bad(`no remount: ${JSON.stringify(back)}`);

  // ── 4: the mounted boss ──
  await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.length = 0; g.waveActive = false; g.waveIdx = g.stage.waves.length - 1;
    g.hero.x = g.stage.waves[g.waveIdx].atX - 6; g.hero.z = 100; g.hero.invuln = 999;
    g.camX = Math.max(0, Math.min(g.stage.width - window.innerWidth, g.hero.x - window.innerWidth * 0.42));
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  const boss0 = await page.evaluate(() => {
    const g = window.__KN; const b = g.enemies.find(e => e.boss);
    if (!b) return null;
    b.x = g.hero.x + 380; b.z = g.hero.z; b.chargeCd = 0; b.stun = 0;
    return { mounted: !!b.mounted, zh: b.zh };
  });
  if (boss0 && boss0.mounted && boss0.zh) ok(`the boss duels from the saddle (seal ${boss0.zh})`); else bad(`boss not mounted: ${JSON.stringify(boss0)}`);
  await page.waitForTimeout(450);
  const tele = await page.evaluate(() => { const b = window.__KN.enemies.find(e => e.boss); return b.charge ? b.charge.phase : -1; });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}-boss.png` });
  if (tele === 0) ok('the boss rears up to telegraph the charge'); else bad(`no charge telegraph (phase ${tele})`);
  const x0 = await page.evaluate(() => window.__KN.enemies.find(e => e.boss).x);
  await page.waitForTimeout(1100);
  const x1 = await page.evaluate(() => window.__KN.enemies.find(e => e.boss).x);
  if (Math.abs(x1 - x0) > 250) ok(`then thunders down the lane (${Math.round(Math.abs(x1 - x0))}px)`); else bad(`boss did not charge: ${x0} → ${x1}`);
  await page.waitForTimeout(900);
  const un = await page.evaluate(async () => {
    const g = window.__KN; const b = g.enemies.find(e => e.boss);
    b.hp = Math.round(b.hpMax * 0.41); b.charge = null; b.chargeCd = 99; b.stun = 5;
    b.x = g.hero.x + 90; b.z = g.hero.z; g.hero.facing = 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    await new Promise(r => setTimeout(r, 400));
    return { mounted: !!b.mounted, hp: b.hp, max: b.hpMax };
  });
  if (!un.mounted && un.hp > 0) ok('below 40% health the boss is beaten out of the saddle'); else bad(`boss unhorse wrong: ${JSON.stringify(un)}`);

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
