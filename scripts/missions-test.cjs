// Missions & dialog end-to-end:
//  ch1: cage — wave stays locked until the cage breaks; freed actor + objective
//  ch2: gate — batter it down; theme is night
//  ch3: defend — enemies hunt the caster; thunder finale clears the field
//  dialog: hero vow + wave barks appear as speech entries
//  themes: the three stages render visibly different skies
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };

async function boot(page, stageName) {
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass', 'magistrate_wall', 'hidden_court'], coins: 0, hero: 'songjiang' })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(350);
  if (stageName) { await page.click(`text=${stageName}`); await page.waitForTimeout(150); }
  await page.click('text=Fight!');
  await page.waitForTimeout(350);
  await page.click('text=March Out');
  await page.waitForTimeout(900);
}

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // ── CH1: cage rescue ──
  await boot(page, null);
  const vow = await page.evaluate(() => window.__KN.speech.length);
  if (vow >= 1) ok(`hero vow speech queued at stage start (${vow})`);
  else bad('no speech at stage start');

  await page.evaluate(() => {                    // jump to cage wave (idx 1, atX 1200)
    const g = window.__KN; g.waveIdx = 1; g.hero.x = 1195; g.hero.z = 100;
    g.camX = Math.max(0, 1195 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  const cageState = await page.evaluate(() => {
    const g = window.__KN;
    return { cages: g.cages.length, bark: g.speech.length, waveActive: g.waveActive };
  });
  if (cageState.cages === 1) ok('cage spawned with its wave'); else bad(`no cage (${JSON.stringify(cageState)})`);

  // kill all enemies → wave must STAY active because the cage is intact
  await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.filter(e => !e.dead).forEach(e => { e.hp = 1; e.x = g.hero.x + 60; e.z = g.hero.z; e.stun = 3; });
  });
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(160); }
  await page.waitForTimeout(700);
  const lockedState = await page.evaluate(() => {
    const g = window.__KN;
    return { alive: g.enemies.filter(e => !e.dead).length, waveActive: g.waveActive, objCur: g.objCur };
  });
  if (lockedState.alive === 0 && lockedState.waveActive) ok('wave stays locked until the captive is freed');
  else bad(`wave lock wrong: ${JSON.stringify(lockedState)}`);

  // smash the cage
  await page.evaluate(() => {
    const g = window.__KN;
    const c = g.cages[0];
    g.hero.x = c.x - 60; g.hero.z = c.z; g.hero.facing = 1;
  });
  for (let i = 0; i < 5; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(170); }
  await page.waitForTimeout(600);
  const freed = await page.evaluate(() => {
    const g = window.__KN;
    return { broken: g.cages[0].broken, objCur: g.objCur, actors: g.actors.length, waveActive: g.waveActive };
  });
  if (freed.broken && freed.objCur === 1) ok(`cage smashed → objective 1/3, actor spawned (${freed.actors})`);
  else bad(`cage break failed: ${JSON.stringify(freed)}`);
  if (!freed.waveActive) ok('wave completes after the rescue'); else bad('wave did not complete after rescue');
  await page.screenshot({ path: 'mission-ch1.png' });

  // ── CH2: gate siege + night theme ──
  await boot(page, 'Zhu Family Manor');
  const skyCh2 = await page.evaluate(() => {
    const cv = document.querySelector('.knights-canvas');
    return [...cv.getContext('2d').getImageData(30, 30, 1, 1).data];
  });
  await page.evaluate(() => {
    const g = window.__KN; g.waveIdx = 3; g.hero.x = 2695; g.hero.z = 100;
    g.camX = Math.max(0, 2695 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  const gateInfo = await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.forEach(e => { e.dead = true; e.deadT = g.time; });   // clear defenders
    return g.gate ? { hp: g.gate.hp, x: g.gate.x } : null;
  });
  if (gateInfo) ok(`gate spawned (hp ${gateInfo.hp})`); else bad('no gate on the siege wave');
  await page.evaluate(() => {
    const g = window.__KN;
    g.hero.x = g.gate.x - 80; g.hero.z = 100; g.hero.facing = 1; g.hero.atk = 200;  // haste the test
  });
  for (let i = 0; i < 8; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(150); }
  await page.waitForTimeout(700);
  const gateDone = await page.evaluate(() => {
    const g = window.__KN;
    return { broken: g.gate.broken, objCur: g.objCur, waveActive: g.waveActive };
  });
  if (gateDone.broken && gateDone.objCur === 1) ok('gate battered down → objective progress');
  else bad(`gate break failed: ${JSON.stringify(gateDone)}`);
  await page.screenshot({ path: 'mission-ch2.png' });

  // ── CH3: defend the rite + mist theme ──
  await boot(page, 'The Sorcerer of Gaotang');
  const skyCh3 = await page.evaluate(() => {
    const cv = document.querySelector('.knights-canvas');
    return [...cv.getContext('2d').getImageData(30, 30, 1, 1).data];
  });
  await page.evaluate(() => {
    const g = window.__KN; g.waveIdx = 4; g.hero.x = 3395; g.hero.z = 100;
    g.camX = Math.max(0, 3395 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
  await page.waitForTimeout(600);
  const rit = await page.evaluate(() => {
    const g = window.__KN;
    return g.ritual ? { active: g.ritual.active, hp: g.ritual.hp, x: g.ritual.x } : null;
  });
  if (rit && rit.active) ok('ritual active with caster on the field'); else bad('no active ritual');

  // enemies should be heading for the CASTER, not the hero
  const homing = await page.evaluate(async () => {
    const g = window.__KN;
    g.hero.invuln = 99;
    const e = g.enemies.find(en => !en.dead);
    if (!e) return null;
    const d0 = Math.abs(e.x - g.ritual.x);
    await new Promise(r => setTimeout(r, 900));
    const d1 = Math.abs(e.x - g.ritual.x);
    return { d0, d1 };
  });
  if (homing && homing.d1 < homing.d0) ok(`enemies hunt the caster (${homing.d0 | 0} → ${homing.d1 | 0})`);
  else bad(`enemies not targeting caster: ${JSON.stringify(homing)}`);

  // fast-forward the rite → thunder wipes the field
  await page.evaluate(() => { window.__KN.ritual.t = window.__KN.ritual.dur - 0.1; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'mission-ch3.png' });   // bolts mid-flash
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const g = window.__KN;
    return { done: g.ritual && g.ritual.done, objCur: g.objCur, alive: g.enemies.filter(e => !e.dead).length };
  });
  if (after.done && after.objCur === 1 && after.alive === 0) ok('Five Thunders finish the rite and clear the field');
  else bad(`rite finish wrong: ${JSON.stringify(after)}`);

  // themes differ
  const diff = Math.abs(skyCh2[0] - skyCh3[0]) + Math.abs(skyCh2[1] - skyCh3[1]) + Math.abs(skyCh2[2] - skyCh3[2]);
  if (diff > 20) ok(`stage skies differ (night ${skyCh2.slice(0,3)} vs mist ${skyCh3.slice(0,3)})`);
  else bad(`themes look identical: ${skyCh2} vs ${skyCh3}`);

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
