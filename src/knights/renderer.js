// ── Knights of Valour-style 2.5D renderer ──
// World: (x, z) where x scrolls horizontally and z is depth on the floor
// band. Higher z = closer to camera (lower on screen).
//
// Screen Y mapping:
//   floorYTop = h * 0.60   (z = 0, far)
//   floorYBot = h * 0.88   (z = Z_MAX, near)
// Linear interpolation by z. Characters drawn back-to-front (by z asc).
//
// Perf: cached sky/ground gradients on resize, offscreen mountain
// silhouette pre-rendered once, no per-frame allocations or
// createRadialGradient. DPR capped at 1.5.
import { drawSprite, spriteDrawHeight } from '../scene2d/sprites.js';
import { ELEMENTS } from './elements.js';

export const Z_MIN = 0;
export const Z_MAX = 200;

const SHADOW_ALPHA = 0.34;

// ── Per-chapter visual themes ──
// dusk  (ch1): sunset over the pass          night (ch2): moonlit siege,
// burning manor glow                          mist  (ch3): sorcerous fog
const THEMES = {
  // 水墨 ink-wash: cream rice paper for sky, grey ink mountains dissolving
  // into mist, pale sand underfoot. Each chapter tints the paper differently.
  dusk: {
    sky: ['#f6efdf', '#f2e8d3', '#ecdfc6'],
    ground: ['#eadbb9', '#e3d0a6', '#d9c293', '#cdb482'],
    mts: ['#8f9498', '#5d6266', '#33373a'],
    tree: '#2a2d2f',
    orb: { x: 0.74, y: 0.2, r: 54, c1: 'rgba(206,74,52,0.55)', c2: 'rgba(206,74,52,0.10)' },
    mistCol: '255,252,244',
  },
  night: {
    sky: ['#e3ddd0', '#ddd5c5', '#d5ccb8'],
    ground: ['#d6cbb0', '#cbbd9c', '#bdad88', '#ad9c76'],
    mts: ['#7c8085', '#4c5055', '#25282c'],
    tree: '#1d2023',
    orb: { x: 0.8, y: 0.16, r: 40, c1: 'rgba(255,255,255,0.9)', c2: 'rgba(255,255,255,0.15)' },
    burn: true,             // the burning manor bleeds red wash along the horizon
    mistCol: '250,246,238',
  },
  mist: {
    sky: ['#e6e8dd', '#dfe2d5', '#d6dacb'],
    ground: ['#d9d8bf', '#cdcbad', '#bfbc99', '#aeaa85'],
    mts: ['#869088', '#56605a', '#2d3531'],
    tree: '#232a26',
    orb: { x: 0.26, y: 0.18, r: 40, c1: 'rgba(120,150,130,0.35)', c2: 'rgba(120,150,130,0.06)' },
    mist: true,             // drifting fog bands over the floor
    mistCol: '248,250,244',
  },
  dream: {                  // 红楼梦 crossover — the Land of Illusion
    sky: ['#f7e9e6', '#f3dfdd', '#edd3d2'],
    ground: ['#ecd9cf', '#e3c9c0', '#d6b7b0', '#c7a5a0'],
    mts: ['#a58f9c', '#77606f', '#4a3846'],
    tree: '#3a2c37',
    orb: { x: 0.5, y: 0.15, r: 50, c1: 'rgba(214,96,120,0.45)', c2: 'rgba(214,96,120,0.08)' },
    mist: true,
    ghost: true,            // enemies are dream-phantoms: jade aura
    mistCol: '255,246,248',
  },
};
const INK = '#1a1612';      // brush ink
const SEAL = '#c0261c';     // vermilion seal paste

// Attack thrust envelope: p in [0,1] across the move's duration.
// Returns a signed thrust:  brief wind-BACK (negative) → snap FORWARD to
// +1 near p≈0.42 → ease back to 0. Drives lunge/lean for every melee pose.
function thrustEnv(p) {
  if (p < 0.16) return -0.35 * (p / 0.16);
  if (p < 0.42) return -0.35 + 1.35 * ((p - 0.16) / 0.26);
  return Math.max(0, 1 - (p - 0.42) / 0.58);
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// '#rrggbb' + alpha → rgba()
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
}

export function createRenderer(canvas, themeName = 'dusk') {
  const ctx = canvas.getContext('2d', { alpha: false });
  const theme = THEMES[themeName] || THEMES.dusk;
  let cssW = 0, cssH = 0;
  let dpr = 1;
  let skyGrad = null, groundGrad = null;
  let sunCanvas = null, burnCanvas = null, mountainCanvas = null, mountainCanvasW = 0;
  let groundTile = null, treeTile = null;
  const GROUND_W = 1024, TREE_W = 1400;
  let floorYTop = 0, floorYBot = 0, horizonY = 0;

  function floorYFromZ(z) {
    return floorYTop + (z - Z_MIN) / (Z_MAX - Z_MIN) * (floorYBot - floorYTop);
  }

  function resize(w, h) {
    cssW = w; cssH = h;
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Wide floor band so the hero can walk the full vertical play area.
    // Mountains are kept small (top ~28%) so the floor occupies almost the
    // whole rest of the screen.
    horizonY = h * 0.28;
    floorYTop = h * 0.30;
    floorYBot = h * 0.92;

    skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, theme.sky[0]);
    skyGrad.addColorStop(0.5, theme.sky[1]);
    skyGrad.addColorStop(1, theme.sky[2]);

    // Ground gradient spans the WHOLE area below the mountains so there's
    // no uncovered band (the canvas is alpha:false → unpainted = black).
    groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, theme.ground[0]);
    groundGrad.addColorStop(0.35, theme.ground[1]);
    groundGrad.addColorStop(0.7, theme.ground[2]);
    groundGrad.addColorStop(1, theme.ground[3]);

    const sunR = theme.orb.r;
    sunCanvas = offscreen(sunR * 2 + 8, sunR * 2 + 8);
    {
      const sc = sunCanvas.getContext('2d');
      const cx = sunCanvas.width / 2, cy = sunCanvas.height / 2;
      const grad = sc.createRadialGradient(cx, cy, 0, cx, cy, sunR);
      grad.addColorStop(0, theme.orb.c1);
      grad.addColorStop(0.6, theme.orb.c2);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sc.fillStyle = grad;
      sc.beginPath(); sc.arc(cx, cy, sunR, 0, Math.PI * 2); sc.fill();
    }

    // Night siege: a warm burning glow smeared along part of the horizon.
    burnCanvas = null;
    if (theme.burn) {
      burnCanvas = offscreen(Math.ceil(w * 0.6), 160);
      const bc = burnCanvas.getContext('2d');
      const gr = bc.createRadialGradient(
        burnCanvas.width / 2, burnCanvas.height, 10,
        burnCanvas.width / 2, burnCanvas.height, burnCanvas.width / 2);
      gr.addColorStop(0, 'rgba(206,60,34,0.42)');
      gr.addColorStop(0.5, 'rgba(206,90,50,0.16)');
      gr.addColorStop(1, 'rgba(206,90,50,0)');
      bc.fillStyle = gr;
      bc.fillRect(0, 0, burnCanvas.width, burnCanvas.height);
    }

    buildGroundTile(h);
    buildTreeTile();

    mountainCanvasW = Math.ceil(w * 2);
    mountainCanvas = offscreen(mountainCanvasW, horizonY + 30);
    {
      const mc = mountainCanvas.getContext('2d');
      const layers = [
        { color: theme.mts[0], amp: Math.min(150, horizonY * 0.8),  y: horizonY - 14, freq: 0.004 },
        { color: theme.mts[1], amp: Math.min(110, horizonY * 0.6), y: horizonY - 4,  freq: 0.003 },
        { color: theme.mts[2], amp: Math.min(70, horizonY * 0.4),  y: horizonY + 8,  freq: 0.0025 },
      ];
      // Each ridge is a wet brush-load of ink: darkest along the crest,
      // bleeding out to bare paper (mist) lower down.
      const period = Math.PI * 2 / 0.0005;           // keeps the tile seamless
      const snap = (f) => Math.max(1, Math.round(f * mountainCanvasW / (Math.PI * 2))) * (Math.PI * 2) / mountainCanvasW;
      void period;
      layers.forEach((L, li) => {
        const f1 = snap(L.freq), f2 = snap(L.freq * 2.3), f3 = snap(L.freq * 5.1);
        const top = L.y - L.amp;
        const grad = mc.createLinearGradient(0, top, 0, L.y + 34);
        const a = [0.42, 0.6, 0.82][li];
        grad.addColorStop(0, hexA(L.color, a));
        grad.addColorStop(0.45, hexA(L.color, a * 0.55));
        grad.addColorStop(1, hexA(L.color, 0));
        mc.fillStyle = grad;
        mc.beginPath();
        mc.moveTo(0, mountainCanvas.height);
        for (let x = 0; x <= mountainCanvasW; x += 4) {
          const n = Math.sin(x * f1 + li) * 0.55 + Math.sin(x * f2 + li * 2) * 0.33 + Math.sin(x * f3) * 0.12;
          mc.lineTo(x, L.y - (0.5 + n * 0.5) * L.amp);
        }
        mc.lineTo(mountainCanvasW, mountainCanvas.height);
        mc.closePath();
        mc.fill();
      });
    }
  }

  // Tiny deterministic RNG so the scenery is identical every frame/resize.
  function rng(seed) {
    let v = seed >>> 0;
    return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; };
  }

  // The road: brushed streaks, ruts and pebbles that scroll with the camera,
  // so walking finally reads as covering ground.
  function buildGroundTile(h) {
    const gh = Math.max(40, Math.ceil(h - horizonY));
    groundTile = offscreen(GROUND_W, gh);
    const gc = groundTile.getContext('2d');
    const r = rng(theme.sky[0].length * 7919 + 17);
    const wrap = (fn) => { fn(0); fn(-GROUND_W); fn(GROUND_W); };
    // long brushed streaks — thin and faint far away, bolder up close
    for (let i = 0; i < 150; i++) {
      const k = Math.pow(r(), 0.7);                    // 0 far → 1 near
      const y = 6 + k * (gh - 12);
      const len = 30 + k * 150 + r() * 60;
      const x = r() * GROUND_W;
      const light = r() < 0.4;
      gc.strokeStyle = light ? `rgba(255,252,240,${0.10 + k * 0.10})` : `rgba(60,48,34,${0.035 + k * 0.06})`;
      gc.lineWidth = 1 + k * 2;
      gc.lineCap = 'round';
      wrap((ox) => { gc.beginPath(); gc.moveTo(x + ox, y); gc.lineTo(x + ox + len, y + (r() - 0.5) * 2); gc.stroke(); });
    }
    // pebbles and tufts
    for (let i = 0; i < 70; i++) {
      const k = Math.pow(r(), 0.8);
      const y = 10 + k * (gh - 20);
      const x = r() * GROUND_W;
      const sz = 1.5 + k * 3.5;
      const tuft = r() < 0.35;
      wrap((ox) => {
        if (tuft) {
          gc.strokeStyle = `rgba(0,0,0,${0.16 + k * 0.12})`;
          gc.lineWidth = 1.2;
          gc.beginPath();
          gc.moveTo(x + ox - sz, y); gc.lineTo(x + ox - sz * 1.6, y - sz * 2.2);
          gc.moveTo(x + ox, y); gc.lineTo(x + ox, y - sz * 2.8);
          gc.moveTo(x + ox + sz, y); gc.lineTo(x + ox + sz * 1.7, y - sz * 2);
          gc.stroke();
        } else {
          gc.fillStyle = `rgba(0,0,0,${0.16 + k * 0.10})`;
          gc.beginPath(); gc.ellipse(x + ox, y, sz * 1.5, sz * 0.7, 0, 0, Math.PI * 2); gc.fill();
          gc.fillStyle = `rgba(255,240,210,${0.05 + k * 0.05})`;
          gc.beginPath(); gc.ellipse(x + ox - sz * 0.3, y - sz * 0.25, sz * 0.8, sz * 0.3, 0, 0, Math.PI * 2); gc.fill();
        }
      });
    }
  }

  // A line of trees along the far edge of the road, drifting slower than the
  // ground (parallax) to give the scene depth.
  function buildTreeTile() {
    const th = 120;
    treeTile = offscreen(TREE_W, th);
    const tc = treeTile.getContext('2d');
    const r = rng(theme.mts[2].length * 104729 + 5);
    const wrap = (fn) => { fn(0); fn(-TREE_W); fn(TREE_W); };
    for (let layer = 0; layer < 2; layer++) {
      tc.fillStyle = theme.tree || theme.mts[2];
      tc.globalAlpha = layer ? 0.5 : 0.22;
      const count = layer ? 13 : 20;
      for (let i = 0; i < count; i++) {
        const x = (i + r() * 0.8) * (TREE_W / count);
        const hgt = (layer ? 34 : 24) + r() * (layer ? 36 : 22);
        const wid = hgt * (0.34 + r() * 0.2);
        const pine = r() < 0.6;
        wrap((ox) => {
          const bx = x + ox;
          if (pine) {
            for (let t = 0; t < 3; t++) {
              const ty = th - hgt * (0.25 + t * 0.25);
              const tw = wid * (1 - t * 0.24);
              tc.beginPath();
              tc.moveTo(bx - tw, ty + hgt * 0.3); tc.lineTo(bx, ty - hgt * 0.22); tc.lineTo(bx + tw, ty + hgt * 0.3);
              tc.closePath(); tc.fill();
            }
            tc.fillRect(bx - 2, th - hgt * 0.3, 4, hgt * 0.3);
          } else {
            tc.beginPath(); tc.ellipse(bx, th - hgt * 0.62, wid * 0.95, hgt * 0.42, 0, 0, Math.PI * 2); tc.fill();
            tc.beginPath(); tc.ellipse(bx - wid * 0.5, th - hgt * 0.42, wid * 0.6, hgt * 0.28, 0, 0, Math.PI * 2); tc.fill();
            tc.fillRect(bx - 2.5, th - hgt * 0.45, 5, hgt * 0.45);
          }
        });
      }
    }
    tc.globalAlpha = 1;
  }

  function drawBackground(g) {
    const w = cssW, h = cssH;
    const camX = g.camX;
    const M = 16;                       // overscan so screen-shake never bares the canvas
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-M, -M, w + 2 * M, horizonY + M);
    ctx.drawImage(sunCanvas, w * theme.orb.x - sunCanvas.width / 2, h * theme.orb.y - sunCanvas.height / 2);

    // Burning-manor glow (night theme) — flickers gently.
    if (burnCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.75 + Math.sin(g.time * 5.3) * 0.12 + Math.sin(g.time * 13.7) * 0.06;
      ctx.drawImage(burnCanvas, w * 0.52, horizonY - burnCanvas.height + 8);
      ctx.restore();
    }

    // Procedural mountains only — the painted bg PNGs ship with AI-checker
    // baked into the sky portion. Stripping it left visible artifacts in
    // the watercolor; the procedural silhouette is clean and atmospheric.
    const off = ((-camX * 0.18) % mountainCanvasW + mountainCanvasW) % mountainCanvasW - mountainCanvasW;
    ctx.drawImage(mountainCanvas, off, 0);
    ctx.drawImage(mountainCanvas, off + mountainCanvasW, 0);

    // Ground gradient covers everything below the mountains. No painted
    // ground PNG either — same reason.
    ctx.fillStyle = groundGrad;
    ctx.fillRect(-M, horizonY, w + 2 * M, h - horizonY + M);

    // Road texture scrolls 1:1 with the world.
    if (groundTile) {
      const gx = -(((camX % GROUND_W) + GROUND_W) % GROUND_W);
      for (let x = gx - GROUND_W; x < w + M; x += GROUND_W) {
        if (x + GROUND_W > -M) ctx.drawImage(groundTile, Math.round(x), Math.round(horizonY));
      }
    }
    // Tree line straddling the horizon, at mid parallax.
    if (treeTile) {
      const tx = -((((camX * 0.5) % TREE_W) + TREE_W) % TREE_W);
      const ty = Math.round(horizonY - treeTile.height + 12);
      for (let x = tx - TREE_W; x < w + M; x += TREE_W) {
        if (x + TREE_W > -M) ctx.drawImage(treeTile, Math.round(x), ty);
      }
      // ground the trees with a soft haze so they don't look pasted on
      const hz = ctx.createLinearGradient(0, horizonY - 6, 0, horizonY + 26);
      hz.addColorStop(0, 'rgba(0,0,0,0)');
      hz.addColorStop(0.45, theme.ground[0]);
      hz.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = hz;
      ctx.fillRect(-M, horizonY - 6, w + 2 * M, 32);
      ctx.restore();
    }
  }

  // Dream-phantom aura: a soft jade glow drawn behind ghostly enemies.
  let ghostGlow = null;
  function ensureGhostGlow() {
    if (ghostGlow || !theme.ghost) return;
    ghostGlow = offscreen(120, 150);
    const gc = ghostGlow.getContext('2d');
    const gr = gc.createRadialGradient(60, 75, 8, 60, 75, 72);
    gr.addColorStop(0, 'rgba(150,255,215,0.30)');
    gr.addColorStop(0.6, 'rgba(150,235,215,0.12)');
    gr.addColorStop(1, 'rgba(150,235,215,0)');
    gc.fillStyle = gr;
    gc.fillRect(0, 0, 120, 150);
  }

  // Sorcerous fog: translucent bands drifting across the floor (mist theme).
  // The band texture is pre-rendered once; per-frame work is 5 drawImages.
  let mistBand = null;
  function ensureMistBand() {
    if (mistBand || !theme.mist) return;
    mistBand = offscreen(440, 34);
    const mc = mistBand.getContext('2d');
    const grad = mc.createRadialGradient(220, 17, 4, 220, 17, 220);
    grad.addColorStop(0, `rgba(${theme.mistCol},0.34)`);
    grad.addColorStop(0.7, `rgba(${theme.mistCol},0.14)`);
    grad.addColorStop(1, `rgba(${theme.mistCol},0)`);
    mc.fillStyle = grad;
    mc.fillRect(0, 0, 440, 34);
  }
  function drawMist(g) {
    if (!theme.mist) return;
    ensureMistBand();
    const t = g.time;
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const bandY = floorYTop + ((i + 0.5) / 5) * (floorYBot - floorYTop);
      const span = cssW + 480;
      const drift = (((t * (14 + i * 5) + i * 340 - g.camX * 0.35) % span) + span) % span - 240;
      ctx.globalAlpha = 0.8 + 0.3 * Math.sin(t * 0.8 + i * 1.7);
      ctx.drawImage(mistBand, drift - 220, bandY - 17);
    }
    ctx.restore();
  }

  function drawShadow(sx, fy, w, squash = 1) {
    ctx.save();
    ctx.globalAlpha = SHADOW_ALPHA * (0.4 + 0.6 * clamp(squash, 0, 1));
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, fy + 3, w * 0.55 * squash, w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }


  // Draw a sprite with a full affine pose around its foot point:
  //   lungeX  horizontal slide (screen px)
  //   lift    vertical raise   (screen px, +up)
  //   lean    rotation (rad) about the feet, or about `pivotY` px above them
  //   scaleX/scaleY  squash & stretch about the feet
  //   tint/tintAlpha colour wash that follows the sprite's silhouette
  //   silhouette     draw ONLY the flat tint shape (afterimages)
  function drawPosed(name, footX, footY, p) {
    ctx.save();
    ctx.translate(footX + (p.lungeX || 0), footY - (p.lift || 0));
    if (p.lean) {
      if (p.pivotY) { ctx.translate(0, -p.pivotY); ctx.rotate(p.lean); ctx.translate(0, p.pivotY); }
      else ctx.rotate(p.lean);
    }
    const sxk = p.scaleX == null ? 1 : p.scaleX, syk = p.scaleY == null ? 1 : p.scaleY;
    if (sxk !== 1 || syk !== 1) ctx.scale(sxk, syk);
    const drew = drawSprite(ctx, name, 0, 0, {
      flip: !!p.flip, anchorY: 'bottom', scale: p.scale || 1,
      alpha: p.alpha == null ? 1 : p.alpha,
      tint: p.tint || null, tintAlpha: p.tintAlpha || 0, silhouette: !!p.silhouette,
      rig: p.rig || null,
    });
    ctx.restore();
    return drew;
  }

  // Shared cut-out rig poses. `art` is the way the picture faces (+1 right,
  // -1 left) so "forward" values land on the right side whatever the flip.
  function rigWalk(rig, art, phase, amp) {
    const sw = Math.sin(phase), cw = Math.cos(phase);
    rig.stride = amp * sw;
    rig.liftL = amp * 1.4 * Math.max(0, -cw * art);     // the leg swinging forward lifts
    rig.liftR = amp * 1.4 * Math.max(0, cw * art);
    rig.bend += 5 * art;                                // lean into the walk
    rig.belly += sw * 3.2;                              // shoulders and hips counter-swing
    rig.head += (-1.5 + Math.sin(phase * 2) * 1.6) * art - sw * 2.2;
    rig.hem = 7; rig.phase = phase;                     // skirts and robes swing with each step
  }

  // ── Mounted fighters ──
  // The rider's own picture (cut off at the waist) seated on the war horse.
  // The horse gallops through the cut-out rig: front and hind legs scissor,
  // the body rocks and bounces, and the rider bobs half a beat behind.
  //   o: { dir, phase, moving, t, lean, lift, lungeX, scaleX, scaleY, scale,
  //        riderFlip, rig, alpha, tint, tintAlpha, dark, rear }
  // Returns the height of the whole figure (for bars and labels).
  const HORSE = 'world/horse';
  function drawMounted(riderName, sx, fy, o) {
    const hs = (o.scale || 1) * 1.3;
    const horseH = spriteDrawHeight(HORSE, hs) || 170;
    const horseW = horseH * 0.9;
    const ph = o.phase || 0;
    const run = o.moving ? 1 : 0;
    const hop = run ? Math.abs(Math.sin(ph)) * 8 : 0;
    const rear = o.rear || 0;                              // 0..1 rearing up
    const rock = (run ? Math.sin(ph) * 0.05 : Math.sin((o.t || 0) * 1.5) * 0.006) - rear * 0.42;
    const lift = o.lift || 0, lungeX = o.lungeX || 0;
    const alpha = o.alpha == null ? 1 : o.alpha;
    const horseRig = {
      bend: 0, belly: 0, breathe: 0, hem: 0, phase: 0,
      head: run ? Math.sin(ph + 1) * 3.5 : Math.sin((o.t || 0) * 1.3) * 1.6,
      stride: run ? 15 * Math.sin(ph) : rear * 10,
      liftL: run ? 14 * Math.max(0, Math.cos(ph)) : rear * 16,
      liftR: run ? 14 * Math.max(0, -Math.cos(ph)) : 0,
    };
    const dark = !!o.dark;
    drawShadow(sx, fy, 104, 1 - Math.min(0.6, lift / 220));
    // horse art faces LEFT
    drawPosed(HORSE, sx, fy - hop, {
      flip: o.dir > 0, lean: rock * o.dir + (o.lean || 0) * 0.4, lift, lungeX, scale: hs,
      scaleX: o.scaleX, scaleY: o.scaleY, rig: horseRig, alpha,
      tint: o.tintAlpha > 0.01 ? o.tint : (dark ? '#14110e' : null),
      tintAlpha: o.tintAlpha > 0.01 ? o.tintAlpha : (dark ? 0.62 : 0),
    });
    // rider: seated on the saddle, legs hidden behind the horse's barrel
    const rs = (o.scale || 1) * 1.06;
    const rH = spriteDrawHeight(riderName, rs) || 140;
    const bobR = run ? Math.abs(Math.sin(ph - 0.7)) * 6 : 0;
    const seatY = fy - hop - lift - horseH * 0.63 - bobR - rear * horseH * 0.16;
    const seatX = sx + lungeX - o.dir * (horseW * 0.07 + rear * horseW * 0.12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(seatX - 260, seatY - rH - 140, 520, rH + 140 + 10);
    ctx.clip();
    drawPosed(riderName, seatX, seatY + rH * 0.36, {
      flip: !!o.riderFlip, lean: (o.lean || 0) - rear * 0.2 * o.dir, scale: rs,
      scaleX: o.scaleX, scaleY: o.scaleY, rig: o.rig || null, alpha,
      tint: o.tint || null, tintAlpha: o.tintAlpha || 0,
    });
    ctx.restore();
    return horseH * 0.63 + rH * 0.64 + rear * horseH * 0.16;
  }

  // A vermilion seal with the fighter's name, as stamped on a painting.
  function drawSeal(x, y, zh, alpha) {
    if (!zh) return;
    const chars = [...zh];
    const cs = 17, pad = 5;
    const w = cs + pad * 2, h = chars.length * cs + pad * 2;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = SEAL;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y, w, h, 6); else ctx.rect(x - w / 2, y, w, h);
    ctx.fill();
    ctx.fillStyle = '#fbf3e2';
    ctx.font = `bold ${cs - 2}px "KaiTi", "STKaiti", "Songti SC", "SimSun", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < chars.length; i++) ctx.fillText(chars[i], x, y + pad + cs * (i + 0.5));
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // Turn-around: the sprite folds flat and unfolds facing the new way.
  // Returns the horizontal scale factor and whether to show the OLD facing.
  function turnFold(turnT) {
    if (!(turnT > 0)) return null;
    const k = clamp(turnT / 0.13, 0, 1);          // 1 → 0
    return { sx: Math.max(0.08, Math.abs(Math.cos(k * Math.PI))), old: k > 0.5 };
  }

  function drawHero(g) {
    const h = g.hero;
    const sx = h.x - g.camX;
    const fy = floorYFromZ(h.z);
    const t = g.time;
    const dir = h.facing >= 0 ? 1 : -1;
    let flip = h.facing < 0;
    const name = h.sprite || 'hero/idle';
    const visH = spriteDrawHeight(name) || 150;
    const tintCol = h.color || '#ffd676';

    const ko = h.ko > 0;
    const airborne = h.y < -0.5;
    const walking = h.walking && !airborne && !ko;
    const step = Math.sin(h.walkPhase * Math.PI);          // one footfall per unit
    const bob = walking ? Math.abs(step) * 7 : 0;

    // Pose accumulators — every state layers a whole-body transform onto these.
    let lean = 0, lungeX = 0, scaleX = 1, scaleY = 1, lift = 0, swing = 0, alpha = 1, pivotY = 0;
    let tint = null, tintAlpha = 0;
    // Cut-out rig: the picture's own parts move (legs, spine, head, hem).
    const rig = { bend: 0, belly: 0, head: 0, stride: 0, liftL: 0, liftR: 0, breathe: 0, hem: 0, phase: 0 };
    const art = 1;                                        // hero art faces right

    // Airborne lift (h.y is NEGATIVE while airborne → raise up the screen).
    lift += -(h.y || 0);

    if (!airborne && !ko && h.attacking <= 0 && h.dashing <= 0) {
      if (walking) {
        // legs stride, the body dips on each footfall and leans into the walk
        const dip = 1 - Math.abs(step);
        lean += 0.03 * dir + step * 0.018;
        scaleY *= 1 - dip * 0.035; scaleX *= 1 + dip * 0.02;
        rigWalk(rig, art, h.walkPhase * Math.PI, 11);
      } else {
        const br = Math.sin(t * 2.2);
        scaleY *= 1 + br * 0.012;
        rig.breathe = 0.02 + br * 0.022;
        rig.bend = Math.sin(t * 1.3) * 1.6;
        rig.head = Math.sin(t * 1.7 + 0.6) * 1.3;
        rig.hem = 1.6; rig.phase = t * 2.2;
      }
    }
    if (airborne && !ko) { rig.liftL = rig.liftR = 9; rig.stride = 4; rig.bend += 3 * art; }
    if (h.dashing > 0) { rig.bend += 13 * art; rig.stride = 9; rig.head += 3 * art; }

    if (h.land > 0) {
      const k = h.land / 0.15;
      scaleY *= 1 - 0.30 * k; scaleX *= 1 + 0.28 * k;
    } else if (airborne && !ko) {
      const s = Math.min(0.26, Math.abs(h.vy) / 1500);
      scaleY *= 1 + s; scaleX *= 1 - s * 0.7;
      if (g.stageComplete) lean += Math.sin(t * 9) * 0.05;   // victory wiggle
    }

    if (h.dashing > 0) { lean += 0.26 * dir; scaleX *= 1.12; scaleY *= 0.95; }

    if (h.attacking > 0 && !ko) {
      const mv = h.attackMove;
      if (mv) {
        const p = clamp(1 - h.attacking / mv.dur, 0, 1);
        const thr = thrustEnv(p);
        const fwd = Math.max(0, thr);
        // the spine coils back on the wind-up, then whips through the blow
        rig.bend += (thr < 0 ? thr * 26 : thr * 17) * art;
        rig.head += thr * 5 * art;
        rig.belly += -thr * 4 * art;
        if (!airborne) { rig.stride = 3 + fwd * 6; }      // feet plant wide
        if (mv.downward) {
          // dive: tip forward and stretch toward the ground
          lean += (0.35 + fwd * 0.2) * dir; scaleY *= 1 + fwd * 0.1; swing = fwd;
        } else if (mv.aoe) {
          lean += thr * 0.30 * dir; lift += -thr * 14; lungeX += fwd * 20 * dir;
          scaleY *= 1 - fwd * 0.08; scaleX *= 1 + fwd * 0.10; swing = fwd;
        } else if (mv.projectile) {
          lungeX += -Math.max(0, -thr) * 14 * dir - fwd * 8 * dir;   // draw back, recoil
          lean += -fwd * 0.06 * dir; scaleX *= 1 + fwd * 0.03;
        } else if (mv.launches) {
          lift += fwd * 26; lean += -thr * 0.14 * dir; scaleY *= 1 + fwd * 0.14; scaleX *= 1 - fwd * 0.05;
          swing = fwd * 0.7;
        } else if (mv.pierces) {
          lungeX += thr * Math.min(54, (mv.xRange || 120) * 0.32) * dir;
          lean += thr * 0.10 * dir; scaleX *= 1 + fwd * 0.08; scaleY *= 1 - fwd * 0.03; swing = fwd;
        } else if (mv.hits > 1) {
          const buzz = Math.sin(p * Math.PI * mv.hits * 2) * 8 * fwd;
          lungeX += (thr * 16 + buzz) * dir; lean += thr * 0.08 * dir; swing = fwd;
        } else {
          lungeX += thr * Math.min(40, (mv.xRange || 90) * 0.4) * dir;
          lean += thr * 0.18 * dir; scaleY *= 1 + fwd * 0.06; scaleX *= 1 - fwd * 0.02; swing = fwd;
        }
      } else {
        // special cast: gather (crouch) → rise and release
        const p = clamp(1 - h.attacking / 0.45, 0, 1);
        const e = thrustEnv(p);
        lift += Math.max(0, e) * 16;
        lean += e * 0.08 * dir;
        scaleY *= 1 + Math.max(0, e) * 0.12 - Math.max(0, -e) * 0.10;
        scaleX *= 1 + Math.max(0, -e) * 0.10 - Math.max(0, e) * 0.04;
        rig.bend += -e * 7 * art; rig.head += -Math.max(0, e) * 6 * art;
        rig.breathe = 0.05 + Math.max(0, e) * 0.06;
        rig.hem = 6; rig.phase = t * 14;
      }
    }

    if (h.hitFlash > 0 && h.attacking <= 0 && !ko) {
      const k = Math.min(1, h.hitFlash / 0.4);
      lean += -0.10 * dir * k;
      lungeX += -dir * 8 * k + Math.sin(t * 70) * 3 * k;
      scaleX *= 1 + 0.05 * k; scaleY *= 1 - 0.05 * k;
      rig.bend += -14 * k * art; rig.head += -6 * k * art; rig.belly += 5 * k * art;   // folds around the blow
    }

    if (ko) {
      // knocked off their feet: tumble backward, land flat
      const k = clamp(h.ko / 0.5, 0, 1);
      lean = -dir * k * (Math.PI / 2) * (airborne ? 0.8 : 1);
      if (!airborne && h.ko > 1.0) alpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 10));
    }

    const fold = turnFold(h.turnT);
    if (fold && !ko) { scaleX *= fold.sx; if (fold.old) flip = !flip; }

    if (h.hitFlash > 0) { tint = '#ff5a4a'; tintAlpha = Math.min(0.7, h.hitFlash * 2); }
    else if (h.castT > 0) { tint = '#ffffff'; tintAlpha = Math.min(0.55, h.castT * 1.2); }
    else if (h.invuln > 0 && h.dashing <= 0 && !ko && !g.stageComplete) {
      if (Math.sin(t * 46) > 0) { tint = '#ffffff'; tintAlpha = 0.4; }   // i-frame flicker
    }

    const selfGallop = h.selfMounted && walking ? Math.abs(Math.sin(h.gallop)) * 6 : 0;
    const footY = fy - bob - selfGallop;
    if (!(h.mounted && !h.selfMounted && !ko)) drawShadow(sx, fy, 56, 1 - Math.min(0.6, lift / 220));

    // Empowered (Tiger Spirit etc.): a pulsing ring of fire at the feet
    let buffed = false;
    for (let i = 0; i < h.buffs.length; i++) if (h.buffs[i].atk) buffed = true;
    if (buffed) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(sx, fy + 2);
      ctx.scale(1, 0.34);
      const pr = 44 + Math.sin(t * 9) * 5;
      ctx.strokeStyle = 'rgba(255,170,70,0.6)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,160,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, pr * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    const pose = { flip, lean, scaleX, scaleY, lift, lungeX, pivotY, rig: ko ? null : rig };
    const riding = h.mounted && !h.selfMounted && !ko;
    let figH = visH;
    if (riding) {
      // the rider's legs are hidden; only the spine/head of the rig matter
      rig.stride = 0; rig.liftL = 0; rig.liftR = 0; rig.hem = 0;
      const mo = {
        dir, phase: h.gallop, moving: h.walking || h.dashing > 0, t,
        lean: lean * 0.7, lift, lungeX, scaleX, scaleY, riderFlip: flip, rig,
      };
      if (h.dashing > 0) {                        // charge afterimages
        const ga = Math.min(1, h.dashing / 0.42);
        for (let i = 2; i >= 1; i--) drawMounted(name, sx - dir * i * 34, fy, { ...mo, alpha: 0.2 * ga });
      }
      figH = drawMounted(name, sx, fy, { ...mo, alpha: alpha < 1 ? alpha : 1, tint, tintAlpha });
    }
    // name seal: stamped beside the hero as the stage opens
    if (t < 4.2 && h.zh) drawSeal(sx - dir * 62, fy - figH - 6, h.zh, Math.min(1, t * 2, (4.2 - t) * 1.5));
    if (riding) {
      if (h.grab) { /* grabs are on foot only */ }
      return;
    }
    if (h.dashing > 0) {                          // dash afterimages (silhouettes)
      const ga = Math.min(1, h.dashing / 0.25);
      for (let i = 3; i >= 1; i--) {
        drawPosed(name, sx - dir * i * 22, footY, { ...pose, tint: tintCol, silhouette: true, alpha: 0.2 * ga * (1 - i * 0.2) });
      }
    }
    if (swing > 0.25) {                           // swing smear trail
      const ga = (swing - 0.25) / 0.75;
      for (let i = 2; i >= 1; i--) {
        drawPosed(name, sx, footY, {
          ...pose, lean: lean * (1 - i * 0.22), lungeX: lungeX * (1 - i * 0.34),
          tint: tintCol, silhouette: true, alpha: 0.17 * ga,
        });
      }
    }

    const drew = drawPosed(name, sx, footY, { ...pose, alpha, tint, tintAlpha });
    if (!drew) {
      const bx = sx + lungeX, by = footY - lift;
      ctx.fillStyle = h.color || '#ffc26b';
      ctx.fillRect(bx - 14, by - 80, 28, 64);
      ctx.beginPath(); ctx.arc(bx, by - 88, 12, 0, Math.PI * 2); ctx.fill();
    }

    if (h.grab) {                                  // what to do with a held foe
      ctx.save();
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      const label = 'J: strike   ←/→ + J: throw';
      const lw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(sx - lw / 2, fy - visH - 34, lw, 18);
      ctx.fillStyle = '#ffe6a0';
      ctx.fillText(label, sx, fy - visH - 21);
      ctx.restore();
    }

    // Stars circle a knocked-out hero
    if (ko && !airborne) {
      ctx.save();
      ctx.fillStyle = '#ffe680';
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * 2.1;
        const px = sx - dir * visH * 0.55 + Math.cos(a) * 20;
        const py = fy - 34 + Math.sin(a) * 6;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(a * 2);
        drawStar(px, py, 6, 2.4, a);
      }
      ctx.restore();
    }
  }

  // Four-point star (hit sparks, KO stars). Caller sets fillStyle.
  function drawStar(x, y, rLong, rShort, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? rLong : rShort;
      const a = (i / 8) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e, camX) {
    const sx = e.x - camX;
    if (sx < -200 || sx > cssW + 200) return;
    const dir = e.facing >= 0 ? 1 : -1;
    const scale = e.boss ? 1.25 : 1.0;
    // Visual height of the art as drawn (bars, rings and auras hang off this —
    // NOT the smaller collision height, which left HP bars across faces).
    const visH = spriteDrawHeight(e.sprite, scale) || (e.height || 88) * scale;

    // ── Death tumble: knocked into the air, spinning, fading out ──
    if (e.dead) {
      const fade = clamp(e.deathFade || 0, 0, 1);
      const a = 1 - fade;
      if (a <= 0.02) return;
      const dfy = floorYFromZ(e.z);
      const dlift = e.deathY || 0;
      drawShadow(sx, dfy, e.width || 56, clamp(1 - dlift / 160 - fade * 0.5, 0, 1));
      drawPosed(e.sprite, sx, dfy, {
        flip: e.artRight ? e.facing < 0 : e.facing >= 0, lean: e.deathSpin || 0, lift: dlift, pivotY: visH * 0.45,
        scale: scale * (1 - fade * 0.3), alpha: a,
        tint: INK, tintAlpha: Math.min(0.85, fade * 1.6),            // dissolves into ink
      });
      return;
    }

    const fy = floorYFromZ(e.z);
    // enemy art faces LEFT; the mirror phantom wears hero art, which faces right
    const art = e.artRight ? 1 : -1;
    let flip = e.artRight ? e.facing < 0 : e.facing >= 0;
    let lean = 0, lungeX = 0, scaleX = 1, scaleY = 1, pivotY = 0, alpha = 1, bob = 0;
    const rig = { bend: 0, belly: 0, head: 0, stride: 0, liftL: 0, liftR: 0, breathe: 0, hem: 0, phase: 0 };
    let lift = (e.y || 0);                     // height above the floor while launched
    let tint = null, tintAlpha = 0;

    if (e.grabbed) {
      // seized by the collar: hoisted off balance, struggling
      lift += 10;
      lean += -0.2 * dir + Math.sin(e.bobPhase * 6) * 0.05;
      rig.bend = -10 * art; rig.head = Math.sin(e.bobPhase * 7) * 4;
      rig.liftL = 5 + Math.sin(e.bobPhase * 8) * 4; rig.liftR = 5 - Math.sin(e.bobPhase * 8) * 4;
    } else if (e.launched > 0) {
      // juggled: a full tumble through the air, landing upright
      const spinDir = (e.kbVx || dir) < 0 ? -1 : 1;
      lean += clamp((e.launchT || 0) / 0.63, 0, 1) * Math.PI * 2 * spinDir;
      pivotY = visH * 0.45;
    } else if (e.stun > 0) {
      const k = Math.min(1, e.stun / 0.2);
      lean += -0.08 * dir * k;
      lungeX += -dir * 6 * k + Math.sin(e.hitFlash * 120) * 3 * k;
      rig.bend = -13 * k * art; rig.head = -6 * k * art; rig.belly = 5 * k * art;   // doubles over
    } else if (e.moving) {
      // marching: legs stride, a small hop and dip on each footfall
      const ph = (e.walkPhase || 0) * Math.PI;
      const st = Math.sin(ph);
      const dip = 1 - Math.abs(st);
      bob = Math.abs(st) * 4;
      lean += 0.025 * dir + st * 0.02;
      scaleY *= 1 - dip * 0.03; scaleX *= 1 + dip * 0.02;
      rigWalk(rig, art, ph, 10);
    } else {
      const br = Math.sin(e.bobPhase);
      scaleY *= 1 + br * 0.01;
      lean += 0.02 * dir;
      rig.breathe = 0.02 + br * 0.02;
      rig.bend = Math.sin(e.bobPhase * 0.6) * 1.5;
      rig.head = Math.sin(e.bobPhase * 0.8 + 1) * 1.2;
      rig.hem = 1.5; rig.phase = e.bobPhase;
    }

    if (e.landT > 0) {                          // crash-landing squash
      const k = e.landT / 0.2;
      scaleY *= 1 - 0.26 * k; scaleX *= 1 + 0.2 * k;
    }

    if (e.windup > 0) {
      // anticipation: coil back and flush red as the blow charges
      const k = clamp(1 - e.windup / (e.windupMax || 0.3), 0, 1);
      const pulse = 0.75 + 0.25 * Math.sin(k * 26);
      lean += -0.08 * dir * k;
      lungeX += -dir * 11 * k;
      scaleY *= 1 - 0.07 * k; scaleX *= 1 + 0.06 * k;
      rig.bend += -16 * k * art; rig.head += -4 * k * art; rig.stride = 5 * k;   // rears back
      tint = e.projectileSpeed ? '#ffd86a' : '#ff3a24'; tintAlpha = 0.42 * k * pulse;
    } else if (e.atkAnim > 0) {
      // the strike itself: snap forward, then recover
      const p = clamp(1 - e.atkAnim / 0.26, 0, 1);
      const f = p < 0.22 ? p / 0.22 : 1 - (p - 0.22) / 0.78;
      if (e.projectileSpeed) {
        lungeX += -f * 7 * dir; lean += -f * 0.06 * dir;       // recoil from the shot
      } else {
        lungeX += f * 30 * dir; lean += f * 0.10 * dir;
        scaleX *= 1 + f * 0.08; scaleY *= 1 - f * 0.03;
        rig.bend += f * 20 * art; rig.head += f * 5 * art; rig.stride = 4 + f * 6;   // whips through
      }
    }

    if (e.hitFlash > 0) {
      const k = Math.min(1, e.hitFlash / 0.35);
      if (e.stun <= 0 && e.launched <= 0) { scaleX *= 1 + 0.08 * k; scaleY *= 1 - 0.06 * k; }
      tint = SEAL; tintAlpha = Math.min(0.72, e.hitFlash * 2.6);   // struck: flushed vermilion
    }

    if (e.spawnT > 0) {
      const k = clamp(e.spawnT / (e.spawnKind === 'mirror' ? 0.55 : 0.4), 0, 1);   // 1 → 0
      alpha *= 1 - k;
      if (e.spawnKind === 'mirror') {
        scaleX *= 1 - 0.45 * k; scaleY *= 1 - 0.25 * k;
        tint = '#e8f0ff'; tintAlpha = Math.max(tintAlpha, k);
      }
    }

    const fold = turnFold(e.turnT);
    if (fold && e.launched <= 0) { scaleX *= fold.sx; if (fold.old) flip = !flip; }

    const footY = fy - bob;
    if (!e.mounted) drawShadow(sx, fy, e.width || 56, 1 - Math.min(0.6, lift / 200));

    // A charging officer: the lane they will thunder down is washed in red
    let rear = 0;
    if (e.charge) {
      const c = e.charge;
      if (c.phase === 0) {
        rear = Math.sin(Math.min(1, c.t / 0.9) * Math.PI * 0.9);
        const x0 = c.dir > 0 ? sx : 0, x1 = c.dir > 0 ? cssW : sx;
        ctx.save();
        ctx.globalAlpha = 0.14 + 0.14 * Math.abs(Math.sin(c.t * 12));
        ctx.fillStyle = SEAL;
        ctx.fillRect(x0, fy - 26, x1 - x0, 44);
        ctx.restore();
      }
    }

    // Dream theme: enemies are phantoms — jade aura + slight translucency
    if (theme.ghost) {
      ensureGhostGlow();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha;
      ctx.drawImage(ghostGlow, sx + lungeX - 60, footY - lift - visH + 8, 120, visH + 16);
      ctx.restore();
    }

    let figH = visH;
    let drew = true;
    if (e.mounted) {
      rig.stride = 0; rig.liftL = 0; rig.liftR = 0; rig.hem = 0;
      const charging = e.charge && e.charge.phase === 1;
      figH = drawMounted(e.sprite, sx, fy, {
        dir, phase: (e.walkPhase || 0) * Math.PI * (charging ? 1 : 0.8), moving: e.moving, t: e.bobPhase,
        lean: lean * 0.7 + (charging ? 0.12 * dir : 0), lift, lungeX, scaleX, scaleY, scale,
        riderFlip: flip, rig, alpha, tint, tintAlpha, dark: true, rear,
      });
    } else {
      drew = drawPosed(e.sprite, sx, footY, {
        flip, lean, lungeX, scaleX, scaleY, lift, scale, pivotY, alpha, tint, tintAlpha,
        rig: e.launched > 0 ? null : rig,
      });
    }
    if (!drew) {
      const w = e.width || 56, hh = e.height || 88;
      const bx = sx + lungeX, by = footY - lift;
      ctx.fillStyle = e.color || '#a55';
      ctx.fillRect(bx - w / 2, by - hh, w, hh - 12);
      ctx.beginPath(); ctx.arc(bx, by - hh - 4, w * 0.3, 0, Math.PI * 2); ctx.fill();
    }

    const drawnFootY = footY - lift;

    // Attack telegraph — a warning ring that closes as the strike lands.
    if (e.windup > 0) {
      const wk = clamp(e.windup / (e.windupMax || 0.3), 0, 1);  // 1 → 0
      const cyW = drawnFootY - figH * (e.mounted ? 0.72 : 0.5);
      const cxW = sx + lungeX;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = e.projectileSpeed ? '#ffd86a' : '#ff5a4a';
      ctx.globalAlpha = 0.3 + 0.55 * (1 - wk);
      ctx.beginPath();
      ctx.arc(cxW, cyW, 16 + wk * 52, 0, Math.PI * 2);
      ctx.stroke();
      if (wk < 0.28) {
        ctx.globalAlpha = (0.28 - wk) / 0.28 * 0.7;
        ctx.fillStyle = '#fff';
        drawStar(cxW, cyW, 20, 5, wk * 6);
      }
      ctx.restore();
    }

    if ((e.boss || e.hp < e.hpMax) && !(e.spawnT > 0)) {
      const bw = e.boss ? 110 : 50;
      const bx = sx - bw / 2;
      const by = drawnFootY - figH - 12;
      if (e.boss) drawSeal(sx + dir * -84, by - 4, e.zh);          // the officer's name seal
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = e.boss ? '#c44' : '#d77';
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.hpMax), 4);
      // 五行 element badge beside the bar
      const meta = e.el && ELEMENTS[e.el];
      if (meta) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.beginPath(); ctx.arc(bx - 10, by + 2, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = meta.color;
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.zh, bx - 10, by + 3);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  function drawProjectile(p, camX) {
    const sx = p.x - camX;
    if (sx < -50 || sx > cssW + 50) return;
    const fy = floorYFromZ(p.z) + (p.yOff || -40);
    if (p.kind === 'arrow') {
      ctx.save();
      ctx.translate(sx, fy);
      ctx.rotate(p.angle || 0);
      // motion streak behind the shaft
      const grad = ctx.createLinearGradient(-64, 0, -8, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, p.enemy ? 'rgba(255,120,100,0.55)' : 'rgba(210,255,190,0.6)');
      ctx.fillStyle = grad;
      ctx.fillRect(-64, -1.5, 56, 3);
      ctx.fillStyle = p.enemy ? '#a44' : '#caffaa';
      ctx.fillRect(-12, -2, 24, 4);
      ctx.fillStyle = p.enemy ? '#622' : '#5a8a3a';
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(4, -5); ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawItem(it, camX) {
    const sx = it.x - camX;
    if (sx < -40 || sx > cssW + 40) return;
    const fy = floorYFromZ(it.z);
    const bob = Math.sin(it.bobT * 3) * 4;
    drawShadow(sx, fy, 20);
    ctx.fillStyle = it.color || '#fff';
    ctx.beginPath();
    ctx.arc(sx, fy - 14 - bob, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (it.glyph) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(it.glyph, sx, fy - 13 - bob);
    }
  }

  function drawBarrel(b, camX) {
    if (b.broken) return;
    const sx = b.x - camX;
    if (sx < -40 || sx > cssW + 40) return;
    const fy = floorYFromZ(b.z);
    drawShadow(sx, fy, 36);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(sx - 16, fy - 32, 32, 32);
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 16, fy - 32, 32, 32);
    ctx.beginPath();
    ctx.moveTo(sx - 16, fy - 20); ctx.lineTo(sx + 16, fy - 20);
    ctx.moveTo(sx - 16, fy - 10); ctx.lineTo(sx + 16, fy - 10);
    ctx.stroke();
  }

  function drawVfx(fx, camX) {
    if (fx.t < 0) return;                       // delayed effect not visible yet
    const a = Math.max(0, 1 - fx.t / fx.dur);
    const sx = fx.world ? fx.x - camX : fx.x;
    const fy = fx.world ? (floorYFromZ(fx.z || 100) + (fx.yOff || -40)) : fx.y;
    ctx.save();
    ctx.globalAlpha = a;
    switch (fx.kind) {
      case 'slash': {
        // A tapered crescent that sweeps through the arc of the swing.
        const tt = fx.t / fx.dur;
        const r = Math.max(60, (fx.range || 100) * 0.74);
        const ease = 1 - Math.pow(1 - Math.min(1, tt / 0.55), 3);
        ctx.translate(sx + fx.dir * 14, fy);
        ctx.scale(fx.dir, fx.flipY ? -1 : 1);
        if (fx.up) ctx.rotate(-0.95);
        else if (fx.down) ctx.rotate(0.75);
        ctx.rotate(-0.85 + ease * 1.25);
        ctx.scale(1 + ease * 0.12, 1 + ease * 0.12);
        const th = 1.05;                                   // half-angle of the blade
        const d = r * 0.36;                                // inner circle offset
        const px = r * Math.cos(th), py = r * Math.sin(th);
        const r2 = Math.hypot(px + d, py);
        const ph = Math.atan2(py, px + d);
        ctx.globalAlpha = a * 0.86;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(0, 0, r, -th, th);
        ctx.arc(-d, 0, r2, ph, -ph, true);
        ctx.closePath();
        ctx.fill();
        // bright leading edge
        const d2 = r * 0.16;
        const r3 = Math.hypot(px + d2, py), ph3 = Math.atan2(py, px + d2);
        ctx.globalAlpha = a * 0.75;
        ctx.fillStyle = '#f7f1e3';
        ctx.beginPath();
        ctx.arc(0, 0, r, -th * 0.92, th * 0.92);
        ctx.arc(-d2, 0, r3, ph3 * 0.92, -ph3 * 0.92, true);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'thrust': {
        // Spear/sword lunge: a lance of light stabbing along the row.
        const tt = fx.t / fx.dur;
        const len = (fx.range || 150) * (1 - Math.pow(1 - Math.min(1, tt / 0.35), 3));
        const wdt = 13 * (1 - tt * 0.6);
        ctx.translate(sx + fx.dir * 10, fy);
        ctx.scale(fx.dir, 1);
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(0, -wdt * 0.5); ctx.lineTo(len * 0.72, -wdt); ctx.lineTo(len, 0);
        ctx.lineTo(len * 0.72, wdt); ctx.lineTo(0, wdt * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = a * 0.8;
        ctx.fillStyle = '#f7f1e3';
        ctx.beginPath();
        ctx.moveTo(8, -wdt * 0.18); ctx.lineTo(len * 0.8, -wdt * 0.32); ctx.lineTo(len * 0.97, 0);
        ctx.lineTo(len * 0.8, wdt * 0.32); ctx.lineTo(8, wdt * 0.18);
        ctx.closePath(); ctx.fill();
        // speed lines
        ctx.strokeStyle = 'rgba(26,22,18,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(len * 0.1, -wdt - 7); ctx.lineTo(len * 0.62, -wdt - 7);
        ctx.moveTo(len * 0.2, wdt + 8); ctx.lineTo(len * 0.7, wdt + 8);
        ctx.stroke();
        break;
      }
      case 'muzzle': {
        // Bowstring release: a quick flare at the bow.
        const tt = fx.t / fx.dur;
        ctx.globalAlpha = a;
        ctx.fillStyle = INK;
        drawStar(sx + fx.dir * 34, fy, 20 * (0.5 + tt), 4, tt * 2);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3 * (1 - tt);
        ctx.beginPath();
        ctx.arc(sx + fx.dir * 34, fy, 8 + tt * 22, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'shock':
      case 'ring': {
        // Ground-hugging shockwave: flattened rings racing outward.
        const tt = fx.t / fx.dur;
        const ease = 1 - Math.pow(1 - tt, 3);
        const R = (fx.range || 130) * (0.25 + ease * 0.95);
        const gy = floorYFromZ(fx.z || 100) + 4;
        const gx = fx.kind === 'shock' ? sx + fx.dir * 46 : sx;
        ctx.translate(gx, gy);
        ctx.scale(1, 0.36);
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = INK;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2, true); ctx.fill();
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4 * (1 - tt) + 1;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        if (fx.kind === 'shock') {
          // cracks radiating through the earth
          ctx.strokeStyle = 'rgba(30,16,8,0.8)';
          ctx.lineWidth = 3;
          for (let i = 0; i < 7; i++) {
            const ang = i * 0.9 + 0.3;
            const r0 = R * 0.18, r1 = R * (0.62 + (i % 3) * 0.12);
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
            ctx.lineTo(Math.cos(ang + 0.12) * r1 * 0.6, Math.sin(ang + 0.12) * r1 * 0.6);
            ctx.lineTo(Math.cos(ang - 0.06) * r1, Math.sin(ang - 0.06) * r1);
            ctx.stroke();
          }
        }
        break;
      }
      case 'cast': {
        // Gathering power: a magic circle spins up under the caster while
        // motes of light are drawn inward.
        const tt = fx.t / fx.dur;
        const gy = floorYFromZ(fx.z || 100) + 4;
        ctx.save();
        ctx.translate(sx, gy);
        ctx.scale(1, 0.36);
        ctx.globalAlpha = Math.sin(Math.min(1, tt * 1.2) * Math.PI) * 0.8;
        ctx.strokeStyle = SEAL;
        const R = 74;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.72, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const ang = tt * 5 + (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(0, 0, R * 0.86, ang, ang + 0.34);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = INK;
        for (let i = 0; i < 10; i++) {
          const ang = i * 2.39 + 0.6;
          const rr = 120 * (1 - tt) * (0.5 + (i % 4) * 0.17);
          ctx.globalAlpha = Math.min(1, tt * 3) * (1 - tt);
          ctx.beginPath();
          ctx.arc(sx + Math.cos(ang) * rr, gy - 70 + Math.sin(ang) * rr * 0.6, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'aoe': {
        const r = (fx.range || 200) * Math.min(1, fx.t / (fx.dur * 0.4));
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6 * (1 - fx.t / fx.dur);
        ctx.beginPath();
        ctx.arc(sx, fy + 12, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'beam': {
        // Layered energy beam: soft halo, coloured body, flickering white core.
        const tt = fx.t / fx.dur;
        const L = (fx.range || 600) * Math.min(1, tt / 0.12);
        const flick = 0.85 + 0.15 * Math.sin(fx.t * 70);
        const wd = (fx.width || 40) * (tt < 0.7 ? 1 : 1 - (tt - 0.7) / 0.3) * flick;
        const x1 = sx + fx.dir * 26, x2 = sx + fx.dir * L;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = INK;
        ctx.lineWidth = wd * 1.7;
        ctx.beginPath(); ctx.moveTo(x1, fy); ctx.lineTo(x2, fy); ctx.stroke();
        ctx.globalAlpha = 0.82;
        ctx.lineWidth = wd * 0.8;
        ctx.beginPath(); ctx.moveTo(x1, fy); ctx.lineTo(x2, fy); ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#f7f1e3';
        ctx.lineWidth = Math.max(2, wd * 0.26);
        ctx.beginPath(); ctx.moveTo(x1, fy); ctx.lineTo(x2, fy); ctx.stroke();
        // rings racing down the beam + a flare at the source
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const k = ((fx.t * 2.4 + i * 0.25) % 1);
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.beginPath();
          ctx.ellipse(sx + fx.dir * (26 + k * (L - 26)), fy, wd * 0.22, wd * 0.75, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = INK;
        drawStar(x1, fy, wd * 1.1, wd * 0.25, fx.t * 6);
        break;
      }
      case 'spin': {
        // Whirling blades: crescents orbiting the caster over expanding rings.
        const tt = fx.t / fx.dur;
        const R = fx.range || 130;
        const gy = floorYFromZ(fx.z || 100) + 4;
        ctx.save();
        ctx.translate(sx, gy);
        ctx.scale(1, 0.36);
        for (let k = 0; k < 3; k++) {
          const kk = (tt * 1.6 + k / 3) % 1;
          ctx.globalAlpha = a * (1 - kk) * 0.8;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 5 * (1 - kk) + 1;
          ctx.beginPath(); ctx.arc(0, 0, R * (0.15 + kk * 0.95), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        const blades = 5;
        for (let k = 0; k < blades; k++) {
          const ang = tt * Math.PI * 5 + k * (Math.PI * 2 / blades);
          const rr = Math.min(R * 0.62, 150) * Math.min(1, tt / 0.15);
          const bx = sx + Math.cos(ang) * rr;
          const by = fy + Math.sin(ang) * rr * 0.36 - 6;
          const depth = Math.sin(ang);                      // behind → smaller
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(ang + Math.PI / 2);
          const sc = 1.25 + depth * 0.35;
          ctx.scale(sc, sc);
          ctx.globalAlpha = a * (0.65 + depth * 0.3);
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(0, 0, 30, -1.1, 1.1);
          ctx.arc(-13, 0, 37, 0.8, -0.8, true);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#f7f1e3';
          ctx.beginPath();
          ctx.arc(0, 0, 30, -0.9, 0.9);
          ctx.arc(-5, 0, 32.5, 0.8, -0.8, true);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'rain': {
        // Starlight arrows streak down across the field, splashing where they land.
        const seedRoot = fx.seed | 0;
        const spread = Math.min(fx.range || 600, 620);
        const N = 26;
        ctx.lineCap = 'round';
        for (let i = 0; i < N; i++) {
          const seed = (seedRoot + i * 7919) | 0;
          const offX = ((seed * 37) % (spread * 2)) - spread;
          const gz = Z_MIN + ((seed * 13) % (Z_MAX - Z_MIN));
          const gy = floorYFromZ(gz);
          const cyc = (fx.t * 2.2 + ((seed * 17) % 100) / 100) % 1;
          const fall = 1 - cyc;                              // 1 high → 0 ground
          const x = sx + offX + fall * 70;
          const y = gy - fall * 330;
          ctx.globalAlpha = a * 0.9;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 11, y - 52); ctx.stroke();
          ctx.strokeStyle = '#f7f1e3';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y - 28); ctx.stroke();
          if (cyc > 0.82) {                                  // ground splash
            const k = (cyc - 0.82) / 0.18;
            ctx.globalAlpha = a * (1 - k);
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(sx + offX, gy, 6 + k * 16, 2 + k * 5, 0, 0, Math.PI * 2); ctx.stroke();
          }
        }
        break;
      }
      case 'pop': {
        // Impact star: a spiked flash plus a ring snapping outward.
        const k = fx.t / fx.dur;
        const R = 12 + k * 20;
        ctx.globalAlpha = a;
        ctx.fillStyle = INK;
        drawStar(sx, fy, R * 1.5, R * 0.3, fx.rot || 0);
        ctx.fillStyle = fx.color === '#fff076' ? SEAL : INK;
        drawStar(sx, fy, R * 1.05, R * 0.42, (fx.rot || 0) + 0.6);
        // spatter droplets
        for (let i = 0; i < 5; i++) {
          const da = (fx.rot || 0) + i * 1.26, dr = R * (1.5 + (i % 3) * 0.35);
          ctx.beginPath(); ctx.arc(sx + Math.cos(da) * dr, fy + Math.sin(da) * dr, 2.2 - k * 1.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3 * (1 - k);
        ctx.beginPath();
        ctx.arc(sx, fy, R * 1.3, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'damageNumber': {
        const ddy = 46 * (1 - Math.pow(1 - Math.min(1, fx.t / fx.dur), 2));
        const pop = fx.t < 0.12 ? 1.7 - (fx.t / 0.12) * 0.7 : 1;      // punch in, settle
        const nx = sx + (fx.drift || 0) * Math.min(1, fx.t / fx.dur);
        ctx.globalAlpha = Math.min(1, a * 2.2);
        ctx.translate(nx, fy - 30 - ddy);
        ctx.scale(pop, pop);
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(250,244,230,0.92)';
        if (fx.text) {                       // spirit-capture / status float
          ctx.fillStyle = INK;
          ctx.font = 'bold 15px system-ui';
          ctx.strokeText(fx.text, 0, 0);
          ctx.fillText(fx.text, 0, 0);
          break;
        }
        // element effectiveness tints the number: green = overcoming (相剋),
        // grey = resisted
        ctx.fillStyle = fx.crit ? SEAL : fx.heal ? '#2f7a3c'
          : fx.eff === 'strong' ? '#1f5f8a' : fx.eff === 'weak' ? '#8a8378' : INK;
        ctx.font = `bold ${fx.crit ? 28 : fx.eff === 'strong' ? 23 : 20}px system-ui`;
        const text = fx.heal ? `+${fx.value}` : `${fx.value}`;
        ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);
        break;
      }
      case 'bolt': {
        // Five-Thunder strike — jagged lightning from the sky to the target.
        const seed = fx.seed | 0;
        const segs = 7;
        ctx.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? INK : 'rgba(60,70,110,0.45)';
          ctx.lineWidth = pass ? 3 : 9 * a;
          ctx.beginPath();
          let px = sx, py = fy - 420;
          ctx.moveTo(px, py);
          for (let i = 1; i <= segs; i++) {
            const k = i / segs;
            const jit = (((seed * 73 + i * 131) % 100) / 100 - 0.5) * 46 * (1 - k * 0.5);
            px = sx + jit;
            py = fy - 420 + k * 420;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        break;
      }
      case 'flash': {
        // Fullscreen white flash (screen-space).
        ctx.fillStyle = `rgba(235,240,255,${a * 0.75})`;
        ctx.fillRect(-30, -30, cssW + 60, cssH + 60);
        break;
      }
      case 'clash': {
        // Blades meet: a burst of ink, a ring, and the ring of steel — 鏘.
        const k = fx.t / fx.dur;
        const R = 22 + k * 46;
        ctx.globalAlpha = a;
        ctx.fillStyle = INK;
        drawStar(sx, fy, R * 1.9, R * 0.22, fx.rot || 0);
        drawStar(sx, fy, R * 1.3, R * 0.3, (fx.rot || 0) + 0.8);
        ctx.fillStyle = '#fbf3e2';
        drawStar(sx, fy, R * 0.9, R * 0.2, (fx.rot || 0) + 0.4);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(sx, fy, R * 1.5, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 9; i++) {
          const da = (fx.rot || 0) + i * 0.7, dr = R * (1.7 + (i % 3) * 0.4);
          ctx.beginPath(); ctx.arc(sx + Math.cos(da) * dr, fy + Math.sin(da) * dr * 0.8, 3 - k * 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = Math.min(1, a * 2);
        drawSeal(sx + 44, fy - 74 - k * 16, '鏘', Math.min(1, a * 2));
        break;
      }
      case 'cutin': {
        // Full-gauge special: the hero's portrait sweeps across a slashed band.
        const tt = fx.t / fx.dur;
        const inK = 1 - Math.pow(1 - Math.min(1, tt / 0.22), 3);
        const outK = tt > 0.78 ? (tt - 0.78) / 0.22 : 0;
        const bandH = Math.min(190, cssH * 0.3);
        const cy = cssH * 0.4;
        ctx.globalAlpha = (1 - outK) * 0.92;
        ctx.save();
        ctx.translate(cssW / 2, cy);
        ctx.rotate(-0.06);
        ctx.scale(1, inK);
        const bg = ctx.createLinearGradient(-cssW, 0, cssW, 0);
        bg.addColorStop(0, 'rgba(10,6,4,0.95)');
        bg.addColorStop(0.55, 'rgba(40,14,8,0.92)');
        bg.addColorStop(1, 'rgba(10,6,4,0.95)');
        ctx.fillStyle = bg;
        ctx.fillRect(-cssW, -bandH / 2, cssW * 2, bandH);
        ctx.fillStyle = fx.color || '#ffd676';
        ctx.fillRect(-cssW, -bandH / 2 - 4, cssW * 2, 4);
        ctx.fillRect(-cssW, bandH / 2, cssW * 2, 4);
        // speed streaks racing through the band
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 9; i++) {
          const yy = -bandH / 2 + 12 + i * (bandH - 24) / 8;
          const xx = ((fx.t * 1900 + i * 331) % (cssW * 2)) - cssW;
          ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 190, yy); ctx.stroke();
        }
        ctx.beginPath();
        ctx.rect(-cssW, -bandH / 2, cssW * 2, bandH);
        ctx.clip();
        const px = -cssW * 0.5 + inK * cssW * 0.3 + tt * 30;
        const sh = spriteDrawHeight(fx.sprite) || 150;
        drawSprite(ctx, fx.sprite, px, bandH * 1.5, { scale: (bandH * 2.3) / sh, alpha: (1 - outK) });
        ctx.restore();
        ctx.globalAlpha = (1 - outK) * Math.min(1, tt / 0.2);
        ctx.font = `italic 900 ${Math.max(22, Math.min(54, cssW * 0.05))}px system-ui`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        const tx = cssW * 0.6 + (1 - inK) * 120;
        ctx.strokeText(fx.text || '', tx, cy + 16);
        ctx.fillStyle = fx.color || '#ffd676';
        ctx.fillText(fx.text || '', tx, cy + 16);
        break;
      }
      case 'banner': {
        // Brush-stroke title card: snaps in large, settles, then fades.
        const size0 = fx.size || 38;
        ctx.font = `bold ${size0}px system-ui`;
        const fit = Math.min(1, (cssW - 56) / Math.max(1, ctx.measureText(fx.text || '').width + 48));
        const size = Math.max(14, Math.floor(size0 * fit));
        const inK = Math.min(1, fx.t / 0.16);
        const sc = 1 + (1 - inK) * 0.35;
        ctx.globalAlpha = Math.min(1, a * 3) * inK * 0.96;
        ctx.translate(sx, fy);
        ctx.scale(sc, sc);
        ctx.font = `bold ${size}px system-ui`;
        ctx.textAlign = 'center';
        const m = ctx.measureText(fx.text || '');
        const pad = Math.round(size * 0.6);
        const bw = m.width + pad * 2;
        const bh = size + pad;
        const grad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.14, 'rgba(8,4,2,0.74)');
        grad.addColorStop(0.86, 'rgba(8,4,2,0.74)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(-bw / 2 - 30, -bh / 2, bw + 60, bh);
        ctx.fillStyle = SEAL;
        ctx.fillRect(-bw / 2, -bh / 2, bw, 2);
        ctx.fillRect(-bw / 2, bh / 2 - 2, bw, 2);
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(fx.text || '', 0, size * 0.34);
        ctx.fillStyle = '#f7f1e3';
        ctx.fillText(fx.text || '', 0, size * 0.34);
        break;
      }
    }
    ctx.restore();
  }

  function drawParticle(p, camX) {
    const sx = p.x - camX;
    if (sx < -40 || sx > cssW + 40) return;
    const fy = floorYFromZ(p.z) - (p.y || 0);
    const lifeK = clamp(p.life / p.max, 0, 1);
    switch (p.kind) {
      case 'spark':
        // flung ink; the brightest sparks (crits, relics) are vermilion
        ctx.globalAlpha = lifeK * 0.9;
        ctx.strokeStyle = inkOf(p.color);
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, fy);
        ctx.lineTo(sx - p.vx * 0.018, fy + p.vy * 0.018);
        ctx.stroke();
        break;
      case 'dust': {
        const r = p.size * (1 + (1 - lifeK) * 1.7);
        ctx.globalAlpha = lifeK * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, fy, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'debris':
        ctx.globalAlpha = lifeK;
        ctx.save();
        ctx.translate(sx, fy);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        ctx.restore();
        break;
      case 'ember':
        // drifting flecks of dry ink
        ctx.globalAlpha = lifeK * 0.28;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(sx, fy, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'petal': {
        // falling blossom — a small rotating ellipse
        ctx.globalAlpha = Math.min(1, lifeK * 2) * 0.85;
        ctx.save();
        ctx.translate(sx, fy);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
    }
  }

  // Map the old glow colours onto the two inks a painter has: black and red.
  function inkOf(color) {
    if (!color) return INK;
    const c = color.toLowerCase();
    if (c === '#fff1a0' || c === '#ffe6a0' || c === '#ff8484') return SEAL;
    return INK;
  }

  // Ground-hugging particles (dust, wood debris, falling petals) — drawn
  // behind characters.
  function drawGroundParticles(g) {
    const camX = g.camX;
    for (let i = 0; i < g.particles.length; i++) {
      const p = g.particles[i];
      if (p.kind === 'dust' || p.kind === 'debris' || p.kind === 'petal') drawParticle(p, camX);
    }
    ctx.globalAlpha = 1;
  }

  // Glowing particles (impact sparks, ambient embers) — additive, on top.
  function drawAirParticles(g) {
    const camX = g.camX;
    for (let i = 0; i < g.particles.length; i++) {
      const p = g.particles[i];
      if (p.kind === 'spark' || p.kind === 'ember') drawParticle(p, camX);
    }
    ctx.globalAlpha = 1;
  }

  // ── Mission objects ──

  function drawCage(c, camX) {
    const sx = c.x - camX;
    if (sx < -80 || sx > cssW + 80) return;
    const fy = floorYFromZ(c.z);
    const shake = c.hitT > 0 ? Math.sin(c.hitT * 90) * 3 * Math.min(1, c.hitT / 0.2) : 0;
    const cw = 74, ch = 112;
    drawShadow(sx, fy, 60);
    // occupant, dimmed behind the bars
    drawPosed(c.occupant, sx + shake * 0.4, fy - 4, { scale: 0.62, alpha: 0.92 });
    ctx.save();
    ctx.translate(sx + shake, fy);
    const hurt = 1 - c.hp / c.hpMax;
    ctx.rotate(hurt * 0.05);
    // frame
    ctx.strokeStyle = '#4a3018';
    ctx.lineWidth = 7;
    ctx.strokeRect(-cw / 2, -ch, cw, ch);
    // bars
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#5d3d20';
    for (let i = 1; i <= 3; i++) {
      const bx = -cw / 2 + (cw / 4) * i;
      ctx.beginPath(); ctx.moveTo(bx, -ch + 4); ctx.lineTo(bx + hurt * 3 * (i % 2 ? 1 : -1), -4); ctx.stroke();
    }
    // crossbeam + lock
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-cw / 2, -ch * 0.55); ctx.lineTo(cw / 2, -ch * 0.55); ctx.stroke();
    ctx.fillStyle = '#8a7020';
    ctx.fillRect(cw / 2 - 12, -ch * 0.58, 9, 12);
    ctx.restore();
    // name tag
    ctx.save();
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const nw = ctx.measureText(c.name).width + 12;
    ctx.fillRect(sx - nw / 2, fy - ch - 22, nw, 15);
    ctx.fillStyle = '#ffd676';
    ctx.fillText(c.name, sx, fy - ch - 11);
    ctx.restore();
  }

  function drawGate(gt, camX, time) {
    if (gt.kind === 'mirror') { drawMirror(gt, camX, time); return; }
    const sx = gt.x - camX;
    if (sx < -160 || sx > cssW + 160) return;
    const baseY = floorYFromZ(Z_MAX) + 8;
    const topY = horizonY + 26;
    const shake = gt.hitT > 0 ? Math.sin(gt.hitT * 80) * 4 * Math.min(1, gt.hitT / 0.2) : 0;
    const w = 96;
    ctx.save();
    ctx.translate(sx + shake, 0);
    // stone posts
    ctx.fillStyle = '#3a3f4e';
    ctx.fillRect(-w / 2 - 16, topY - 12, 16, baseY - topY + 12);
    ctx.fillRect(w / 2, topY - 12, 16, baseY - topY + 12);
    // lintel roof
    ctx.fillStyle = '#2b2f3c';
    ctx.fillRect(-w / 2 - 30, topY - 26, w + 60, 20);
    ctx.fillStyle = '#8a2f28';
    ctx.fillRect(-w / 2 - 24, topY - 34, w + 48, 10);
    // door panels
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(-w / 2, topY, w / 2 - 1, baseY - topY);
    ctx.fillRect(1, topY, w / 2 - 1, baseY - topY);
    // iron bands + studs
    ctx.fillStyle = '#23252e';
    for (let i = 1; i <= 3; i++) {
      const by = topY + (baseY - topY) * (i / 4);
      ctx.fillRect(-w / 2, by - 3, w, 6);
    }
    ctx.fillStyle = '#c9a23a';
    for (let i = 1; i <= 3; i++) {
      const by = topY + (baseY - topY) * (i / 4);
      ctx.beginPath(); ctx.arc(-w / 4, by, 3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(w / 4, by, 3, 0, 7); ctx.fill();
    }
    // damage cracks
    const hurt = 1 - gt.hp / gt.hpMax;
    if (hurt > 0.15) {
      ctx.strokeStyle = 'rgba(10,6,2,0.85)';
      ctx.lineWidth = 2.5;
      const cracks = Math.min(5, Math.floor(hurt * 6));
      for (let i = 0; i < cracks; i++) {
        const cy0 = topY + 24 + i * 34;
        ctx.beginPath();
        ctx.moveTo((i % 2 ? -1 : 1) * w * 0.3, cy0);
        ctx.lineTo((i % 2 ? -1 : 1) * w * 0.12, cy0 + 18);
        ctx.lineTo((i % 2 ? -1 : 1) * w * 0.26, cy0 + 40);
        ctx.stroke();
      }
    }
    ctx.restore();
    // HP bar + label (not shaken)
    const bw = 120;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(sx - bw / 2 - 1, topY - 52, bw + 2, 9);
    ctx.fillStyle = '#c9822e';
    ctx.fillRect(sx - bw / 2, topY - 51, bw * Math.max(0, gt.hp / gt.hpMax), 7);
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd676';
    ctx.fillText(gt.name, sx, topY - 58);
    // subtle "strike here" pulse while intact
    if (gt.hp > 0 && time) {
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(time * 3);
      ctx.strokeStyle = '#ffd676';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - w / 2 - 4, topY - 4, w + 8, baseY - topY + 8);
      ctx.globalAlpha = 1;
    }
  }

  // 風月寶鑑 — a standing oval mirror that spills phantoms until shattered.
  function drawMirror(gt, camX, time) {
    const sx = gt.x - camX;
    if (sx < -160 || sx > cssW + 160) return;
    const fy = floorYFromZ(120);
    const shake = gt.hitT > 0 ? Math.sin(gt.hitT * 80) * 4 * Math.min(1, gt.hitT / 0.2) : 0;
    const rw = 52, rh = 96;                      // mirror radii
    const cy = fy - rh - 26;
    drawShadow(sx, fy, 70);
    ctx.save();
    ctx.translate(sx + shake, cy);
    // stand legs
    ctx.strokeStyle = '#6a5230';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-rw * 0.7, rh + 24); ctx.lineTo(0, rh - 10);
    ctx.moveTo(rw * 0.7, rh + 24); ctx.lineTo(0, rh - 10);
    ctx.stroke();
    // gold frame
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#c9a23a';
    ctx.beginPath(); ctx.ellipse(0, 0, rw + 6, rh + 6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#8a6a20';
    ctx.beginPath(); ctx.ellipse(0, 0, rw + 11, rh + 11, 0, 0, Math.PI * 2); ctx.stroke();
    // glass — pale, with a slow moving glint
    ctx.fillStyle = 'rgba(190,210,225,0.85)';
    ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2); ctx.clip();
    const gx = ((time * 40) % (rw * 4)) - rw * 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(gx - 20, -rh); ctx.lineTo(gx + 30, rh); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(gx + 18, -rh); ctx.lineTo(gx + 68, rh); ctx.stroke();
    // a dark silhouette stirs inside the glass
    ctx.fillStyle = 'rgba(60,40,80,0.35)';
    ctx.beginPath();
    ctx.ellipse(Math.sin(time * 1.4) * 10, rh * 0.25, 16, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // damage cracks radiating from center
    const hurt = 1 - gt.hp / gt.hpMax;
    if (hurt > 0.12) {
      ctx.strokeStyle = 'rgba(30,20,40,0.9)';
      ctx.lineWidth = 2;
      const cracks = Math.min(7, Math.floor(hurt * 8));
      for (let i = 0; i < cracks; i++) {
        const ang = (i / 7) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 6, Math.sin(ang) * 10);
        ctx.lineTo(Math.cos(ang) * rw * 0.55, Math.sin(ang) * rh * 0.55);
        ctx.lineTo(Math.cos(ang + 0.18) * rw * 0.85, Math.sin(ang + 0.18) * rh * 0.85);
        ctx.stroke();
      }
    }
    ctx.restore();
    // HP bar + name
    const bw = 130;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(sx - bw / 2 - 1, cy - rh - 34, bw + 2, 9);
    ctx.fillStyle = '#b48cff';
    ctx.fillRect(sx - bw / 2, cy - rh - 33, bw * Math.max(0, gt.hp / gt.hpMax), 7);
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8d8ff';
    ctx.fillText(gt.name, sx, cy - rh - 40);
  }

  function drawRitual(r, camX, time) {
    const sx = r.x - camX;
    const fy = floorYFromZ(r.z);
    // magic circle — two counter-rotating dashed rings
    ctx.save();
    ctx.translate(sx, fy + 4);
    ctx.scale(1, 0.38);
    const pulse = 0.75 + 0.25 * Math.sin(time * 3.2);
    for (let ring = 0; ring < 2; ring++) {
      const rad = 58 + ring * 22;
      const segs = 10 + ring * 4;
      const spin = time * (ring ? -0.9 : 1.3);
      ctx.strokeStyle = ring ? `rgba(180,140,255,${0.5 * pulse})` : `rgba(220,190,255,${0.7 * pulse})`;
      ctx.lineWidth = ring ? 3 : 4;
      for (let i = 0; i < segs; i++) {
        const a0 = spin + (i / segs) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, rad, a0, a0 + (Math.PI * 2 / segs) * 0.55);
        ctx.stroke();
      }
    }
    ctx.restore();
    // the Taoist, swaying as he chants
    drawShadow(sx, fy, 50);
    drawPosed(r.sprite, sx, fy, { lean: Math.sin(time * 2.4) * 0.05, scale: 0.98 });
    // progress ring above his head
    const px = sx, py = fy - 178;
    const prog = Math.min(1, r.t / r.dur);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#c9a0ff';
    ctx.beginPath(); ctx.arc(px, py, 16, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
    // hp bar + name
    const bw = 86;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(sx - bw / 2 - 1, fy - 168, bw + 2, 7);
    ctx.fillStyle = r.hp / r.hpMax > 0.35 ? '#8adf7a' : '#e3663a';
    ctx.fillRect(sx - bw / 2, fy - 167, bw * Math.max(0, r.hp / r.hpMax), 5);
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8d8ff';
    ctx.fillText(r.name, sx, fy - 173);
  }

  function drawActor(a, camX) {
    const sx = a.x - camX;
    if (sx < -120 || sx > cssW + 120) return;
    const fy = floorYFromZ(a.z);
    drawShadow(sx, fy, 44, 1 - Math.min(0.6, (a.y || 0) / 160));
    drawPosed(a.sprite, sx, fy, {
      flip: a.artLeft ? a.vx > 0 : a.vx < 0, lift: a.y || 0,
      rig: a.artLeft ? {
        bend: 0, belly: 0, head: Math.sin(a.t * 16) * 3, breathe: 0, hem: 0, phase: 0,
        stride: 15 * Math.sin(a.t * 14), liftL: 14 * Math.max(0, Math.cos(a.t * 14)), liftR: 14 * Math.max(0, -Math.cos(a.t * 14)),
      } : null,
      // static garden NPCs breathe gently; freed captives scamper-wobble
      lean: a.static ? Math.sin(a.t * 1.6) * 0.025 : Math.sin(a.t * 9) * 0.08,
      scale: a.static ? 1 : 0.9, alpha: a.alpha == null ? 1 : a.alpha,
    });
    if (a.static && a.name) {
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const nw = ctx.measureText(a.name).width + 12;
      ctx.fillRect(sx - nw / 2, fy - 172, nw, 15);
      ctx.fillStyle = a.color || '#ffd676';
      ctx.fillText(a.name, sx, fy - 161);
    }
  }

  // ── In-world speech bubbles ──
  function wrapText(text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const wd of words) {
      const probe = line ? line + ' ' + wd : wd;
      if (ctx.measureText(probe).width > maxW && line) { lines.push(line); line = wd; }
      else line = probe;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawSpeech(g) {
    if (!g.speech || !g.speech.length) return;
    const camX = g.camX;
    for (let i = 0; i < g.speech.length; i++) {
      const s = g.speech[i];
      if (s.t < 0) continue;                       // still delayed
      // resolve the anchor position each frame so bubbles track their speaker
      let wx = s.lastX, wz = s.lastZ, head = s.headH || 150;
      if (s.target === 'hero') { wx = g.hero.x; wz = g.hero.z; }
      else if (s.target && s.target.kind === 'enemy') {
        const e = g.enemies.find(en => en.id === s.target.id && !en.dead);
        if (e) { wx = e.x; wz = e.z; head = (e.boss ? 190 : 140); }
      } else if (s.target === 'ritual' && g.ritual) { wx = g.ritual.x; wz = g.ritual.z; }
      if (wx == null) continue;
      s.lastX = wx; s.lastZ = wz;

      const sx = wx - camX;
      if (sx < -240 || sx > cssW + 240) continue;
      const fy = floorYFromZ(wz);

      const fade = Math.min(1, s.t / 0.18, Math.max(0, (s.dur - s.t) / 0.3));
      const popup = 1 - Math.min(1, s.t / 0.18);
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.font = '13px system-ui';
      const lines = wrapText(s.text, 210);
      const lw = Math.min(218, Math.max(70, ...lines.map(l => ctx.measureText(l).width)) + 8);
      const lh = lines.length * 17 + 24;
      const bx = Math.max(8, Math.min(sx - lw / 2 - 8, cssW - lw - 24));
      const by = fy - head - lh - 26 + popup * 8;
      // bubble (roundRect with fallback for older Safari)
      ctx.fillStyle = 'rgba(16,10,6,0.88)';
      ctx.strokeStyle = s.color || '#ffd676';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, lw + 16, lh, 8);
      else ctx.rect(bx, by, lw + 16, lh);
      ctx.fill(); ctx.stroke();
      // tail
      ctx.beginPath();
      ctx.moveTo(sx - 6, by + lh);
      ctx.lineTo(sx + 6, by + lh);
      ctx.lineTo(sx, by + lh + 10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(16,10,6,0.88)';
      ctx.fill();
      // name + text
      ctx.textAlign = 'left';
      ctx.fillStyle = s.color || '#ffd676';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(s.name || '', bx + 9, by + 14);
      ctx.fillStyle = '#f3e8d0';
      ctx.font = '13px system-ui';
      for (let li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], bx + 9, by + 30 + li * 17);
      }
      ctx.restore();
    }
  }

  // The boss's name and a long health bar across the top, arcade-style.
  function drawBossBar(g) {
    let boss = null;
    for (let i = 0; i < g.enemies.length; i++) if (g.enemies[i].boss && !g.enemies[i].dead) boss = g.enemies[i];
    if (!boss) return;
    const bw = Math.min(520, cssW * 0.62);
    const bx = (cssW - bw) / 2, by = 52;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(bx - 3, by - 3, bw + 6, 16);
    const k = Math.max(0, boss.hp / boss.hpMax);
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, '#ffb04a');
    grad.addColorStop(1, '#d62a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, bw * k, 10);
    ctx.strokeStyle = 'rgba(255,214,118,0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 3, by - 3, bw + 6, 16);
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.fillStyle = '#ffe6a0';
    ctx.strokeText(boss.name, cssW / 2, by + 30);
    ctx.fillText(boss.name, cssW / 2, by + 30);
    ctx.restore();
  }

  function drawCombo(g) {
    if (!g.comboCount || g.comboCount < 2) return;
    const fade = clamp(g.comboT / 0.4, 0, 1);
    const pop = g.comboPop > 0 ? g.comboPop / 0.18 : 0;
    const scale = 1 + pop * 0.45;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(cssW * 0.5, cssH * 0.17);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.font = 'italic 900 52px system-ui';
    ctx.fillStyle = g.comboCount >= 10 ? '#ff7a4a' : '#ffd676';
    ctx.strokeText(g.comboCount, 0, 0);
    ctx.fillText(g.comboCount, 0, 0);
    ctx.font = 'italic 800 18px system-ui';
    ctx.fillStyle = '#fff2c0';
    ctx.strokeText('HIT COMBO', 0, 22);
    ctx.fillText('HIT COMBO', 0, 22);
    ctx.restore();
  }

  function render(g) {
    if (!g) return;

    // Screen shake (trauma²) + zoom-punch — applied to the world layer only,
    // leaving the UI steady. Zoom is ≥1 so it crops inward (no bare edges).
    const trauma = g.shake || 0;
    const zoom = g.zoom || 1;
    let ox = 0, oy = 0;
    if (trauma > 0.01) {
      const amp = trauma * trauma * 11;
      ox = (Math.random() * 2 - 1) * amp;
      oy = (Math.random() * 2 - 1) * amp;
    }
    ctx.save();
    if (zoom !== 1) {
      ctx.translate(cssW / 2, cssH / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-cssW / 2, -cssH / 2);
    }
    if (ox || oy) ctx.translate(ox, oy);

    drawBackground(g);

    // Gate architecture sits behind every character
    if (g.gate && !g.gate.broken) drawGate(g.gate, g.camX, g.time);

    drawGroundParticles(g);

    // Combine all on-floor drawables, sort by z asc (back to front)
    const list = g._drawList;
    list.length = 0;
    for (let i = 0; i < g.enemies.length; i++) list.push({ kind: 'e', z: g.enemies[i].z, ref: g.enemies[i] });
    for (let i = 0; i < g.items.length; i++) list.push({ kind: 'i', z: g.items[i].z, ref: g.items[i] });
    for (let i = 0; i < g.barrels.length; i++) {
      const b = g.barrels[i];
      if (!b.broken) list.push({ kind: 'b', z: b.z, ref: b });
    }
    if (g.cages) for (let i = 0; i < g.cages.length; i++) {
      if (!g.cages[i].broken) list.push({ kind: 'c', z: g.cages[i].z, ref: g.cages[i] });
    }
    if (g.ritual) list.push({ kind: 'r', z: g.ritual.z, ref: g.ritual });
    if (g.actors) for (let i = 0; i < g.actors.length; i++) list.push({ kind: 'a', z: g.actors[i].z, ref: g.actors[i] });
    list.push({ kind: 'h', z: g.hero.z, ref: g.hero });
    list.sort(_zAsc);

    const camX = g.camX;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.kind === 'e') drawEnemy(it.ref, camX);
      else if (it.kind === 'i') drawItem(it.ref, camX);
      else if (it.kind === 'b') drawBarrel(it.ref, camX);
      else if (it.kind === 'c') drawCage(it.ref, camX);
      else if (it.kind === 'r') drawRitual(it.ref, camX, g.time);
      else if (it.kind === 'a') drawActor(it.ref, camX);
      else if (it.kind === 'h') drawHero(g);
    }

    // Fog drifts in front of the fighters (mist theme)
    drawMist(g);

    // Projectiles + glowing particles + VFX on top
    for (let i = 0; i < g.projectiles.length; i++) drawProjectile(g.projectiles[i], camX);
    drawAirParticles(g);
    for (let i = 0; i < g.vfx.length; i++) drawVfx(g.vfx[i], camX);

    // Speech bubbles track their speakers in world space
    drawSpeech(g);

    ctx.restore();

    // ── UI overlays — NOT shaken ──
    drawCombo(g);
    drawBossBar(g);

    // Running K.O. tally
    if (g.kills > 0) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = 'italic 900 22px system-ui';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.fillStyle = '#ffd676';
      const kx = cssW - 20, ky = cssW < 700 ? 118 : 104;
      ctx.strokeText(`K.O. ${g.kills}`, kx, ky);
      ctx.fillText(`K.O. ${g.kills}`, kx, ky);
      ctx.restore();
    }

    // Wave dots
    if (g.stage && g.stage.waves) {
      const total = g.stage.waves.length;
      const cx = cssW / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const dotW = 12, gap = 6;
      const totalW = total * dotW + (total - 1) * gap + 24;
      ctx.fillRect(cx - totalW / 2, 18, totalW, 22);
      for (let i = 0; i < total; i++) {
        const dx = cx - totalW / 2 + 12 + i * (dotW + gap);
        ctx.fillStyle = i < g.waveIdx ? '#ffd676'
          : i === g.waveIdx && g.waveActive ? '#fff'
          : 'rgba(255,255,255,0.32)';
        ctx.beginPath(); ctx.arc(dx + dotW / 2, 29, dotW / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function dispose() { skyGrad = groundGrad = sunCanvas = mountainCanvas = groundTile = treeTile = null; }

  return { resize, render, dispose, floorYFromZ, getFloorBand: () => ({ top: Z_MIN, bot: Z_MAX }) };
}

function _zAsc(a, b) { return a.z - b.z; }
