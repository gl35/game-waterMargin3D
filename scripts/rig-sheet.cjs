// Contact sheet of the cut-out rig in motion: for each hero, a row of walk
// frames and a row of attack frames, captured straight from the game canvas.
// usage: node scripts/rig-sheet.cjs [outDir] [heroId ...]
const { chromium } = require('playwright');
const fs = require('fs');
const outDir = process.argv[2] || '.';
const ALL = ['songjiang', 'linchong', 'wusong', 'huarong', 'husanniang', 'likui'];
const heroes = process.argv.length > 3 ? process.argv.slice(3) : ALL;

(async () => {
  const errors = [];
  const b = await chromium.launch();
  for (const hero of heroes) {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto('http://localhost:5173', { waitUntil: 'load' });
    await p.evaluate((h) => localStorage.setItem('knights_save_v1', JSON.stringify(
      { unlocked: ['mountain_pass'], coins: 0, hero: h, heroXp: { [h]: 6000 },
        upgrades: { atk: 0, hp: 0, fortune: 0 }, pot: {}, charms: {}, relics: {}, relicEq: {} })), hero);
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(2600);
    const click = (re) => p.evaluate((src) =>
      [...document.querySelectorAll('button')].find(x => new RegExp(src).test(x.textContent)).click(), re);
    await click('Insert Coin'); await p.waitForTimeout(350);
    await p.evaluate((i) => document.querySelectorAll('.knights-hero-card')[i].click(), ALL.indexOf(hero));
    await p.waitForTimeout(200);
    await click('Fight!'); await p.waitForTimeout(350);
    await click('March Out'); await p.waitForTimeout(1500);
    const url = await p.evaluate(async () => {
      const g = window.__KN;
      const cv = document.querySelector('.knights-canvas');
      const dpr = cv.width / window.innerWidth;
      const TW = 230, TH = 250, COLS = 8;
      const sheet = document.createElement('canvas');
      sheet.width = TW * COLS; sheet.height = TH * 3;
      const sc = sheet.getContext('2d');
      sc.fillStyle = '#1a120c'; sc.fillRect(0, 0, sheet.width, sheet.height);
      const frame = () => new Promise(r => requestAnimationFrame(r));
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const grab = (col, row) => {
        const hx = (g.hero.x - g.camX) * dpr;
        const fy = cv.height * (0.30 + 0.62 * (g.hero.z / 200));
        sc.drawImage(cv, hx - TW * dpr / 2, fy - (TH - 30) * dpr, TW * dpr, TH * dpr, col * TW, row * TH, TW, TH);
      };
      const key = (type, k) => window.dispatchEvent(new KeyboardEvent(type, { key: k }));
      // row 0: walking
      key('keydown', 'd'); await sleep(350);
      for (let i = 0; i < COLS; i++) { await sleep(46); await frame(); grab(i, 0); }
      key('keyup', 'd'); await sleep(500);
      // row 1: idle, then the opening attack frame by frame
      grab(0, 1);
      key('keydown', 'j');
      for (let i = 1; i < COLS; i++) { await frame(); await frame(); grab(i, 1); }
      await sleep(700);
      // row 2: taking a hit, then a dash
      g.hero.hitFlash = 0.4;
      for (let i = 0; i < 3; i++) { await sleep(40); await frame(); grab(i, 2); }
      await sleep(500);
      key('keydown', 'shift');
      for (let i = 3; i < 6; i++) { await sleep(40); await frame(); grab(i, 2); }
      await sleep(500);
      key('keydown', 'k');
      for (let i = 6; i < 8; i++) { await sleep(110); await frame(); grab(i, 2); }
      return sheet.toDataURL('image/png');
    });
    fs.writeFileSync(`${outDir}/rig-${hero}.png`, Buffer.from(url.split(',')[1], 'base64'));
    const info = await p.evaluate(() => 0);
    console.log('wrote', `rig-${hero}.png`, info === 0 ? '' : info);
    await p.close();
  }
  await b.close();
  console.log('errors:', errors.length, errors.slice(0, 4));
})();
