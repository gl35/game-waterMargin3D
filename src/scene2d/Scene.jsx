import { useEffect, useRef } from 'react';
import { NPCS } from '../core/story/config';
import { tileToWorldPosition } from '../core/story/coordinates';
import { drawSprite, preloadAllSprites, getSprite } from './sprites';
import { sfxFootstep } from '../audio/sfx';

const WORLD_BOUNDS = { minX: -170, maxX: 170, minZ: -170, maxZ: 220 };
const PIXELS_PER_UNIT = 14;
const HERO_RADIUS = 1.2;
const SOLID_OBSTACLES = [[-60, -80, 28]]; // [cx, cz, radius]

let terrainChapter = 1;

// ── Traditional Chinese ink-wash palette ──
// Earthy creams, mossy greens, vermilion reds, indigo washes, ink black
const INK = {
  outline:    '#2a2014',   // dark brown ink line
  outlineSft: '#4a3a28',   // softer brown line
  paper:      '#e8dcc0',   // aged paper / silk background
  paperHi:    '#f0e6cc',   // highlight on paper
  mistLight:  '#d8cfb2',   // pale mist tone
  mistDark:   '#9a9078',   // shadow mist
  mossBlue:   '#5e7868',   // dusty blue-green moss
  mossDark:   '#3a4a3a',   // dark moss shadow
  bambooG:    '#7a8c5a',   // bamboo / fresh green
  pineDark:   '#2a3a30',   // dark evergreen
  earth:      '#8a6e48',   // warm umber
  earthDark:  '#5a4028',   // dark earth shadow
  vermilion:  '#c43a30',   // traditional Chinese red (朱砂)
  vermilionD: '#8a2018',   // deep red
  azalea:     '#d8506a',   // bauhinia / azalea pink
  ivory:      '#f4ecd8',   // robe ivory
  indigo:     '#2a3858',   // 靛蓝 indigo
  scholarBl:  '#3a5878',   // scholar-robe blue
  goldDull:   '#b89048',   // muted gold trim
  jade:       '#7ca888',   // jade green
};

const NPC_STYLES = {
  songjiang: { robe: INK.vermilionD, robeLight: INK.vermilion, hat: INK.outline,    sash: INK.goldDull, rim: '#5a1410', accessory: 'scholar' },
  linchong:  { robe: INK.indigo,     robeLight: INK.scholarBl, hat: INK.outline,    sash: INK.goldDull, rim: '#181a2a', accessory: 'warrior' },
  wuyong:    { robe: INK.scholarBl,  robeLight: '#5a7898',     hat: INK.outline,    sash: INK.ivory,    rim: '#1a2a3a', accessory: 'fan' },
  tonkey:    { robe: '#3a4838',      robeLight: INK.mossBlue,  hat: INK.earth,      sash: INK.vermilion,rim: '#1a2018', accessory: 'sword' },
  villager:  { robe: INK.earth,      robeLight: '#a88a60',     hat: INK.earthDark,  sash: INK.vermilion,rim: '#3a2814', accessory: 'sage' },
  // Female commoner — soft ivory robe, vermilion sash, no hat
  linchongwife: { robe: INK.ivory,   robeLight: '#f8e8c4',     hat: null,           sash: INK.vermilion,rim: '#a88a60', accessory: 'sage' },
};

const ENEMY_STYLES = {
  raider:    { body: '#3a1f18', plate: '#5a2820', accent: INK.vermilion, size: 1.0,  helmet: 'horned' },
  scout:     { body: '#2a2418', plate: '#4a3820', accent: INK.goldDull,  size: 0.85, helmet: 'hood' },
  captain:   { body: '#2a1818', plate: '#5a1818', accent: '#d8a040',     size: 1.3,  helmet: 'plumed' },
  berserker: { body: '#1c1828', plate: '#4a2840', accent: '#d83030',     size: 1.1,  helmet: 'wild' },
  guard:     { body: '#1c1c28', plate: '#3a3848', accent: INK.scholarBl, size: 1.05, helmet: 'plumed' },
  archer:    { body: '#241e18', plate: '#3a3220', accent: INK.bambooG,   size: 0.9,  helmet: 'hood' },
  warlord:   { body: '#0a0808', plate: '#3a0808', accent: '#d82020',     size: 1.7,  helmet: 'crowned' },
  // Chapter 3 — sorcerer's coven
  cultist:   { body: '#2a1638', plate: '#5a2868', accent: '#a050ff',     size: 1.0,  helmet: 'hood' },
  shade:     { body: '#141020', plate: '#2a1838', accent: '#80a0ff',     size: 0.9,  helmet: 'hood' },
  sorcerer:  { body: '#1a0828', plate: '#400860', accent: '#ff20a0',     size: 1.9,  helmet: 'crowned' },
};

// Deterministic seeded random for stable decoration positions
function hash2D(x, y) {
  let h = (x * 374761393) ^ (y * 668265263);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function resolveCollisions(x, z) {
  let nx = x, nz = z;
  for (const [cx, cz, cr] of SOLID_OBSTACLES) {
    const dx = nx - cx, dz = nz - cz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = cr + HERO_RADIUS;
    if (dist < minDist && dist > 0.001) {
      const push = (minDist - dist) / dist;
      nx += dx * push;
      nz += dz * push;
    }
  }
  return { x: nx, z: nz };
}

// ── PARTICLE SYSTEM ────────────────────────────────────────────
// Particles use world-space coords (x, z). Drawn after camera transform.
// type: 'dust' (grey puff), 'blood' (red splat), 'spark' (yellow glint),
//       'leaf' (orange floating), 'ember' (orange rising)
function spawnParticle(particles, p) {
  particles.push(p);
  // Cap to prevent unbounded growth
  if (particles.length > 400) particles.splice(0, particles.length - 400);
}

function spawnHitParticles(particles, x, z, count = 8, type = 'spark') {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    spawnParticle(particles, {
      x, z, type,
      vx: Math.cos(a) * speed,
      vz: Math.sin(a) * speed,
      life: 0,
      maxLife: 0.4 + Math.random() * 0.3,
      size: type === 'blood' ? 2 + Math.random() * 3 : 1 + Math.random() * 2,
    });
  }
}

function spawnFootstepDust(particles, x, z, vx, vz) {
  const a = Math.atan2(vz, vx);
  spawnParticle(particles, {
    x, z, type: 'dust',
    vx: -Math.cos(a) * 2 + (Math.random() - 0.5) * 1.5,
    vz: -Math.sin(a) * 2 + (Math.random() - 0.5) * 1.5,
    life: 0,
    maxLife: 0.6,
    size: 2 + Math.random() * 2,
  });
}

function stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.vx *= Math.pow(0.05, dt);
    p.vz *= Math.pow(0.05, dt);
    if (p.type === 'ember' || p.type === 'leaf') p.vz -= dt * 6; // float / fall
    p.life += dt;
    if (p.life >= p.maxLife) particles.splice(i, 1);
  }
}

function drawParticle(ctx, p, sx, sy) {
  const alpha = 1 - p.life / p.maxLife;
  if (p.type === 'dust') {
    ctx.fillStyle = `rgba(190, 175, 140, ${alpha * 0.6})`;
    drawCircle(ctx, sx, sy, p.size * (1 + p.life / p.maxLife), ctx.fillStyle);
  } else if (p.type === 'blood') {
    ctx.fillStyle = `rgba(${160 - p.life * 60}, 20, 20, ${alpha})`;
    drawCircle(ctx, sx, sy, p.size, ctx.fillStyle);
  } else if (p.type === 'spark') {
    ctx.fillStyle = `rgba(255, ${200 + Math.random() * 55}, 80, ${alpha})`;
    drawCircle(ctx, sx, sy, p.size, ctx.fillStyle);
  } else if (p.type === 'leaf') {
    // Pink blossom petal — soft, drifting, faintly translucent
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.life * 1.8);
    // Petal body (teardrop)
    const petalAlpha = alpha * 0.85;
    ctx.fillStyle = `rgba(248, 198, 212, ${petalAlpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 1.4, p.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pink center
    ctx.fillStyle = `rgba(216, 80, 106, ${petalAlpha * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.7, p.size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (p.type === 'ember') {
    const flick = 0.5 + Math.sin(p.life * 12) * 0.5;
    ctx.fillStyle = `rgba(255, ${100 + flick * 80}, 30, ${alpha * flick})`;
    drawCircle(ctx, sx, sy, p.size, ctx.fillStyle);
  }
}

// ── DRAWING HELPERS ────────────────────────────────────────────
function drawCircle(ctx, x, y, r, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke = null, lineWidth = 1) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

// ── Path corridor overlay (mountain dirt trail with stepping stones) ──
function drawPathOverlay(ctx, cam, vw, vh, ch2) {
  if (ch2) return;
  const ppu = PIXELS_PER_UNIT;
  const pathX = (0 - cam.x) * ppu + vw / 2;
  const grad = ctx.createLinearGradient(pathX - 5 * ppu, 0, pathX + 5 * ppu, 0);
  grad.addColorStop(0, 'rgba(138, 110, 72, 0)');
  grad.addColorStop(0.5, 'rgba(168, 138, 92, 0.45)');
  grad.addColorStop(1, 'rgba(138, 110, 72, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(pathX - 5 * ppu, vh * 0.40, 10 * ppu, vh * 0.60);
  ctx.fillStyle = 'rgba(90, 64, 40, 0.4)';
  for (let i = 0; i < 30; i++) {
    const wz = i * 14 - 200;
    const sy = (wz - cam.z) * ppu + vh / 2;
    if (sy < -20 || sy > vh + 20) continue;
    const dx = (hash2D(0, i) - 0.5) * 4 * ppu;
    ctx.beginPath();
    ctx.ellipse(pathX + dx, sy, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Mist drift bands moving slowly across the screen ──
function drawMistDriftOverlay(ctx, cam, vw, vh, t, ch2) {
  if (ch2) {
    for (let i = 0; i < 6; i++) {
      const my = vh * (0.20 + i * 0.10);
      ctx.fillStyle = `rgba(40, 30, 20, ${0.10 + i * 0.02})`;
      const offset = (t * 6 + i * 120) % (vw + 300) - 150;
      ctx.beginPath();
      ctx.ellipse(offset, my, 220, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const my = vh * (0.55 + i * 0.08);
      ctx.fillStyle = `rgba(244, 236, 216, ${0.04 + i * 0.02})`;
      const offset = (t * 4 + i * 80) % (vw + 200) - 100;
      ctx.beginPath();
      ctx.ellipse(offset, my, 240, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Draw a single-copy bitmap backdrop layer (no tiling, clamped parallax) ──
// For distant layers (sky, mountains): screen-space band with X-parallax only.
function drawBgLayer(ctx, spriteName, cam, vw, vh, opts) {
  const img = getSprite(spriteName);
  if (!img) return false;
  const { parallax, top, height } = opts;
  const aspect = img.width / img.height;
  const drawH = height;
  const drawW = Math.max(drawH * aspect, vw * 1.15);
  const extraW = drawW - vw;
  const halfExtra = extraW / 2;
  const desiredOffset = cam.x * PIXELS_PER_UNIT * parallax;
  const offset = Math.max(-halfExtra, Math.min(halfExtra, desiredOffset));
  const x = (vw - drawW) / 2 - offset;
  ctx.drawImage(img, x, top, drawW, drawH);
  return true;
}

// ── Tile the ground bitmap in WORLD space so it scrolls with entities ──
// The bitmap represents a chunk of terrain; copies repeat across the world
// surface. Trees, characters, and ground all move at the same speed, so the
// floor stays anchored beneath them. Output is clipped to a screen band so
// mountains and sky above stay visible.
function drawWorldTiledGround(ctx, spriteName, cam, vw, vh, screenTop) {
  const img = getSprite(spriteName);
  if (!img) return false;
  const ppu = PIXELS_PER_UNIT;
  // Tile size in world units (smaller = more variety, more seams)
  const worldTileH = 18;
  const screenTileH = worldTileH * ppu;
  const aspect = img.width / img.height;
  const screenTileW = screenTileH * aspect;
  const worldTileW = screenTileW / ppu;

  // Clip everything to the screen ground band so we don't paint over sky/mountains
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, screenTop, vw, vh - screenTop);
  ctx.clip();

  // Visible world range — pad with one tile on every side
  const worldLeft  = cam.x - vw / 2 / ppu - worldTileW;
  const worldRight = cam.x + vw / 2 / ppu + worldTileW;
  const worldTopZ  = cam.z + (screenTop - vh / 2) / ppu - worldTileH;
  const worldBotZ  = cam.z + vh / 2 / ppu + worldTileH;

  const startCol = Math.floor(worldLeft / worldTileW);
  const endCol   = Math.ceil(worldRight / worldTileW);
  const startRow = Math.floor(worldTopZ / worldTileH);
  const endRow   = Math.ceil(worldBotZ / worldTileH);

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const wx = col * worldTileW;
      const wz = row * worldTileH;
      const sx = (wx - cam.x) * ppu + vw / 2;
      const sy = (wz - cam.z) * ppu + vh / 2;
      // Mirror alternating tiles to mask repetition seams
      const flip = (col + row) & 1;
      if (flip) {
        ctx.save();
        ctx.translate(sx + screenTileW, sy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, screenTileW, screenTileH);
        ctx.restore();
      } else {
        ctx.drawImage(img, sx, sy, screenTileW, screenTileH);
      }
    }
  }

  // Feather the top edge: erase a soft gradient at the horizon so ground
  // fades into the mountains behind instead of cutting on a hard line.
  const featherH = 60;
  const featherGrad = ctx.createLinearGradient(0, screenTop, 0, screenTop + featherH);
  featherGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  featherGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = featherGrad;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(0, screenTop, vw, featherH);
  ctx.globalCompositeOperation = 'source-over';

  ctx.restore();
  return true;
}

// ── BACKGROUND TERRAIN: ink-wash painted style ───────────────────
function drawTerrain(ctx, cam, vw, vh, t) {
  const ch2 = terrainChapter === 2;

  // Always fill a full base wash first so any bitmap transparency reveals
  // a nice color instead of the canvas backdrop / checkerboard pattern.
  const baseGrad = ctx.createLinearGradient(0, 0, 0, vh);
  if (ch2) {
    baseGrad.addColorStop(0, '#1a0a08');
    baseGrad.addColorStop(0.5, '#2a1408');
    baseGrad.addColorStop(1, '#1a0805');
  } else {
    baseGrad.addColorStop(0, INK.paperHi);
    baseGrad.addColorStop(0.45, INK.paper);
    baseGrad.addColorStop(0.75, INK.mistDark);
    baseGrad.addColorStop(1, INK.mossDark);
  }
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, vw, vh);

  // ── Sky and mountains share the same parallax so they don't drift apart ──
  // Sky covers full upper area; mountains overlay with their own transparency.
  const SAME_PARALLAX = 0.10;
  drawBgLayer(ctx, ch2 ? 'bg/sky_ch2' : 'bg/sky_ch1', cam, vw, vh, {
    parallax: SAME_PARALLAX, top: 0, height: vh * 0.62,
  });

  const mtnDrawn = drawBgLayer(ctx, ch2 ? 'bg/mountains_ch2' : 'bg/mountains_ch1', cam, vw, vh, {
    parallax: SAME_PARALLAX, top: vh * 0.18, height: vh * 0.45,
  });
  if (!mtnDrawn && !ch2) {
    drawMistMountains(ctx, cam, vw, vh);
  }

  // ── Painted ground tiled in WORLD space — moves with entities, no flow ──
  const groundDrawn = drawWorldTiledGround(ctx, ch2 ? 'bg/ground_ch2' : 'bg/ground_ch1', cam, vw, vh, vh * 0.46);

  // Skip procedural watercolor patches when bitmap ground loaded — they'd muddy it
  if (groundDrawn) {
    drawPathOverlay(ctx, cam, vw, vh, ch2);
    drawMistDriftOverlay(ctx, cam, vw, vh, t, ch2);
    return;
  }

  // ── Watercolor wash patches — flatter, less tile-y for 3/4-view ground ──
  const TILE = 44;
  const ppu = PIXELS_PER_UNIT;
  const startWX = Math.floor((cam.x - vw / 2 / ppu) / TILE) - 1;
  const endWX   = Math.ceil((cam.x + vw / 2 / ppu) / TILE) + 1;
  const startWZ = Math.floor((cam.z - vh / 2 / ppu) / TILE) - 1;
  const endWZ   = Math.ceil((cam.z + vh / 2 / ppu) / TILE) + 1;

  for (let tz = startWZ; tz < endWZ; tz++) {
    for (let tx = startWX; tx < endWX; tx++) {
      const r = hash2D(tx, tz);
      const r2 = hash2D(tx + 13, tz - 7);
      const r3 = hash2D(tx - 5, tz + 11);
      // Sparser — skip half the tiles
      if (r > 0.55) continue;
      const wx = tx * TILE + r * TILE * 0.9;
      const wz = tz * TILE + r2 * TILE * 0.9;
      const sx = (wx - cam.x) * ppu + vw / 2;
      const sy = (wz - cam.z) * ppu + vh / 2;
      const sizeX = 22 + r * 32;
      const sizeY = (10 + r * 14) * 0.7; // flattened ellipse — flat ground

      if (ch2) {
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sizeX);
        grad.addColorStop(0, `rgba(58, 24, 12, 0.55)`);
        grad.addColorStop(1, `rgba(40, 16, 8, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sizeX, sizeY, 0, 0, Math.PI * 2);
        ctx.fill();
        if (r2 < 0.18) {
          const flicker = 0.5 + Math.sin(t * 4 + r * 30) * 0.5;
          const fg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sizeX * 0.5);
          fg.addColorStop(0, `rgba(255, ${100 + flicker * 80}, 30, ${0.45 * flicker})`);
          fg.addColorStop(1, `rgba(255, 80, 20, 0)`);
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.ellipse(sx, sy, sizeX * 0.5, sizeY * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const isMoss = r3 < 0.6;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sizeX);
        if (isMoss) {
          grad.addColorStop(0, 'rgba(108, 132, 116, 0.40)');
          grad.addColorStop(0.7, 'rgba(108, 132, 116, 0.12)');
          grad.addColorStop(1, 'rgba(108, 132, 116, 0)');
        } else {
          grad.addColorStop(0, 'rgba(168, 134, 90, 0.32)');
          grad.addColorStop(1, 'rgba(168, 134, 90, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sizeX, sizeY, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Foreground ground vignette — darkens the bottom for depth in 3/4 view ──
  if (!ch2) {
    const fgGrad = ctx.createLinearGradient(0, vh * 0.5, 0, vh);
    fgGrad.addColorStop(0, 'rgba(58, 74, 58, 0)');
    fgGrad.addColorStop(1, 'rgba(58, 74, 58, 0.30)');
    ctx.fillStyle = fgGrad;
    ctx.fillRect(0, vh * 0.5, vw, vh * 0.5);
  }

  drawPathOverlay(ctx, cam, vw, vh, ch2);
  drawMistDriftOverlay(ctx, cam, vw, vh, t, ch2);
}

// ── Distant misty mountain ridges (3 parallax layers) ──
function drawMistMountains(ctx, cam, vw, vh) {
  const layers = [
    { y: vh * 0.32, color: 'rgba(154, 144, 120, 0.55)', amp: 22, freq: 0.012, speed: 0.05 },
    { y: vh * 0.40, color: 'rgba(116, 116, 102, 0.55)', amp: 28, freq: 0.018, speed: 0.10 },
    { y: vh * 0.50, color: 'rgba(82, 92, 78, 0.55)',    amp: 36, freq: 0.024, speed: 0.18 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, layer.y + layer.amp);
    for (let x = 0; x <= vw; x += 8) {
      const wx = x + cam.x * layer.speed;
      const h = Math.sin(wx * layer.freq) * layer.amp
              + Math.sin(wx * layer.freq * 2.7) * layer.amp * 0.4
              + Math.cos(wx * layer.freq * 0.7) * layer.amp * 0.6;
      ctx.lineTo(x, layer.y - h);
    }
    ctx.lineTo(vw, vh * 0.7);
    ctx.lineTo(0, vh * 0.7);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDecorations(ctx, cam, vw, vh, t) {
  const ch2 = terrainChapter === 2;
  const ppu = PIXELS_PER_UNIT;
  const TILE = 24;
  const startWX = Math.floor((cam.x - vw / 2 / ppu) / TILE) - 1;
  const endWX   = Math.ceil((cam.x + vw / 2 / ppu) / TILE) + 1;
  const startWZ = Math.floor((cam.z - vh / 2 / ppu) / TILE) - 1;
  const endWZ   = Math.ceil((cam.z + vh / 2 / ppu) / TILE) + 1;

  // Trees, rocks, bushes (sorted by world z — south-most draws on top)
  const items = [];
  for (let tz = startWZ; tz < endWZ; tz++) {
    for (let tx = startWX; tx < endWX; tx++) {
      const r = hash2D(tx, tz);
      const r2 = hash2D(tx + 99, tz + 31);
      const r3 = hash2D(tx - 7, tz + 11);
      const r4 = hash2D(tx + 41, tz - 17);
      if (r > 0.78) continue; // denser scattering — fewer empty patches
      const wx = tx * TILE + r * TILE;
      const wz = tz * TILE + r2 * TILE;
      if (!ch2 && Math.abs(wx) < 5) continue;
      if (Math.hypot(wx + 60, wz + 80) < 30) continue;
      // Pick decoration type by hash
      let kind;
      if (r3 < 0.45) kind = 'pine';
      else if (r3 < 0.62) kind = 'azalea';
      else if (r3 < 0.76) kind = 'bamboo';
      else kind = 'rock';
      items.push({ wx, wz, kind, r, r4 });
    }
  }
  items.sort((a, b) => a.wz - b.wz);

  // Horizon line — decorations whose feet are above the ground band get culled.
  // Allow a small overlap so trees just past horizon appear as "distant".
  const HORIZON_Y = vh * 0.46;

  for (const it of items) {
    const sx = (it.wx - cam.x) * ppu + vw / 2;
    const sy = (it.wz - cam.z) * ppu + vh / 2;
    if (sx < -50 || sx > vw + 50 || sy < HORIZON_Y || sy > vh + 30) continue;
    if (ch2) {
      drawBurntTree(ctx, sx, sy, it.r);
      continue;
    }
    if (it.kind === 'pine') drawGnarledPine(ctx, sx, sy, it.r, it.r4);
    else if (it.kind === 'azalea') drawAzaleaBush(ctx, sx, sy, it.r, it.r4);
    else if (it.kind === 'bamboo') drawBambooCluster(ctx, sx, sy, it.r, it.r4);
    else drawMossyRock(ctx, sx, sy, it.r, it.r4);
  }

  // Liangshan fortress on the mountain at (-60, -80)
  const lx = (-60 - cam.x) * ppu + vw / 2;
  const lz = (-80 - cam.z) * ppu + vh / 2;
  if (lx > -200 && lx < vw + 200 && lz > -200 && lz < vh + 200) {
    drawFortress(ctx, lx, lz, ch2);
  }

  // Campfires (chapter 1 only) — also cull above horizon
  if (!ch2) {
    const camps = [[-18, 10], [22, -8], [-40, -25], [55, 20]];
    for (const [cx, cz] of camps) {
      const sx = (cx - cam.x) * ppu + vw / 2;
      const sy = (cz - cam.z) * ppu + vh / 2;
      if (sy < HORIZON_Y) continue;
      drawCampfire(ctx, sx, sy, t);
    }
  } else {
    const ruins = [[-30, -20], [10, -40], [40, -10], [-15, 20], [25, 30]];
    for (const [cx, cz] of ruins) {
      const sx = (cx - cam.x) * ppu + vw / 2;
      const sy = (cz - cam.z) * ppu + vh / 2;
      if (sy < HORIZON_Y) continue;
      drawBurningRuin(ctx, sx, sy, t, hash2D(cx, cz));
    }
  }
}

// ── Gnarled pine: ink-line trunk with dark/light dual-tone foliage clusters ──
function drawGnarledPine(ctx, sx, sy, r, r4) {
  if (drawSprite(ctx, 'deco/pine', sx, sy, { scale: 0.9 + r * 0.3, anchorY: 'bottom' })) return;
  const tilt = (r - 0.5) * 0.4;
  // Twisted trunk drawn as Bezier
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 2 + r * 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx + tilt * 4, sy);
  ctx.bezierCurveTo(
    sx + tilt * 8 + 2, sy - 8,
    sx - tilt * 6 - 1, sy - 16,
    sx + tilt * 4, sy - 26 - r * 4,
  );
  ctx.stroke();
  // Branch arms — short, asymmetric
  ctx.lineWidth = 1.2 + r * 0.8;
  ctx.beginPath();
  ctx.moveTo(sx + tilt * 6, sy - 14);
  ctx.lineTo(sx + tilt * 10 + 8, sy - 18);
  ctx.moveTo(sx + tilt * 2, sy - 20);
  ctx.lineTo(sx - 8, sy - 24);
  ctx.stroke();
  // Foliage masses — dark green flat-bottom pads (multiple)
  const masses = 2 + Math.floor(r4 * 2);
  for (let i = 0; i < masses; i++) {
    const fx = sx + tilt * 4 + (hash2D(Math.floor(sx), i) - 0.5) * 16;
    const fy = sy - 22 - i * 6 - r4 * 4;
    const fw = 12 + r * 6;
    const fh = 6 + r4 * 3;
    // Dark base
    ctx.fillStyle = INK.pineDark;
    ctx.beginPath();
    ctx.ellipse(fx, fy, fw, fh, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lighter highlight on top-left
    ctx.fillStyle = 'rgba(124, 168, 136, 0.45)';
    ctx.beginPath();
    ctx.ellipse(fx - fw * 0.25, fy - fh * 0.4, fw * 0.6, fh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ink-stipple needles (a few darker dots)
    ctx.fillStyle = 'rgba(20, 28, 22, 0.7)';
    for (let j = 0; j < 4; j++) {
      const nx = fx + (hash2D(i * 7, j) - 0.5) * fw * 1.4;
      const ny = fy + (hash2D(j * 5, i) - 0.5) * fh * 1.2;
      ctx.fillRect(nx, ny, 1, 1);
    }
  }
}

// ── Red azalea / bauhinia bush — clusters of vermilion blossoms over moss ──
function drawAzaleaBush(ctx, sx, sy, r, r4) {
  if (drawSprite(ctx, 'deco/azalea', sx, sy, { scale: 0.9 + r * 0.3, anchorY: 'bottom' })) return;
  // Mossy base
  ctx.fillStyle = INK.mossBlue;
  ctx.beginPath();
  ctx.ellipse(sx, sy, 11 + r * 4, 6 + r4 * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(58, 74, 58, 0.7)';
  ctx.beginPath();
  ctx.ellipse(sx + 3, sy + 1, 5 + r * 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Red blossom clusters scattered on top
  const blossoms = 8 + Math.floor(r4 * 6);
  for (let i = 0; i < blossoms; i++) {
    const ox = (hash2D(Math.floor(sx) + i, Math.floor(sy)) - 0.5) * 22;
    const oy = (hash2D(Math.floor(sy), Math.floor(sx) + i) - 0.5) * 8 - 2;
    const sz = 1.4 + hash2D(i, i * 3) * 1.2;
    const isPink = hash2D(i, 0) < 0.3;
    ctx.fillStyle = isPink ? INK.azalea : INK.vermilion;
    drawCircle(ctx, sx + ox, sy + oy, sz, ctx.fillStyle);
    // Tiny dark center
    ctx.fillStyle = '#5a1810';
    ctx.fillRect(sx + ox - 0.4, sy + oy - 0.4, 0.8, 0.8);
  }
  // Stem hint
  ctx.strokeStyle = INK.outlineSft;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(sx - 4, sy + 2);
  ctx.lineTo(sx - 2, sy - 4);
  ctx.moveTo(sx + 5, sy + 2);
  ctx.lineTo(sx + 3, sy - 4);
  ctx.stroke();
}

// ── Bamboo cluster: vertical green stalks with tiny leaf tufts ──
function drawBambooCluster(ctx, sx, sy, r, r4) {
  if (drawSprite(ctx, 'deco/bamboo', sx, sy, { scale: 0.9 + r * 0.3, anchorY: 'bottom' })) return;
  const stalks = 3 + Math.floor(r4 * 3);
  for (let i = 0; i < stalks; i++) {
    const ox = (i - stalks / 2) * 3 + (hash2D(i, Math.floor(sx)) - 0.5) * 2;
    const height = 22 + r * 12 + i * 2;
    const stalkX = sx + ox;
    // Stalk
    ctx.strokeStyle = INK.bambooG;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(stalkX, sy);
    ctx.lineTo(stalkX, sy - height);
    ctx.stroke();
    // Joints (bamboo nodes)
    ctx.strokeStyle = INK.pineDark;
    ctx.lineWidth = 0.8;
    for (let j = 1; j < 4; j++) {
      const jy = sy - (height / 4) * j;
      ctx.beginPath();
      ctx.moveTo(stalkX - 1.5, jy);
      ctx.lineTo(stalkX + 1.5, jy);
      ctx.stroke();
    }
    // Top leaves — narrow strokes
    ctx.strokeStyle = INK.bambooG;
    ctx.lineWidth = 1.2;
    for (let j = 0; j < 3; j++) {
      const lAng = -Math.PI / 2 + (j - 1) * 0.5 + (hash2D(i, j) - 0.5) * 0.4;
      ctx.beginPath();
      ctx.moveTo(stalkX, sy - height + 2);
      ctx.lineTo(stalkX + Math.cos(lAng) * 6, sy - height + 2 + Math.sin(lAng) * 6);
      ctx.stroke();
    }
  }
}

// ── Mossy rock: watercolor wash pebble with ink-line outline ──
function drawMossyRock(ctx, sx, sy, r, r4) {
  if (drawSprite(ctx, 'deco/rock', sx, sy + 4, { scale: 0.8 + r * 0.4, anchorY: 'bottom' })) return;
  const w = 7 + r * 5;
  const h = 4 + r * 3;
  // Wash fill
  const grad = ctx.createRadialGradient(sx - w * 0.3, sy - h * 0.5, 0, sx, sy, w);
  grad.addColorStop(0, '#a89d88');
  grad.addColorStop(1, '#5a5448');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(sx, sy, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ink outline (broken — sketchy, not full circle)
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(sx, sy, w, Math.PI * 0.95, Math.PI * 1.95);
  ctx.stroke();
  // Moss patches on top
  if (r4 < 0.7) {
    ctx.fillStyle = INK.mossBlue;
    ctx.beginPath();
    ctx.ellipse(sx - w * 0.3, sy - h * 0.6, w * 0.5, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(58, 74, 58, 0.8)';
    ctx.fillRect(sx - 1, sy - h * 0.7, 2, 1);
  }
}

// ── Burnt tree (chapter 2) ──
function drawBurntTree(ctx, sx, sy, r) {
  if (drawSprite(ctx, 'deco/burnt_tree', sx, sy, { scale: 0.9 + r * 0.3, anchorY: 'bottom' })) return;
  ctx.strokeStyle = '#1a0808';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  // Crooked trunk
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.bezierCurveTo(sx + 4, sy - 8, sx - 3, sy - 18, sx + (r - 0.5) * 6, sy - 28);
  ctx.stroke();
  // Broken branches
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sx + 1, sy - 14);
  ctx.lineTo(sx + 12, sy - 22);
  ctx.moveTo(sx - 1, sy - 20);
  ctx.lineTo(sx - 10, sy - 24);
  ctx.lineTo(sx - 14, sy - 22);
  ctx.stroke();
  // Glowing ember in trunk
  if (r < 0.3) {
    ctx.fillStyle = 'rgba(255, 100, 30, 0.6)';
    ctx.fillRect(sx - 1, sy - 12, 2, 2);
  }
}

function drawFortress(ctx, sx, sy, ch2) {
  if (drawSprite(ctx, 'world/fortress', sx, sy + 20, { scale: 1, anchorY: 'bottom' })) return;
  const ppu = PIXELS_PER_UNIT;
  const stoneLight = ch2 ? '#3a2820' : '#a89880';
  const stoneDark  = ch2 ? '#1a1008' : '#5a4838';
  const woodLight  = ch2 ? '#4a2818' : '#8a5a30';
  const woodDark   = ch2 ? '#2a1408' : '#5a3818';
  const tileRed    = ch2 ? '#5a1010' : INK.vermilionD;
  const tileLight  = ch2 ? '#7a1818' : INK.vermilion;

  // ── Mountain silhouette behind fortress ──
  const mountainGrad = ctx.createRadialGradient(sx, sy - 20, 0, sx, sy - 10, 30 * ppu);
  mountainGrad.addColorStop(0, stoneLight);
  mountainGrad.addColorStop(1, stoneDark);
  ctx.fillStyle = mountainGrad;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 4, 30 * ppu, 18 * ppu, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Secondary peak
  ctx.fillStyle = stoneDark;
  ctx.beginPath();
  ctx.ellipse(sx - 8 * ppu, sy - 28, 14 * ppu, 11 * ppu, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Stone wall: sloped masonry base ──
  ctx.fillStyle = stoneLight;
  ctx.beginPath();
  ctx.moveTo(sx - 95, sy - 18);
  ctx.lineTo(sx - 88, sy - 50);
  ctx.lineTo(sx + 88, sy - 50);
  ctx.lineTo(sx + 95, sy - 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Wall stones (horizontal lines)
  ctx.strokeStyle = stoneDark;
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 4; i++) {
    const y = sy - 50 + (i / 4) * 32;
    ctx.beginPath();
    ctx.moveTo(sx - 92, y);
    ctx.lineTo(sx + 92, y);
    ctx.stroke();
  }
  // Vertical stone joints (offset per row)
  for (let row = 0; row < 4; row++) {
    const yT = sy - 50 + (row / 4) * 32;
    const yB = sy - 50 + ((row + 1) / 4) * 32;
    const offset = (row % 2) * 8;
    for (let x = sx - 88 + offset; x < sx + 88; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, yT);
      ctx.lineTo(x, yB);
      ctx.stroke();
    }
  }

  // ── Curved-eave roof above wall (traditional Chinese 飞檐) ──
  drawCurvedEave(ctx, sx, sy - 50, 200, 12, tileRed, tileLight, woodDark);

  // ── Banners hanging from wall ──
  const bannerCols = [tileRed, INK.indigo, tileRed, INK.indigo];
  for (let i = 0; i < 4; i++) {
    const bx = sx - 70 + i * 50;
    const flutter = Math.sin(i + sx * 0.01) * 1;
    // Pole/tassel cord
    ctx.fillStyle = woodDark;
    ctx.fillRect(bx - 0.5, sy - 70, 1, 14);
    // Banner cloth
    ctx.fillStyle = bannerCols[i];
    ctx.beginPath();
    ctx.moveTo(bx, sy - 68);
    ctx.lineTo(bx + 14 + flutter, sy - 66);
    ctx.lineTo(bx + 14 + flutter, sy - 50);
    ctx.lineTo(bx, sy - 52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK.outline;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Symbol
    ctx.fillStyle = INK.goldDull;
    ctx.font = '8px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('梁', bx + 7, sy - 59);
  }

  // ── Massive central gate (timber double-doors) ──
  ctx.fillStyle = woodDark;
  ctx.fillRect(sx - 18, sy - 36, 36, 28);
  ctx.fillStyle = woodLight;
  ctx.fillRect(sx - 16, sy - 34, 15, 24);
  ctx.fillRect(sx + 1, sy - 34, 15, 24);
  // Door studs
  ctx.fillStyle = INK.goldDull;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillRect(sx - 13 + c * 5, sy - 30 + r * 7, 1.5, 1.5);
      ctx.fillRect(sx + 4 + c * 5, sy - 30 + r * 7, 1.5, 1.5);
    }
  }
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1;
  ctx.strokeRect(sx - 18, sy - 36, 36, 28);
  // Gate plaque above (匾额)
  ctx.fillStyle = woodDark;
  ctx.fillRect(sx - 14, sy - 44, 28, 8);
  ctx.fillStyle = '#ffd060';
  ctx.font = 'bold 7px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('梁山', sx, sy - 40);

  // ── Multi-tier pagoda keep (3 tiers with curved eaves) ──
  // Tier 1 (largest, base)
  drawPagodaTier(ctx, sx, sy - 70, 56, 18, tileRed, tileLight, woodDark, woodLight);
  // Tier 2
  drawPagodaTier(ctx, sx, sy - 92, 42, 16, tileRed, tileLight, woodDark, woodLight);
  // Tier 3 (top)
  drawPagodaTier(ctx, sx, sy - 110, 28, 12, tileRed, tileLight, woodDark, woodLight);
  // Spire (尖顶)
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 116);
  ctx.lineTo(sx, sy - 130);
  ctx.stroke();
  // Spire orbs
  ctx.fillStyle = INK.goldDull;
  drawCircle(ctx, sx, sy - 132, 2.2, ctx.fillStyle, INK.outline, 0.6);
  drawCircle(ctx, sx, sy - 126, 1.4, ctx.fillStyle);

  // ── Stone steps leading up ──
  ctx.fillStyle = stoneDark;
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(sx - 24 + i * 2, sy - 8 + i * 3, 48 - i * 4, 2);
  }
}

// ── Curved-eave roof: arc-shaped tile field ──
function drawCurvedEave(ctx, cx, cy, width, height, tileRed, tileLight, edgeDark) {
  const left = cx - width / 2;
  const right = cx + width / 2;
  // Roof body (curve up at the ends)
  ctx.fillStyle = tileRed;
  ctx.beginPath();
  ctx.moveTo(left - 4, cy + 2);
  ctx.bezierCurveTo(left - 4, cy - 4, left + 6, cy - height + 2, left + 18, cy - height + 4);
  ctx.lineTo(right - 18, cy - height + 4);
  ctx.bezierCurveTo(right - 6, cy - height + 2, right + 4, cy - 4, right + 4, cy + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Tile rows
  ctx.strokeStyle = tileLight;
  ctx.lineWidth = 0.7;
  for (let i = 1; i < 4; i++) {
    const y = cy - 2 - (i / 4) * (height - 2);
    const xPad = (i / 4) * 6;
    ctx.beginPath();
    ctx.moveTo(left + xPad, y);
    ctx.lineTo(right - xPad, y);
    ctx.stroke();
  }
  // Eave overhang (dark wood underside)
  ctx.fillStyle = edgeDark;
  ctx.fillRect(left - 4, cy + 1, width + 8, 2);
  // Upturned dragon-finial corners
  ctx.fillStyle = tileLight;
  ctx.beginPath();
  ctx.arc(left, cy - 1, 3, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(right, cy - 1, 3, Math.PI, 0);
  ctx.fill();
}

// ── Pagoda tier (rectangular building with curved roof) ──
function drawPagodaTier(ctx, cx, cy, width, bodyHeight, tileRed, tileLight, woodDark, woodLight) {
  // Building body (wood frame)
  ctx.fillStyle = woodLight;
  ctx.fillRect(cx - width / 2, cy - bodyHeight, width, bodyHeight);
  // Wood column accents
  ctx.fillStyle = woodDark;
  for (let i = 0; i <= 4; i++) {
    const x = cx - width / 2 + (i / 4) * width;
    ctx.fillRect(x - 0.8, cy - bodyHeight, 1.6, bodyHeight);
  }
  // Lattice window panels between columns
  ctx.fillStyle = '#1a0a08';
  for (let i = 0; i < 4; i++) {
    const x = cx - width / 2 + 2 + (i / 4) * width;
    ctx.fillRect(x, cy - bodyHeight + 3, width / 4 - 4, bodyHeight - 6);
  }
  // Lattice cross-bars
  ctx.strokeStyle = woodLight;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const x = cx - width / 2 + 2 + (i / 4) * width;
    const y = cy - bodyHeight + 3;
    ctx.beginPath();
    ctx.moveTo(x, y + (bodyHeight - 6) / 2);
    ctx.lineTo(x + width / 4 - 4, y + (bodyHeight - 6) / 2);
    ctx.moveTo(x + (width / 4 - 4) / 2, y);
    ctx.lineTo(x + (width / 4 - 4) / 2, y + bodyHeight - 6);
    ctx.stroke();
  }
  // Outline
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - width / 2, cy - bodyHeight, width, bodyHeight);
  // Curved roof on top
  drawCurvedEave(ctx, cx, cy - bodyHeight, width + 12, 8, tileRed, tileLight, woodDark);
}

function drawCampfire(ctx, sx, sy, t) {
  if (drawSprite(ctx, 'deco/campfire', sx, sy, { scale: 1, anchorY: 'bottom' })) {
    // Keep glow halo on top for ambience
    const grad = ctx.createRadialGradient(sx, sy - 3, 0, sx, sy - 3, 30);
    grad.addColorStop(0, `rgba(255, 150, 60, ${0.3 + Math.sin(t * 6) * 0.1})`);
    grad.addColorStop(1, 'rgba(255, 100, 40, 0)');
    ctx.fillStyle = grad;
    drawCircle(ctx, sx, sy - 3, 30, ctx.fillStyle);
    return;
  }
  ctx.fillStyle = '#3a2010';
  drawCircle(ctx, sx, sy, 9, ctx.fillStyle);
  // Logs
  ctx.strokeStyle = '#5a3818';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx - 6, sy + 2); ctx.lineTo(sx + 6, sy - 2);
  ctx.moveTo(sx - 5, sy - 3); ctx.lineTo(sx + 7, sy + 3);
  ctx.stroke();
  // Flicker fire
  const flick = 1 + Math.sin(t * 6) * 0.15 + Math.cos(t * 9) * 0.1;
  ctx.fillStyle = '#ff8030';
  drawCircle(ctx, sx, sy - 3, 6 * flick, ctx.fillStyle);
  ctx.fillStyle = '#ffcc40';
  drawCircle(ctx, sx, sy - 4, 3 * flick, ctx.fillStyle);
  // Glow
  const grad = ctx.createRadialGradient(sx, sy - 3, 0, sx, sy - 3, 30);
  grad.addColorStop(0, 'rgba(255, 150, 60, 0.4)');
  grad.addColorStop(1, 'rgba(255, 100, 40, 0)');
  ctx.fillStyle = grad;
  drawCircle(ctx, sx, sy - 3, 30, ctx.fillStyle);
}

function drawBurningRuin(ctx, sx, sy, t, seed) {
  // Foundation
  ctx.fillStyle = '#1a0a05';
  ctx.fillRect(sx - 18, sy - 14, 36, 28);
  // Charred walls
  ctx.fillStyle = '#2a1208';
  ctx.fillRect(sx - 16, sy - 18, 6, 18);
  ctx.fillRect(sx + 10, sy - 16, 5, 16);
  ctx.fillRect(sx - 8, sy - 20, 4, 14);
  // Fire flickers
  const flick = 0.7 + Math.sin(t * 5 + seed * 20) * 0.3;
  ctx.fillStyle = `rgba(255, ${80 + flick * 80}, 20, ${0.7 * flick})`;
  drawCircle(ctx, sx - 6, sy - 8, 7 * flick, ctx.fillStyle);
  drawCircle(ctx, sx + 8, sy - 4, 5 * flick, ctx.fillStyle);
  // Glow
  const grad = ctx.createRadialGradient(sx, sy - 4, 0, sx, sy - 4, 50);
  grad.addColorStop(0, 'rgba(255, 100, 30, 0.4)');
  grad.addColorStop(1, 'rgba(255, 50, 10, 0)');
  ctx.fillStyle = grad;
  drawCircle(ctx, sx, sy - 4, 50, ctx.fillStyle);
}

// ── Procedural Chinese war-horse: side view, animated gallop ──
// Painted in the style-guide palette (warm umber + indigo + vermilion + ink),
// with watercolor wash gradients and ink-line outlines.
// Anchored so sy is at hoof level. Returns the saddle-top Y (for placing rider).
function drawProceduralHorse(ctx, sx, sy, t, opts = {}) {
  const { facingLeft = false, isMoving = false, scale = 1 } = opts;
  // Style-guide palette
  const COAT     = '#8a6e48';  // warm umber
  const COAT_LT  = '#a88a60';  // ivory-tinted highlight
  const COAT_DK  = '#5a4028';  // dark umber shadow
  const MANE     = '#2a2014';  // ink black
  const HOOF     = '#2a2014';  // ink black
  const LEATHER  = '#3a2818';  // dark earth
  const SADDLE_B = '#2a3858';  // indigo
  const SADDLE_R = '#c43a30';  // vermilion
  const GOLD     = '#b89048';  // muted gold
  const PLUME    = '#c43a30';  // vermilion plume
  const EYE_W    = '#f4ecd8';  // ivory cream
  const INK      = '#2a2014';  // ink outline

  ctx.save();
  ctx.translate(sx, sy);
  if (facingLeft) ctx.scale(-1, 1);
  ctx.scale(scale, scale);

  // Gallop stride: diagonal-pair leg motion at ~6 Hz
  const stride = isMoving ? Math.sin(t * 12) : 0;
  const phaseA = stride;      // FL + BR pair
  const phaseB = -stride;     // FR + BL pair
  const bodyBob = isMoving ? Math.abs(stride) * 3 : 0;

  // Soft shadow under hooves
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 46, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const drawLeg = (hipX, hipY, phase, isFront) => {
    const swing = phase * 14; // forward/back offset of hoof
    const lift = Math.max(0, phase) * 6; // lift when moving forward
    ctx.strokeStyle = COAT;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(hipX + swing * 0.4, hipY + 18 - lift * 0.4);
    ctx.lineTo(hipX + swing, hipY + 36 - lift);
    ctx.stroke();
    // Knee highlight
    ctx.strokeStyle = COAT_LT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hipX - 1, hipY + 4);
    ctx.lineTo(hipX + swing * 0.4 - 1, hipY + 17 - lift * 0.4);
    ctx.stroke();
    // Hoof
    ctx.fillStyle = HOOF;
    ctx.beginPath();
    ctx.ellipse(hipX + swing, hipY + 36 - lift, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── Back legs first (behind body in 3/4 view) ──
  // Hindquarter pair is offset further back/up
  drawLeg(-28, -38 - bodyBob, phaseB, false); // back-left (far)
  drawLeg(-24, -38 - bodyBob, phaseA, false); // back-right (near)

  // ── Body barrel (watercolor wash + ink outline) ──
  const bodyGrad = ctx.createLinearGradient(0, -62 - bodyBob, 0, -30 - bodyBob);
  bodyGrad.addColorStop(0, COAT_LT);
  bodyGrad.addColorStop(0.5, COAT);
  bodyGrad.addColorStop(1, COAT_DK);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, -46 - bodyBob, 38, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  // Soft belly shadow
  ctx.fillStyle = 'rgba(42, 32, 20, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -38 - bodyBob, 34, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ink-line outline
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -46 - bodyBob, 38, 17, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Chest bulge (front, where neck meets body)
  ctx.fillStyle = COAT_LT;
  ctx.beginPath();
  ctx.ellipse(28, -42 - bodyBob, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Tail ──
  ctx.strokeStyle = MANE;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-36, -48 - bodyBob);
  ctx.bezierCurveTo(-46, -42 - bodyBob, -52, -32 - bodyBob, -50, -22 - bodyBob);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-44, -38 - bodyBob);
  ctx.lineTo(-54, -28 - bodyBob);
  ctx.stroke();

  // ── Neck (rising from chest forward-up) ──
  ctx.save();
  ctx.translate(32, -52 - bodyBob);
  ctx.rotate(-0.55);
  ctx.fillStyle = COAT;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-4, -26);
  ctx.lineTo(10, -26);
  ctx.lineTo(8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COAT_DK;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Neck highlight
  ctx.fillStyle = COAT_LT;
  ctx.fillRect(-2, -24, 4, 24);
  // Mane along neck crest
  ctx.fillStyle = MANE;
  ctx.beginPath();
  ctx.moveTo(-7, -2);
  ctx.lineTo(-5, -28);
  ctx.lineTo(2, -28);
  ctx.lineTo(0, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── Head ──
  const headX = 50, headY = -78 - bodyBob;
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(-0.15);
  // Skull
  ctx.fillStyle = COAT;
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.lineTo(16, -8);
  ctx.lineTo(20, 4);
  ctx.lineTo(14, 12);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COAT_DK;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Muzzle highlight
  ctx.fillStyle = COAT_LT;
  ctx.beginPath();
  ctx.ellipse(16, 4, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nostril
  ctx.fillStyle = '#2a1208';
  ctx.beginPath();
  ctx.ellipse(18, 6, 1.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye
  ctx.fillStyle = EYE_W;
  ctx.beginPath();
  ctx.ellipse(2, -2, 2.2, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0a08';
  ctx.beginPath();
  ctx.ellipse(2, -2, 1.4, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.fillStyle = COAT;
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.lineTo(-7, -22);
  ctx.lineTo(-1, -14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -14);
  ctx.lineTo(0, -22);
  ctx.lineTo(6, -14);
  ctx.closePath();
  ctx.fill();
  // Red plume between ears
  ctx.fillStyle = PLUME;
  ctx.beginPath();
  ctx.moveTo(-2, -16);
  ctx.bezierCurveTo(-1, -28, 3, -32, 5, -28);
  ctx.bezierCurveTo(4, -22, 2, -18, 0, -16);
  ctx.closePath();
  ctx.fill();
  // Bridle noseband
  ctx.strokeStyle = LEATHER;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(20, 4);
  ctx.stroke();
  // Bridle cheek strap
  ctx.beginPath();
  ctx.moveTo(2, -8);
  ctx.lineTo(14, 4);
  ctx.stroke();
  // Bridle browband (red)
  ctx.strokeStyle = SADDLE_R;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(8, -8);
  ctx.stroke();
  // Bit ring
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.ellipse(18, 8, 1.5, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Reins from bit to withers ──
  ctx.strokeStyle = LEATHER;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(headX + 14, headY + 8);
  ctx.bezierCurveTo(headX + 8, headY + 16, 24, -56 - bodyBob, 18, -58 - bodyBob);
  ctx.stroke();

  // ── Saddle ──
  // Pad (blanket) — blue with red border
  ctx.fillStyle = SADDLE_B;
  ctx.beginPath();
  ctx.ellipse(0, -64 - bodyBob, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SADDLE_R;
  ctx.fillRect(-18, -65 - bodyBob, 36, 1.5);
  ctx.fillRect(-18, -60 - bodyBob, 36, 1.5);
  // Saddle leather seat
  ctx.fillStyle = COAT_DK;
  ctx.beginPath();
  ctx.moveTo(-14, -68 - bodyBob);
  ctx.bezierCurveTo(-16, -72 - bodyBob, 16, -72 - bodyBob, 14, -68 - bodyBob);
  ctx.lineTo(12, -62 - bodyBob);
  ctx.lineTo(-12, -62 - bodyBob);
  ctx.closePath();
  ctx.fill();
  // Pommel + cantle raised parts (gold)
  ctx.fillStyle = GOLD;
  ctx.fillRect(-15, -71 - bodyBob, 3, 5);
  ctx.fillRect(12, -71 - bodyBob, 3, 5);
  // Saddle red trim center
  ctx.fillStyle = SADDLE_R;
  ctx.beginPath();
  ctx.ellipse(0, -68 - bodyBob, 4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stirrup leather
  ctx.strokeStyle = LEATHER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, -64 - bodyBob);
  ctx.lineTo(-2, -48 - bodyBob);
  ctx.stroke();
  // Stirrup ring
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.ellipse(-2, -46 - bodyBob, 3, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Front legs (drawn over body) ──
  drawLeg(16, -40 - bodyBob, phaseA, true); // front-right (near)
  drawLeg(22, -40 - bodyBob, phaseB, true); // front-left (far)

  ctx.restore();
  // Return Y of saddle top in screen space (for placing the rider)
  return sy - 70 * scale - bodyBob * scale;
}

// ── ENTITIES ───────────────────────────────────────────────────
// 3/4 perspective: characters always face camera (head up, feet down).
// Horizontal mirror by velocity x sign so they face left/right when walking.
function drawHero(ctx, sx, sy, facing, t, palette, isMounted, isCharging, chargeLevel, isDodging, dodgeRoll, isMoving, attackAge = 9999, walkIntensity = 0, walkPhaseSmooth = 0) {
  // Sprite-first: try bitmap; fall back to procedural drawing.
  const flipSprite = facing.x < -0.1;
  const ATTACK_DURATION = 500;
  const isAttacking = attackAge < ATTACK_DURATION;

  // ── Walk cycle: phase smoothly accumulated outside (~5.5 Hz at full speed),
  //   intensity ramps 0→1 based on velocity so motion fades in/out gracefully.
  //   sin² for bob (smooth, no kink at zero) ──
  const phase = walkPhaseSmooth;
  const cycle = (Math.floor(phase * 2 / Math.PI) % 2 + 2) % 2; // 0/1 alternation for sprite swap
  const bobNorm = Math.sin(phase) * Math.sin(phase); // sin² — peaks twice per stride, always ≥ 0
  const swayWave = Math.sin(phase);
  // Boosted from the previous very-subtle values — "dead box" was the
  // small amplitudes plus a tendency for walk1/walk2 frames to look near-
  // identical, so the only motion was a ~6px bob. Now: bigger bob, real
  // sway, a stronger body roll, and a visible squash on each step-down.
  const walkBob   = bobNorm * 11  * walkIntensity;
  const walkSway  = swayWave * 5  * walkIntensity;
  const walkTilt  = swayWave * 0.09 * walkIntensity; // ±5° body roll
  const walkScaleY = 1 + bobNorm * 0.08 * walkIntensity;  // squash on contact
  const walkScaleX = 1 - bobNorm * 0.06 * walkIntensity;

  // ── Idle breathing (engages as walkIntensity falls toward 0) ──
  const idle = 1 - walkIntensity;
  const breathe = !isAttacking ? Math.sin(t * 2.2) * 1.2 * idle : 0;
  const idleScaleY = 1 + Math.sin(t * 2.2) * 0.012 * idle;

  // ── Attack: single smooth bell curve, no hard phase boundaries ──
  // bell(p) = sin(πp): zero at start/end, peak at p=0.5. Add a small early
  // anticipation pull via a second harmonic that peaks early then decays.
  let attackLungeX = 0, attackLungeY = 0, attackTilt = 0, attackScaleY = 1, attackScaleX = 1;
  if (isAttacking) {
    const p = attackAge / ATTACK_DURATION;
    const bell = Math.sin(p * Math.PI);              // 0 → 1 → 0 smoothly
    // Anticipation: small negative pulse at p≈0.15
    const ant = Math.sin(p * Math.PI * 1.6) * Math.max(0, 0.18 - p) * 0.9;
    const lunge = bell - ant;                         // smooth start, peak, end
    attackLungeX = lunge * 13 * (flipSprite ? -1 : 1);
    attackLungeY = -Math.max(0, lunge) * 3;
    attackTilt   = lunge * 0.16 * (flipSprite ? -1 : 1);
    attackScaleY = 1 - bell * 0.03 + Math.max(0, lunge) * 0.06;
    attackScaleX = 1 + bell * 0.04 - Math.max(0, lunge) * 0.02;
  }

  // ── Dodge: squash/leap effect ──
  const dodgePop = isDodging ? Math.sin(dodgeRoll * Math.PI) * 6 : 0;

  // Pick the right sprite for this frame
  // Frame swap uses walkIntensity threshold so we don't flicker walk1↔walk2 at low speeds
  let spriteName;
  if (isAttacking) spriteName = 'hero/attack';
  else if (isMounted) spriteName = 'hero/idle';
  else if (walkIntensity > 0.35) spriteName = cycle === 0 ? 'hero/walk1' : 'hero/walk2';
  else spriteName = 'hero/idle';

  const drawX = sx + walkSway + attackLungeX;
  const drawY = sy + 14 - walkBob - breathe + attackLungeY - dodgePop;
  // Combined transform (skip when mounted — handled by gallop wrapper below)
  const heroTilt = isAttacking ? attackTilt : walkTilt;
  const heroScaleX = isAttacking ? attackScaleX : walkScaleX;
  const heroScaleY = isAttacking ? attackScaleY : (walkIntensity > 0 ? walkScaleY : idleScaleY);

  // ── Mounted: horse PNG with gallop motion, hero sprite on top ──
  if (isMounted) {
    const gallopPhase = t * 9;
    const gallopBob   = isMoving ? Math.abs(Math.sin(gallopPhase)) * 10 : Math.sin(t * 1.4) * 1.5;
    const gallopTilt  = isMoving ? Math.sin(gallopPhase) * 0.08 : 0;
    const gallopSway  = isMoving ? Math.sin(gallopPhase * 0.5) * 2.5 : 0;
    const drawGallop = (renderInner) => {
      ctx.save();
      ctx.translate(sx + gallopSway, sy);
      ctx.rotate(gallopTilt);
      ctx.translate(-sx, -sy);
      renderInner();
      ctx.restore();
    };

    // 1. Try the dedicated mounted-hero PNG (rider on horseback in one image)
    let drewMounted = false;
    drawGallop(() => {
      drewMounted = drawSprite(ctx, 'hero/mounted', sx, sy + 14 - gallopBob, {
        flip: flipSprite, scale: 1, anchorY: 'bottom',
      });
    });
    if (drewMounted) {
      if (isCharging && chargeLevel > 0) {
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 36);
        grad.addColorStop(0, `rgba(255, 200, 80, ${0.7 * chargeLevel})`);
        grad.addColorStop(1, 'rgba(255, 150, 40, 0)');
        ctx.fillStyle = grad;
        drawCircle(ctx, sx, sy, 36, ctx.fillStyle);
      }
      return;
    }

    // 2. Composite: horse PNG bobs + tilts, hero sprite sits on top
    let horseDrew = false;
    drawGallop(() => {
      horseDrew = drawSprite(ctx, 'world/horse', sx, sy + 14 - gallopBob, {
        flip: flipSprite, scale: 1.15, anchorY: 'bottom',
      });
    });
    const horseImg = horseDrew ? getSprite('world/horse') : null;
    const horseRise = horseImg ? horseImg.height * (130 / horseImg.height) * 0.55 : 60;
    const heroOnHorseY = sy + 14 - horseRise - gallopBob;
    let drewHero = false;
    drawGallop(() => {
      drewHero = drawSprite(ctx, spriteName, drawX, heroOnHorseY, {
        flip: flipSprite, scale: 0.85, anchorY: 'bottom',
      });
    });
    if (drewHero) {
      if (isCharging && chargeLevel > 0) {
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 36);
        grad.addColorStop(0, `rgba(255, 200, 80, ${0.7 * chargeLevel})`);
        grad.addColorStop(1, 'rgba(255, 150, 40, 0)');
        ctx.fillStyle = grad;
        drawCircle(ctx, sx, sy, 36, ctx.fillStyle);
      }
      // Dust kicks at hooves when galloping
      if (isMoving && Math.sin(gallopPhase) > 0.7) {
        ctx.fillStyle = 'rgba(180, 165, 130, 0.5)';
        drawCircle(ctx, sx - 20, sy + 14, 5, ctx.fillStyle);
        drawCircle(ctx, sx + 20, sy + 14, 5, ctx.fillStyle);
      }
      return;
    }
    // hero sprite missing — fall through to procedural mounted render below
  } else {
    // Apply tilt + scale squash around the hero's anchor (feet at drawY)
    ctx.save();
    ctx.translate(drawX, drawY);
    if (heroTilt) ctx.rotate(heroTilt);
    if (heroScaleX !== 1 || heroScaleY !== 1) ctx.scale(heroScaleX, heroScaleY);
    ctx.translate(-drawX, -drawY);
    const drewUnmounted = drawSprite(ctx, spriteName, drawX, drawY, { flip: flipSprite, scale: 1, anchorY: 'bottom' });
    ctx.restore();
    if (drewUnmounted) {
      if (isCharging && chargeLevel > 0) {
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 36);
        grad.addColorStop(0, `rgba(255, 200, 80, ${0.7 * chargeLevel})`);
        grad.addColorStop(1, 'rgba(255, 150, 40, 0)');
        ctx.fillStyle = grad;
        drawCircle(ctx, sx, sy, 36, ctx.fillStyle);
      }
      // Footstep dust kicks under feet on each foot-strike
      // Footstep dust on each foot-strike (when bob is near a peak)
      if (walkIntensity > 0.35 && Math.sin(phase) * Math.sin(phase) > 0.7) {
        const dustX = sx + (cycle === 0 ? -7 : 7);
        ctx.fillStyle = `rgba(190, 170, 140, ${0.4 * walkIntensity})`;
        ctx.beginPath();
        ctx.ellipse(dustX, sy + 12, 4, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    // sprite missing — continue with procedural fallback below
  }

  ctx.save();
  ctx.translate(sx, sy);
  // Mirror sprite if moving left
  const flip = facing.x < -0.1 ? -1 : 1;
  ctx.scale(flip, 1);

  if (isMounted) {
    // Horse body
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a3c1a';
    ctx.beginPath();
    ctx.ellipse(0, 6, 11, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8f4e28';
    ctx.beginPath();
    ctx.ellipse(0, -4, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Galloping legs
    const gallop = Math.sin(t * 12) * (isMoving ? 4 : 1);
    ctx.fillStyle = '#5a2810';
    ctx.fillRect(-7, 12 + gallop * 0.5, 3, 6);
    ctx.fillRect(4, 12 - gallop * 0.5, 3, 6);
    ctx.fillRect(-6, -2 + gallop * 0.6, 3, 5);
    ctx.fillRect(3, -2 - gallop * 0.6, 3, 5);
    // Mane
    ctx.fillStyle = '#1a0e05';
    ctx.fillRect(-3, -10, 6, 8);
    // Saddle
    ctx.fillStyle = '#1a3a6a';
    ctx.fillRect(-5, 0, 10, 4);
    ctx.fillStyle = '#b02020';
    ctx.fillRect(-3, -1, 6, 2);
  }

  if (isDodging) {
    // Dodge roll: dust trail
    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    drawCircle(ctx, -10, 4, 6, ctx.fillStyle);
    drawCircle(ctx, 10, 4, 6, ctx.fillStyle);
    ctx.scale(1, 1 - 0.5 * dodgeRoll);
  }

  // Walk cycle
  const stride = isMoving ? Math.sin(t * 12) : 0;
  const bob = isMoving ? Math.abs(Math.sin(t * 12)) * 1.2 : Math.sin(t * 1.6) * 0.3;
  const yOff = -bob;

  // ── Soft watercolor shadow under feet ──
  const shadowGrad = ctx.createRadialGradient(0, 10, 0, 0, 10, 14);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!isMounted) {
    // Boots peeking out beneath robe hem
    ctx.fillStyle = INK.outline;
    ctx.fillRect(-4, 8 + stride * 1.2, 3, 5);
    ctx.fillRect(1, 8 - stride * 1.2, 3, 5);
  }

  // ── Trailing cloak/sleeve behind (forward-walking direction) ──
  if (isMoving && !isMounted) {
    ctx.save();
    ctx.fillStyle = `rgba(244, 236, 216, ${0.45 + Math.sin(t * 8) * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(-6, 4 + yOff);
    ctx.bezierCurveTo(-10, 8, -8 + stride * 2, 14, -2, 12 + yOff);
    ctx.lineTo(0, 6 + yOff);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ── Robe body — trapezoidal, flares at hem (bottom), gradient-shaded ──
  const robeMain = palette.tunic || INK.ivory;
  const robeAccent = palette.cloak || INK.indigo;
  const robeRim = palette.headband || INK.outlineSft;

  ctx.save();
  // Robe outline path (slightly flared at bottom)
  ctx.beginPath();
  ctx.moveTo(-8, -6 + yOff);
  ctx.bezierCurveTo(-9, -4 + yOff, -10, 4 + yOff, -11, 9 + yOff);
  ctx.lineTo(11, 9 + yOff);
  ctx.bezierCurveTo(10, 4 + yOff, 9, -4 + yOff, 8, -6 + yOff);
  ctx.closePath();
  // Watercolor gradient fill
  const robeGrad = ctx.createLinearGradient(0, -7, 0, 12);
  robeGrad.addColorStop(0, robeMain);
  robeGrad.addColorStop(1, shadeColor(robeMain, -0.35));
  ctx.fillStyle = robeGrad;
  ctx.fill();
  // Ink outline
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // Robe inner trim (vertical accent stripe)
  ctx.fillStyle = robeAccent;
  ctx.fillRect(-1.2, -5 + yOff, 2.4, 14);

  // ── Sash with knot at waist ──
  ctx.fillStyle = robeRim;
  ctx.fillRect(-9, 0 + yOff, 18, 2.2);
  // Sash knot in center
  ctx.fillStyle = shadeColor(robeRim, -0.2);
  ctx.fillRect(-2, 0 + yOff, 4, 4);
  // Sash tail trailing
  ctx.fillStyle = robeRim;
  ctx.fillRect(-1, 3 + yOff, 1.5, 5);

  // ── Arms — slim sleeves with hand at end ──
  const armSwing = isMoving ? -stride * 0.6 : 0;
  // Left sleeve
  ctx.save();
  ctx.translate(-8, -3 + yOff);
  ctx.rotate(armSwing * 0.3);
  ctx.fillStyle = robeMain;
  ctx.beginPath();
  ctx.moveTo(-2, 0); ctx.lineTo(-3, 9); ctx.lineTo(2, 9); ctx.lineTo(1, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK.outline; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = '#f2c9a0';
  drawCircle(ctx, -0.5, 9, 1.8, ctx.fillStyle, INK.outlineSft, 0.6);
  ctx.restore();
  // Right sleeve (holds spear)
  ctx.save();
  ctx.translate(8, -3 + yOff);
  ctx.rotate(-armSwing * 0.3);
  ctx.fillStyle = robeMain;
  ctx.beginPath();
  ctx.moveTo(-1, 0); ctx.lineTo(-2, 9); ctx.lineTo(3, 9); ctx.lineTo(2, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK.outline; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = '#f2c9a0';
  drawCircle(ctx, 0.5, 9, 1.8, ctx.fillStyle, INK.outlineSft, 0.6);
  ctx.restore();

  // ── Head (slimmer, with face hint) ──
  // Long queue/braid trailing behind
  ctx.strokeStyle = '#1a0e0a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -7 + yOff);
  ctx.bezierCurveTo(0, -2 + yOff, -1, 4 + yOff, -2 + Math.sin(t * 6) * 0.5, 10 + yOff);
  ctx.stroke();
  ctx.fillStyle = '#1a0e0a';
  drawCircle(ctx, -2 + Math.sin(t * 6) * 0.5, 11 + yOff, 1.4, ctx.fillStyle);

  // Face
  ctx.fillStyle = '#e8c89c';
  ctx.beginPath();
  ctx.ellipse(0, -12 + yOff, 5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.outlineSft;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Eyes — narrow ink strokes
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-2.4, -13.4 + yOff); ctx.lineTo(-1.2, -13.4 + yOff);
  ctx.moveTo(1.2, -13.4 + yOff);  ctx.lineTo(2.4, -13.4 + yOff);
  ctx.stroke();

  // ── Conical bamboo traveler hat (斗笠) seen from above ──
  // Outer rim
  ctx.fillStyle = '#a88840';
  ctx.beginPath();
  ctx.ellipse(0, -12 + yOff, 8.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Inner cone (raised peak)
  ctx.fillStyle = '#7a6028';
  ctx.beginPath();
  ctx.ellipse(0, -13.5 + yOff, 4.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.outlineSft;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // Hat-band ribbon (red sash tied around brim)
  ctx.strokeStyle = INK.vermilion;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-7, -10.5 + yOff);
  ctx.lineTo(7, -10.5 + yOff);
  ctx.stroke();
  // Ribbon ends trailing
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(7, -10.5 + yOff);
  ctx.bezierCurveTo(10, -8 + yOff, 9, -5 + yOff, 8, -2 + yOff);
  ctx.stroke();

  // ── Spear: graceful slim shaft with red tassel and ornate tip ──
  // Shaft (lacquered wood gradient)
  const spearGrad = ctx.createLinearGradient(7, 4 + yOff, 7, -34 + yOff);
  spearGrad.addColorStop(0, '#5a3818');
  spearGrad.addColorStop(0.5, '#8a6028');
  spearGrad.addColorStop(1, '#5a3818');
  ctx.strokeStyle = spearGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(7, 6 + yOff);
  ctx.lineTo(7, -34 + yOff);
  ctx.stroke();
  // Tassel below tip — a flourish of red
  ctx.fillStyle = INK.vermilion;
  ctx.beginPath();
  ctx.moveTo(5.5, -28 + yOff);
  ctx.lineTo(8.5, -28 + yOff);
  ctx.lineTo(9, -22 + yOff);
  ctx.lineTo(7, -20 + yOff);
  ctx.lineTo(5, -22 + yOff);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK.vermilionD;
  ctx.fillRect(6, -22 + yOff, 2, 1);
  // Spear tip — leaf-shaped blade with darker center vein
  ctx.fillStyle = '#e8e0c0';
  ctx.beginPath();
  ctx.moveTo(7, -42 + yOff);
  ctx.bezierCurveTo(2, -35 + yOff, 4, -30 + yOff, 7, -28 + yOff);
  ctx.bezierCurveTo(10, -30 + yOff, 12, -35 + yOff, 7, -42 + yOff);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Center vein
  ctx.strokeStyle = '#a89878';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(7, -42 + yOff);
  ctx.lineTo(7, -29 + yOff);
  ctx.stroke();

  // Charge glow
  if (isCharging && chargeLevel > 0) {
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 36);
    grad.addColorStop(0, `rgba(255, 200, 80, ${0.7 * chargeLevel})`);
    grad.addColorStop(1, 'rgba(255, 150, 40, 0)');
    ctx.fillStyle = grad;
    drawCircle(ctx, 0, 0, 36, ctx.fillStyle);
    if (chargeLevel > 0.3) {
      const sg = ctx.createRadialGradient(7, -38, 0, 7, -38, 14);
      sg.addColorStop(0, `rgba(255, 240, 180, ${chargeLevel})`);
      sg.addColorStop(1, 'rgba(255, 200, 80, 0)');
      ctx.fillStyle = sg;
      drawCircle(ctx, 7, -38, 14, ctx.fillStyle);
    }
  }

  ctx.restore();
}

// Lightens or darkens a hex color by amount in [-1..1]
function shadeColor(hex, amt) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return hex;
  const adj = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  const r = adj(parseInt(m[1], 16));
  const g = adj(parseInt(m[2], 16));
  const b = adj(parseInt(m[3], 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawAttackSlash(ctx, sx, sy, facing, age, isHeavy = false) {
  if (age > 320) return;
  const ang = Math.atan2(facing.x, -facing.z);
  const t = age / 320;
  const arcStart = -Math.PI * 0.35 + t * Math.PI * 0.4;
  const arcEnd = arcStart + Math.PI * 0.65;
  const r = isHeavy ? 38 : 28;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  ctx.strokeStyle = isHeavy ? `rgba(255, 200, 60, ${1 - t})` : `rgba(255, 240, 200, ${0.85 * (1 - t)})`;
  ctx.lineWidth = isHeavy ? 6 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r, arcStart - Math.PI / 2, arcEnd - Math.PI / 2);
  ctx.stroke();
  // Inner flash
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - t)})`;
  ctx.lineWidth = isHeavy ? 3 : 2;
  ctx.stroke();
  ctx.restore();
}

function drawNpc(ctx, sx, sy, npcId, isHighlighted, t) {
  // Per-NPC phase offset so they don't all sync.
  // Boosted from 1.2/0.8 — those amplitudes were nearly invisible at game scale.
  const phase = (npcId.charCodeAt(0) || 0) * 0.7;
  const breathe = Math.sin(t * 1.8 + phase) * 2.8;
  const sway = Math.sin(t * 0.9 + phase) * 2.2;
  // Try bitmap sprite first
  if (drawSprite(ctx, `npc/${npcId}`, sx + sway, sy + 14 - breathe, { scale: 1, anchorY: 'bottom' })) {
    if (isHighlighted) {
      const pulse = 0.7 + Math.sin(t * 4) * 0.3;
      ctx.strokeStyle = `rgba(255, 224, 96, ${0.7 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 12, 18, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  const style = NPC_STYLES[npcId] || NPC_STYLES.villager;
  const accessory = style.accessory || 'sage';

  // Highlight: golden lotus ring on the ground
  if (isHighlighted) {
    const pulse = 0.7 + Math.sin(t * 4) * 0.3;
    // Glow
    const glow = ctx.createRadialGradient(sx, sy + 10, 0, sx, sy + 10, 22);
    glow.addColorStop(0, `rgba(255, 220, 130, ${0.35 * pulse})`);
    glow.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = glow;
    drawCircle(ctx, sx, sy + 10, 22, ctx.fillStyle);
    // Petal ring
    ctx.strokeStyle = `rgba(212, 160, 80, ${0.7 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 9, 16, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Watercolor shadow
  const shadowGrad = ctx.createRadialGradient(sx, sy + 9, 0, sx, sy + 9, 14);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 9, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Boots
  ctx.fillStyle = INK.outline;
  ctx.fillRect(sx - 4, sy + 6, 3, 5);
  ctx.fillRect(sx + 1, sy + 6, 3, 5);

  // ── Flowing robe (trapezoidal flare) ──
  const robe = style.robe;
  const robeLight = style.robeLight || shadeColor(robe, 0.25);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx - 8, sy - 6);
  ctx.bezierCurveTo(sx - 9, sy - 4, sx - 10, sy + 4, sx - 11, sy + 9);
  ctx.lineTo(sx + 11, sy + 9);
  ctx.bezierCurveTo(sx + 10, sy + 4, sx + 9, sy - 4, sx + 8, sy - 6);
  ctx.closePath();
  const robeGrad = ctx.createLinearGradient(sx - 8, sy - 7, sx + 8, sy + 9);
  robeGrad.addColorStop(0, robeLight);
  robeGrad.addColorStop(1, shadeColor(robe, -0.3));
  ctx.fillStyle = robeGrad;
  ctx.fill();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // Inner robe trim (vertical center stripe)
  ctx.fillStyle = shadeColor(robe, -0.15);
  ctx.fillRect(sx - 1, sy - 5, 2, 14);

  // Sash with knot
  ctx.fillStyle = style.sash;
  ctx.fillRect(sx - 9, sy, 18, 2.4);
  ctx.fillStyle = shadeColor(style.sash, -0.2);
  ctx.fillRect(sx - 2, sy, 4, 4);
  ctx.fillStyle = style.sash;
  ctx.fillRect(sx - 1, sy + 3, 1.5, 5);

  // Sleeves
  ctx.save();
  // Left sleeve (slight droop)
  ctx.fillStyle = robeGrad;
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(sx - 8, sy - 4);
  ctx.lineTo(sx - 11, sy + 5);
  ctx.lineTo(sx - 7, sy + 5);
  ctx.lineTo(sx - 5, sy - 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Right sleeve
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(sx + 8, sy - 4);
  ctx.lineTo(sx + 11, sy + 5);
  ctx.lineTo(sx + 7, sy + 5);
  ctx.lineTo(sx + 5, sy - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Hands peeking from sleeves
  ctx.fillStyle = '#e8c89c';
  drawCircle(ctx, sx - 9, sy + 5, 1.7, ctx.fillStyle, INK.outlineSft, 0.6);
  drawCircle(ctx, sx + 9, sy + 5, 1.7, ctx.fillStyle, INK.outlineSft, 0.6);

  // ── Face ──
  ctx.fillStyle = '#e8c89c';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 11, 5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK.outlineSft;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Eyes — narrow ink strokes
  ctx.strokeStyle = INK.outline;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(sx - 2.4, sy - 12.5); ctx.lineTo(sx - 1.2, sy - 12.5);
  ctx.moveTo(sx + 1.2, sy - 12.5); ctx.lineTo(sx + 2.4, sy - 12.5);
  ctx.stroke();

  // ── Headwear / hairstyle by accessory type ──
  if (accessory === 'scholar') {
    // Black official's hat (官帽) — squared with side flaps
    ctx.fillStyle = INK.outline;
    ctx.fillRect(sx - 7, sy - 18, 14, 5);
    ctx.fillRect(sx - 8, sy - 14, 16, 2);
    // Side flaps
    ctx.fillRect(sx - 10, sy - 15, 3, 2);
    ctx.fillRect(sx + 7, sy - 15, 3, 2);
    // Top button
    ctx.fillStyle = INK.goldDull;
    ctx.fillRect(sx - 1, sy - 20, 2, 2);
  } else if (accessory === 'warrior') {
    // Topknot wrap with red ribbon
    ctx.fillStyle = '#1a0e0a';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 17, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK.vermilion;
    ctx.fillRect(sx - 4, sy - 16, 8, 1.4);
  } else if (accessory === 'sage') {
    // Long white beard hint + simple hairband
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.moveTo(sx - 3, sy - 7);
    ctx.lineTo(sx, sy - 1);
    ctx.lineTo(sx + 3, sy - 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK.outlineSft;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Hat — wide brim sage cap
    ctx.fillStyle = style.hat || INK.earthDark;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 16, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadeColor(style.hat || INK.earthDark, -0.2);
    ctx.beginPath();
    ctx.ellipse(sx, sy - 17.5, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Long thin staff held in left hand
    ctx.strokeStyle = INK.earth;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx - 11, sy + 5);
    ctx.lineTo(sx - 13, sy - 18);
    ctx.stroke();
    ctx.fillStyle = INK.goldDull;
    drawCircle(ctx, sx - 13, sy - 19, 1.8, ctx.fillStyle);
  } else if (accessory === 'fan') {
    // Scholar with folding fan (held)
    ctx.fillStyle = '#1a0e0a';
    ctx.fillRect(sx - 3, sy - 18, 6, 3);
    ctx.fillStyle = INK.outline;
    ctx.fillRect(sx - 5, sy - 15, 10, 1.5);
    // Fan in right hand — open semicircle
    ctx.save();
    ctx.translate(sx + 9, sy + 5);
    ctx.rotate(0.4);
    ctx.fillStyle = INK.ivory;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 7, -Math.PI * 0.6, -Math.PI * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK.outline;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Fan ribs
    for (let i = -3; i <= 1; i++) {
      const a = -Math.PI * 0.32 + i * 0.13;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
      ctx.stroke();
    }
    ctx.restore();
  } else if (accessory === 'sword') {
    // Wide bamboo traveler's hat
    ctx.fillStyle = '#a88840';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 12, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#7a6028';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 13.5, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sword strapped on back (jian)
    ctx.strokeStyle = INK.outlineSft;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + 8, sy - 7);
    ctx.lineTo(sx + 11, sy + 6);
    ctx.stroke();
    ctx.fillStyle = INK.vermilionD;
    ctx.fillRect(sx + 8.5, sy - 8, 2.5, 3);
  }
}

function drawEnemy(ctx, enemy, sx, sy, isHighlighted, hitFlash, t, attackFx) {
  const style = ENEMY_STYLES[enemy.type] || ENEMY_STYLES.raider;
  const sz = style.size;
  const isWarlord = enemy.type === 'warlord';

  // Stagger from hit (applied to both sprite and procedural paths)
  const hitAge = attackFx?.enemyId === enemy.id ? Date.now() - attackFx.at : 9999;
  const staggerEarly = hitAge < 340 ? Math.sin((hitAge / 340) * Math.PI) * 5 : 0;

  // Per-enemy phase + idle bob/sway. Telegraph windup adds a forward lunge.
  // Bumped 2× — the prior amplitudes (1.8/1.0 * sz) read as stationary.
  const phase = (parseInt(enemy.id.slice(-2), 36) || 0) * 0.41;
  const idleBobSin = Math.sin(t * 2.0 + phase);
  const idleBob = idleBobSin * idleBobSin * (3.6 * sz);
  const idleSway = Math.sin(t * 1.3 + phase) * (2.2 * sz);
  const telegraphMs = enemy.telegraphAt ? enemy.telegraphAt - Date.now() : 9999;
  const isWindup = telegraphMs > -100 && telegraphMs < 400;
  const windupP = isWindup ? 1 - Math.max(0, telegraphMs) / 400 : 0;
  const windupBob = windupP * 4 * sz;

  // Try bitmap sprite first
  if (drawSprite(ctx, `enemy/${enemy.type}`, sx + idleSway, sy + 14 + staggerEarly - idleBob - windupBob, {
    scale: sz,
    anchorY: 'bottom',
    alpha: hitFlash ? 0.85 : 1,
  })) {
    // HP bar overlay
    const hpPct = enemy.hp / enemy.maxHp;
    if (hpPct < 1 || isHighlighted) {
      const barW = 22 * sz;
      const barX = sx - barW / 2;
      const barY = sy - 24 * sz;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, 5);
      ctx.fillStyle = hpPct > 0.5 ? '#44dd66' : hpPct > 0.25 ? '#ddcc22' : '#ee3333';
      ctx.fillRect(barX, barY, barW * hpPct, 3);
    }
    if (isHighlighted) {
      const pulse = 0.6 + Math.sin(t * 6) * 0.3;
      ctx.strokeStyle = `rgba(255, 80, 60, ${0.7 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 12 * sz, 16 * sz, 5 * sz, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }

  // Apply stagger from hit (already computed above)
  sy += staggerEarly;

  // Warlord aura
  if (isWarlord) {
    const pulse = 0.3 + Math.sin(t * 3) * 0.15;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50);
    grad.addColorStop(0, `rgba(255, 32, 16, ${pulse})`);
    grad.addColorStop(1, 'rgba(255, 32, 16, 0)');
    ctx.fillStyle = grad;
    drawCircle(ctx, sx, sy, 50, ctx.fillStyle);
    ctx.strokeStyle = `rgba(255, 32, 32, ${0.6 + Math.sin(t * 3) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy + 8, 28, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Highlight ring
  if (isHighlighted) {
    const pulse = 0.6 + Math.sin(t * 6) * 0.3;
    ctx.strokeStyle = `rgba(255, 80, 60, ${0.7 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 8 * sz, 16 * sz, 6 * sz, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Telegraph (windup before attack)
  if (enemy.telegraphAt && Date.now() > enemy.telegraphAt - 400 && Date.now() < enemy.telegraphAt + 100) {
    const phase = 1 - Math.max(0, enemy.telegraphAt - Date.now()) / 400;
    ctx.fillStyle = `rgba(255, 60, 20, ${0.4 * phase})`;
    drawCircle(ctx, sx, sy, 24 * sz * phase, ctx.fillStyle);
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 8 * sz, 11 * sz, 5 * sz, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body / armor
  const bodyColor = hitFlash ? '#ffd8a8' : style.body;
  const plateColor = hitFlash ? '#ffe0b0' : style.plate;
  drawRoundedRect(ctx, sx - 9 * sz, sy - 6 * sz, 18 * sz, 18 * sz, 4, bodyColor, plateColor, 2);
  // Chest plate accent
  ctx.fillStyle = plateColor;
  ctx.fillRect(sx - 6 * sz, sy - 4 * sz, 12 * sz, 12 * sz);
  ctx.fillStyle = style.accent;
  ctx.fillRect(sx - 1 * sz, sy - 4 * sz, 2 * sz, 12 * sz);

  // Helmet head
  const skinColor = hitFlash ? '#fff1cf' : '#c89070';
  drawCircle(ctx, sx, sy - 10 * sz, 6 * sz, skinColor, '#5a3820', 1);
  ctx.fillStyle = '#1a1010';
  ctx.fillRect(sx - 7 * sz, sy - 16 * sz, 14 * sz, 4 * sz);
  // Helmet crest (varies by type)
  ctx.fillStyle = style.accent;
  ctx.fillRect(sx - 1.5 * sz, sy - 20 * sz, 3 * sz, 4 * sz);
  // Red glowing eyes
  ctx.fillStyle = '#ff2020';
  ctx.fillRect(sx - 3 * sz, sy - 11 * sz, 1.5 * sz, 1.5 * sz);
  ctx.fillRect(sx + 1.5 * sz, sy - 11 * sz, 1.5 * sz, 1.5 * sz);

  // ── Weapon varies by enemy type ──
  drawEnemyWeapon(ctx, enemy.type, sx, sy, sz, t, style.accent);

  // Boss / captain banner on back
  if (enemy.type === 'captain' || enemy.type === 'warlord') {
    const flutter = Math.sin(t * 4 + sx * 0.01) * 2;
    ctx.fillStyle = '#1a0a08';
    ctx.fillRect(sx - 0.5, sy - 30 * sz, 1, 14 * sz);
    ctx.fillStyle = enemy.type === 'warlord' ? '#cc1818' : '#aa3030';
    ctx.beginPath();
    ctx.moveTo(sx + 1, sy - 30 * sz);
    ctx.lineTo(sx + 14 * sz + flutter, sy - 28 * sz);
    ctx.lineTo(sx + 14 * sz + flutter, sy - 18 * sz);
    ctx.lineTo(sx + 1, sy - 20 * sz);
    ctx.closePath();
    ctx.fill();
    // Banner symbol
    ctx.fillStyle = '#ffd060';
    ctx.font = `${Math.floor(7 * sz)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(enemy.type === 'warlord' ? '将' : '队', sx + 7 * sz + flutter / 2, sy - 24 * sz);
  }

  // HP bar (always for hostile, fades when full)
  const hpPct = enemy.hp / enemy.maxHp;
  if (hpPct < 1 || isHighlighted) {
    const barW = 22 * sz;
    const barX = sx - barW / 2;
    const barY = sy - 24 * sz;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 5);
    ctx.fillStyle = hpPct > 0.5 ? '#44dd66' : hpPct > 0.25 ? '#ddcc22' : '#ee3333';
    ctx.fillRect(barX, barY, barW * hpPct, 3);
  }
}

function drawEnemyWeapon(ctx, type, sx, sy, sz, t, accent) {
  if (type === 'archer') {
    // Bow
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 1.8 * sz;
    ctx.beginPath();
    ctx.arc(sx + 11 * sz, sy - 6 * sz, 9 * sz, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    // Bowstring
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(sx + 11 * sz, sy - 14 * sz);
    ctx.lineTo(sx + 14 * sz, sy - 6 * sz);
    ctx.lineTo(sx + 11 * sz, sy + 2 * sz);
    ctx.stroke();
    // Arrow nocked
    ctx.strokeStyle = '#a07840';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx + 14 * sz, sy - 6 * sz);
    ctx.lineTo(sx + 22 * sz, sy - 6 * sz);
    ctx.stroke();
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.moveTo(sx + 24 * sz, sy - 6 * sz);
    ctx.lineTo(sx + 21 * sz, sy - 8 * sz);
    ctx.lineTo(sx + 21 * sz, sy - 4 * sz);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'berserker') {
    // Dual axes (one each side)
    const swing = Math.sin(t * 5) * 4 * sz;
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#5a3818';
      ctx.lineWidth = 1.5 * sz;
      ctx.beginPath();
      ctx.moveTo(sx + side * 12 * sz, sy + 4 * sz);
      ctx.lineTo(sx + side * 14 * sz, sy - 14 * sz - swing);
      ctx.stroke();
      // Axe head
      ctx.fillStyle = '#888090';
      ctx.beginPath();
      ctx.moveTo(sx + side * 14 * sz, sy - 14 * sz - swing);
      ctx.lineTo(sx + side * 20 * sz, sy - 10 * sz - swing);
      ctx.lineTo(sx + side * 20 * sz, sy - 18 * sz - swing);
      ctx.lineTo(sx + side * 14 * sz, sy - 22 * sz - swing);
      ctx.closePath();
      ctx.fill();
      // Blood stain on axe
      ctx.fillStyle = 'rgba(160, 30, 20, 0.6)';
      ctx.fillRect(sx + side * 16 * sz, sy - 16 * sz - swing, 3 * sz, 4 * sz);
    }
  } else if (type === 'scout') {
    // Short sword
    ctx.strokeStyle = '#888090';
    ctx.lineWidth = 1.5 * sz;
    ctx.beginPath();
    ctx.moveTo(sx + 10 * sz, sy + 4 * sz);
    ctx.lineTo(sx + 14 * sz, sy - 14 * sz);
    ctx.stroke();
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 2 * sz;
    ctx.beginPath();
    ctx.moveTo(sx + 9 * sz, sy + 4 * sz);
    ctx.lineTo(sx + 11 * sz, sy + 4 * sz);
    ctx.stroke();
  } else if (type === 'guard') {
    // Halberd + small shield
    ctx.fillStyle = '#3a3a48';
    ctx.beginPath();
    ctx.arc(sx - 11 * sz, sy - 2 * sz, 5 * sz, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(sx - 11 * sz, sy - 2 * sz, 3 * sz, 0, Math.PI * 2);
    ctx.fill();
    // Halberd
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 1.8 * sz;
    ctx.beginPath();
    ctx.moveTo(sx + 12 * sz, sy + 8 * sz);
    ctx.lineTo(sx + 14 * sz, sy - 24 * sz);
    ctx.stroke();
    ctx.fillStyle = '#a0a0c0';
    ctx.beginPath();
    ctx.moveTo(sx + 14 * sz, sy - 30 * sz);
    ctx.lineTo(sx + 9 * sz, sy - 22 * sz);
    ctx.lineTo(sx + 19 * sz, sy - 22 * sz);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'warlord') {
    // Massive two-handed sword
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 3 * sz;
    ctx.beginPath();
    ctx.moveTo(sx + 14 * sz, sy + 8 * sz);
    ctx.lineTo(sx + 20 * sz, sy - 30 * sz);
    ctx.stroke();
    // Wide blade
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.moveTo(sx + 20 * sz, sy - 36 * sz);
    ctx.lineTo(sx + 15 * sz, sy - 30 * sz);
    ctx.lineTo(sx + 16 * sz, sy + 4 * sz);
    ctx.lineTo(sx + 24 * sz, sy + 4 * sz);
    ctx.lineTo(sx + 25 * sz, sy - 30 * sz);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Cross-guard
    ctx.fillStyle = '#5a3018';
    ctx.fillRect(sx + 13 * sz, sy + 4 * sz, 14 * sz, 3 * sz);
    // Glowing rune on blade
    ctx.fillStyle = `rgba(255, 80, 40, ${0.6 + Math.sin(t * 3) * 0.3})`;
    ctx.beginPath();
    ctx.arc(sx + 20 * sz, sy - 16 * sz, 2 * sz, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Default: halberd (raider, captain)
    ctx.strokeStyle = '#888090';
    ctx.lineWidth = 2 * sz;
    ctx.beginPath();
    ctx.moveTo(sx + 12 * sz, sy + 8 * sz);
    ctx.lineTo(sx + 14 * sz, sy - 22 * sz);
    ctx.stroke();
    ctx.fillStyle = '#c0c0d8';
    ctx.beginPath();
    ctx.moveTo(sx + 14 * sz, sy - 26 * sz);
    ctx.lineTo(sx + 11 * sz, sy - 18 * sz);
    ctx.lineTo(sx + 17 * sz, sy - 18 * sz);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSuperFx(ctx, sx, sy, type, age) {
  if (type === 'dragon' && age < 1200) {
    const t = age / 1200;
    const s = Math.sin(t * Math.PI);
    // Outer ring
    ctx.strokeStyle = `rgba(255, 104, 32, ${0.7 * s})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, (1 + s * 4) * 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 204, 64, ${0.4 * s})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, (1 + s * 6) * 28, 0, Math.PI * 2);
    ctx.stroke();
    // Beam upward
    ctx.fillStyle = `rgba(255, 136, 48, ${0.85 * s})`;
    ctx.fillRect(sx - 4, sy - 80 * s, 8, 80 * s);
  }
  if (type === 'storm' && age < 1400) {
    const t = age / 1400;
    const s = Math.sin(t * Math.PI);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t * Math.PI * 6);
    ctx.strokeStyle = `rgba(96, 200, 255, ${0.65 * s})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, (1 + s * 3) * 26, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * s})`;
    drawCircle(ctx, 0, 0, (1 + s * 6) * 18, ctx.fillStyle);
    ctx.restore();
  }
  if (type === 'shadow' && age < 1100) {
    const t = age / 1100;
    const s = Math.sin(t * Math.PI);
    // Purple aura
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60);
    grad.addColorStop(0, `rgba(180, 100, 255, ${0.7 * s})`);
    grad.addColorStop(1, 'rgba(60, 20, 120, 0)');
    ctx.fillStyle = grad;
    drawCircle(ctx, sx, sy, 60, ctx.fillStyle);
    // Trail
    for (let i = 0; i < 5; i++) {
      const off = i * 12 * s;
      ctx.fillStyle = `rgba(180, 100, 255, ${0.4 * s * (1 - i / 5)})`;
      drawCircle(ctx, sx - off, sy + off * 0.3, 8 * (1 - i / 5), ctx.fillStyle);
    }
  }
}

function drawLockOnReticle(ctx, sx, sy, t) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(t * 1.5);
  ctx.strokeStyle = '#ff4040';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(20, -2);
    ctx.lineTo(28, -2);
    ctx.lineTo(28, 2);
    ctx.lineTo(20, 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ── MAIN COMPONENT ─────────────────────────────────────────────
export function GameCanvas(props) {
  const canvasRef = useRef(null);
  const propsRef = useRef(props);
  useEffect(() => { propsRef.current = props; });

  // Persistent state across renders
  const heroRef = useRef({
    x: 0, z: 12, y: 0,
    vx: 0, vz: 0,
    facing: { x: 0, z: -1 },
    lastNonZeroFacing: { x: 0, z: -1 },
  });
  const cameraRef = useRef({ x: 0, z: 12, shakeT: 0 });
  const keysRef = useRef({ forward: false, backward: false, left: false, right: false });
  const dodgeStateRef = useRef({ active: false, t: 0, dirX: 0, dirZ: -1 });
  const lastDodgeAt = useRef(0);
  // Smooth walk-intensity ramp — 0 = idle, 1 = full walk. Eased toward target
  // each tick so animations fade in/out instead of snapping.
  const walkIntensityRef = useRef(0);
  // Persistent walk-cycle phase (smoothly accumulated) — never resets, so
  // restarting movement doesn't snap the stride pose to zero.
  const walkPhaseRef = useRef(0);
  const particlesRef = useRef([]);
  const lastFootstepAt = useRef(0);
  const lastAttackFxAt = useRef(0);
  const lastAliveEnemiesRef = useRef(new Set());
  const ambientSpawnAt = useRef(0);

  // Preload all sprites once (silent failure: missing PNGs fall back to procedural)
  useEffect(() => { preloadAllSprites(); }, []);

  // Keyboard input
  useEffect(() => {
    const handle = (pressed) => (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keysRef.current.forward = pressed; break;
        case 'KeyS': case 'ArrowDown':  keysRef.current.backward = pressed; break;
        case 'KeyA': case 'ArrowLeft':  keysRef.current.left = pressed; break;
        case 'KeyD': case 'ArrowRight': keysRef.current.right = pressed; break;
        default:
      }
    };
    const down = handle(true);
    const up = handle(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Pointer (tap) input — convert to world coords and test entities
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
      const dpr = window.devicePixelRatio || 1;
      const cssX = px / dpr;
      const cssY = py / dpr;
      const vw = rect.width;
      const vh = rect.height;
      const cam = cameraRef.current;
      const wx = (cssX - vw / 2) / PIXELS_PER_UNIT + cam.x;
      const wz = (cssY - vh / 2) / PIXELS_PER_UNIT + cam.z;
      // Test enemies
      const cur = propsRef.current;
      const enemies = cur.enemies || [];
      let bestEnemy = null, bestEnemyDist = Infinity;
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const d = Math.hypot(enemy.x - wx, enemy.z - wz);
        if (d < 2.5 && d < bestEnemyDist) { bestEnemy = enemy; bestEnemyDist = d; }
      }
      if (bestEnemy) {
        cur.onEnemyTap?.(bestEnemy.id);
        return;
      }
      // Test NPCs
      let bestNpc = null, bestNpcDist = Infinity;
      for (const npc of NPCS) {
        const w = tileToWorldPosition(npc);
        const d = Math.hypot(w.x - wx, w.z - wz);
        if (d < 2.5 && d < bestNpcDist) { bestNpc = npc; bestNpcDist = d; }
      }
      if (bestNpc) {
        cur.onNpcTap?.(bestNpc.id);
      }
    };
    canvas.addEventListener('pointerdown', onPointer);
    return () => canvas.removeEventListener('pointerdown', onPointer);
  }, []);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let last = performance.now();
    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    const tick = (nowMs) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      const t = nowMs * 0.001;

      // Hit-stop freeze: skip simulation but keep rendering the last frame
      if (Date.now() < (window.__hitStopUntil || 0)) {
        raf = window.requestAnimationFrame(tick);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const vw = rect.width;
      const vh = rect.height;
      if (canvas.width !== Math.floor(vw * dpr) || canvas.height !== Math.floor(vh * dpr)) resize();

      const cur = propsRef.current;
      if (cur.chapter && cur.chapter !== terrainChapter) terrainChapter = cur.chapter;
      const hero = heroRef.current;
      const keys = keysRef.current;
      const move = cur.moveInput || {};

      // Compute movement direction
      const dx = (keys.left || move.left ? -1 : 0) + (keys.right || move.right ? 1 : 0);
      const dz = (keys.forward || move.forward ? -1 : 0) + (keys.backward || move.backward ? 1 : 0);
      const isMoving = dx !== 0 || dz !== 0;
      const len = Math.hypot(dx, dz) || 1;
      const ndx = dx / len, ndz = dz / len;

      // Speed
      const baseSpeed = cur.isMounted ? 42 : cur.isSprinting ? 32 : 18;
      const lerpAmt = cur.isMounted ? 0.45 : cur.isSprinting ? 0.35 : 0.2;
      const targetVx = isMoving ? ndx * baseSpeed : 0;
      const targetVz = isMoving ? ndz * baseSpeed : 0;
      hero.vx = hero.vx + (targetVx - hero.vx) * lerpAmt;
      hero.vz = hero.vz + (targetVz - hero.vz) * lerpAmt;
      hero.x += hero.vx * dt;
      hero.z += hero.vz * dt;

      // Facing
      if (isMoving) {
        hero.facing.x = ndx;
        hero.facing.z = ndz;
        hero.lastNonZeroFacing.x = ndx;
        hero.lastNonZeroFacing.z = ndz;
      } else {
        hero.facing.x = hero.lastNonZeroFacing.x;
        hero.facing.z = hero.lastNonZeroFacing.z;
      }

      // Dodge roll: forward burst when isDodging flips on
      if (cur.isDodging && !dodgeStateRef.current.active && Date.now() - lastDodgeAt.current > 400) {
        dodgeStateRef.current.active = true;
        dodgeStateRef.current.t = 0;
        const dl = Math.hypot(hero.vx, hero.vz);
        if (dl > 0.5) {
          dodgeStateRef.current.dirX = hero.vx / dl;
          dodgeStateRef.current.dirZ = hero.vz / dl;
        } else {
          dodgeStateRef.current.dirX = hero.lastNonZeroFacing.x;
          dodgeStateRef.current.dirZ = hero.lastNonZeroFacing.z;
        }
        lastDodgeAt.current = Date.now();
      }
      let dodgeRoll = 0;
      if (dodgeStateRef.current.active) {
        dodgeStateRef.current.t = Math.min(dodgeStateRef.current.t + dt * 3.5, 1);
        const dp = Math.sin(dodgeStateRef.current.t * Math.PI);
        hero.x += dodgeStateRef.current.dirX * dp * dt * 22;
        hero.z += dodgeStateRef.current.dirZ * dp * dt * 22;
        dodgeRoll = dp;
        if (dodgeStateRef.current.t >= 1) dodgeStateRef.current.active = false;
      }

      // Bounds + collisions
      hero.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, hero.x));
      hero.z = Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, hero.z));
      const resolved = resolveCollisions(hero.x, hero.z);
      hero.x = resolved.x;
      hero.z = resolved.z;

      // Notify parent
      cur.onHeroMove?.({ x: hero.x, y: 0, z: hero.z });

      // ── Footstep dust + sound when moving fast ──
      const speedMag = Math.hypot(hero.vx, hero.vz);
      if (speedMag > 8 && nowMs - lastFootstepAt.current > (cur.isMounted ? 110 : 180)) {
        lastFootstepAt.current = nowMs;
        spawnFootstepDust(particlesRef.current, hero.x, hero.z + 0.4, hero.vx, hero.vz);
        sfxFootstep();
      }

      // ── Smooth walk intensity: 0 idle → 1 full walk, eased over ~250ms ──
      const intensityTarget = Math.min(1, speedMag / 20);
      walkIntensityRef.current += (intensityTarget - walkIntensityRef.current) * Math.min(1, dt * 6);
      // Phase advances at a rate scaled by intensity, so stride blends in/out
      walkPhaseRef.current += dt * 5.5 * walkIntensityRef.current;

      // ── Hit particles on new attack-fx ──
      if (cur.attackFx?.at && cur.attackFx.at !== lastAttackFxAt.current) {
        lastAttackFxAt.current = cur.attackFx.at;
        if (cur.attackFx.enemyId) {
          const target = (cur.enemies || []).find((e) => e.id === cur.attackFx.enemyId);
          if (target) {
            const isHeavy = !!cur.attackFx.heavy;
            spawnHitParticles(particlesRef.current, target.x, target.z, isHeavy ? 14 : 8, 'spark');
            spawnHitParticles(particlesRef.current, target.x, target.z, isHeavy ? 6 : 3, 'blood');
          }
        }
      }

      // ── Death burst when an enemy transitions from alive→dead ──
      const aliveNow = new Set();
      for (const e of cur.enemies || []) {
        if (!e.dead) aliveNow.add(e.id);
        else if (lastAliveEnemiesRef.current.has(e.id)) {
          // Just died — spawn death burst
          spawnHitParticles(particlesRef.current, e.x, e.z, 18, 'blood');
          spawnHitParticles(particlesRef.current, e.x, e.z, 10, 'spark');
        }
      }
      lastAliveEnemiesRef.current = aliveNow;

      // ── Ambient weather: leaves (ch.1) or embers (ch.2) ──
      ambientSpawnAt.current -= dt;
      if (ambientSpawnAt.current <= 0) {
        ambientSpawnAt.current = 0.18 + Math.random() * 0.2;
        const camX = cameraRef.current.x;
        const camZ = cameraRef.current.z;
        const offsetX = (Math.random() - 0.5) * 80;
        const offsetZ = (Math.random() - 0.5) * 60;
        if (terrainChapter === 2) {
          spawnParticle(particlesRef.current, {
            x: camX + offsetX,
            z: camZ + offsetZ + 30,
            type: 'ember',
            vx: (Math.random() - 0.5) * 1.5,
            vz: -1 - Math.random() * 1.5,
            life: 0,
            maxLife: 2.5 + Math.random() * 1.5,
            size: 1 + Math.random() * 1.5,
          });
        } else {
          spawnParticle(particlesRef.current, {
            x: camX + offsetX,
            z: camZ + offsetZ - 40,
            type: 'leaf',
            vx: -3 + (Math.random() - 0.5) * 2,
            vz: 2 + Math.random() * 1.5,
            life: 0,
            maxLife: 4 + Math.random() * 2,
            size: 2 + Math.random() * 1.5,
          });
        }
      }

      // Step all particles
      stepParticles(particlesRef.current, dt);

      // Camera: smooth follow + lock-on bias + screen shake
      const cam = cameraRef.current;
      let camTargetX = hero.x;
      // Camera is "north" of hero so the hero sits ~70% down the screen
      // (aligned with the painted ground band of the bitmap backdrop).
      let camTargetZ = hero.z - 10;
      if (cur.lockedTarget && cur.enemies) {
        const lt = cur.enemies.find((e) => e.id === cur.lockedTarget && !e.dead);
        if (lt) {
          camTargetX = (hero.x + lt.x) / 2;
          camTargetZ = (hero.z + lt.z) / 2;
        }
      }
      cam.x = cam.x + (camTargetX - cam.x) * Math.min(1, dt * 4);
      cam.z = cam.z + (camTargetZ - cam.z) * Math.min(1, dt * 4);
      let shakeX = 0, shakeY = 0;
      if (cur.screenShake) {
        cam.shakeT = (cam.shakeT || 0) + dt * 30;
        shakeX = Math.sin(cam.shakeT) * 4;
        shakeY = Math.cos(cam.shakeT * 1.3) * 4;
      } else {
        cam.shakeT = 0;
      }

      // ─── RENDER ───
      ctx.save();
      ctx.scale(dpr, dpr);
      // Slow-mo blue tint background
      const bgColor = terrainChapter === 2 ? '#1a0808' : '#7ab8e8';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, vw, vh);

      // Apply camera + shake
      ctx.translate(shakeX, shakeY);

      // Terrain + decorations
      drawTerrain(ctx, cam, vw, vh, t);
      drawDecorations(ctx, cam, vw, vh, t);

      // Build draw list for entities sorted by world z (painter's algorithm — south draws on top)
      const drawList = [];
      const recruited = cur.recruited || new Set();
      const hiddenNpcs = cur.hiddenNpcs || new Set();
      // NPCs (skip recruited companions, and story-gated hidden ones)
      // Each NPC drifts visually around their home tile via a deterministic
      // two-frequency wander — so they aren't clustered statues.
      for (const npc of NPCS) {
        if (recruited.has(npc.id)) continue;
        if (hiddenNpcs.has(npc.id)) continue;
        const w = tileToWorldPosition(npc);
        // Hash id → unique phase per NPC so they don't move in sync
        let h = 0;
        for (let i = 0; i < npc.id.length; i++) h = ((h * 31) + npc.id.charCodeAt(i)) | 0;
        const p1 = (h * 0.013) % 7;
        const p2 = (h * 0.027) % 11;
        const dx = Math.sin(t * 0.22 + p1) * 2.8 + Math.cos(t * 0.11 + p2) * 1.6;
        const dz = Math.cos(t * 0.19 + p1) * 2.2 + Math.sin(t * 0.14 + p2) * 1.2;
        drawList.push({ z: w.z + dz, kind: 'npc', npc, x: w.x + dx });
      }
      // Companions (drawn at their dynamic follow positions)
      const companions = cur.companions || [];
      for (const c of companions) {
        drawList.push({ z: c.z, kind: 'companion', x: c.x, comp: c });
      }
      // Item drops (pickups on the ground)
      const itemDrops = cur.items || [];
      for (const it of itemDrops) {
        drawList.push({ z: it.z, kind: 'item', x: it.x, item: it });
      }
      // Enemies
      const enemies = cur.enemies || [];
      for (const e of enemies) {
        if (e.dead) continue;
        drawList.push({ z: e.z, kind: 'enemy', enemy: e, x: e.x });
      }
      // Hero
      drawList.push({ z: hero.z, kind: 'hero', x: hero.x });
      // Horse (if not mounted, render at horsePos; if mounted, hero already shows horse under it)
      if (cur.horsePos && !cur.isMounted) {
        drawList.push({ z: cur.horsePos.z, kind: 'horse', x: cur.horsePos.x });
      }

      drawList.sort((a, b) => a.z - b.z);

      const palette = cur.heroSkin?.colors || {};

      for (const it of drawList) {
        const sx = (it.x - cam.x) * PIXELS_PER_UNIT + vw / 2;
        const sy = (it.z - cam.z) * PIXELS_PER_UNIT + vh / 2;
        if (it.kind === 'npc') {
          drawNpc(ctx, sx, sy, it.npc.id, cur.highlightedNpcId === it.npc.id, t);
          // Name label
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(sx - 24, sy - 30, 48, 13);
          ctx.fillStyle = '#ffe0a0';
          ctx.font = '10px serif';
          ctx.textAlign = 'center';
          ctx.fillText(it.npc.role, sx, sy - 20);
        } else if (it.kind === 'item') {
          // Pickup with float bob, glow halo, type-specific color and emoji glyph
          const item = it.item;
          const bob = Math.sin(t * 3 + (item.id.length || 0)) * 3;
          const itemY = sy + 4 - bob;
          const colors = {
            heal:   { glow: 'rgba(80, 220, 120, 0.65)', core: '#5cd06a', icon: '💊' },
            gold:   { glow: 'rgba(255, 200, 80, 0.65)', core: '#e8c850', icon: '🪙' },
            energy: { glow: 'rgba(100, 200, 255, 0.65)', core: '#5cb8ff', icon: '⚡' },
            scroll: { glow: 'rgba(220, 180, 255, 0.65)', core: '#d8b0ff', icon: '📜' },
          };
          const c = colors[item.type] || colors.heal;
          // Halo glow
          const g = ctx.createRadialGradient(sx, itemY, 0, sx, itemY, 22);
          g.addColorStop(0, c.glow);
          g.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = g;
          drawCircle(ctx, sx, itemY, 22, ctx.fillStyle);
          // Core orb
          ctx.fillStyle = c.core;
          drawCircle(ctx, sx, itemY, 8, ctx.fillStyle, 'rgba(0,0,0,0.5)', 1);
          // Icon
          ctx.font = '13px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(c.icon, sx, itemY + 1);
          // Shadow on ground
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(sx, sy + 8, 6, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (it.kind === 'companion') {
          // Smaller follower version of NPC sprite — try sprite first then fall back
          const compBob = Math.sin(t * 2.2 + (it.comp.id.charCodeAt(0) || 0)) * 2.8;
          const isDowned = it.comp.downedUntil && Date.now() < it.comp.downedUntil;
          const alpha = isDowned ? 0.45 : 1;
          // Slightly flatter pose when downed
          const downedScale = isDowned ? 0.6 : 0.72;
          if (!drawSprite(ctx, `npc/${it.comp.id}`, sx, sy + 10 - compBob, { scale: downedScale, anchorY: 'bottom', alpha })) {
            ctx.save();
            ctx.globalAlpha = alpha;
            drawNpc(ctx, sx, sy - compBob, it.comp.id, false, t);
            ctx.restore();
          }
          if (isDowned) {
            // Down indicator
            ctx.fillStyle = 'rgba(20, 10, 8, 0.78)';
            ctx.fillRect(sx - 14, sy - 28, 28, 11);
            ctx.fillStyle = '#ff6060';
            ctx.font = 'bold 9px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DOWN', sx, sy - 22);
          } else {
            // HP bar
            const hpPct = (it.comp.hp || 100) / (it.comp.maxHp || 100);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(sx - 9, sy - 28, 18, 3);
            ctx.fillStyle = hpPct > 0.5 ? '#3ad06a' : hpPct > 0.25 ? '#d0ad22' : '#ee3030';
            ctx.fillRect(sx - 9, sy - 28, 18 * hpPct, 3);
          }
        } else if (it.kind === 'enemy') {
          const hitAge = cur.attackFx?.enemyId === it.enemy.id ? Date.now() - cur.attackFx.at : 9999;
          const hitFlash = hitAge < 220;
          drawEnemy(ctx, it.enemy, sx, sy, cur.highlightedEnemyId === it.enemy.id, hitFlash, t, cur.attackFx);
        } else if (it.kind === 'hero') {
          drawHero(ctx, sx, sy, hero.facing, t, palette, cur.isMounted, cur.isCharging, cur.chargeLevel || 0, dodgeStateRef.current.active, dodgeRoll, isMoving || speedMag > 1, cur.attackFx?.at ? Date.now() - cur.attackFx.at : 9999, walkIntensityRef.current, walkPhaseRef.current);
          // Player attack slash
          if (cur.attackFx?.at) {
            const age = Date.now() - cur.attackFx.at;
            drawAttackSlash(ctx, sx, sy, hero.facing, age, cur.attackFx.heavy);
          }
          // Super FX
          if (cur.superFx?.at && cur.superFx?.type) {
            const age = Date.now() - cur.superFx.at;
            drawSuperFx(ctx, sx, sy, cur.superFx.type, age);
          }
        } else if (it.kind === 'horse') {
          // Soft idle bob + flip + sway
          const idleBob = Math.sin(t * 1.4) * 1.2;
          drawSprite(ctx, 'world/horse', sx, sy + 12 - idleBob, {
            scale: 1, anchorY: 'bottom',
          });
          // Mount prompt above the horse
          ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
          ctx.fillRect(sx - 32, sy - 140, 64, 15);
          ctx.fillStyle = '#ffd060';
          ctx.font = '11px serif';
          ctx.textAlign = 'center';
          ctx.fillText('Press E to mount', sx, sy - 129);
        }
      }

      // ── Particles (drawn over entities) ──
      for (const p of particlesRef.current) {
        const psx = (p.x - cam.x) * PIXELS_PER_UNIT + vw / 2;
        const psy = (p.z - cam.z) * PIXELS_PER_UNIT + vh / 2;
        if (psx < -20 || psx > vw + 20 || psy < -20 || psy > vh + 20) continue;
        drawParticle(ctx, p, psx, psy);
      }

      // Lock-on reticle
      if (cur.lockedTarget && cur.enemies) {
        const lt = cur.enemies.find((e) => e.id === cur.lockedTarget && !e.dead);
        if (lt) {
          const sx = (lt.x - cam.x) * PIXELS_PER_UNIT + vw / 2;
          const sy = (lt.z - cam.z) * PIXELS_PER_UNIT + vh / 2;
          drawLockOnReticle(ctx, sx, sy, t);
        }
      }

      // Slow-mo: dim screen edges
      if (cur.slowMo) {
        const grad = ctx.createRadialGradient(vw / 2, vh / 2, vh / 4, vw / 2, vh / 2, vh / 1.2);
        grad.addColorStop(0, 'rgba(80, 100, 200, 0)');
        grad.addColorStop(1, 'rgba(80, 100, 200, 0.4)');
        ctx.fillStyle = grad;
        ctx.fillRect(-shakeX, -shakeY, vw, vh);
      }

      // Kill flash
      if (cur.killFlash) {
        ctx.fillStyle = 'rgba(255, 240, 180, 0.45)';
        ctx.fillRect(-shakeX, -shakeY, vw, vh);
      }

      // Mini-map indicators / off-screen quest markers
      drawOffscreenMarkers(ctx, cam, vw, vh);

      ctx.restore();

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', background: '#102030' }}
    />
  );
}

function drawOffscreenMarkers(ctx, cam, vw, vh) {
  const ppu = PIXELS_PER_UNIT;
  const margin = 28;
  // Highlight off-screen NPCs with arrows
  for (const npc of NPCS) {
    const w = tileToWorldPosition(npc);
    const sx = (w.x - cam.x) * ppu + vw / 2;
    const sy = (w.z - cam.z) * ppu + vh / 2;
    const offscreen = sx < margin || sx > vw - margin || sy < margin || sy > vh - margin;
    if (!offscreen) continue;
    const dx = sx - vw / 2;
    const dy = sy - vh / 2;
    const ang = Math.atan2(dy, dx);
    const r = Math.min(vw, vh) / 2 - margin;
    const ax = vw / 2 + Math.cos(ang) * r;
    const ay = vh / 2 + Math.sin(ang) * r;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255, 224, 96, 0.8)';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
