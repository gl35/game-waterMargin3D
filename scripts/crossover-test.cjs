// Red Chamber crossover end-to-end:
//  dream theme renders; petals fall; Baoyu/Daiyu stand in the garden and
//  speak on approach; the Mirror of Romance spawns + gates the wave and
//  shatters; the boss is the hero's own reflection with Jing Huan's line.
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass', 'magistrate_wall', 'hidden_court', 'red_chamber'], coins: 0, hero: 'songjiang' })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);
  await page.click('text=Dream of the Red Chamber');
  await page.waitForTimeout(200);
  await page.click('text=Fight!');
  await page.waitForTimeout(500);

  // story screen shows the crossover chapter
  const zh = await page.evaluate(() => document.querySelector('.kn-story-zh')?.textContent);
  if (zh === '太虚幻境') ok('story cutscene shows 太虚幻境'); else bad(`story title: ${zh}`);
  await page.screenshot({ path: 'rc-story.png' });
  await page.click('text=March Out');
  await page.waitForTimeout(1200);

  const world = await page.evaluate(() => {
    const g = window.__KN;
    return {
      npcs: g.actors.filter(a => a.static).map(a => a.name),
      petals: g.particles.filter(p => p.kind === 'petal').length,
    };
  });
  if (world.npcs.length === 2) ok(`garden NPCs present: ${world.npcs.join(', ')}`);
  else bad(`NPCs missing: ${JSON.stringify(world.npcs)}`);
  if (world.petals > 0) ok(`petals falling (${world.petals})`); else bad('no petals');

  // walk to Baoyu → proximity dialog
  await page.evaluate(() => {
    const g = window.__KN; g.hero.x = 700; g.camX = Math.max(0, 700 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
  await page.waitForTimeout(500);
  const spoke = await page.evaluate(() => {
    const g = window.__KN;
    return g.speech.some(s => s.name === 'Jia Baoyu');
  });
  if (spoke) ok('Baoyu speaks when approached'); else bad('Baoyu proximity dialog missing');
  await page.screenshot({ path: 'rc-baoyu.png' });

  // mirror wave (idx 2, atX 2000) — clear whatever wave the stroll triggered
  await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.length = 0; g.waveActive = false;
    g.waveIdx = 2; g.hero.x = 1995; g.hero.z = 100;
    g.camX = Math.max(0, 1995 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  const mirror = await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.forEach(e => { e.dead = true; e.deadT = g.time; });
    return g.gate ? { kind: g.gate.kind, hp: g.gate.hp } : null;
  });
  if (mirror && mirror.kind === 'mirror') ok(`Mirror of Romance spawned (hp ${mirror.hp})`);
  else bad(`no mirror: ${JSON.stringify(mirror)}`);
  await page.screenshot({ path: 'rc-mirror.png' });
  await page.evaluate(() => {
    const g = window.__KN;
    g.hero.x = g.gate.x - 80; g.hero.z = 100; g.hero.facing = 1; g.hero.atk = 200;
  });
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(150); }
  await page.waitForTimeout(700);
  const shattered = await page.evaluate(() => {
    const g = window.__KN;
    return { broken: g.gate.broken, objCur: g.objCur, waveActive: g.waveActive };
  });
  if (shattered.broken && shattered.objCur === 1) ok('mirror shattered → objective 1/2');
  else bad(`mirror break failed: ${JSON.stringify(shattered)}`);

  // boss: the hero's own reflection — clear residual wave state first
  await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.length = 0; g.waveActive = false;
    g.waveIdx = 7; g.hero.x = 5595; g.hero.z = 100;
    g.camX = Math.max(0, 5595 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
  await page.waitForTimeout(600);
  const boss = await page.evaluate(() => {
    const g = window.__KN;
    const b = g.enemies.find(e => e.boss && !e.dead);
    return b ? { name: b.name, sprite: b.sprite, heroSprite: g.heroDef.sprite } : null;
  });
  if (boss && boss.sprite === boss.heroSprite) ok(`boss is the hero's reflection (${boss.name}, ${boss.sprite})`);
  else bad(`phantom boss wrong: ${JSON.stringify(boss)}`);
  await page.waitForTimeout(1500);
  const jinghuan = await page.evaluate(() =>
    window.__KN.speech.some(s => (s.name || '').includes('Jing Huan')));
  if (jinghuan) ok("Jing Huan's voice speaks at the trial"); else bad('Jing Huan dialog missing');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'rc-boss.png' });

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
