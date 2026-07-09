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
import { drawSprite } from '../scene2d/sprites.js';
import { ELEMENTS } from './elements.js';

export const Z_MIN = 0;
export const Z_MAX = 200;

const SHADOW_ALPHA = 0.34;

// ── Per-chapter visual themes ──
// dusk  (ch1): sunset over the pass          night (ch2): moonlit siege,
// burning manor glow                          mist  (ch3): sorcerous fog
const THEMES = {
  dusk: {
    sky: ['#1a1a2e', '#4a2540', '#8a3a20'],
    ground: ['#6a4830', '#5a3a25', '#3a2418', '#22150d'],
    mts: ['#3a2a3a', '#2a1c30', '#1a121f'],
    orb: { x: 0.72, y: 0.18, r: 70, c1: 'rgba(255,200,140,0.95)', c2: 'rgba(255,160,90,0.30)' },
  },
  night: {
    sky: ['#04060e', '#0b1124', '#182140'],
    ground: ['#2b3143', '#222736', '#171b29', '#0d101b'],
    mts: ['#141a2c', '#0e1322', '#070b16'],
    orb: { x: 0.80, y: 0.14, r: 46, c1: 'rgba(230,238,255,0.95)', c2: 'rgba(180,200,255,0.22)' },
    burn: true,             // distant burning-manor glow on the horizon
  },
  mist: {
    sky: ['#120a20', '#291646', '#40295e'],
    ground: ['#3b2f47', '#2e2538', '#211a2b', '#141020'],
    mts: ['#241636', '#190f28', '#11091d'],
    orb: { x: 0.26, y: 0.16, r: 42, c1: 'rgba(200,255,215,0.75)', c2: 'rgba(140,220,170,0.16)' },
    mist: true,             // drifting fog bands over the floor
  },
  dream: {                  // 红楼梦 crossover — the Land of Illusion
    sky: ['#251b40', '#5a3f6e', '#b87e96'],
    ground: ['#5c4660', '#4a3850', '#362a40', '#221a2c'],
    mts: ['#68557f', '#52426a', '#3d3156'],
    orb: { x: 0.5, y: 0.13, r: 56, c1: 'rgba(255,244,252,0.95)', c2: 'rgba(240,200,225,0.28)' },
    mist: true,
    ghost: true,            // enemies are dream-phantoms: translucent + jade aura
  },
};

// Attack thrust envelope: p in [0,1] across the move's duration.
// Returns a signed thrust:  brief wind-BACK (negative) → snap FORWARD to
// +1 near p≈0.42 → ease back to 0. Drives lunge/lean for every melee pose.
function thrustEnv(p) {
  if (p < 0.16) return -0.35 * (p / 0.16);
  if (p < 0.42) return -0.35 + 1.35 * ((p - 0.16) / 0.26);
  return Math.max(0, 1 - (p - 0.42) / 0.58);
}
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

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
      gr.addColorStop(0, 'rgba(255,130,40,0.55)');
      gr.addColorStop(0.5, 'rgba(200,70,20,0.22)');
      gr.addColorStop(1, 'rgba(120,30,10,0)');
      bc.fillStyle = gr;
      bc.fillRect(0, 0, burnCanvas.width, burnCanvas.height);
    }

    mountainCanvasW = Math.ceil(w * 2);
    mountainCanvas = offscreen(mountainCanvasW, horizonY + 30);
    {
      const mc = mountainCanvas.getContext('2d');
      const layers = [
        { color: theme.mts[0], amp: 60,  y: horizonY - 10, freq: 0.004 },
        { color: theme.mts[1], amp: 100, y: horizonY,      freq: 0.003 },
        { color: theme.mts[2], amp: 150, y: horizonY + 14, freq: 0.0025 },
      ];
      for (const L of layers) {
        mc.fillStyle = L.color;
        mc.beginPath();
        mc.moveTo(0, mountainCanvas.height);
        for (let x = 0; x <= mountainCanvasW; x += 6) {
          const y = L.y - (Math.sin(x * L.freq) * 0.6 + Math.sin(x * L.freq * 2.3) * 0.4) * L.amp;
          mc.lineTo(x, y);
        }
        mc.lineTo(mountainCanvasW, mountainCanvas.height);
        mc.closePath();
        mc.fill();
      }
    }
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
    grad.addColorStop(0, 'rgba(190,170,230,0.11)');
    grad.addColorStop(0.7, 'rgba(190,170,230,0.05)');
    grad.addColorStop(1, 'rgba(190,170,230,0)');
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
  //   lean    rotation about the feet (rad)
  //   scaleX/scaleY  squash & stretch about the feet
  function drawPosed(name, footX, footY, p) {
    ctx.save();
    ctx.translate(footX + (p.lungeX || 0), footY - (p.lift || 0));
    if (p.lean) ctx.rotate(p.lean);
    const sxk = p.scaleX || 1, syk = p.scaleY || 1;
    if (sxk !== 1 || syk !== 1) ctx.scale(sxk, syk);
    const drew = drawSprite(ctx, name, 0, 0, {
      flip: !!p.flip, anchorY: 'bottom', scale: p.scale || 1,
      alpha: p.alpha == null ? 1 : p.alpha,
    });
    ctx.restore();
    return drew;
  }

  function drawHero(g) {
    const h = g.hero;
    const sx = h.x - g.camX;
    const fy = floorYFromZ(h.z);
    const t = g.time;
    const dir = h.facing >= 0 ? 1 : -1;
    const flip = h.facing < 0;

    const walking = h.walking && h.y >= -0.5;
    const bob = walking ? Math.abs(Math.sin(h.walkPhase * Math.PI)) * 8 : Math.sin(t * 2.2) * 1.5;

    // Pose accumulators — every state layers a whole-body transform onto these.
    let lean = 0, lungeX = 0, scaleX = 1, scaleY = 1, lift = 0, swing = 0;

    // Airborne lift (h.y is NEGATIVE while airborne → raise up the screen).
    const airborne = h.y < -0.5;
    lift += -(h.y || 0);

    if (!airborne && h.attacking <= 0 && h.dashing <= 0) {
      if (walking) {
        lungeX += Math.sin(h.walkPhase) * 3;
        lean += 0.05 * dir;
        scaleY *= 1 + Math.sin(h.walkPhase * 2) * 0.03;
      } else {
        scaleY *= 1 + Math.sin(t * 2.2) * 0.02;
      }
    }

    if (h.land > 0) {
      const k = h.land / 0.15;
      scaleY *= 1 - 0.30 * k; scaleX *= 1 + 0.28 * k;
    } else if (airborne) {
      const s = Math.min(0.26, Math.abs(h.vy) / 1500);
      scaleY *= 1 + s; scaleX *= 1 - s * 0.7;
    }

    if (h.dashing > 0) { lean += 0.26 * dir; scaleX *= 1.12; scaleY *= 0.95; }

    if (h.attacking > 0) {
      const mv = h.attackMove;
      if (mv) {
        const p = clamp(1 - h.attacking / mv.dur, 0, 1);
        const thr = thrustEnv(p);
        const fwd = Math.max(0, thr);
        if (mv.aoe || mv.downward) {
          lean += thr * 0.30 * dir; lift += -thr * 14; lungeX += fwd * 20 * dir;
          scaleY *= 1 - fwd * 0.08; scaleX *= 1 + fwd * 0.10; swing = fwd;
        } else if (mv.projectile) {
          lungeX += thr * 10 * dir; lean += thr * 0.07 * dir; scaleX *= 1 + fwd * 0.03;
        } else if (mv.launches) {
          lift += fwd * 22; lean += -thr * 0.12 * dir; scaleY *= 1 + fwd * 0.12; swing = fwd * 0.7;
        } else if (mv.pierces) {
          lungeX += thr * Math.min(54, (mv.xRange || 120) * 0.32) * dir;
          lean += thr * 0.10 * dir; scaleX *= 1 + fwd * 0.06; swing = fwd;
        } else if (mv.hits > 1) {
          const buzz = Math.sin(p * Math.PI * mv.hits * 2) * 8 * fwd;
          lungeX += (thr * 16 + buzz) * dir; lean += thr * 0.08 * dir; swing = fwd;
        } else {
          lungeX += thr * Math.min(40, (mv.xRange || 90) * 0.4) * dir;
          lean += thr * 0.18 * dir; scaleY *= 1 + fwd * 0.06; swing = fwd;
        }
      } else {
        const p = clamp(1 - h.attacking / 0.45, 0, 1);
        const e = thrustEnv(p);
        lift += Math.max(0, -e) * 12 + Math.max(0, e) * 4;
        lean += e * 0.10 * dir;
        scaleY *= 1 + Math.max(0, e) * 0.10; scaleX *= 1 + Math.max(0, -e) * 0.05;
      }
    }

    if (h.hitFlash > 0 && h.attacking <= 0) {
      const k = Math.min(1, h.hitFlash / 0.4);
      lean += -0.14 * dir * k;
      lungeX += Math.sin(t * 70) * 3 * k;
    }

    const footY = fy - bob;
    drawShadow(sx, fy, 56, 1 - Math.min(0.6, lift / 220));

    if (h.dashing > 0) {                          // dash afterimages
      const ga = Math.min(1, h.dashing / 0.25);
      for (let i = 2; i >= 1; i--) {
        drawPosed(h.sprite || 'hero/idle', sx - dir * i * 18, footY, { flip, lean, scaleX, scaleY, lift, lungeX, alpha: 0.16 * ga });
      }
    }
    if (swing > 0.25) {                           // swing motion-blur trail
      const ga = (swing - 0.25) / 0.75;
      for (let i = 2; i >= 1; i--) {
        drawPosed(h.sprite || 'hero/idle', sx, footY, { flip, lean: lean * (1 - i * 0.22), scaleX, scaleY, lift, lungeX: lungeX * (1 - i * 0.34), alpha: 0.13 * ga });
      }
    }

    const drew = drawPosed(h.sprite || 'hero/idle', sx, footY, { flip, lean, scaleX, scaleY, lift, lungeX });
    if (!drew) {
      const bx = sx + lungeX, by = footY - lift;
      ctx.fillStyle = h.color || '#ffc26b';
      ctx.fillRect(bx - 14, by - 80, 28, 64);
      ctx.beginPath(); ctx.arc(bx, by - 88, 12, 0, Math.PI * 2); ctx.fill();
    }

    if (h.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, h.hitFlash * 2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ff6060';
      ctx.fillRect(sx + lungeX - 28, footY - lift - 100, 56, 100);
      ctx.restore();
    }
  }

  function drawEnemy(e, camX) {
    const sx = e.x - camX;
    if (sx < -200 || sx > cssW + 200) return;
    const dir = e.facing >= 0 ? 1 : -1;
    const scale = e.boss ? 1.25 : 1.0;
    const charH = e.height || 88;

    // ── Death tumble: knocked into the air, spinning, fading out ──
    if (e.dead) {
      const fade = clamp(e.deathFade || 0, 0, 1);
      const a = 1 - fade;
      if (a <= 0.02) return;
      const dfy = floorYFromZ(e.z);
      const dlift = e.deathY || 0;
      drawShadow(sx, dfy, e.width || 56, clamp(1 - dlift / 160 - fade * 0.5, 0, 1));
      drawPosed(e.sprite, sx, dfy, {
        flip: e.facing >= 0, lean: e.deathSpin || 0, lift: dlift,
        scale: scale * (1 - fade * 0.3), alpha: a,
      });
      return;
    }

    const fy = floorYFromZ(e.z);
    const flip = e.facing >= 0;
    const bob = Math.sin(e.bobPhase) * 2;
    let lean = 0, lungeX = 0, scaleX = 1, scaleY = 1;
    let lift = (e.y || 0);                     // e.y is POSITIVE while launched (up)

    if (e.launched > 0) {
      const prog = clamp((0.8 - e.launched) / 0.8, 0, 1);
      const spinDir = (e.kbVx || dir) < 0 ? -1 : 1;
      lean += prog * Math.PI * 1.5 * spinDir;
    } else if (e.stun > 0) {
      const k = Math.min(1, e.stun / 0.2);
      lean += -0.12 * dir * k;
      lungeX += -dir * 5 * k + Math.sin(e.hitFlash * 120) * 3 * k;
    } else {
      lean += 0.04 * dir;
      lungeX += Math.sin(e.bobPhase) * 1.5;
    }

    // Attack lunge (windup + strike follow-through both drive atkAnim)
    if (e.atkAnim > 0) {
      const p = clamp(1 - e.atkAnim / 0.4, 0, 1);
      const thr = thrustEnv(p);
      if (e.projectileSpeed) {
        lungeX += thr * 9 * dir;
        lean += -Math.max(0, -thr) * 0.10 * dir + Math.max(0, thr) * 0.05 * dir;
      } else {
        lungeX += thr * 22 * dir;
        lean += thr * 0.16 * dir;
        scaleX *= 1 + Math.max(0, thr) * 0.05;
      }
    }

    if (e.hitFlash > 0 && e.stun <= 0 && e.launched <= 0) {
      const k = Math.min(1, e.hitFlash / 0.35);
      scaleX *= 1 + 0.06 * k; scaleY *= 1 - 0.04 * k;
    }

    const footY = fy - bob;
    drawShadow(sx, fy, e.width || 56, 1 - Math.min(0.6, lift / 200));

    // Dream theme: enemies are phantoms — jade aura + slight translucency
    if (theme.ghost) {
      ensureGhostGlow();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(ghostGlow, sx + lungeX - 60, footY - lift - charH * scale + 8,
        120, charH * scale + 16);
      ctx.restore();
    }

    const drew = drawPosed(e.sprite, sx, footY, {
      flip, lean, lungeX, scaleX, scaleY, lift, scale,
      alpha: theme.ghost ? 0.88 : 1,
    });
    if (!drew) {
      const w = e.width || 56, hh = charH;
      const bx = sx + lungeX, by = footY - lift;
      ctx.fillStyle = e.color || '#a55';
      ctx.fillRect(bx - w / 2, by - hh, w, hh - 12);
      ctx.beginPath(); ctx.arc(bx, by - hh - 4, w * 0.3, 0, Math.PI * 2); ctx.fill();
    }

    const drawnFootY = footY - lift;
    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, e.hitFlash * 2.2);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffe0c0';
      ctx.fillRect(sx + lungeX - 36, drawnFootY - charH - 4, 72, charH + 8);
      ctx.restore();
    }

    // Attack telegraph — a warning ring that closes as the strike lands.
    if (e.windup > 0) {
      const wk = clamp(e.windup / (e.windupMax || 0.3), 0, 1);  // 1 → 0
      const cyW = drawnFootY - charH * scale * 0.5;
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
        ctx.beginPath();
        ctx.arc(cxW, cyW, 13, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (e.boss || e.hp < e.hpMax) {
      const bw = e.boss ? 110 : 50;
      const bx = sx - bw / 2;
      const by = drawnFootY - charH * scale - 14;
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
      ctx.fillStyle = p.enemy ? '#a44' : '#caffaa';
      ctx.fillRect(-12, -2, 24, 4);
      ctx.fillStyle = p.enemy ? '#622' : '#5a8a3a';
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(4, -5); ctx.lineTo(4, 5);
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
        ctx.translate(sx + (fx.dir > 0 ? 40 : -40), fy);
        ctx.scale(fx.dir, 1);
        const r = fx.range || 90;
        ctx.strokeStyle = fx.color || '#ffe080';
        ctx.lineWidth = 10 * (1 - fx.t / fx.dur) + 4;
        ctx.lineCap = 'round';
        const tt = fx.t / fx.dur;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2 - 0.5 + tt * 0.6, Math.PI / 2 + 0.5 + tt * 0.6);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2 - 0.5 + tt * 0.6, Math.PI / 2 + 0.5 + tt * 0.6);
        ctx.stroke();
        break;
      }
      case 'aoe': {
        const r = (fx.range || 200) * Math.min(1, fx.t / (fx.dur * 0.4));
        ctx.strokeStyle = fx.color || '#ffd07a';
        ctx.lineWidth = 6 * (1 - fx.t / fx.dur);
        ctx.beginPath();
        ctx.arc(sx, fy + 12, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'beam': {
        ctx.strokeStyle = fx.color || '#c2ddff';
        ctx.lineWidth = (fx.width || 40) * (1 - 0.5 * (fx.t / fx.dur));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, fy); ctx.lineTo(sx + fx.dir * (fx.range || 600), fy);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx, fy); ctx.lineTo(sx + fx.dir * (fx.range || 600), fy);
        ctx.stroke();
        break;
      }
      case 'spin': {
        const r = fx.range || 130;
        ctx.strokeStyle = fx.color || '#ff9cd6';
        ctx.lineWidth = 5;
        for (let k = 0; k < 6; k++) {
          const ang = (fx.t / fx.dur) * Math.PI * 2 * 2 + k * (Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(sx, fy);
          ctx.lineTo(sx + Math.cos(ang) * r, fy + Math.sin(ang) * r * 0.45);
          ctx.stroke();
        }
        break;
      }
      case 'rain': {
        const seedRoot = fx.seed | 0;
        ctx.fillStyle = fx.color || '#9cffb5';
        const N = 18;
        for (let i = 0; i < N; i++) {
          const seed = (seedRoot + i * 31) | 0;
          const offX = ((seed * 37) % (fx.width || 360)) - (fx.width || 360) / 2;
          const fall = ((fx.t * 1200) + (seed * 17) % 240) % 240;
          ctx.fillRect(sx + offX, fy - 240 + fall, 3, 14);
        }
        break;
      }
      case 'pop': {
        const r = 14 * (1 - fx.t / fx.dur) + 4;
        ctx.fillStyle = fx.color || '#fff';
        ctx.beginPath();
        ctx.arc(sx, fy, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'damageNumber': {
        const ddy = fx.t * 60;
        if (fx.text) {                       // spirit-capture / status float
          ctx.fillStyle = fx.effColor || '#e8d8ff';
          ctx.font = 'bold 15px system-ui';
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(0,0,0,0.78)';
          ctx.strokeText(fx.text, sx, fy - 30 - ddy);
          ctx.fillText(fx.text, sx, fy - 30 - ddy);
          break;
        }
        // element effectiveness tints the number: green = overcoming (相剋),
        // grey = resisted
        ctx.fillStyle = fx.crit ? '#fff076' : fx.heal ? '#a0ff90'
          : fx.eff === 'strong' ? '#b8ffb0' : fx.eff === 'weak' ? '#bfbfbf' : '#ffd0d0';
        ctx.font = `bold ${fx.crit ? 28 : fx.eff === 'strong' ? 23 : 20}px system-ui`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.78)';
        const text = fx.heal ? `+${fx.value}` : `${fx.value}`;
        ctx.strokeText(text, sx, fy - 30 - ddy);
        ctx.fillText(text, sx, fy - 30 - ddy);
        break;
      }
      case 'bolt': {
        // Five-Thunder strike — jagged lightning from the sky to the target.
        const seed = fx.seed | 0;
        const segs = 7;
        ctx.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? '#ffffff' : 'rgba(170,190,255,0.85)';
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
      case 'banner': {
        ctx.globalAlpha = a * 0.95;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = `bold ${fx.size || 38}px system-ui`;
        ctx.textAlign = 'center';
        const m = ctx.measureText(fx.text || '');
        const pad = 24;
        const bw = m.width + pad * 2;
        const bh = (fx.size || 38) + pad;
        ctx.fillRect(sx - bw / 2, fy - bh / 2, bw, bh);
        ctx.fillStyle = '#fff8c4';
        ctx.fillText(fx.text || '', sx, fy + (fx.size || 38) * 0.32);
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
        ctx.globalAlpha = lifeK;
        ctx.strokeStyle = p.color;
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
        ctx.globalAlpha = lifeK * 0.8;
        ctx.fillStyle = p.color;
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
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < g.particles.length; i++) {
      const p = g.particles[i];
      if (p.kind === 'spark' || p.kind === 'ember') drawParticle(p, camX);
    }
    ctx.globalCompositeOperation = 'source-over';
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
      flip: a.vx < 0, lift: a.y || 0,
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

  function dispose() { skyGrad = groundGrad = sunCanvas = mountainCanvas = null; }

  return { resize, render, dispose, floorYFromZ, getFloorBand: () => ({ top: Z_MIN, bot: Z_MAX }) };
}

function _zAsc(a, b) { return a.z - b.z; }
