// Game-feel check: brawl through the first wave and verify the juice systems
// fire — particles spawn, screen-shake builds, combo counts, enemies enter a
// death tumble — then capture a mid-combat frame.
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
  await page.waitForTimeout(1200);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(300);
  await page.click('text=Fight!');
  await page.waitForTimeout(400);
  await page.click('text=March Out');
  await page.waitForTimeout(900);

  // Jump in front of wave 0 and crowd the raiders together for a fat combo.
  await page.evaluate(() => {
    const g = window.__KN;
    g.waveIdx = 0; g.hero.x = 595; g.hero.z = 100;
    g.camX = Math.max(0, 595 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(220);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const g = window.__KN;
    const live = g.enemies.filter(e => !e.dead);
    live.forEach((e, i) => { e.x = g.hero.x + 64 + i * 6; e.z = g.hero.z; e.hp = 30; });
    g.hero.facing = 1;
  });

  // Mash attack; sample peak juice metrics across the brawl.
  let maxParticles = 0, maxShake = 0, maxCombo = 0, sawDeath = false;
  let combatShot = false;
  for (let i = 0; i < 28; i++) {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(95);
    const s = await page.evaluate(() => {
      const g = window.__KN;
      return {
        parts: g.particles.length,
        shake: g.shake,
        combo: g.comboCount,
        dying: g.enemies.some(e => e.dead && e.deathFade < 1),
      };
    });
    maxParticles = Math.max(maxParticles, s.parts);
    maxShake = Math.max(maxShake, s.shake);
    maxCombo = Math.max(maxCombo, s.combo);
    if (s.dying) sawDeath = true;
    if (!combatShot && s.parts > 12) { await page.screenshot({ path: 'juice-combat.png' }); combatShot = true; }
  }
  if (!combatShot) await page.screenshot({ path: 'juice-combat.png' });

  if (maxParticles > 8) ok(`particles spawned (peak ${maxParticles} live)`);
  else bad(`few/no particles (peak ${maxParticles})`);
  if (maxShake > 0.1) ok(`screen-shake builds (peak trauma ${maxShake.toFixed(2)})`);
  else bad(`no screen-shake (peak ${maxShake.toFixed(2)})`);
  if (maxCombo >= 2) ok(`combo counter reached ${maxCombo}`);
  else bad(`combo never chained (max ${maxCombo})`);
  if (sawDeath) ok('enemies entered death-tumble (deathFade < 1)');
  else bad('never observed a death-tumble frame');

  // Ambient embers exist even when idle
  await page.waitForTimeout(600);
  const embers = await page.evaluate(() => window.__KN.particles.filter(p => p.kind === 'ember').length);
  if (embers > 0) ok(`ambient embers drifting (${embers} live)`);
  else bad('no ambient embers');

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
