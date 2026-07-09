// 仙术 skill milestones:
//  1. LV1 hero: combo cycles 3 hits; dash/jump attacks unavailable
//  2. LV8 hero: 4th combo form usable; dash attack works
//  3. crossing a milestone mid-battle announces the new art
//  4. select screen shows the skill track (locked + unlocked chips)
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };

async function boot(page, xp) {
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate((x) => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang',
      heroXp: { songjiang: x }, upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {} })), xp);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(500);
}
async function intoStage(page) {
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

  // ── LV1: 3-hit cycle, no dash/jump arts ──
  await boot(page, 0);
  const chips = await page.evaluate(() => ({
    total: document.querySelectorAll('.kn-skill-chip').length,
    got: document.querySelectorAll('.kn-skill-chip.got').length,
  }));
  if (chips.total === 5 && chips.got === 0) ok('LV1 skill track: 5 chips, all locked');
  else bad(`skill track wrong: ${JSON.stringify(chips)}`);
  await page.screenshot({ path: 'skills-select.png' });
  await intoStage(page);
  const cycle = await page.evaluate(async () => {
    const g = window.__KN;
    const seen = [];
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 4; i++) {
      g.inputRefHack = null;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      await sleep(60);
      seen.push(g.hero.attackMove ? g.hero.attackMove.name : null);
      await sleep(420);                    // let the move finish, stay in combo window
    }
    return { seen, dashLocked: !g.skills.dashAttack, jumpLocked: !g.skills.jumpAttack };
  });
  const uniq = [...new Set(cycle.seen)];
  if (!cycle.seen.includes('launch') && uniq.length === 3 && cycle.seen[3] === cycle.seen[0])
    ok(`LV1 combo cycles 3 forms (${cycle.seen.join(' → ')})`);
  else bad(`LV1 combo wrong: ${JSON.stringify(cycle.seen)}`);
  if (cycle.dashLocked && cycle.jumpLocked) ok('dash & aerial arts locked at LV1');
  else bad('arts not locked at LV1');
  const lockedCard = await page.evaluate(() => !!document.querySelector('.knights-skill-card.kn-locked'));
  if (lockedCard) ok('HUD shows the 4th form padlocked'); else bad('no locked HUD card');

  // ── LV7 (xp 2000; cumulative L7 = 1880): 4-hit combo + dash art ──
  await boot(page, 2000);
  const gotChips = await page.evaluate(() => document.querySelectorAll('.kn-skill-chip.got').length);
  if (gotChips === 3) ok(`LV7 skill track shows 3 unlocked arts`); else bad(`LV7 chips: ${gotChips}`);
  await intoStage(page);
  const lv8 = await page.evaluate(async () => {
    const g = window.__KN;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const seen = [];
    for (let i = 0; i < 4; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
      await sleep(60);
      seen.push(g.hero.attackMove ? g.hero.attackMove.name : null);
      await sleep(420);
    }
    // dash art
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'shift' }));
    await sleep(60);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    await sleep(80);
    const dashMove = g.hero.attackMove ? g.hero.attackMove.name : null;
    return { seen, dashMove, lv: g.heroLevel };
  });
  if (lv8.seen.includes('launch')) ok(`LV7 combo reaches the 4th form (${lv8.seen.join(' → ')})`);
  else bad(`LV7 combo missing 4th: ${JSON.stringify(lv8.seen)}`);
  if (lv8.dashMove === 'shoulder') ok(`dash art fires (${lv8.dashMove})`);
  else bad(`dash art wrong: ${lv8.dashMove}`);

  // ── milestone crossing announces the art ── (xp 95 → LV2? no milestone;
  // use xp just below LV3: L1→2=100, 2→3=155 → total 255. Set 250, kill 1.)
  await boot(page, 250);
  await intoStage(page);
  await page.evaluate(() => {
    const g = window.__KN; g.hero.x = 595; g.camX = Math.max(0, 595 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(260); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const g = window.__KN;
    const e = g.enemies.find(en => !en.dead);
    e.hp = 1; e.x = g.hero.x + 60; e.z = g.hero.z; e.stun = 4;
    g.enemies.filter(en => en !== e && !en.dead).forEach(en => { en.x = g.hero.x + 500; en.stun = 5; });
    g.hero.facing = 1;
  });
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(160); }
  await page.waitForTimeout(1400);
  const ann = await page.evaluate(() => ({
    lv: window.__KN.heroLevel,
    banner: window.__KN.vfx.some(v => v.kind === 'banner' && /疾風斬|新技/.test(v.text || '')),
    dash: !!window.__KN.skills.dashAttack,
  }));
  if (ann.lv === 3 && ann.dash && ann.banner) ok('crossing LV3 mid-battle unlocks + announces 疾風斬');
  else bad(`milestone announce wrong: ${JSON.stringify(ann)}`);

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
