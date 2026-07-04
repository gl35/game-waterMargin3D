// Animation polish check: capture mid-action frames for jump (sign fix),
// attack lunge, and dash afterimages. Verifies hero physically rises on a
// jump and that an attack pose lands a hit, plus no console errors.
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

  // ── JUMP: hero must RISE (h.y goes negative). Capture near apex. ──
  await page.keyboard.press('Space');
  let minY = 0, apexShot = false;
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(45);
    const y = await page.evaluate(() => window.__KN.hero.y);
    if (y < minY) minY = y;
    if (!apexShot && y < -60) { await page.screenshot({ path: 'polish-jump.png' }); apexShot = true; }
  }
  if (minY < -40) ok(`jump rises: hero.y reached ${minY.toFixed(0)} (negative = up)`);
  else bad(`jump did not rise: min hero.y was ${minY.toFixed(0)}`);
  if (!apexShot) await page.screenshot({ path: 'polish-jump.png' });
  await page.waitForTimeout(500);

  // ── ATTACK: place a frozen enemy in front, swing, expect a hit + pose ──
  await page.evaluate(() => {
    const g = window.__KN;
    g.waveIdx = 0; g.hero.x = 595; g.hero.z = 100;
    g.camX = Math.max(0, 595 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(220);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(300);
  const placed = await page.evaluate(() => {
    const g = window.__KN;
    const e = g.enemies.filter(x => !x.dead).sort((a, b) => Math.abs(a.x - g.hero.x) - Math.abs(b.x - g.hero.x))[0];
    if (!e) return null;
    e.x = g.hero.x + 70; e.z = g.hero.z; e.stun = 5; e.atkAnim = 0; // freeze in place
    g.hero.facing = 1;
    return { hp: e.hp, id: e.id };
  });
  if (!placed) { bad('no enemy spawned for attack test'); }
  else {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(75);            // mid-swing
    await page.screenshot({ path: 'polish-attack.png' });
    await page.waitForTimeout(160);
    const after = await page.evaluate((id) => {
      const e = window.__KN.enemies.find(x => x.id === id);
      return e ? e.hp : 0;
    }, placed.id);
    if (after < placed.hp) ok(`attack landed: enemy hp ${placed.hp} → ${after}`);
    else bad(`attack did not connect (hp stayed ${placed.hp})`);
  }

  // ── DASH: afterimages during the 0.25s dash window ──
  await page.evaluate(() => { window.__KN.hero.dashCdLeft = 0; });
  await page.keyboard.press('Shift');
  await page.waitForTimeout(110);
  const dashing = await page.evaluate(() => window.__KN.hero.dashing);
  await page.screenshot({ path: 'polish-dash.png' });
  if (dashing > 0) ok(`dash active (afterimages drawn), dashing=${dashing.toFixed(2)}`);
  else bad('dash not active when screenshotting');

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
