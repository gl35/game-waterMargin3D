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
import { drawFighter, getBuild, attackKindFor, BASE_SCALE, FIGHTER_H } from './fighter.js';

export const Z_MIN = 0;
export const Z_MAX = 200;

const SHADOW_ALPHA = 0.34;

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let cssW = 0, cssH = 0;
  let dpr = 1;
  let skyGrad = null, groundGrad = null;
  let sunCanvas = null, mountainCanvas = null, mountainCanvasW = 0;
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
    skyGrad.addColorStop(0, '#1a1a2e');
    skyGrad.addColorStop(0.5, '#4a2540');
    skyGrad.addColorStop(1, '#8a3a20');

    // Ground gradient spans the WHOLE area below the mountains so there's
    // no uncovered band (the canvas is alpha:false → unpainted = black).
    groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, '#6a4830');
    groundGrad.addColorStop(0.35, '#5a3a25');
    groundGrad.addColorStop(0.7, '#3a2418');
    groundGrad.addColorStop(1, '#22150d');

    const sunR = 70;
    sunCanvas = offscreen(sunR * 2 + 8, sunR * 2 + 8);
    {
      const sc = sunCanvas.getContext('2d');
      const cx = sunCanvas.width / 2, cy = sunCanvas.height / 2;
      const grad = sc.createRadialGradient(cx, cy, 0, cx, cy, sunR);
      grad.addColorStop(0, 'rgba(255,200,140,0.95)');
      grad.addColorStop(0.6, 'rgba(255,160,90,0.30)');
      grad.addColorStop(1, 'rgba(255,160,90,0)');
      sc.fillStyle = grad;
      sc.beginPath(); sc.arc(cx, cy, sunR, 0, Math.PI * 2); sc.fill();
    }

    mountainCanvasW = Math.ceil(w * 2);
    mountainCanvas = offscreen(mountainCanvasW, horizonY + 30);
    {
      const mc = mountainCanvas.getContext('2d');
      const layers = [
        { color: '#3a2a3a', amp: 60,  y: horizonY - 10, freq: 0.004 },
        { color: '#2a1c30', amp: 100, y: horizonY,      freq: 0.003 },
        { color: '#1a121f', amp: 150, y: horizonY + 14, freq: 0.0025 },
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
    ctx.drawImage(sunCanvas, w * 0.72 - sunCanvas.width / 2, h * 0.18 - sunCanvas.height / 2);

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

  function drawShadow(sx, fy, w, squash = 1) {
    ctx.save();
    ctx.globalAlpha = SHADOW_ALPHA * (0.4 + 0.6 * clamp(squash, 0, 1));
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, fy + 3, w * 0.55 * squash, w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }


  // Draw an articulated fighter with a whole-body transform (lunge slide,
  // jump lift, lean, landing squash) layered over its limb animation.
  function drawFighterAt(build, footX, footY, st, opt) {
    const o = opt || {};
    ctx.save();
    ctx.translate(footX + (o.lungeX || 0), footY - (o.lift || 0));
    if (o.lean) ctx.rotate(o.lean);
    if (o.scaleX !== undefined || o.scaleY !== undefined) ctx.scale(o.scaleX || 1, o.scaleY || 1);
    const drew = drawFighter(ctx, build, { ...st, alpha: o.alpha });
    ctx.restore();
    return drew;
  }

  function drawHero(g) {
    const h = g.hero;
    const build = getBuild(h.id);
    const sx = h.x - g.camX;
    const fy = floorYFromZ(h.z);
    const t = g.time;
    const dir = h.facing >= 0 ? 1 : -1;
    const airborne = h.y < -0.5;

    // Pick the animation action + params from hero state.
    let action = 'idle', attackP = 0, attackKind = 'swing', phase = 0, jumpK = 0;
    let lungeX = 0, lift = -(h.y || 0), lean = 0, scaleX = 1, scaleY = 1, swing = 0;

    if (h.attacking > 0) {
      const mv = h.attackMove;
      if (mv) {
        action = 'attack';
        attackP = clamp(1 - h.attacking / mv.dur, 0, 1);
        attackKind = attackKindFor(mv, build ? build.weapon : 'sword');
        const fwd = Math.max(0, thrustEnv(attackP));
        lungeX += fwd * (mv.pierces ? 32 : mv.projectile ? 6 : 20) * dir;
        swing = mv.projectile ? 0 : fwd;
      } else {
        action = 'cast';
        attackP = clamp(1 - h.attacking / 0.45, 0, 1);
      }
    } else if (h.dashing > 0) {
      action = 'dash';
    } else if (airborne) {
      action = 'jump'; jumpK = h.vy < 0 ? 1 : -1;
    } else if (h.hitFlash > 0.24) {
      action = 'hurt';
    } else if (h.walking) {
      action = 'walk'; phase = h.walkPhase;
    }

    // Landing squash
    if (h.land > 0) { const k = h.land / 0.15; scaleY *= 1 - 0.26 * k; scaleX *= 1 + 0.24 * k; }

    const st = { action, t, phase, attackP, attackKind, jumpK, facing: dir };
    const footY = fy;
    drawShadow(sx, fy, 58, 1 - Math.min(0.6, lift / 220));

    if (!build) {
      ctx.fillStyle = h.color || '#ffc26b';
      ctx.fillRect(sx - 14, footY - lift - 80, 28, 64);
      return;
    }

    // Dash afterimages
    if (h.dashing > 0) {
      const ga = Math.min(1, h.dashing / 0.25);
      for (let i = 2; i >= 1; i--) drawFighterAt(build, sx - dir * i * 18, footY, st, { lift, alpha: 0.16 * ga });
    }
    // Swing trail — motion-blur ghosts during a melee strike
    if (swing > 0.3) {
      const ga = (swing - 0.3) / 0.7;
      for (let i = 2; i >= 1; i--) drawFighterAt(build, sx, footY, st, { lungeX: lungeX * (1 - i * 0.34), lift, alpha: 0.12 * ga });
    }

    drawFighterAt(build, sx, footY, st, { lungeX, lift, lean, scaleX, scaleY });

    if (h.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, h.hitFlash * 1.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ff6060';
      const fh = FIGHTER_H * BASE_SCALE;
      ctx.beginPath();
      ctx.ellipse(sx + lungeX, footY - lift - fh * 0.5, 26, fh * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEnemy(e, camX) {
    const sx = e.x - camX;
    if (sx < -200 || sx > cssW + 200) return;
    const build = getBuild(e.typeId);
    const dir = e.facing >= 0 ? 1 : -1;
    const charH = (build ? FIGHTER_H * (build.scale || 1) * BASE_SCALE : (e.height || 88));

    // ── Death tumble: knocked into the air, spinning, fading out ──
    if (e.dead) {
      const fade = clamp(e.deathFade || 0, 0, 1);
      const a = 1 - fade;
      if (a <= 0.02) return;
      const dfy = floorYFromZ(e.z);
      const dlift = e.deathY || 0;
      drawShadow(sx, dfy, e.width || 56, clamp(1 - dlift / 160 - fade * 0.5, 0, 1));
      if (build) {
        drawFighterAt(build, sx, dfy, { action: 'hurt', t: 0, facing: dir },
          { lift: dlift, lean: e.deathSpin || 0, alpha: a });
      }
      return;
    }

    const fy = floorYFromZ(e.z);
    let lean = 0, lungeX = 0;
    let lift = (e.y || 0);                     // e.y is POSITIVE while launched (up)
    let action = 'walk', attackP = 0;
    const attackKind = attackKindFor(null, build ? build.weapon : 'sword');

    if (e.launched > 0) {
      // Tumble through the air, spinning away from the knockback.
      const prog = clamp((0.8 - e.launched) / 0.8, 0, 1);
      const spinDir = (e.kbVx || dir) < 0 ? -1 : 1;
      lean += prog * Math.PI * 1.5 * spinDir;
      action = 'hurt';
    } else if (e.stun > 0) {
      const k = Math.min(1, e.stun / 0.2);
      lungeX += -dir * 5 * k + Math.sin(e.hitFlash * 120) * 3 * k;
      action = 'hurt';
    } else if (e.windup > 0) {                  // telegraph wind-up portion
      action = 'attack';
      attackP = (1 - clamp(e.windup / (e.windupMax || 0.3), 0, 1)) * 0.3;
    } else if (e.atkAnim > 0) {                 // strike + recover follow-through
      action = 'attack';
      attackP = 0.3 + (1 - clamp(e.atkAnim / 0.2, 0, 1)) * 0.7;
    }

    if (action === 'attack') {
      const fwd = Math.max(0, thrustEnv(attackP));
      lungeX += fwd * (e.projectileSpeed ? 6 : 20) * dir;
    }

    const st = { action, t: e.bobPhase, phase: e.bobPhase, attackP, attackKind, facing: dir };
    const footY = fy;
    drawShadow(sx, fy, (e.width || 56) * 0.85, 1 - Math.min(0.6, lift / 200));

    if (build) {
      drawFighterAt(build, sx, footY, st, { lungeX, lift, lean });
    } else {
      const w = e.width || 56, by = footY - lift;
      ctx.fillStyle = e.color || '#a55';
      ctx.fillRect(sx + lungeX - w / 2, by - charH, w, charH - 12);
    }

    const drawnFootY = footY - lift;
    if (e.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, e.hitFlash * 2.0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffe0c0';
      ctx.beginPath();
      ctx.ellipse(sx + lungeX, drawnFootY - charH * 0.5, 28, charH * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Attack telegraph — a warning ring that closes as the strike lands.
    if (e.windup > 0) {
      const wk = clamp(e.windup / (e.windupMax || 0.3), 0, 1);  // 1 → 0
      const cyW = drawnFootY - charH * 0.5;
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
      const by = drawnFootY - charH - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = e.boss ? '#c44' : '#d77';
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.hpMax), 4);
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
        ctx.fillStyle = fx.crit ? '#fff076' : fx.heal ? '#a0ff90' : '#ffd0d0';
        ctx.font = `bold ${fx.crit ? 28 : 20}px system-ui`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.78)';
        const text = fx.heal ? `+${fx.value}` : `${fx.value}`;
        ctx.strokeText(text, sx, fy - 30 - ddy);
        ctx.fillText(text, sx, fy - 30 - ddy);
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
    }
  }

  // Ground-hugging particles (dust, wood debris) — drawn behind characters.
  function drawGroundParticles(g) {
    const camX = g.camX;
    for (let i = 0; i < g.particles.length; i++) {
      const p = g.particles[i];
      if (p.kind === 'dust' || p.kind === 'debris') drawParticle(p, camX);
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
    list.push({ kind: 'h', z: g.hero.z, ref: g.hero });
    list.sort(_zAsc);

    const camX = g.camX;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.kind === 'e') drawEnemy(it.ref, camX);
      else if (it.kind === 'i') drawItem(it.ref, camX);
      else if (it.kind === 'b') drawBarrel(it.ref, camX);
      else if (it.kind === 'h') drawHero(g);
    }

    // Projectiles + glowing particles + VFX on top
    for (let i = 0; i < g.projectiles.length; i++) drawProjectile(g.projectiles[i], camX);
    drawAirParticles(g);
    for (let i = 0; i < g.vfx.length; i++) drawVfx(g.vfx[i], camX);

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
