// ── Articulated procedural fighter ──
// A real skeleton (torso, head, two legs with knees, two arms with elbows, a
// weapon hand) posed per-frame so limbs and the weapon ARM actually move —
// the static AI portraits could only slide around as a whole.
//
// Local space: feet at origin, +y UP, faces RIGHT. drawFighter applies the
// facing flip + scale, so callers just give a foot point and a state.

const D = Math.PI / 180;
const OUTLINE = '#160f08';
export const BASE_SCALE = 1.5;   // on-screen size multiplier (body ≈ 96px * this)
export const FIGHTER_H = 96;     // nominal body height at scale 1

// Body proportions (px at scale 1 ≈ 96 tall).
const P = {
  hipY: 42, chestY: 73, shoulderY: 71, neckY: 75, headY: 87, headR: 10,
  thigh: 22, shin: 21, upper: 18, fore: 16,
  hipW: 6, shoulderW: 9,
};

// ── Visual builds: palette + weapon + scale per character ──
const mk = (robe, robe2, skin, hair, metal, weapon, extra = {}) =>
  ({ robe, robe2, skin, hair, metal, weapon, scale: 1, ...extra });

export const BUILDS = {
  // Heroes
  songjiang:  mk('#c0392b', '#7b1f17', '#e8b88a', '#1a1a1a', '#ffd676', 'sword', { hat: 'official' }),
  linchong:   mk('#3a6ea5', '#22436a', '#e8b88a', '#1a1a1a', '#cfe0ff', 'spear', { hat: 'helm' }),
  wusong:     mk('#9c5a2c', '#6a3a18', '#e8b88a', '#241a12', '#caa', 'staff', { hat: 'band' }),
  huarong:    mk('#3a8a4d', '#246030', '#e8b88a', '#1a1a1a', '#caffaa', 'bow',  { hat: 'helm' }),
  husanniang: mk('#c84e92', '#8a2f60', '#f0c89a', '#241018', '#ffd6ec', 'twin', { hair: 'long' }),
  likui:      mk('#3a3a3a', '#1f1f1f', '#caa07a', '#0a0a0a', '#888', 'axe',   { hat: 'wild', burly: true }),
  // Enemies
  raider:     mk('#a05a3a', '#6a3520', '#d8a87a', '#241a12', '#9a8', 'club',   { hat: 'helm' }),
  scout:      mk('#6a6a5a', '#3a3a30', '#d8a87a', '#1a1a1a', '#aaa', 'dagger', { hat: 'hood' }),
  archer:     mk('#5a7a4a', '#36502c', '#d8a87a', '#241a12', '#caffaa', 'bow', { hat: 'hood' }),
  brute:      mk('#a04030', '#6a2418', '#d89a72', '#1a1a1a', '#888', 'club',   { scale: 1.18, burly: true }),
  guard:      mk('#6a6a72', '#3a3a40', '#d8a87a', '#1a1a1a', '#bbb', 'halberd',{ hat: 'helm', scale: 1.08 }),
  captain:    mk('#933', '#5a1818', '#d8a87a', '#1a1a1a', '#ffd676', 'sword',  { hat: 'helm', scale: 1.3, burly: true }),
  warlord:    mk('#511', '#2a0a0a', '#d89a72', '#1a1a1a', '#caa', 'halberd',   { hat: 'helm', scale: 1.42, burly: true }),
  sorcerer:   mk('#5a2a8a', '#341858', '#d8c0a0', '#cfcfe0', '#c9a0ff', 'staff',{ hat: 'crown', scale: 1.3 }),
};

export const getBuild = (key) => BUILDS[key];

// Map a move + weapon to a swing style.
export function attackKindFor(move, weapon) {
  if (move) {
    if (move.projectile) return 'bow';
    if (move.launches) return 'upcut';
    if (move.aoe || move.downward) return 'overhead';
    if (move.pierces) return 'thrust';
  }
  if (weapon === 'spear' || weapon === 'halberd') return 'thrust';
  if (weapon === 'bow') return 'bow';
  if (weapon === 'axe' || weapon === 'club') return 'overhead';
  return 'swing';
}

// ── Pose: all joint angles (rad, measured from straight-DOWN, + = forward) ──
function basePose() {
  return {
    spine: 6 * D, head: 0, bob: 0,
    hipB: -10 * D, kneeB: 8 * D, hipF: 12 * D, kneeF: 6 * D,
    shB: 18 * D, elB: 14 * D,
    shF: -16 * D, elF: 16 * D,
    // weapon hand extra reach/none
    reach: 0,
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function poseFor(action, st) {
  const p = basePose();
  const t = st.t || 0;
  switch (action) {
    case 'idle': {
      const b = Math.sin(t * 2.0);
      p.spine = 6 * D + b * 1.5 * D;
      p.shF = -14 * D + b * 3 * D;
      p.shB = 16 * D - b * 3 * D;
      p.bob = b * 0.8;
      p.head = -b * 1 * D;
      break;
    }
    case 'walk': {
      const ph = st.phase || 0;
      const s = Math.sin(ph), c = Math.cos(ph);
      p.hipF = 26 * D * s;
      p.hipB = -26 * D * s;
      p.kneeF = 10 * D + Math.max(0, -s) * 34 * D;   // bend trailing/lifting leg
      p.kneeB = 10 * D + Math.max(0, s) * 34 * D;
      p.shF = -18 * D * s - 6 * D;                    // arms counter-swing legs
      p.shB = 18 * D * s + 6 * D;
      p.elF = 18 * D; p.elB = 16 * D;
      p.spine = 9 * D;
      p.bob = Math.abs(c) * 1.4;
      break;
    }
    case 'attack': {
      const pr = st.attackP || 0;
      const k = st.attackKind || 'swing';
      attackPose(p, pr, k);
      break;
    }
    case 'cast': {
      const pr = st.attackP || 0;
      const up = Math.sin(Math.min(1, pr * 1.4) * Math.PI);
      p.shF = lerp(-16 * D, -150 * D, up);
      p.shB = lerp(16 * D, -150 * D, up);
      p.elF = lerp(16 * D, 30 * D, up);
      p.elB = lerp(14 * D, 30 * D, up);
      p.spine = lerp(6 * D, -8 * D, up);
      p.bob = up * 3;
      break;
    }
    case 'jump': {
      const k = st.jumpK || 0;                        // +1 rising, -1 falling
      const tuck = k > 0 ? 0.6 : 1;
      p.hipF = 34 * D * tuck; p.kneeF = 50 * D * tuck;
      p.hipB = 14 * D * tuck; p.kneeB = 64 * D * tuck;
      p.shF = -40 * D; p.shB = 30 * D;
      p.spine = 4 * D;
      break;
    }
    case 'dash': {
      p.spine = 30 * D;
      p.hipF = 38 * D; p.kneeF = 20 * D;
      p.hipB = -34 * D; p.kneeB = 40 * D;
      p.shF = 30 * D; p.shB = 44 * D; p.elF = 20 * D;
      p.head = 8 * D;
      break;
    }
    case 'hurt': {
      p.spine = -22 * D;
      p.head = -16 * D;
      p.shF = -40 * D; p.shB = -36 * D; p.elF = 50 * D; p.elB = 50 * D;
      p.hipB = -30 * D; p.kneeB = 30 * D;
      p.bob = 1;
      break;
    }
  }
  return p;
}

function attackPose(p, pr, kind) {
  // Three beats: wind-up (0-0.3), strike (0.3-0.6), recover (0.6-1).
  const windup = Math.min(1, pr / 0.3);
  const strike = pr < 0.3 ? 0 : Math.min(1, (pr - 0.3) / 0.3);
  const recover = pr < 0.6 ? 0 : (pr - 0.6) / 0.4;
  const sw = ease(strike) * (1 - recover);          // 0→1→0 strike envelope
  const wu = windup * (1 - strike);                 // wind-up that fades as strike begins

  if (kind === 'thrust') {
    p.shF = lerp(-16 * D, -34 * D, wu) ;
    p.elF = lerp(16 * D, 86 * D, wu);
    // strike: arm shoots straight forward
    p.shF = lerp(p.shF, 84 * D, sw);
    p.elF = lerp(p.elF, 2 * D, sw);
    p.spine = lerp(6 * D, 22 * D, sw);
    p.hipF = 30 * D * sw + 8 * D;
    p.reach = sw * 6;
  } else if (kind === 'bow') {
    // hold bow forward, draw string back with the OTHER arm, release
    p.shF = 86 * D; p.elF = 6 * D;                   // bow arm forward, steady
    p.shB = lerp(40 * D, 74 * D, wu);                // draw back
    p.elB = lerp(20 * D, 86 * D, wu);
    p.shB = lerp(p.shB, 50 * D, sw);                 // snap forward on release
    p.elB = lerp(p.elB, 30 * D, sw);
    p.spine = 8 * D;
  } else if (kind === 'overhead') {
    p.shF = lerp(-16 * D, -158 * D, wu);             // raise weapon high overhead
    p.elF = lerp(16 * D, 40 * D, wu);
    p.spine = lerp(6 * D, -14 * D, wu);
    p.shF = lerp(p.shF, 96 * D, sw);                 // chop straight down-front
    p.elF = lerp(p.elF, 14 * D, sw);
    p.spine = lerp(p.spine, 30 * D, sw);
    p.hipF = 24 * D * sw + 8 * D;
    p.bob = -sw * 3;
  } else if (kind === 'upcut') {
    p.shF = lerp(-16 * D, 40 * D, wu);               // load low
    p.elF = lerp(16 * D, 50 * D, wu);
    p.spine = lerp(6 * D, 16 * D, wu);
    p.shF = lerp(p.shF, -120 * D, sw);               // swing UP
    p.elF = lerp(p.elF, 8 * D, sw);
    p.spine = lerp(p.spine, -10 * D, sw);
    p.bob = sw * 3;
  } else {                                           // 'swing' — horizontal slash
    p.shF = lerp(-16 * D, -120 * D, wu);             // cock back & up
    p.elF = lerp(16 * D, 64 * D, wu);
    p.spine = lerp(6 * D, -10 * D, wu);
    p.shF = lerp(p.shF, 76 * D, sw);                 // sweep forward & down
    p.elF = lerp(p.elF, 12 * D, sw);
    p.spine = lerp(p.spine, 20 * D, sw);
    p.hipF = 26 * D * sw + 8 * D;
  }
  // off-hand braces during melee
  if (kind !== 'bow') { p.shB = lerp(18 * D, 40 * D, sw); p.elB = 30 * D; }
}

// FK: point at angle `ang` (from down, +forward) and length from (x,y).
function fk(x, y, len, ang) { return [x + Math.sin(ang) * len, y - Math.cos(ang) * len]; }

function bone(ctx, x1, y1, x2, y2, w, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = w + 3;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = OUTLINE; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
}

function drawWeapon(ctx, weapon, hx, hy, ang, b, st) {
  const m = b.metal, wood = '#6a4a2a';
  const tip = (len) => fk(hx, hy, len, ang);
  if (weapon === 'sword' || weapon === 'dagger') {
    const L = weapon === 'dagger' ? 16 : 30;
    const [ex, ey] = tip(L);
    // guard
    const [gx, gy] = fk(hx, hy, 5, ang + 90 * D);
    const [gx2, gy2] = fk(hx, hy, 5, ang - 90 * D);
    bone(ctx, gx, gy, gx2, gy2, 4, m);
    bone(ctx, hx, hy, ex, ey, weapon === 'dagger' ? 4 : 5, m);
  } else if (weapon === 'spear' || weapon === 'halberd') {
    const [bx, by] = fk(hx, hy, -22, ang);           // butt behind hand
    const [ex, ey] = tip(weapon === 'halberd' ? 46 : 56);
    bone(ctx, bx, by, ex, ey, 4, wood);
    const [tx, ty] = tip(weapon === 'halberd' ? 60 : 70);
    bone(ctx, ex, ey, tx, ty, 5, m);                 // blade tip
    if (weapon === 'halberd') {                      // crescent
      const [cx, cy] = fk(ex, ey, 12, ang + 70 * D);
      bone(ctx, ex, ey, cx, cy, 4, m);
    }
  } else if (weapon === 'staff') {
    const [bx, by] = fk(hx, hy, -34, ang);
    const [ex, ey] = tip(36);
    bone(ctx, bx, by, ex, ey, 5, wood);
    dot(ctx, ex, ey, 5, m);                          // pommel / orb
    if (b.weapon === 'staff' && st && st.cast) dot(ctx, ex, ey, 8, m);
  } else if (weapon === 'axe' || weapon === 'club') {
    const [ex, ey] = tip(26);
    bone(ctx, hx, hy, ex, ey, 5, wood);
    if (weapon === 'axe') {
      const [a1x, a1y] = fk(ex, ey, 11, ang + 60 * D);
      const [a2x, a2y] = fk(ex, ey, 11, ang - 60 * D);
      bone(ctx, ex, ey, a1x, a1y, 7, m);
      bone(ctx, ex, ey, a2x, a2y, 7, m);
    } else {
      dot(ctx, ex, ey, 7, m);
    }
  } else if (weapon === 'twin') {
    const [ex, ey] = tip(22);
    bone(ctx, hx, hy, ex, ey, 4, b.metal);
  }
}

function drawBow(ctx, hx, hy, ang, b, drawn) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-(ang));                                 // align bow across the arm
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, 17, -1.1, 1.1); ctx.stroke();
  ctx.strokeStyle = b.metal; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 17, -1.1, 1.1); ctx.stroke();
  // string
  const sx = Math.cos(-1.1) * 17, sy = Math.sin(-1.1) * 17;
  const ex = Math.cos(1.1) * 17, ey = Math.sin(1.1) * 17;
  const pull = drawn ? -9 : -2;
  ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(pull, 0); ctx.lineTo(ex, ey); ctx.stroke();
  if (drawn) { ctx.strokeStyle = '#caffaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pull, 0); ctx.lineTo(18, 0); ctx.stroke(); }
  ctx.restore();
}

// Draw the fighter. st: { action, t, phase, attackP, attackKind, jumpK, facing, alpha }
export function drawFighter(ctx, build, st) {
  if (!build) return false;
  const facing = st.facing >= 0 ? 1 : -1;
  const s = (build.scale || 1) * BASE_SCALE;
  const pose = poseFor(st.action || 'idle', st);
  const a = st.alpha == null ? 1 : st.alpha;

  ctx.save();
  if (a !== 1) ctx.globalAlpha = a;
  ctx.scale(facing * s, -s);                          // local: +y up, +x forward
  ctx.translate(0, pose.bob);

  const torsoW = build.burly ? 16 : 13;
  // Pelvis & shoulders
  const hipX = 0, hipY = P.hipY;
  const shoulderX = Math.sin(pose.spine) * (P.shoulderY - P.hipY);
  const shoulderY = P.hipY + Math.cos(pose.spine) * (P.shoulderY - P.hipY);

  // ── Back limbs (behind torso) ──
  const [bkneeX, bkneeY] = fk(hipX - P.hipW, hipY, P.thigh, pose.hipB);
  const [bfootX, bfootY] = fk(bkneeX, bkneeY, P.shin, pose.hipB + pose.kneeB);
  bone(ctx, hipX - P.hipW, hipY, bkneeX, bkneeY, 7, build.robe2);
  bone(ctx, bkneeX, bkneeY, bfootX, bfootY, 6, build.robe2);
  dot(ctx, bfootX, bfootY - 1, 3.5, build.metal);

  const bShX = shoulderX - P.shoulderW, bShY = shoulderY;
  const [belbX, belbY] = fk(bShX, bShY, P.upper, pose.shB);
  const [bhandX, bhandY] = fk(belbX, belbY, P.fore, pose.shB + pose.elB);
  bone(ctx, bShX, bShY, belbX, belbY, 6, build.robe2);
  bone(ctx, belbX, belbY, bhandX, bhandY, 5, build.robe2);
  dot(ctx, bhandX, bhandY, 3.5, build.skin);
  if (build.weapon === 'twin') drawWeapon(ctx, 'twin', bhandX, bhandY, pose.shB + pose.elB + 30 * D, build, st);
  if (build.weapon === 'bow' && st.action === 'attack' && st.attackKind === 'bow') {
    // back hand draws the string — drawn near bow center; arrow handled by bow arm
  }

  // ── Torso (robe) ──
  ctx.fillStyle = OUTLINE;
  roundTorso(ctx, hipX, hipY, shoulderX, shoulderY, torsoW + 3, P.hipW + 2);
  ctx.fillStyle = build.robe;
  roundTorso(ctx, hipX, hipY, shoulderX, shoulderY, torsoW, P.hipW);
  // sash
  ctx.strokeStyle = build.metal; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-torsoW / 2, hipY + 6); ctx.lineTo(torsoW / 2, hipY + 4); ctx.stroke();

  // ── Head ──
  const neckX = shoulderX + Math.sin(pose.spine + pose.head) * (P.headY - P.shoulderY);
  const headCx = shoulderX + Math.sin(pose.spine + pose.head) * (P.headY - P.shoulderY);
  const headCy = shoulderY + Math.cos(pose.spine + pose.head) * (P.headY - P.shoulderY);
  bone(ctx, shoulderX, shoulderY, neckX, shoulderY + 4, 7, build.skin);
  dot(ctx, headCx, headCy, P.headR, build.skin);
  drawHair(ctx, headCx, headCy, build, facing);

  // ── Front leg ──
  const [fkneeX, fkneeY] = fk(hipX + P.hipW, hipY, P.thigh, pose.hipF);
  const [ffootX, ffootY] = fk(fkneeX, fkneeY, P.shin, pose.hipF + pose.kneeF);
  bone(ctx, hipX + P.hipW, hipY, fkneeX, fkneeY, 8, build.robe);
  bone(ctx, fkneeX, fkneeY, ffootX, ffootY, 7, build.robe);
  dot(ctx, ffootX, ffootY - 1, 4, build.metal);

  // ── Front (weapon) arm ──
  const fShX = shoulderX + P.shoulderW, fShY = shoulderY;
  const reach = pose.reach || 0;
  const [felbX, felbY] = fk(fShX, fShY, P.upper + reach, pose.shF);
  const handAng = pose.shF + pose.elF;
  const [fhandX, fhandY] = fk(felbX, felbY, P.fore, handAng);
  bone(ctx, fShX, fShY, felbX, felbY, 7, build.robe);
  bone(ctx, felbX, felbY, fhandX, fhandY, 6, build.skin);
  dot(ctx, fhandX, fhandY, 4, build.skin);
  if (build.weapon === 'bow') {
    drawBow(ctx, fhandX, fhandY, handAng, build, st.action === 'attack' && st.attackKind === 'bow');
  } else {
    drawWeapon(ctx, build.weapon, fhandX, fhandY, handAng, build, st);
  }

  ctx.restore();
  return true;
}

function roundTorso(ctx, hx, hy, sx, sy, topW, botW) {
  const dx = sx - hx, dy = sy - hy, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(hx + nx * botW, hy + ny * botW);
  ctx.lineTo(sx + nx * topW / 2, sy + ny * topW / 2);
  ctx.quadraticCurveTo(sx, sy + 4, sx - nx * topW / 2, sy - ny * topW / 2);
  ctx.lineTo(hx - nx * botW, hy - ny * botW);
  ctx.quadraticCurveTo(hx, hy - 2, hx + nx * botW, hy + ny * botW);
  ctx.fill();
}

function drawHair(ctx, x, y, b, facing) {
  const hat = b.hat;
  if (hat === 'official') {                            // black gauze cap
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 9, y + 4, 18, 8);
    ctx.fillStyle = b.hair; ctx.fillRect(x - 8, y + 5, 16, 6);
    dot(ctx, x + 11, y + 8, 2.5, OUTLINE);
  } else if (hat === 'helm') {
    ctx.fillStyle = b.metal; ctx.beginPath(); ctx.arc(x, y + 2, P.headR + 1, Math.PI, 0); ctx.fill();
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - 1.5, y + 8, 3, 8);    // plume base
    ctx.fillStyle = '#c33'; ctx.fillRect(x - 1.5, y + 10, 3, 8);
  } else if (hat === 'crown') {
    ctx.fillStyle = b.metal; ctx.beginPath();
    ctx.moveTo(x - 9, y + 6); ctx.lineTo(x - 9, y + 12); ctx.lineTo(x, y + 9);
    ctx.lineTo(x + 9, y + 12); ctx.lineTo(x + 9, y + 6); ctx.closePath(); ctx.fill();
  } else if (hat === 'hood') {
    ctx.fillStyle = b.robe2; ctx.beginPath(); ctx.arc(x, y + 1, P.headR + 3, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
  } else if (hat === 'band') {
    ctx.fillStyle = b.hair; ctx.beginPath(); ctx.arc(x, y + 3, P.headR, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#caa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 9, y + 2); ctx.lineTo(x + 9, y + 2); ctx.stroke();
  } else if (hat === 'wild' || b.hair === 'long') {
    ctx.fillStyle = b.hair; ctx.beginPath(); ctx.arc(x, y + 2, P.headR + 2, Math.PI * 0.8, Math.PI * 2.2); ctx.fill();
    if (b.hair === 'long') { ctx.fillRect(x - P.headR - 1, y - 8, 4, 12); ctx.fillRect(x + P.headR - 3, y - 8, 4, 12); }
  } else {
    ctx.fillStyle = b.hair; ctx.beginPath(); ctx.arc(x, y + 3, P.headR, Math.PI, 0); ctx.fill();
  }
  // simple face mark
  dot(ctx, x + facing * 3, y - 1, 1.2, OUTLINE);
}

// Render every action's frames onto one sheet (for inspection / proof).
export function generateSheet(buildKey, cellW = 110, cellH = 150) {
  const build = BUILDS[buildKey];
  const rows = [
    ['idle', 4, (i, n) => ({ action: 'idle', t: i / n * Math.PI * 2 })],
    ['walk', 6, (i, n) => ({ action: 'walk', phase: i / n * Math.PI * 2 })],
    ['attack', 6, (i, n) => ({ action: 'attack', attackP: i / (n - 1), attackKind: attackKindFor(null, build.weapon) })],
    ['jump', 2, (i) => ({ action: 'jump', jumpK: i === 0 ? 1 : -1 })],
    ['hurt', 1, () => ({ action: 'hurt' })],
  ];
  const cols = Math.max(...rows.map(r => r[1]));
  const c = document.createElement('canvas');
  c.width = cols * cellW; c.height = rows.length * cellH;
  const ctx = c.getContext('2d');
  rows.forEach(([, n, gen], r) => {
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(i * cellW + cellW / 2, r * cellH + cellH - 14);
      drawFighter(ctx, build, { facing: 1, ...gen(i, n) });
      ctx.restore();
    }
  });
  return c;
}
