// 寶物 boss relics:
//  1. first boss kill drops its relic (banner + relicGained) and persists
//  2. lobby shows it owned; equipping persists per hero
//  3. equipped Iron Writ (+10% atk) applies in the next battle
//  4. repeat boss kill pays a coin bounty instead
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
  await page.waitForTimeout(450);
}
async function intoStage(page) {
  await page.click('text=Fight!');
  await page.waitForTimeout(350);
  await page.click('text=March Out');
  await page.waitForTimeout(900);
}
async function killBoss(page) {
  await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.length = 0; g.waveActive = false;
    g.waveIdx = 6; g.hero.x = 4395; g.hero.z = 100;    // ch1 boss wave at 4400
    g.camX = Math.max(0, 4395 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(260); await page.keyboard.up('KeyD');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const g = window.__KN;
    const boss = g.enemies.find(e => e.boss);
    boss.hp = 1; boss.x = g.hero.x + 70; boss.z = g.hero.z; boss.stun = 5; boss.windup = 0;
    g.hero.facing = 1; g.hero.invuln = 99;
  });
  for (let i = 0; i < 5; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(170); }
  await page.waitForTimeout(600);
}

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // ── 1: first kill drops the Iron Writ ──
  await boot(page, { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang',
    heroXp: {}, upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {}, relics: {}, relicEq: {} });
  await intoStage(page);
  await killBoss(page);
  const drop = await page.evaluate(() => ({
    gained: window.__KN.relicGained,
    banner: window.__KN.vfx.some(v => v.kind === 'banner' && /鐵面令/.test(v.text || '')),
  }));
  if (drop.gained === 'iron_writ' && drop.banner) ok('first boss kill drops 鐵面令 Iron Writ (banner shown)');
  else bad(`relic drop wrong: ${JSON.stringify(drop)}`);
  await page.screenshot({ path: 'relic-drop.png' });
  await page.waitForTimeout(2200);                    // stage completes → persists
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('knights_save_v1')));
  if (saved.relics && saved.relics.iron_writ) ok('relic persisted to the save');
  else bad(`relic not persisted: ${JSON.stringify(saved.relics)}`);

  // ── 2: equip in the lobby ──
  await page.click('button:has-text("Lobby")');
  await page.waitForSelector('.kn-relic-card', { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.click('.kn-relic-card:has-text("Iron Writ")');
  const clicked = true;
  await page.waitForTimeout(300);
  const eq = await page.evaluate(() => JSON.parse(localStorage.getItem('knights_save_v1')).relicEq);
  if (clicked && eq.songjiang === 'iron_writ') ok('Iron Writ equipped for Song Jiang');
  else bad(`equip failed: ${JSON.stringify({ clicked, eq })}`);
  await page.screenshot({ path: 'relic-lobby.png' });

  // ── 3: relic applies in battle (+10% atk over the level-scaled base) ──
  await intoStage(page);
  const st = await page.evaluate(() => ({
    atk: window.__KN.hero.atk, crit: window.__KN.critChance, lv: window.__KN.heroLevel,
  }));
  const baseAtk = Math.round(38 * (1 + 0.06 * (st.lv - 1)));
  if (st.atk === Math.round(baseAtk * 1.10) && Math.abs(st.crit - 0.13) < 1e-9)
    ok(`Iron Writ applies (LV${st.lv}: atk ${baseAtk}→${st.atk}, crit ${st.crit})`);
  else bad(`relic stats wrong: ${JSON.stringify(st)} (expected atk ${Math.round(baseAtk * 1.10)})`);

  // ── 4: repeat kill pays a bounty ──
  const coins0 = await page.evaluate(() => window.__KN.hero.coins);
  await killBoss(page);
  const rep = await page.evaluate(() => ({ gained: window.__KN.relicGained, coins: window.__KN.hero.coins }));
  if (!rep.gained && rep.coins >= coins0 + 150) ok(`repeat kill pays a bounty (coins ${coins0}→${rep.coins})`);
  else bad(`repeat bounty wrong: ${JSON.stringify(rep)} vs coins0=${coins0}`);

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
