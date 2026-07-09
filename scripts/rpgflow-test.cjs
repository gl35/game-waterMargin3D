// Full RPG flow: assemble a 3-hero party → story → overworld walk →
// encounter opens a turn-based battle → fight through it with Attack →
// victory returns to the overworld, resolves the cage mission, advances
// the wave, and persists XP for every party member on defeat.
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };

// Drive one full battle by repeatedly choosing Attack → first target.
async function winBattle(page, maxTurns = 60) {
  for (let i = 0; i < maxTurns; i++) {
    const state = await page.evaluate(() => ({
      inBattle: !!document.querySelector('.kn-battle'),
      menu: !!document.querySelector('.kn-btl-cmd.atk'),
      dialog: !!document.querySelector('.kn-btl-dialog'),
    }));
    if (!state.inBattle) return true;                  // returned to overworld
    if (state.dialog) { await page.click('.kn-btl-dialog'); await page.waitForTimeout(250); continue; }
    if (state.menu) {
      await page.click('.kn-btl-cmd.atk');
      await page.waitForTimeout(200);
      const tgt = await page.$('.kn-btl-cmd.tgt');
      if (tgt) await tgt.click();
      await page.waitForTimeout(950);                  // strike + enemy turns
    } else {
      await page.waitForTimeout(400);
    }
  }
  return !(await page.$('.kn-battle'));
}

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang',
      heroXp: {}, upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {}, relics: {}, relicEq: {} })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);

  // assemble a party of 3
  await page.click('.knights-hero-card:has-text("Spear of the Pine")');
  await page.waitForTimeout(150);
  await page.click('.knights-hero-card:has-text("Black Whirlwind")');
  await page.waitForTimeout(150);
  const badges = await page.evaluate(() => document.querySelectorAll('.kn-party-badge').length);
  if (badges === 3) ok('party of 3 assembled (badges shown)');
  else bad(`party badges: ${badges}`);
  await page.screenshot({ path: 'rpg-party.png' });

  await page.click('text=Fight!');
  await page.waitForTimeout(350);
  await page.click('text=March Out');
  await page.waitForTimeout(900);
  const party = await page.evaluate(() => window.__KN.party.map(m => m.id));
  if (party.length === 3 && party[0] === 'songjiang') ok(`party in stage: ${party.join(', ')}`);
  else bad(`party wrong: ${JSON.stringify(party)}`);

  // walk right into the first encounter line (x=600)
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2600);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(800);
  const inBattle = await page.evaluate(() => !!document.querySelector('.kn-battle'));
  if (inBattle) ok('crossing the wave line opened a turn-based battle');
  else { bad('battle did not open'); }
  await page.screenshot({ path: 'rpg-battle.png' });

  // battle intro (enemy bark) shows as dialog
  const hadDialog = await page.evaluate(() => !!document.querySelector('.kn-btl-dialog'));
  if (hadDialog) ok('battle opens with the enemy bark as dialog');
  else bad('no battle intro dialog');

  const won = await winBattle(page);
  if (won) ok('battle won via Attack commands');
  else bad('battle did not finish');
  await page.waitForTimeout(900);

  const after = await page.evaluate(() => ({
    screenStage: !!document.querySelector('.knights-canvas'),
    waveIdx: window.__KN.waveIdx,
    runXp: window.__KN.runXp,
    waveActive: window.__KN.waveActive,
  }));
  if (after.screenStage && after.waveIdx === 1 && !after.waveActive && after.runXp > 0)
    ok(`victory returned to overworld (wave→${after.waveIdx}, +${after.runXp} xp)`);
  else bad(`post-battle state wrong: ${JSON.stringify(after)}`);

  // cage wave (idx 1 at x=1200): battle then auto-rescue
  await page.evaluate(() => {
    const g = window.__KN; g.hero.x = 1180; g.camX = Math.max(0, 1180 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  await page.waitForTimeout(800);
  const cageThere = await page.evaluate(() => window.__KN.cages.length === 1);
  if (cageThere) ok('cage spawned with its encounter'); else bad('no cage');
  const won2 = await winBattle(page);
  await page.waitForTimeout(1400);
  const rescued = await page.evaluate(() => ({
    broken: window.__KN.cages[0] && window.__KN.cages[0].broken,
    obj: window.__KN.objCur,
  }));
  if (won2 && rescued.broken && rescued.obj === 1) ok('victory freed the caged villager (objective 1/3)');
  else bad(`rescue failed: ${JSON.stringify(rescued)}`);
  await page.screenshot({ path: 'rpg-rescue.png' });

  // defeat keeps XP for ALL party members
  await page.evaluate(() => {
    const g = window.__KN;
    g.party.forEach(m => { m.hp = 1; });
    g.hero.x = 1780; g.camX = Math.max(0, 1780 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  await page.waitForTimeout(800);
  // defend until wiped
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => ({
      over: !document.querySelector('.kn-battle'),
      menu: !!document.querySelector('.kn-btl-cmd.def'),
      dialog: !!document.querySelector('.kn-btl-dialog'),
    }));
    if (s.over) break;
    if (s.dialog) { await page.click('.kn-btl-dialog'); await page.waitForTimeout(200); continue; }
    if (s.menu) { await page.click('.kn-btl-cmd.def'); }
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1200);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('knights_save_v1')));
  const allKept = ['songjiang', 'linchong', 'likui'].every(id => (saved.heroXp[id] || 0) > 0);
  const onGameover = await page.evaluate(() => document.body.innerText.includes('Continue?'));
  if (onGameover && allKept) ok(`defeat keeps XP for all 3 members (${JSON.stringify(saved.heroXp)})`);
  else bad(`defeat persist wrong: gameover=${onGameover} xp=${JSON.stringify(saved.heroXp)}`);

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
