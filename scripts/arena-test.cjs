// During a wave the hero must be able to cross the screen: the arena wall
// sits near the RIGHT edge of the view, not at mid-screen. Checked on a
// desktop, a wide desktop and a phone, plus the end-of-stage boss arena.
const { chromium } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };

async function run(browser, label, viewport, bossWave) {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang', heroXp: {},
      upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {}, relics: {}, relicEq: {} })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const clickBtn = (re) => page.evaluate((src) =>
    [...document.querySelectorAll('button')].find(x => new RegExp(src).test(x.textContent)).click(), re);
  await clickBtn('Insert Coin'); await page.waitForTimeout(350);
  await clickBtn('Fight!'); await page.waitForTimeout(350);
  await clickBtn('March Out'); await page.waitForTimeout(900);
  await page.evaluate((boss) => {
    const g = window.__KN;
    g.hero.invuln = 999;
    if (boss) g.waveIdx = g.stage.waves.length - 1;
    const atX = g.stage.waves[g.waveIdx].atX;
    g.hero.x = atX - 6;
    g.camX = Math.max(0, Math.min(g.stage.width - window.innerWidth, g.hero.x - window.innerWidth * 0.42));
  }, bossWave);
  // hold right for a while: walk into the wave, then keep pushing at the wall
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' })));
  await page.waitForTimeout(4200);
  const r = await page.evaluate(() => {
    const g = window.__KN;
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
    return { active: g.waveActive, sx: g.hero.x - g.camX, W: window.innerWidth,
      heroX: g.hero.x, lock: g.waveLockX, width: g.stage.width };
  });
  const frac = r.sx / r.W;
  const need = r.W < 600 ? 0.55 : 0.7;
  if (r.active && frac >= need && r.sx <= r.W - 20)
    ok(`${label}: hero reaches ${Math.round(frac * 100)}% across the screen (wall near the right edge)`);
  else bad(`${label}: hero stuck at ${Math.round(frac * 100)}% — ${JSON.stringify(r)}`);
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 'desktop 1280', { width: 1280, height: 720 }, false);
  await run(browser, 'wide 1920', { width: 1920, height: 1000 }, false);
  await run(browser, 'phone 390', { width: 390, height: 780 }, false);
  await run(browser, 'boss arena 1280', { width: 1280, height: 720 }, true);
  await browser.close();
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length ? 1 : 0);
})();
