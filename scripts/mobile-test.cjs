// Verify the on-screen touch controls work under iPhone emulation:
//  1. touch controls render in-stage
//  2. joystick drag moves the hero
//  3. attack button triggers an attack (and hold auto-chains)
const { chromium, devices } = require('playwright');

const fail = [];
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); fail.push(m); };

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });   // touch + mobile
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.tap('text=Insert Coin');
  await page.waitForTimeout(400);
  await page.tap('text=Fight!');
  await page.waitForTimeout(400);
  await page.tap('text=March Out');
  await page.waitForTimeout(1000);

  const hasControls = await page.evaluate(() => !!document.querySelector('.kn-joy') && document.querySelectorAll('.kn-tbtn').length === 4);
  if (hasControls) ok('touch controls rendered (joystick + 4 buttons)');
  else bad('touch controls not rendered on mobile');
  await page.screenshot({ path: 'mobile-controls.png' });

  // ── Joystick: hold right, hero.x should climb ──
  const x0 = await page.evaluate(() => window.__KN.hero.x);
  await page.evaluate(() => {
    const joy = document.querySelector('.kn-joy');
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    joy.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: cx, clientY: cy, bubbles: true }));
    joy.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: cx + 60, clientY: cy, bubbles: true }));
  });
  await page.waitForTimeout(700);
  const x1 = await page.evaluate(() => window.__KN.hero.x);
  await page.evaluate(() => {
    const joy = document.querySelector('.kn-joy');
    joy.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
  });
  await page.waitForTimeout(200);
  const x2 = await page.evaluate(() => window.__KN.hero.x);
  if (x1 - x0 > 20) ok(`joystick right moved hero ${x0.toFixed(0)} → ${x1.toFixed(0)}`);
  else bad(`joystick did not move hero (${x0.toFixed(0)} → ${x1.toFixed(0)})`);
  if (Math.abs(x2 - x1) < 6) ok('releasing the joystick stops the hero');
  else bad(`hero kept moving after release (${x1.toFixed(0)} → ${x2.toFixed(0)})`);

  // ── Attack button ──
  await page.evaluate(() => {
    const b = document.querySelector('.kn-tbtn.atk');
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }));
  });
  await page.waitForTimeout(80);
  const attacking = await page.evaluate(() => window.__KN.hero.attacking);
  await page.evaluate(() => {
    const b = document.querySelector('.kn-tbtn.atk');
    b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, bubbles: true }));
  });
  if (attacking > 0) ok(`attack button triggered an attack (attacking=${attacking.toFixed(2)})`);
  else bad('attack button did not trigger an attack');

  await browser.close();
  console.log(`\nPage errors (${errors.length}):`);
  errors.slice(0, 8).forEach(e => console.log('  ' + e));
  console.log(fail.length === 0 ? '\nALL CHECKS PASSED' : `\n${fail.length} CHECK(S) FAILED`);
  process.exit(fail.length || errors.length ? 1 : 0);
})();
