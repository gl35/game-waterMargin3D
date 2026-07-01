import { useEffect, useRef, useState } from 'react';
import './VictoryBanquet.css';

// ── 2D Banquet hall renderer ───────────────────────────────────
function drawBanquetHall(ctx, w, h, t) {
  // Warm wooden hall background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#3a1808');
  bg.addColorStop(0.5, '#5a2810');
  bg.addColorStop(1, '#2a0e04');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Camera sway: slow horizontal pan
  const camX = Math.sin(t * 0.12) * 30;

  // Back wall
  const wallY = h * 0.18, wallH = h * 0.45;
  ctx.fillStyle = '#7a3a18';
  ctx.fillRect(0, wallY, w, wallH);
  // Wood grain
  ctx.fillStyle = '#5a2a10';
  for (let i = 0; i < 14; i++) {
    ctx.fillRect((i / 14) * w + camX * 0.5, wallY, 3, wallH);
  }

  // Ceiling beams
  ctx.fillStyle = '#3a1808';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(0, h * 0.10 + i * 16, w, 6);
  }

  // Wall banners
  const bannerColors = ['#cc1818', '#1840a0', '#cc1818', '#1840a0', '#cc1818'];
  for (let i = 0; i < 5; i++) {
    const bx = (i / 5) * w + w * 0.1 + camX * 0.3;
    ctx.fillStyle = bannerColors[i];
    ctx.fillRect(bx, wallY + 30, 50, 110);
    // Banner trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(bx, wallY + 138, 50, 4);
  }

  // Hanging red lanterns
  const lanterns = [];
  for (let i = 0; i < 10; i++) {
    const lx = (i / 10) * w + w * 0.05 + camX * 0.7;
    const ly = h * (0.20 + (i % 3) * 0.05);
    lanterns.push({ x: lx, y: ly, i });
  }
  for (const l of lanterns) {
    // String
    ctx.strokeStyle = '#1a0a04';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(l.x, 0);
    ctx.lineTo(l.x, l.y - 18);
    ctx.stroke();
    // Lantern body
    const flick = 1 + Math.sin(t * 2 + l.i * 0.5) * 0.06;
    ctx.fillStyle = '#cc1818';
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, 14 * flick, 18 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner glow
    ctx.fillStyle = '#ff8040';
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tassel
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y + 16);
    ctx.lineTo(l.x, l.y + 24);
    ctx.stroke();
    // Glow halo
    const lg = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 60);
    lg.addColorStop(0, `rgba(255, 128, 48, ${0.35 * flick})`);
    lg.addColorStop(1, 'rgba(255, 128, 48, 0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(l.x, l.y, 60, 0, Math.PI * 2); ctx.fill();
  }

  // Floor
  ctx.fillStyle = '#7a4e28';
  ctx.fillRect(0, h * 0.63, w, h * 0.37);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#6a3e20' : '#7a4e28';
    ctx.fillRect((i / 12) * w + camX * 0.3, h * 0.63, w / 12 - 1, h * 0.37);
  }

  // Long banquet tables (two rows)
  for (let r = 0; r < 2; r++) {
    const ty = h * (0.74 + r * 0.10);
    const th = 22;
    ctx.fillStyle = '#6a3a18';
    ctx.fillRect(w * 0.08, ty, w * 0.84, th);
    ctx.fillStyle = '#4a2810';
    ctx.fillRect(w * 0.08, ty + th - 4, w * 0.84, 4);
    // Dishes + cups
    for (let d = 0; d < 9; d++) {
      const dx = w * 0.10 + (d / 8) * w * 0.80;
      // Plate
      ctx.fillStyle = '#e8d8c0';
      ctx.beginPath();
      ctx.ellipse(dx, ty + 6, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Food
      ctx.fillStyle = ['#ff4040', '#40cc40', '#e8d050', '#ff8020'][d % 4];
      ctx.beginPath();
      ctx.arc(dx, ty + 4, 4, 0, Math.PI * 2);
      ctx.fill();
      // Cup
      ctx.fillStyle = '#c8a060';
      ctx.fillRect(dx + 14, ty + 2, 5, 8);
    }
  }

  // Song Jiang at center back, raising cup
  const sjx = w / 2, sjy = h * 0.70;
  drawBanquetSongJiang(ctx, sjx, sjy, t);

  // Dancing women in foreground
  const dancers = [
    { x: w * 0.18, y: h * 0.92, color: '#e83060', phase: 0,    speed: 1.1 },
    { x: w * 0.32, y: h * 0.94, color: '#e04090', phase: 1.2,  speed: 0.9 },
    { x: w * 0.50, y: h * 0.96, color: '#cc2080', phase: 2.4,  speed: 1.2 },
    { x: w * 0.68, y: h * 0.94, color: '#d03888', phase: 0.8,  speed: 1.0 },
    { x: w * 0.82, y: h * 0.92, color: '#e85080', phase: 1.8,  speed: 1.15 },
  ];
  for (const d of dancers) drawDancer(ctx, d.x, d.y, d.color, t * d.speed + d.phase);

  // Confetti raining
  drawConfetti(ctx, w, h, t);

  // Warm overhead light
  const overall = ctx.createRadialGradient(w / 2, 0, h * 0.2, w / 2, 0, h);
  overall.addColorStop(0, 'rgba(255, 200, 130, 0.25)');
  overall.addColorStop(1, 'rgba(255, 130, 60, 0)');
  ctx.fillStyle = overall;
  ctx.fillRect(0, 0, w, h);
}

function drawBanquetSongJiang(ctx, x, y, t) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Robe body
  ctx.fillStyle = '#7f1f26';
  ctx.beginPath();
  ctx.moveTo(x - 22, y);
  ctx.lineTo(x - 16, y - 70);
  ctx.lineTo(x + 16, y - 70);
  ctx.lineTo(x + 22, y);
  ctx.closePath();
  ctx.fill();
  // Gold sash + emblem
  ctx.fillStyle = '#d9b36b';
  ctx.fillRect(x - 22, y - 30, 44, 4);
  ctx.beginPath();
  ctx.arc(x, y - 50, 6, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#d8a870';
  ctx.beginPath();
  ctx.arc(x, y - 82, 14, 0, Math.PI * 2);
  ctx.fill();
  // Hat
  ctx.fillStyle = '#101010';
  ctx.fillRect(x - 16, y - 96, 32, 5);
  ctx.fillRect(x - 12, y - 104, 24, 8);
  // Raised arm with cup
  ctx.fillStyle = '#7f1f26';
  ctx.save();
  ctx.translate(x + 16, y - 60);
  ctx.rotate(-0.7);
  ctx.fillRect(-5, -36, 10, 36);
  ctx.restore();
  // Cup
  const cx = x + 30 + Math.sin(t * 1.2) * 2;
  const cy = y - 92;
  ctx.fillStyle = '#c8a060';
  ctx.fillRect(cx - 5, cy, 10, 8);
  ctx.fillStyle = '#e8c870';
  ctx.fillRect(cx - 4, cy + 1, 8, 2);
  // Cup glow
  const cg = ctx.createRadialGradient(cx, cy + 4, 0, cx, cy + 4, 30);
  cg.addColorStop(0, `rgba(255, 220, 120, ${0.4 + Math.sin(t * 2) * 0.1})`);
  cg.addColorStop(1, 'rgba(255, 180, 80, 0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(cx, cy + 4, 30, 0, Math.PI * 2); ctx.fill();
}

function drawDancer(ctx, x, y, color, t) {
  const sway = Math.sin(t * 0.5) * 8;
  const bounce = Math.abs(Math.sin(t * 1.8)) * 8;
  x += sway;
  y -= bounce;
  // Skirt (flowing)
  const skirtSway = Math.sin(t * 1.6) * 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 22, y);
  ctx.bezierCurveTo(x - 18 + skirtSway, y - 30, x - 12, y - 50, x - 8, y - 60);
  ctx.lineTo(x + 8, y - 60);
  ctx.bezierCurveTo(x + 12, y - 50, x + 18 - skirtSway, y - 30, x + 22, y);
  ctx.closePath();
  ctx.fill();
  // Sash
  ctx.fillStyle = '#d4a030';
  ctx.fillRect(x - 12, y - 60, 24, 3);
  // Torso
  ctx.fillStyle = color;
  ctx.fillRect(x - 8, y - 80, 16, 22);
  // Arms outstretched
  const armWave = Math.sin(t * 2.1) * 12;
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(x - 8, y - 76);
  ctx.rotate(-0.6 + Math.sin(t * 2.1) * 0.5);
  ctx.fillRect(-3, 0, 6, 28);
  // Trailing silk sleeve
  ctx.fillStyle = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.5)`;
  ctx.beginPath();
  ctx.moveTo(-8, 4);
  ctx.lineTo(-22 + armWave, 36);
  ctx.lineTo(-12, 36);
  ctx.lineTo(0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(x + 8, y - 76);
  ctx.rotate(0.6 - Math.sin(t * 2.1 + 1) * 0.5);
  ctx.fillRect(-3, 0, 6, 28);
  ctx.restore();
  // Head
  ctx.fillStyle = '#f2c8a0';
  ctx.beginPath();
  ctx.arc(x, y - 88, 9, 0, Math.PI * 2);
  ctx.fill();
  // Hair updo
  ctx.fillStyle = '#1a1020';
  ctx.beginPath();
  ctx.arc(x, y - 96, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 4, y - 106, 8, 8);
  // Hairpin jewel
  ctx.fillStyle = '#ff4488';
  ctx.beginPath();
  ctx.arc(x + 10, y - 100, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawConfetti(ctx, w, h, t) {
  const COUNT = 80;
  const colors = ['#ff3030', '#ffd820', '#30cc40', '#3080ff', '#e040e0', '#ff8030'];
  for (let i = 0; i < COUNT; i++) {
    const seed = i * 7919;
    const baseX = ((seed * 13) % 1000) / 1000 * w;
    const fallSpeed = 50 + ((seed * 17) % 100);
    const baseY = ((t * fallSpeed + (seed % 800)) % (h + 100)) - 30;
    const sway = Math.sin(t * 2 + i) * 14;
    const x = baseX + sway;
    const rot = t * 3 + i;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.rotate(rot);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-5, -2, 10, 4);
    ctx.restore();
  }
}

// ── Magistrate court (chapter 2 victory) ─────────────────────────
function drawMagistrateCourt(ctx, w, h, t) {
  // Night sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  sky.addColorStop(0, '#0a0a18');
  sky.addColorStop(1, '#3a1810');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.5);

  // Stars
  for (let i = 0; i < 60; i++) {
    const sx = (i * 91) % w;
    const sy = (i * 47) % (h * 0.4);
    const twinkle = 0.4 + Math.sin(t * 2 + i) * 0.3;
    ctx.fillStyle = `rgba(255, 240, 200, ${twinkle})`;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }

  // Distant fire glow on horizon
  const horizGrad = ctx.createLinearGradient(0, h * 0.35, 0, h * 0.55);
  horizGrad.addColorStop(0, 'rgba(120, 30, 10, 0)');
  horizGrad.addColorStop(1, 'rgba(255, 80, 30, 0.4)');
  ctx.fillStyle = horizGrad;
  ctx.fillRect(0, h * 0.35, w, h * 0.20);

  // Fortress gate at back
  const gx = w * 0.30, gw = w * 0.40, gy = h * 0.30, gh = h * 0.30;
  ctx.fillStyle = '#5a2a18';
  ctx.fillRect(gx, gy, gw, gh);
  // Roof
  ctx.fillStyle = '#3a1a10';
  ctx.beginPath();
  ctx.moveTo(gx - 20, gy);
  ctx.lineTo(gx + gw / 2, gy - 40);
  ctx.lineTo(gx + gw + 20, gy);
  ctx.closePath();
  ctx.fill();
  // Gate door
  ctx.fillStyle = '#241208';
  ctx.fillRect(gx + gw / 2 - 50, gy + gh - 80, 100, 80);
  // Banners hanging
  ctx.fillStyle = '#c01818';
  ctx.fillRect(gx + 30, gy + 8, 14, 70);
  ctx.fillStyle = '#aa6b18';
  ctx.fillRect(gx + gw - 44, gy + 8, 14, 70);
  ctx.fillStyle = '#c01818';
  ctx.fillRect(gx + gw / 2 - 7, gy + 8, 14, 70);

  // Stone plaza
  const plazaY = h * 0.60;
  ctx.fillStyle = '#4a3c32';
  ctx.fillRect(0, plazaY, w, h * 0.40);
  // Steps
  ctx.fillStyle = '#3c2e28';
  ctx.fillRect(w * 0.20, plazaY, w * 0.60, 8);
  ctx.fillRect(w * 0.18, plazaY + 8, w * 0.64, 8);
  ctx.fillRect(w * 0.16, plazaY + 16, w * 0.68, 8);

  // Hero on horse — rotating slowly around center
  const heroAng = t * 0.12;
  const camX = Math.cos(heroAng) * 30;
  const hx = w / 2 + camX, hy = h * 0.78;
  drawHorseHero(ctx, hx, hy, t);

  // Captured magistrate cage in foreground
  drawMagistrateCage(ctx, w * 0.50, h * 0.92);

  // Torches lining plaza
  const torchPositions = [w * 0.18, w * 0.82, w * 0.30, w * 0.70, w * 0.10, w * 0.90];
  for (let i = 0; i < torchPositions.length; i++) {
    drawTorch(ctx, torchPositions[i], h * 0.65 + (i % 2) * 16, t, i);
  }

  // Crowd of cheering villagers (left and right)
  for (let i = 0; i < 4; i++) {
    drawCheeringFigure(ctx, w * 0.10 + i * 30, h * 0.86, '#a0262b', t, i);
    drawCheeringFigure(ctx, w * 0.78 + i * 30, h * 0.86, '#2b4670', t, i + 4, i === 1);
  }

  // Embers
  for (let i = 0; i < 70; i++) {
    const seed = i * 991;
    const ex = ((seed * 13) % 1000) / 1000 * w;
    const ey = h - ((t * 60 + (seed % 600)) % (h * 0.8));
    const flick = 0.5 + Math.sin(t * 4 + i) * 0.5;
    ctx.fillStyle = `rgba(255, ${100 + flick * 80}, 30, ${flick * 0.7})`;
    ctx.fillRect(ex, ey, 2, 2);
  }
}

function drawHorseHero(ctx, x, y, t) {
  // Horse shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 38, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Horse body
  ctx.fillStyle = '#3c1e0f';
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 38, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Horse neck + head
  ctx.fillStyle = '#3c1e0f';
  ctx.save();
  ctx.translate(x + 28, y - 12);
  ctx.rotate(-0.3);
  ctx.fillRect(-6, -28, 12, 28);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x + 44, y - 26, 9, 0, Math.PI * 2);
  ctx.fill();
  // Mane
  ctx.fillStyle = '#1a0e05';
  ctx.fillRect(x + 22, y - 30, 8, 10);
  // Hero on horse
  const hx = x - 8, hy = y - 30;
  ctx.fillStyle = '#7f1f26';
  ctx.fillRect(hx - 12, hy - 36, 24, 36);
  // Head
  ctx.fillStyle = '#d8a870';
  ctx.beginPath();
  ctx.arc(hx, hy - 46, 10, 0, Math.PI * 2);
  ctx.fill();
  // Hat / topknot
  ctx.fillStyle = '#101010';
  ctx.fillRect(hx - 8, hy - 60, 16, 6);
  // Spear raised
  ctx.strokeStyle = '#d9b36b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hx - 8, hy - 16);
  ctx.lineTo(hx - 50, hy - 86);
  ctx.stroke();
  ctx.fillStyle = '#f5d64c';
  ctx.beginPath();
  ctx.moveTo(hx - 50, hy - 92);
  ctx.lineTo(hx - 56, hy - 80);
  ctx.lineTo(hx - 44, hy - 78);
  ctx.closePath();
  ctx.fill();
  // Spear glow
  const sg = ctx.createRadialGradient(hx - 50, hy - 86, 0, hx - 50, hy - 86, 30);
  sg.addColorStop(0, `rgba(255, 230, 120, ${0.5 + Math.sin(t * 3) * 0.15})`);
  sg.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(hx - 50, hy - 86, 30, 0, Math.PI * 2); ctx.fill();
}

function drawMagistrateCage(ctx, x, y) {
  // Cage box
  ctx.fillStyle = '#20100a';
  ctx.fillRect(x - 60, y - 50, 120, 50);
  // Bars
  ctx.fillStyle = '#463224';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(x - 60 + i * 24, y - 70, 4, 70);
  }
  ctx.fillRect(x - 60, y - 70, 120, 4);
  // Prisoner silhouette inside
  ctx.fillStyle = '#362012';
  ctx.beginPath();
  ctx.ellipse(x, y - 24, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a2a1a';
  ctx.beginPath();
  ctx.arc(x, y - 50, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawTorch(ctx, x, y, t, seed) {
  // Pole
  ctx.fillStyle = '#301408';
  ctx.fillRect(x - 3, y, 6, 26);
  // Flame
  const flick = 1 + Math.sin(t * 12 + seed) * 0.15;
  const fh = 24 * flick;
  ctx.fillStyle = '#ff7a30';
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.quadraticCurveTo(x, y - fh * 1.5, x + 8, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd870';
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.quadraticCurveTo(x, y - fh * 0.9, x + 4, y);
  ctx.closePath();
  ctx.fill();
  // Glow
  const tg = ctx.createRadialGradient(x, y - 8, 0, x, y - 8, 50);
  tg.addColorStop(0, `rgba(255, 130, 40, ${0.5 * flick})`);
  tg.addColorStop(1, 'rgba(255, 130, 40, 0)');
  ctx.fillStyle = tg;
  ctx.beginPath(); ctx.arc(x, y - 8, 50, 0, Math.PI * 2); ctx.fill();
}

function drawCheeringFigure(ctx, x, y, color, t, seed, hasFlag = false) {
  const wave = Math.sin(t * 4 + seed) * 0.5;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 13, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = color;
  ctx.fillRect(x - 10, y - 30, 20, 30);
  // Head
  ctx.fillStyle = '#f5d8b0';
  ctx.beginPath();
  ctx.arc(x, y - 40, 8, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(x, y - 46, 9, Math.PI, 0);
  ctx.fill();
  // Arms raised waving
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(x - 10, y - 26);
  ctx.rotate(-1.2 - wave);
  ctx.fillRect(-3, -18, 6, 18);
  if (hasFlag) {
    ctx.fillStyle = '#d9b36b';
    ctx.fillRect(-12, -34, 24, 12);
  }
  ctx.restore();
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(x + 10, y - 26);
  ctx.rotate(1.0 + wave);
  ctx.fillRect(-3, -18, 6, 18);
  ctx.restore();
}

// ── Canvas component ───────────────────────────────────────────
function VictoryCanvas({ chapter, bg }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let start = performance.now();
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
    const tick = (now) => {
      const t = (now - start) / 1000;
      const rect = canvas.getBoundingClientRect();
      const vw = rect.width;
      const vh = rect.height;
      if (canvas.width !== Math.floor(vw * dpr) || canvas.height !== Math.floor(vh * dpr)) resize();
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, vw, vh);
      if (chapter === 2) drawMagistrateCourt(ctx, vw, vh, t);
      else drawBanquetHall(ctx, vw, vh, t);
      ctx.restore();
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [chapter, bg]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

export default function VictoryBanquet({ onClose, gold, heroes, chapter = 1 }) {
  const [phase, setPhase] = useState('cinematic');
  const [captionIndex, setCaptionIndex] = useState(0);
  const isChapter2 = chapter === 2;

  const CAPTIONS = isChapter2 ? [
    '⚔️  Chapter 2 Complete — The Magistrate Falls',
    `🏆  Guards defeated. Warlord Gao slain.`,
    `🪙  Reward: +200 gold  •  Heroes: ${heroes}/108`,
    '🏮  The people cheer as Liangshan\'s might spreads...',
    '"The road home grows shorter. Keep fighting."',
  ] : [
    '⚔️  Chapter 1 Complete — Oath at Liangshan',
    `🏆  Raiders defeated. Captain Zhao slain.`,
    `🪙  Reward: +100 gold  •  Heroes recruited: ${heroes}/108`,
    '🏮  Song Jiang raises his cup in your honour...',
    '"108 heroes. One oath. One mountain. Tonight — we feast."',
  ];

  const titleChi = isChapter2 ? '第二章完成' : '第一章完成';
  const titleEn = isChapter2 ? 'Chapter II — Complete' : 'Chapter I — Complete';
  const titleSub = isChapter2 ? 'The Magistrate Falls' : 'Oath at Liangshan';
  const canvasBg = isChapter2 ? '#050204' : '#1a0808';

  useEffect(() => {
    if (captionIndex < CAPTIONS.length - 1) {
      const t = setTimeout(() => setCaptionIndex((c) => c + 1), 2200);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase('revealed'), 600);
      return () => clearTimeout(t);
    }
  }, [captionIndex]);

  return (
    <div className={`banquet-overlay ${isChapter2 ? 'chapter-two' : ''}`}>
      <div className="banquet-canvas">
        <VictoryCanvas chapter={chapter} bg={canvasBg} />
      </div>

      <div className="banquet-bars top" />
      <div className="banquet-bars bottom" />

      <div className="banquet-caption-wrap">
        <p className="banquet-caption" key={captionIndex}>{CAPTIONS[captionIndex]}</p>
      </div>

      <div className={`banquet-title-card ${phase === 'revealed' ? 'show' : ''}`}>
        <div className="banquet-title-chi">{titleChi}</div>
        <div className="banquet-title-en">{titleEn}</div>
        <div className="banquet-title-sub">{titleSub}</div>
        <div className="banquet-stats">
          <span>🪙 {gold} gold</span>
          <span>👥 {heroes} / 108 heroes</span>
        </div>
        <button className="banquet-continue" onClick={onClose}>
          {chapter >= 2 ? '⚔️ Continue to Chapter 3 →' : '⚔️ Continue to Chapter 2 →'}
        </button>
      </div>
    </div>
  );
}
