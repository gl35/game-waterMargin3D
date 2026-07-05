// One-command redeploy to GitHub Pages.  Run:  npm run deploy
//
// Builds the game, keeps only the character sprites the game uses and
// downscales them (the source art is 1400-2400px but renders at ~150px), then
// force-pushes the site to the `gh-pages` branch served at
// https://gl35.github.io/game-waterMargin3D/.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

// The character art actually drawn in-game (see src/scene2d/sprites.js manifest).
const USED = [
  'npc_songjiang_and_liangshang_leaders.png', 'linchong.png', 'npc_小李广-花荣.png',
  'npc_黑旋风-李逵.png', 'npc_一丈青-扈三娘.png', 'npc_武松.png',
  'enemy_raider.png', 'enemy_scout.png', 'enemy_captain.png', 'enemy_berserker.png',
  'enemy_guard.png', 'enemy_archer.png', 'enemy_warlord.png',
  // Mission actors (cages / defend-the-rite)
  'npc_白日鼠-白胜.png', 'npc_拼命三郎-石秀.png', 'npc_智多星-吴用.png',
  // Red Chamber crossover (Baoyu / Daiyu stand-ins)
  'npc_白面郎君-郑天寿.png', 'npc_母夜叉-孙二娘.png',
];
const MAX_H = 640;   // source is scaled down at draw time; 640 keeps 2x crispness

async function optimizeSprites() {
  const spritesDir = path.join(dist, 'sprites');
  if (!fs.existsSync(spritesDir)) return;
  // Drop every sprite the game doesn't use (the folder is 600 MB+).
  for (const f of fs.readdirSync(spritesDir)) {
    if (!USED.includes(f)) fs.rmSync(path.join(spritesDir, f), { recursive: true, force: true });
  }
  // Downscale the survivors in a headless browser (keeps the checker background
  // intact so the game's runtime flood-fill still strips it cleanly).
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  let before = 0, after = 0;
  for (const f of USED) {
    const p = path.join(spritesDir, f);
    if (!fs.existsSync(p)) { console.log('  (missing) ' + f); continue; }
    before += fs.statSync(p).size;
    const b64 = fs.readFileSync(p).toString('base64');
    const out = await page.evaluate(async ({ b64, MAX_H }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
      const s = Math.min(1, MAX_H / img.height);
      const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/png');
    }, { b64, MAX_H });
    fs.writeFileSync(p, Buffer.from(out.split(',')[1], 'base64'));
    after += fs.statSync(p).size;
  }
  await browser.close();
  console.log(`  sprites ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB`);
}

(async () => {
  console.log('▶ building…');
  sh('npm run build', { cwd: root });

  console.log('▶ optimizing sprites…');
  await optimizeSprites();
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');       // serve /assets untouched
  fs.rmSync(path.join(dist, '.git'), { recursive: true, force: true });

  console.log('▶ publishing to gh-pages…');
  // schannel = use the Windows cert store (Git's bundled OpenSSL can't find a CA here)
  const git = (c) => sh(`git -c http.sslBackend=schannel ${c}`, { cwd: dist });
  git('init -q');
  git('checkout -q -b gh-pages');
  git('add -A');
  sh('git -c user.email="gene_li35@yahoo.com" -c user.name="gl35" commit -q -m "Deploy"', { cwd: dist });
  git('remote add origin https://github.com/gl35/game-waterMargin3D.git');
  git('push -f origin gh-pages');

  console.log('\n✅ Deployed → https://gl35.github.io/game-waterMargin3D/  (allow ~1 min for the CDN)');
})();
