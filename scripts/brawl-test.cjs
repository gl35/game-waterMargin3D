// Brawler mechanics:
//  1. walking into a foe grabs them; Attack knees them
//  2. ←/→ + Attack throws; the thrown body damages enemies in its path
//  3. the 氣 gauge fills from landed hits; when full the special costs no HP
//  4. the cut-out rig finds legs on legged art and none on robes/mounts
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
    { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang', heroXp: { songjiang: 6000 },
      upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {}, relics: {}, relicEq: {} })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const click = (re) => page.evaluate((src) =>
    [...document.querySelectorAll('button')].find(x => new RegExp(src).test(x.textContent)).click(), re);
  await click('Insert Coin'); await page.waitForTimeout(350);
  await click('Fight!'); await page.waitForTimeout(350);
  await click('March Out'); await page.waitForTimeout(900);

  // into wave 1, enemies parked and harmless
  await page.evaluate(() => { const g = window.__KN; g.hero.x = 595; g.hero.invuln = 999; g.camX = Math.max(0, 595 - window.innerWidth * 0.42); });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const g = window.__KN; g.hero.invuln = 999;
    g.enemies.forEach((e, i) => { e.hp = e.hpMax = 5000; e.stun = 30; e.spawnT = 0; e.z = g.hero.z; e.x = g.hero.x + 90 + i * 150; });
  });

  // ── 1: grab by walking in ──
  await page.keyboard.down('KeyD'); await page.waitForTimeout(450); await page.keyboard.up('KeyD');
  const grab = await page.evaluate(() => ({ held: !!window.__KN.hero.grab, id: window.__KN.hero.grab && window.__KN.hero.grab.id }));
  if (grab.held) ok('walking into a foe grabs them'); else bad('no grab on contact');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}-grab.png` });
  const hp0 = await page.evaluate(() => window.__KN.hero.grab && window.__KN.hero.grab.hp);
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(260);
  const hp1 = await page.evaluate((id) => window.__KN.enemies.find(e => e.id === id).hp, grab.id);
  if (hp1 < hp0) ok(`knee strike hurts the held foe (${hp0} → ${hp1})`); else bad(`knee did nothing: ${hp0} → ${hp1}`);

  // ── 2: throw into the crowd ──
  const others0 = await page.evaluate((id) => window.__KN.enemies.filter(e => e.id !== id).map(e => e.hp), grab.id);
  await page.keyboard.down('KeyD'); await page.keyboard.press('KeyJ'); await page.keyboard.up('KeyD');
  await page.waitForTimeout(140);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}-throw.png` });
  const air = await page.evaluate((id) => { const e = window.__KN.enemies.find(en => en.id === id); return { thrown: e.thrown, y: e.y, held: !!window.__KN.hero.grab }; }, grab.id);
  if (air.thrown && air.y > 0 && !air.held) ok('←/→ + Attack hurls the held foe'); else bad(`throw failed: ${JSON.stringify(air)}`);
  await page.waitForTimeout(1200);
  const others1 = await page.evaluate((id) => window.__KN.enemies.filter(e => e.id !== id).map(e => e.hp), grab.id);
  const bowled = others1.filter((v, i) => v < others0[i]).length;
  if (bowled >= 1) ok(`the thrown body bowled over ${bowled} other foe(s)`); else bad(`nobody was hit by the throw: ${others0} → ${others1}`);
  const landed = await page.evaluate((id) => { const e = window.__KN.enemies.find(en => en.id === id); return { thrown: !!e.thrown, y: e.y, hp: e.hp }; }, grab.id);
  if (!landed.thrown && landed.y === 0 && landed.hp < hp1) ok('thrown foe lands and takes the fall damage'); else bad(`landing wrong: ${JSON.stringify(landed)}`);

  // ── 3: gauge → free special ──
  const g0 = await page.evaluate(() => window.__KN.rage);
  if (g0 > 0) ok(`氣 gauge filled from landed hits (${g0.toFixed(1)})`); else bad('gauge did not fill');
  await page.evaluate(() => { const g = window.__KN; g.rage = 100; g.hero.hp = g.hero.hpMax; });
  await page.keyboard.press('KeyL'); await page.waitForTimeout(260);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}-cutin.png` });
  const sp = await page.evaluate(() => { const g = window.__KN; return { hp: g.hero.hp, max: g.hero.hpMax, rage: g.rage, cut: g.vfx.some(v => v.kind === 'cutin') }; });
  if (sp.hp === sp.max && sp.rage < 100 && sp.cut) ok('full gauge: special costs no HP and plays the cut-in');
  else bad(`free special wrong: ${JSON.stringify(sp)}`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__KN.rage = 0; });
  await page.keyboard.press('KeyL'); await page.waitForTimeout(200);
  const paid = await page.evaluate(() => window.__KN.hero.hp < window.__KN.hero.hpMax);
  if (paid) ok('empty gauge: special still costs HP'); else bad('special was free with an empty gauge');

  // ── 4: rig analysis ──
  const rig = await page.evaluate(async () => {
    const m = await import('/src/scene2d/sprites.js');
    const names = ['enemy/raider', 'npc/likui', 'npc/songjiang', 'npc/husanniang'];
    names.forEach(n => m.getSprite(n));
    for (let i = 0; i < 60 && !names.every(n => m.getSprite(n)); i++) await new Promise(r => setTimeout(r, 250));
    const o = {};
    names.forEach(n => { const r = m.getRigInfo(n); o[n] = r ? r.legs : null; });
    return o;
  });
  if (rig['enemy/raider'] === true && rig['npc/likui'] === true) ok('rig finds two legs on legged art'); else bad(`leg detection: ${JSON.stringify(rig)}`);
  if (rig['npc/songjiang'] === false && rig['npc/husanniang'] === false) ok('rig treats robes / mounts as skirts (sway, no split)');
  else bad(`robe detection: ${JSON.stringify(rig)}`);

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
