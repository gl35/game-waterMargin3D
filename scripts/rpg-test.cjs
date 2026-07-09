// RPG progression end-to-end:
//  1. levels scale stats (LV5 save → higher hp/atk than base)
//  2. mid-battle LEVEL UP fires when run XP crosses the threshold
//  3. defeat persists XP ("a defeat still trains you")
//  4. camp upgrade purchase deducts coins and boosts next run's stats
//  5. HUD shows LV badge + XP bar; select cards show LV
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };

async function boot(page, saveObj) {
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('knights_save_v1', JSON.stringify(s)), saveObj);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);
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

  // ── 1. levels scale stats ── (LV5 ≈ 100+155+240+335 = 830 xp)
  await boot(page, { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang',
    heroXp: { songjiang: 900 }, upgrades: { atk: 0, hp: 0, fortune: 0 } });
  const lvChip = await page.evaluate(() => document.querySelector('.kn-portrait-lv')?.textContent);
  if (/LV [45]/.test(lvChip || '')) ok(`select card shows level (${lvChip})`);
  else bad(`select card level wrong: ${lvChip}`);
  await page.screenshot({ path: 'rpg-select.png' });
  await intoStage(page);
  const stats = await page.evaluate(() => ({
    lv: window.__KN.heroLevel, hp: window.__KN.hero.hpMax, atk: window.__KN.hero.atk,
    badge: document.querySelector('.knights-lv-badge')?.textContent,
    xpbar: !!document.querySelector('.knights-bar.xp'),
  }));
  if (stats.lv >= 4 && stats.hp > 1400 && stats.atk > 38) ok(`LV${stats.lv} stats scaled (hp ${stats.hp} > 1400, atk ${stats.atk} > 38)`);
  else bad(`stats not scaled: ${JSON.stringify(stats)}`);
  if (stats.badge && stats.xpbar) ok(`HUD shows ${stats.badge} + XP bar`);
  else bad(`HUD missing badge/xp bar: ${JSON.stringify(stats)}`);

  // ── 2. mid-battle level-up ── (xp 95/100 → one raider kill (+6) levels)
  await boot(page, { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang',
    heroXp: { songjiang: 95 }, upgrades: { atk: 0, hp: 0, fortune: 0 } });
  await intoStage(page);
  const atkBefore = await page.evaluate(() => window.__KN.hero.atk);
  await page.evaluate(() => {
    const g = window.__KN; g.hero.x = 595; g.camX = Math.max(0, 595 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(260); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const g = window.__KN;
    const e = g.enemies.find(en => !en.dead);
    e.hp = 1; e.x = g.hero.x + 60; e.z = g.hero.z; e.stun = 3;
    g.enemies.filter(en => en !== e && !en.dead).forEach(en => { en.x = g.hero.x + 400; en.stun = 4; });
    g.hero.facing = 1;
  });
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(160); }
  await page.waitForTimeout(500);
  const lvUp = await page.evaluate(() => ({
    lv: window.__KN.heroLevel, atk: window.__KN.hero.atk,
    banner: window.__KN.vfx.some(v => v.kind === 'banner' && /LEVEL UP/.test(v.text || '')),
  }));
  if (lvUp.lv === 2 && lvUp.atk > atkBefore) ok(`mid-battle LEVEL UP → LV2, atk ${atkBefore}→${lvUp.atk}`);
  else bad(`level-up failed: ${JSON.stringify(lvUp)} (atkBefore ${atkBefore})`);
  await page.screenshot({ path: 'rpg-levelup.png' });

  // ── 3. defeat persists XP ──
  await page.evaluate(() => { const g = window.__KN; g.hero.hp = 1; g.hero.invuln = 0; damage: g.stageFailed = true; });
  await page.waitForTimeout(800);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('knights_save_v1')));
  if ((kept.heroXp.songjiang || 0) > 95) ok(`defeat kept XP (${kept.heroXp.songjiang} > 95)`);
  else bad(`defeat lost XP: ${JSON.stringify(kept.heroXp)}`);

  // ── 4. camp upgrade ──
  await boot(page, { unlocked: ['mountain_pass'], coins: 500, hero: 'songjiang',
    heroXp: {}, upgrades: { atk: 0, hp: 0, fortune: 0 } });
  await page.click('text=Whetstone');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('knights_save_v1')));
  if (after.upgrades.atk === 1 && after.coins === 380) ok(`camp purchase: atk tier 1, coins 500→${after.coins}`);
  else bad(`camp purchase wrong: ${JSON.stringify(after)}`);
  await intoStage(page);
  const upAtk = await page.evaluate(() => window.__KN.hero.atk);
  if (upAtk === Math.round(38 * 1.08)) ok(`whetstone applies in battle (atk ${upAtk})`);
  else bad(`upgrade not applied: atk ${upAtk}`);
  await page.screenshot({ path: 'rpg-camp.png' });

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
