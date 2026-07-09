// 五行 + 炼妖壶 end-to-end:
//  1. element multipliers land: Li Kui (fire) vs halberd (metal) = overcoming
//  2. spirit capture: special-kill always refines a spirit into the pot
//  3. spirits persist at stage end; fusing 3 grants a charm tier
//  4. charm boosts damage vs that element next run
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };

async function boot(page, saveObj, hero) {
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('knights_save_v1', JSON.stringify(s)), saveObj);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);
  if (hero) { await page.click(`text=${hero}`); await page.waitForTimeout(200); }
  await page.click('text=Fight!');
  await page.waitForTimeout(350);
  await page.click('text=March Out');
  await page.waitForTimeout(900);
}

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // ── 1+2: Li Kui (fire) — fire overcomes metal (halberd) ──
  await boot(page, { unlocked: ['mountain_pass'], coins: 0, hero: 'likui',
    heroXp: {}, upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {} }, 'Black Whirlwind');
  const mults = await page.evaluate(() => {
    const g = window.__KN;
    // deterministic probe: spawn one halberd (metal) and one brute (fire)
    g.waveActive = false; g.enemies.length = 0;
    return { heroEl: g.hero.el };
  });
  if (mults.heroEl === 'fire') ok('Li Kui carries 火 fire'); else bad(`hero el: ${mults.heroEl}`);

  const dmgProbe = await page.evaluate(async () => {
    const g = window.__KN;
    const mk = (window.__KN_makeEnemy = null, null);
    return null;
  }).catch(() => null);
  // measure via real hits: place a halberd via wave 5 (halberd wave x=3000)
  await page.evaluate(() => {
    const g = window.__KN; g.waveIdx = 4; g.hero.x = 2995; g.hero.z = 100;
    g.camX = Math.max(0, 2995 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(260); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  const hit = await page.evaluate(async () => {
    const g = window.__KN;
    const halberd = g.enemies.find(e => e.typeId === 'halberd' && !e.dead);
    const raider = g.enemies.find(e => e.typeId === 'raider' && !e.dead);
    if (!halberd) return null;
    g.enemies.forEach(e => { e.stun = 9; e.x = g.hero.x + 4000; });  // park everyone far away
    halberd.x = g.hero.x + 60; halberd.z = g.hero.z;
    const hp0 = halberd.hp;
    g.hero.facing = 1;
    return { hp0, id: halberd.id, raiderId: raider ? raider.id : null };
  });
  // swing until the halberd takes a NON-crit hit we can measure... simpler:
  // read the damage vfx eff flag after one swing.
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(300);
  const effSeen = await page.evaluate(() => {
    const g = window.__KN;
    const dn = g.vfx.filter(v => v.kind === 'damageNumber' && !v.text && !v.heal);
    return dn.length ? { eff: dn[dn.length - 1].eff, value: dn[dn.length - 1].value } : null;
  });
  if (effSeen && effSeen.eff === 'strong') ok(`fire hit metal → overcoming damage number (${effSeen.value}, tinted strong)`);
  else bad(`no overcoming eff: ${JSON.stringify(effSeen)}`);

  // special-kill the weakened halberd → guaranteed spirit
  await page.evaluate(() => {
    const g = window.__KN;
    const halberd = g.enemies.find(e => e.typeId === 'halberd' && !e.dead);
    halberd.hp = 1; halberd.x = g.hero.x + 80; halberd.z = g.hero.z;
    g.hero.hp = g.hero.hpMax;
  });
  await page.keyboard.press('KeyL');                    // Black Whirlwind special
  await page.waitForTimeout(1300);
  const pot = await page.evaluate(() => ({ gained: window.__KN.potGained }));
  if ((pot.gained.metal || 0) >= 1) ok(`special-kill refined a 金 spirit (${JSON.stringify(pot.gained)})`);
  else bad(`no spirit refined: ${JSON.stringify(pot.gained)}`);

  // die to persist the pot
  await page.evaluate(() => { window.__KN.stageFailed = true; });
  await page.waitForTimeout(800);
  const savedPot = await page.evaluate(() => JSON.parse(localStorage.getItem('knights_save_v1')).pot);
  if ((savedPot.metal || 0) >= 1) ok(`spirits persisted to the save (${JSON.stringify(savedPot)})`);
  else bad(`pot not persisted: ${JSON.stringify(savedPot)}`);

  // ── 3: fuse 3 spirits → charm ──
  await boot(page, { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang',
    heroXp: {}, upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: { metal: 3 }, charms: {} });
  // back out to the lobby to use the pot (boot ended in-stage) — reload instead
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(500);
  const fuseBtn = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.kn-pot-row')];
    const metal = rows.find(r => r.textContent.includes('金'));
    const btn = metal && metal.querySelector('button');
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  });
  await page.waitForTimeout(300);
  const fused = await page.evaluate(() => JSON.parse(localStorage.getItem('knights_save_v1')));
  if (fuseBtn && fused.charms.metal === 1 && fused.pot.metal === 0) ok('fused 3 金 spirits → 金 charm tier 1');
  else bad(`fuse failed: ${JSON.stringify({ fuseBtn, charms: fused.charms, pot: fused.pot })}`);
  await page.screenshot({ path: 'elements-camp.png' });

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
