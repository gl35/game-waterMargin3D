// One-command redeploy to GitHub Pages.  Run:  npm run deploy
//
// Builds the game, strips the large unused sprite art from the output, and
// force-pushes the built site to the `gh-pages` branch that GitHub Pages
// serves at https://gl35.github.io/game-waterMargin3D/.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

console.log('▶ building…');
sh('npm run build', { cwd: root });

// The heroes/enemies are procedural now — the /sprites art (600 MB+) is dead
// weight in the deploy, so drop it before publishing.
fs.rmSync(path.join(dist, 'sprites'), { recursive: true, force: true });
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
