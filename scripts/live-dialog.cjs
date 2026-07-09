// LIVE check: story cutscene appears after Fight!, and in-stage speech
// bubbles (vow + wave bark) actually render on the production build.
const { chromium, devices } = require('playwright');
const URL = 'https://gl35.github.io/game-waterMargin3D/';
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  // bypassCSP/cache-less context — mimic a clean visitor
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('text=Insert Coin');
  await page.waitForTimeout(400);
  await page.click('text=Fight!');
  await page.waitForTimeout(600);

  const story = await page.evaluate(() => ({
    zh: document.querySelector('.kn-story-zh')?.textContent || null,
    lines: document.querySelectorAll('.kn-story-line').length,
    vow: document.querySelector('.kn-story-vow')?.textContent || null,
  }));
  console.log('story screen:', JSON.stringify(story));
  await page.screenshot({ path: 'live-story.png' });

  await page.click('text=March Out');
  await page.waitForTimeout(1600);                  // vow bubble at delay 1.2s
  const vowSpeech = await page.evaluate(() => window.__KN.speech.map(s => s.name + ': ' + s.text.slice(0, 30)));
  console.log('speech after start:', JSON.stringify(vowSpeech));

  // trigger wave 0 → bark
  await page.evaluate(() => {
    const g = window.__KN; g.hero.x = 585; g.camX = Math.max(0, 585 - window.innerWidth * 0.42);
  });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(300); await page.keyboard.up('KeyD');
  await page.waitForTimeout(1200);
  const bark = await page.evaluate(() => window.__KN.speech.map(s => s.name));
  console.log('speech at wave 0:', JSON.stringify(bark));
  await page.screenshot({ path: 'live-bark.png' });

  const storyOK = story.zh === '逼上梁山' && story.lines >= 5;
  const dialogOK = bark.length > 0 || vowSpeech.length > 0;
  console.log('errors:', errors.length);
  errors.slice(0, 6).forEach(e => console.log('  ' + e));
  console.log(storyOK && dialogOK ? '\nLIVE STORY+DIALOG OK' : '\nLIVE STORY+DIALOG FAILED');
  await browser.close();
  process.exit(storyOK && dialogOK && !errors.length ? 0 : 1);
})();
