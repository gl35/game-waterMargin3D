// Story + telegraph check:
//  1. Fight! → story cutscene shows the right chapter / 逼上梁山 / prologue
//  2. March Out → stage begins
//  3. enemies telegraph (windup ring) before striking; standing still = hit
//  4. dodging out of the danger zone during the wind-up makes the blow whiff
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

  // ── Story cutscene ──
  await page.click('text=Insert Coin');
  await page.waitForTimeout(300);
  await page.click('text=Fight!');
  await page.waitForTimeout(500);
  const story = await page.evaluate(() => {
    const zh = document.querySelector('.kn-story-zh');
    const chap = document.querySelector('.kn-story-chapter');
    const lines = [...document.querySelectorAll('.kn-story-line')].map(e => e.textContent);
    return {
      zh: zh && zh.textContent, chap: chap && chap.textContent,
      count: lines.length,
      hasPrologue: lines.some(l => l.includes('替天行道')),
    };
  });
  if (story.zh === '逼上梁山') ok(`story title shows 逼上梁山 (${story.chap})`);
  else bad(`story title wrong: ${JSON.stringify(story)}`);
  if (story.hasPrologue && story.count >= 5) ok(`prologue + intro rendered (${story.count} lines)`);
  else bad(`story lines missing (count ${story.count}, prologue ${story.hasPrologue})`);
  await page.screenshot({ path: 'story-intro.png' });

  await page.click('text=March Out');
  await page.waitForTimeout(900);
  const started = await page.evaluate(() => !!window.__KN);
  if (started) ok('March Out begins the stage'); else bad('stage did not start');

  // ── Telegraph: stand still, take the hit ──
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
    g.enemies = live.slice(0, 1);                 // keep ONE enemy
    const e = g.enemies[0];
    e.x = g.hero.x + 60; e.z = g.hero.z; e.stun = 0; e.windup = 0; e.atkCdLeft = 0.1;
    g.hero.invuln = 0; g.hero.hp = g.hero.hpMax;
  });
  let sawWindup = false, hpStart = 0, hpStill = 0;
  hpStart = await page.evaluate(() => window.__KN.hero.hp);
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(60);
    const s = await page.evaluate(() => {
      const g = window.__KN;
      return { w: g.enemies[0] ? g.enemies[0].windup : 0, hp: g.hero.hp };
    });
    if (s.w > 0) sawWindup = true;
    hpStill = s.hp;
    if (s.hp < hpStart) break;
  }
  if (sawWindup) ok('enemy telegraphs a wind-up before striking');
  else bad('no wind-up observed before the strike');
  if (hpStill < hpStart) ok(`standing in range took the hit (${hpStart}→${hpStill})`);
  else bad('strike never connected on a still target');

  // ── Dodge: leave the danger zone during the wind-up → whiff ──
  const dodged = await page.evaluate(async () => {
    const g = window.__KN;
    const e = g.enemies[0];
    if (!e) return 'no-enemy';
    g.hero.hp = g.hero.hpMax; g.hero.invuln = 0;
    e.x = g.hero.x + 60; e.z = g.hero.z; e.stun = 0; e.windup = 0; e.atkCdLeft = 0;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    // wait for a fresh wind-up to begin
    for (let i = 0; i < 60 && e.windup <= 0; i++) await sleep(30);
    if (e.windup <= 0) return 'no-windup';
    const hpAtWindup = g.hero.hp;
    g.hero.z = 0;                                  // dodge far in depth (dz=100 > 46)
    // wait for the wind-up to resolve
    for (let i = 0; i < 40 && e.windup > 0; i++) await sleep(30);
    await sleep(120);
    return g.hero.hp >= hpAtWindup ? 'whiffed' : 'hit-anyway';
  });
  if (dodged === 'whiffed') ok('dodging during the wind-up makes the blow whiff');
  else bad(`dodge failed: ${dodged}`);

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
