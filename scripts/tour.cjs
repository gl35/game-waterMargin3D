// Visual tour: storyline chapters, hero/stage select, a juicy combat frame,
// and the victory screen with its outro narrative.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

  // Unlock all rounds once (persists across reloads in this context).
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.setItem('knights_save_v1', JSON.stringify(
    { unlocked: ['mountain_pass', 'magistrate_wall', 'hidden_court'], coins: 0, hero: 'songjiang' })));

  async function toSelect() {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);
    await page.click('text=Insert Coin');
    await page.waitForTimeout(450);
  }
  async function viewStory(stageName, shot) {
    await page.click(`text=${stageName}`);
    await page.waitForTimeout(150);
    await page.click('text=Fight!');
    await page.waitForTimeout(2600);                 // all lines fade in
    await page.screenshot({ path: shot });
  }

  // Select screen
  await toSelect();
  await page.screenshot({ path: 'tour-select.png' });

  // Chapter 2 — 三打祝家庄
  await viewStory('Zhu Family Manor', 'tour-story-ch2.png');

  // Chapter 3 — 大破高唐州 (reload back to a clean select first)
  await toSelect();
  await page.click('text=The Sorcerer of Gaotang');
  await page.waitForTimeout(150);
  await page.click('text=Fight!');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'tour-story-ch3.png' });

  // March into the stage and stage a juicy brawl frame
  await page.click('text=March Out');
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const g = window.__KN;
    g.waveIdx = 1; g.hero.x = 1295; g.hero.z = 100;
    g.camX = Math.max(0, 1295 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(260); await page.keyboard.up('KeyD');
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const g = window.__KN;
    g.enemies.filter(e => !e.dead).forEach((e, i) => { e.x = g.hero.x + 60 + i * 10; e.z = g.hero.z; e.hp = 28; });
    g.hero.facing = 1; g.hero.invuln = 99;
  });
  let shot = false;
  for (let i = 0; i < 26; i++) {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(95);
    const parts = await page.evaluate(() => window.__KN.particles.length);
    if (!shot && parts > 14) { await page.screenshot({ path: 'tour-combat.png' }); shot = true; }
  }
  if (!shot) await page.screenshot({ path: 'tour-combat.png' });

  // Force a clear to reach the victory screen with its outro narrative
  await page.evaluate(() => { const g = window.__KN; g.waveActive = false; g.waveIdx = g.stage.waves.length; g.stageComplete = true; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tour-reward.png' });

  await browser.close();
  console.log('wrote tour-select / tour-story-ch2 / tour-story-ch3 / tour-combat / tour-reward');
})();
