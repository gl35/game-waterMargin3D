import { useEffect, useRef, useState } from 'react';
import './OpeningCinematic.css';

// ── 2D scene renderers — each draws onto a single canvas ───────────
function drawStudentScene(ctx, w, h, t) {
  // Dark midnight bedroom
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0a0a18');
  bg.addColorStop(1, '#181030');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Window with moonlight (right side)
  const wx = w * 0.74, wy = h * 0.30, ww = w * 0.18, wh = h * 0.36;
  const moon = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  moon.addColorStop(0, '#3a6ab0');
  moon.addColorStop(1, '#1a2a5a');
  ctx.fillStyle = moon;
  ctx.fillRect(wx, wy, ww, wh);
  // Window frame
  ctx.strokeStyle = '#2a1808';
  ctx.lineWidth = 4;
  ctx.strokeRect(wx, wy, ww, wh);
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();
  // Moon
  const moonX = wx + ww * 0.7, moonY = wy + wh * 0.3;
  ctx.fillStyle = '#f0e8c0';
  ctx.beginPath(); ctx.arc(moonX, moonY, 22, 0, Math.PI * 2); ctx.fill();
  // Moon glow
  const mg = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 60);
  mg.addColorStop(0, 'rgba(240, 240, 200, 0.4)');
  mg.addColorStop(1, 'rgba(240, 240, 200, 0)');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(moonX, moonY, 60, 0, Math.PI * 2); ctx.fill();

  // Desk
  const dx = w * 0.18, dy = h * 0.62, dw = w * 0.50, dh = h * 0.04;
  ctx.fillStyle = '#5a3820';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(dx, dy + dh, 8, h * 0.30);
  ctx.fillRect(dx + dw - 8, dy + dh, 8, h * 0.30);

  // Lamp warm pool of light on desk
  const lampX = dx + dw * 0.85, lampY = dy + 2;
  const lampGlow = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, w * 0.40);
  const flick = 1 + Math.sin(t * 0.8) * 0.05;
  lampGlow.addColorStop(0, `rgba(255, 200, 130, ${0.55 * flick})`);
  lampGlow.addColorStop(0.5, 'rgba(255, 170, 100, 0.18)');
  lampGlow.addColorStop(1, 'rgba(255, 170, 100, 0)');
  ctx.fillStyle = lampGlow;
  ctx.fillRect(0, 0, w, h);

  // Books stacked
  const bookY = dy - 10;
  const bookColors = ['#8a1c1c', '#1c4a8a', '#2a7a2a', '#7a5a1c'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = bookColors[i];
    ctx.fillRect(dx + 30 + i * 20, bookY - i * 4, 18, 8 + i * 2);
  }

  // Laptop with blue glow
  const lx = dx + dw * 0.45, ly = dy - 22;
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(lx, ly, 80, 24);
  // Screen glow
  const screenGrad = ctx.createLinearGradient(lx, ly + 2, lx, ly + 22);
  screenGrad.addColorStop(0, '#2a4cff');
  screenGrad.addColorStop(1, '#0a1a4a');
  ctx.fillStyle = screenGrad;
  ctx.fillRect(lx + 2, ly + 2, 76, 20);
  // Spilled blue light
  const blueGlow = ctx.createRadialGradient(lx + 40, ly + 12, 0, lx + 40, ly + 12, 120);
  blueGlow.addColorStop(0, 'rgba(80, 120, 255, 0.4)');
  blueGlow.addColorStop(1, 'rgba(80, 120, 255, 0)');
  ctx.fillStyle = blueGlow;
  ctx.fillRect(0, 0, w, h);

  // Coffee mug
  const mx = dx + dw * 0.78, my = dy - 26;
  ctx.fillStyle = '#cc4422';
  ctx.fillRect(mx, my, 18, 22);
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(mx + 2, my + 2, 14, 4); // dark coffee
  ctx.strokeStyle = '#cc4422';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(mx + 22, my + 12, 5, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  // Steam
  ctx.strokeStyle = `rgba(220, 220, 240, ${0.3 + Math.sin(t * 2) * 0.1})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mx + 9, my - 2);
  ctx.bezierCurveTo(mx + 5, my - 10, mx + 14, my - 16, mx + 9, my - 24);
  ctx.stroke();

  // Exam paper
  ctx.save();
  ctx.translate(dx + dw * 0.20, dy - 4);
  ctx.rotate(0.15);
  ctx.fillStyle = '#f0e8d0';
  ctx.fillRect(0, 0, 60, 80);
  ctx.fillStyle = '#3a3018';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(6, 8 + i * 8, 48, 1.5);
  }
  ctx.restore();

  // Slumped student figure on desk
  const sx = dx + dw * 0.42, sy = dy - 60;
  // Hair (slumped over arm)
  ctx.fillStyle = '#1a1010';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 2, 28, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Skin (face)
  ctx.fillStyle = '#d8b07a';
  ctx.beginPath();
  ctx.ellipse(sx + 6, sy + 10, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hoodie body slumped
  ctx.fillStyle = '#2a3a5a';
  ctx.fillRect(sx - 30, sy + 10, 70, 28);
  // Arms folded
  ctx.fillStyle = '#1a2a4a';
  ctx.fillRect(sx - 40, sy + 18, 40, 12);
  ctx.fillRect(sx + 10, sy + 16, 40, 12);

  // Lamp body
  ctx.fillStyle = '#1a1010';
  ctx.fillRect(lampX - 8, dy - 10, 6, 10);
  ctx.beginPath();
  ctx.moveTo(lampX - 16, dy - 50);
  ctx.lineTo(lampX + 8, dy - 30);
  ctx.lineTo(lampX + 8, dy - 10);
  ctx.lineTo(lampX - 16, dy - 30);
  ctx.closePath();
  ctx.fillStyle = '#3a2818';
  ctx.fill();
  // Bulb
  ctx.fillStyle = '#ffe0a0';
  ctx.beginPath(); ctx.arc(lampX - 4, dy - 25, 5, 0, Math.PI * 2); ctx.fill();
}

function drawFeverScene(ctx, w, h, t) {
  // Dark vortex bg
  const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  bg.addColorStop(0, '#3a0820');
  bg.addColorStop(0.5, '#1a0410');
  bg.addColorStop(1, '#000005');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  // Spiral arms (tori)
  const ringColors = ['#ff4488', '#aa22ff', '#ff8800', '#2244ff'];
  ctx.lineWidth = 4;
  for (let r = 0; r < 4; r++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.4 + r * 0.4);
    ctx.scale(1, 0.4);
    const radius = (r + 1) * Math.min(w, h) * 0.08;
    ctx.strokeStyle = ringColors[r];
    ctx.globalAlpha = 0.7 - r * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Orbiting particles
  ctx.fillStyle = '#ffaadd';
  for (let i = 0; i < 80; i++) {
    const baseAng = (i / 80) * Math.PI * 2;
    const ang = baseAng + t * (0.3 + (i % 7) * 0.05);
    const r = 30 + (i % 10) * 18 + Math.sin(t * 0.5 + i) * 12;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r * 0.5 + Math.sin(t * 1.2 + i) * 20;
    const sz = 2 + (i % 4);
    ctx.globalAlpha = 0.6 + Math.sin(t * 2 + i) * 0.3;
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;

  // Center bright glow
  const center = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80);
  center.addColorStop(0, 'rgba(255, 200, 200, 0.55)');
  center.addColorStop(1, 'rgba(255, 80, 100, 0)');
  ctx.fillStyle = center;
  ctx.fillRect(0, 0, w, h);

  // Floating Chinese characters
  const chars = ['梁', '山', '英', '雄'];
  ctx.font = 'bold 44px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) {
    const ang = (i / chars.length) * Math.PI * 2 + t * 0.15;
    const r = 180 + Math.sin(t + i) * 30;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r * 0.55;
    ctx.fillStyle = `rgba(255, 220, 200, ${0.7 + Math.sin(t * 1.5 + i) * 0.3})`;
    ctx.fillText(chars[i], x, y);
  }
}

function drawLiangshanScene(ctx, w, h, t) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, '#a8c0e8');
  sky.addColorStop(1, '#e8d8b0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.72);

  // Sun
  const sunX = w * 0.72 + Math.cos(t * 0.05) * 20;
  const sunY = h * 0.22 + Math.sin(t * 0.05) * 6;
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 80);
  sg.addColorStop(0, 'rgba(255, 250, 192, 0.9)');
  sg.addColorStop(0.4, 'rgba(255, 238, 128, 0.4)');
  sg.addColorStop(1, 'rgba(255, 200, 100, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fffac0';
  ctx.beginPath(); ctx.arc(sunX, sunY, 24, 0, Math.PI * 2); ctx.fill();

  // Distant mountains (multiple layers for depth)
  const mountainLayers = [
    { y: h * 0.45, color: '#8a9bb5', peaks: [[0.1, 0.4], [0.25, 0.55], [0.45, 0.45], [0.65, 0.6], [0.85, 0.5]] },
    { y: h * 0.55, color: '#5a7a8a', peaks: [[0.05, 0.5], [0.2, 0.7], [0.4, 0.55], [0.55, 0.75], [0.75, 0.6], [0.95, 0.7]] },
    { y: h * 0.62, color: '#3a5a6a', peaks: [[0.1, 0.65], [0.3, 0.85], [0.5, 0.7], [0.7, 0.9], [0.9, 0.8]] },
  ];
  for (const layer of mountainLayers) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    for (const [px, py] of layer.peaks) {
      ctx.lineTo(px * w, layer.y * (py * 1.6));
    }
    ctx.lineTo(w, h * 0.72);
    ctx.closePath();
    ctx.fill();
    // Snow caps
    ctx.fillStyle = '#e8eeff';
    for (const [px, py] of layer.peaks) {
      const peakY = layer.y * (py * 1.6);
      ctx.beginPath();
      ctx.moveTo(px * w - 8, peakY + 6);
      ctx.lineTo(px * w, peakY);
      ctx.lineTo(px * w + 8, peakY + 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Liangshan fortress on central peak silhouette
  const fx = w * 0.5, fy = h * 0.42;
  ctx.fillStyle = '#4a5a40';
  ctx.beginPath();
  ctx.moveTo(fx - 70, fy + 30);
  ctx.lineTo(fx - 40, fy - 20);
  ctx.lineTo(fx + 40, fy - 20);
  ctx.lineTo(fx + 70, fy + 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a6a50';
  ctx.fillRect(fx - 36, fy - 30, 72, 14);
  ctx.fillStyle = '#4a2010';
  ctx.beginPath();
  ctx.moveTo(fx - 30, fy - 30);
  ctx.lineTo(fx, fy - 50);
  ctx.lineTo(fx + 30, fy - 30);
  ctx.closePath();
  ctx.fill();
  // Towers
  ctx.fillStyle = '#6a5a40';
  ctx.fillRect(fx - 26, fy - 32, 8, 22);
  ctx.fillRect(fx + 18, fy - 32, 8, 22);
  // Banner
  ctx.fillStyle = '#cc1818';
  ctx.fillRect(fx - 1, fy - 60, 2, 14);
  ctx.fillRect(fx, fy - 60, 10, 8);

  // Ground / valley
  ctx.fillStyle = '#5a8a40';
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.fillStyle = '#4a7a35';
  for (let i = 0; i < 12; i++) {
    const gy = h * 0.72 + (i / 12) * h * 0.28;
    ctx.fillRect(0, gy, w, 2);
  }

  // Pine trees in foreground
  for (let i = 0; i < 14; i++) {
    const tx = (i / 14) * w + ((i * 73) % w) * 0.05;
    const ty = h * 0.72 + 30 + (i % 4) * 16;
    if (Math.abs(tx - w / 2) < 60) continue;
    ctx.fillStyle = '#4a3010';
    ctx.fillRect(tx - 2, ty, 4, 20);
    ctx.fillStyle = '#2a6a30';
    ctx.beginPath();
    ctx.moveTo(tx - 14, ty + 6);
    ctx.lineTo(tx, ty - 26);
    ctx.lineTo(tx + 14, ty + 6);
    ctx.closePath();
    ctx.fill();
  }

  // Birds
  ctx.fillStyle = '#1a1010';
  for (let i = 0; i < 6; i++) {
    const bx = (i * 90 + t * 12) % w;
    const by = h * 0.18 + Math.sin(t + i) * 6;
    ctx.beginPath();
    ctx.moveTo(bx - 6, by);
    ctx.quadraticCurveTo(bx - 3, by - 4, bx, by);
    ctx.quadraticCurveTo(bx + 3, by - 4, bx + 6, by);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1a1010';
    ctx.stroke();
  }
}

function drawRaiderScene(ctx, w, h, t) {
  // Night sky
  ctx.fillStyle = '#0a0808';
  ctx.fillRect(0, 0, w, h * 0.5);
  // Smoke / glow on horizon
  const horizGrad = ctx.createLinearGradient(0, h * 0.3, 0, h * 0.6);
  horizGrad.addColorStop(0, 'rgba(80, 30, 10, 0)');
  horizGrad.addColorStop(1, 'rgba(255, 80, 30, 0.5)');
  ctx.fillStyle = horizGrad;
  ctx.fillRect(0, h * 0.3, w, h * 0.3);
  // Ground
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  // Ground glow tint
  const groundGrad = ctx.createRadialGradient(w / 2, h * 0.7, 50, w / 2, h * 0.7, w * 0.6);
  groundGrad.addColorStop(0, 'rgba(255, 80, 20, 0.35)');
  groundGrad.addColorStop(1, 'rgba(255, 80, 20, 0)');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  // Burning buildings (3 in distance)
  const buildings = [
    { x: w * 0.20, y: h * 0.50, w: 130, h: 120 },
    { x: w * 0.45, y: h * 0.48, w: 140, h: 130 },
    { x: w * 0.72, y: h * 0.50, w: 120, h: 110 },
  ];
  for (const b of buildings) {
    // Building body
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof (collapsing/burning)
    ctx.fillStyle = '#2a1008';
    ctx.beginPath();
    ctx.moveTo(b.x - 8, b.y);
    ctx.lineTo(b.x + b.w / 2, b.y - b.h * 0.4);
    ctx.lineTo(b.x + b.w + 8, b.y);
    ctx.closePath();
    ctx.fill();
    // Window glow
    ctx.fillStyle = `rgba(255, 100, 30, ${0.7 + Math.sin(t * 4 + b.x) * 0.2})`;
    ctx.fillRect(b.x + 14, b.y + 30, 18, 24);
    ctx.fillRect(b.x + b.w - 32, b.y + 30, 18, 24);
  }

  // Flames in front of each building
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const fx = b.x + b.w / 2;
    const fy = b.y + b.h - 8;
    drawFlame(ctx, fx - 30, fy, t, i);
    drawFlame(ctx, fx + 20, fy + 6, t, i + 1);
    drawFlame(ctx, fx, fy - 24, t, i + 2);
  }

  // Embers floating up
  for (let i = 0; i < 50; i++) {
    const baseT = t + i * 0.7;
    const ex = (i * 91) % w;
    const ey = h * 0.95 - ((baseT * 30) % h) * 0.9;
    if (ey < 0) continue;
    const flick = 0.5 + Math.sin(baseT * 4) * 0.5;
    ctx.fillStyle = `rgba(255, ${100 + flick * 80}, 30, ${flick * 0.8})`;
    ctx.fillRect(ex, ey, 2, 2);
  }

  // Raider silhouette (right foreground)
  const rx = w * 0.78, ry = h * 0.78;
  ctx.fillStyle = '#1a0a08';
  // Body
  ctx.fillRect(rx - 14, ry - 50, 28, 50);
  // Head
  ctx.beginPath(); ctx.arc(rx, ry - 64, 14, 0, Math.PI * 2); ctx.fill();
  // Helmet horns
  ctx.beginPath();
  ctx.moveTo(rx - 14, ry - 70);
  ctx.lineTo(rx - 22, ry - 84);
  ctx.lineTo(rx - 10, ry - 78);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rx + 14, ry - 70);
  ctx.lineTo(rx + 22, ry - 84);
  ctx.lineTo(rx + 10, ry - 78);
  ctx.closePath();
  ctx.fill();
  // Sword/spear raised
  ctx.strokeStyle = '#888090';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(rx + 16, ry - 50);
  ctx.lineTo(rx + 60, ry - 90);
  ctx.stroke();
  ctx.fillStyle = '#c0c0d8';
  ctx.beginPath();
  ctx.moveTo(rx + 60, ry - 90);
  ctx.lineTo(rx + 70, ry - 96);
  ctx.lineTo(rx + 64, ry - 84);
  ctx.closePath();
  ctx.fill();

  // Fleeing villagers (left foreground)
  for (let i = 0; i < 3; i++) {
    const vx = w * (0.10 + i * 0.06) - Math.sin(t * 2 + i) * 4;
    const vy = h * (0.85 - i * 0.04);
    ctx.fillStyle = '#1a1010';
    // Body
    ctx.fillRect(vx - 8, vy - 28, 16, 28);
    // Head
    ctx.beginPath(); ctx.arc(vx, vy - 36, 8, 0, Math.PI * 2); ctx.fill();
    // Legs running
    const swing = Math.sin(t * 8 + i) * 4;
    ctx.fillRect(vx - 6, vy, 4, 12);
    ctx.fillRect(vx + 2, vy + swing * 0.4, 4, 12);
  }
}

function drawFlame(ctx, x, y, t, seed) {
  const flick = 1 + Math.sin(t * 6 + seed * 1.3) * 0.25;
  const w = 18 * flick;
  const fh = 36 * flick;
  ctx.fillStyle = `rgba(255, 80, 16, 0.85)`;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y - fh * 1.4, x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255, 180, 60, 0.9)`;
  ctx.beginPath();
  ctx.moveTo(x - w / 4, y);
  ctx.quadraticCurveTo(x, y - fh, x + w / 4, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255, 240, 180, 0.95)`;
  ctx.beginPath();
  ctx.moveTo(x - w / 8, y);
  ctx.quadraticCurveTo(x, y - fh * 0.5, x + w / 8, y);
  ctx.closePath();
  ctx.fill();
}

function drawHeroGatherScene(ctx, w, h, t) {
  // Hall background — warm interior
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#3a1408');
  bg.addColorStop(0.7, '#4a1808');
  bg.addColorStop(1, '#1a0808');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Back wall with banner
  const wallY = h * 0.15, wallH = h * 0.55;
  ctx.fillStyle = '#5a1a08';
  ctx.fillRect(w * 0.1, wallY, w * 0.8, wallH);
  // Wood beams
  ctx.fillStyle = '#3a1008';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(w * 0.1 + (i / 5) * w * 0.8, wallY, 4, wallH);
  }
  // Central red banner with character
  const bx = w / 2, by = wallY + 14;
  ctx.fillStyle = '#cc1818';
  ctx.fillRect(bx - 36, by, 72, 160);
  ctx.fillStyle = '#9a1010';
  ctx.fillRect(bx - 36, by + 158, 72, 4);
  ctx.fillStyle = '#ffd060';
  ctx.font = 'bold 56px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('義', bx, by + 60);
  ctx.fillText('勇', bx, by + 120);

  // Lanterns hanging
  for (let i = 0; i < 3; i++) {
    const lx = w * (0.25 + i * 0.25);
    const ly = h * 0.18;
    ctx.fillStyle = '#1a0a04';
    ctx.fillRect(lx - 1, 0, 2, ly - 14);
    // Lantern body
    const flick = 1 + Math.sin(t * 2 + i) * 0.04;
    ctx.fillStyle = '#cc1818';
    ctx.beginPath();
    ctx.ellipse(lx, ly, 16 * flick, 22 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffae40';
    ctx.beginPath();
    ctx.ellipse(lx, ly, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glow
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 100);
    lg.addColorStop(0, `rgba(255, 140, 60, ${0.4 * flick})`);
    lg.addColorStop(1, 'rgba(255, 140, 60, 0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
  }

  // Floor
  ctx.fillStyle = '#6a3a18';
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.fillStyle = '#4a2810';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(0, h * 0.7 + i * 12, w, 1);
  }

  // Heroes flanking (6 figures) — sway slightly
  const heroColors = ['#7f1f26', '#1f3a7f', '#1f7f3a', '#7f5a1f', '#4a1f7f', '#7f1f5a'];
  const heroXs = [-3, -2, -1, 1, 2, 3];
  for (let i = 0; i < 6; i++) {
    const sway = Math.sin(t * 0.4 + i) * 2;
    const xPos = w / 2 + heroXs[i] * 70 + sway;
    const yBase = h * 0.85;
    drawCinemaHero(ctx, xPos, yBase, heroColors[i], 32);
  }

  // Song Jiang in center, raised arm
  const sjx = w / 2;
  const sjy = h * 0.86;
  drawSongJiang(ctx, sjx, sjy, t);

  // Stranger ("you") in foreground center, white-glowing
  drawStrangerHero(ctx, w / 2, h * 0.96, t);
}

function drawCinemaHero(ctx, x, y, color, scale) {
  const s = scale / 32;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 18 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Robe / body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 18 * s, y);
  ctx.lineTo(x - 14 * s, y - 60 * s);
  ctx.lineTo(x + 14 * s, y - 60 * s);
  ctx.lineTo(x + 18 * s, y);
  ctx.closePath();
  ctx.fill();
  // Head
  ctx.fillStyle = '#d8a870';
  ctx.beginPath();
  ctx.arc(x, y - 70 * s, 12 * s, 0, Math.PI * 2);
  ctx.fill();
  // Hair / topknot
  ctx.fillStyle = '#1a1010';
  ctx.fillRect(x - 10 * s, y - 84 * s, 20 * s, 8 * s);
  // Spear / weapon (right)
  ctx.strokeStyle = '#a09888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 16 * s, y - 50 * s);
  ctx.lineTo(x + 18 * s, y - 110 * s);
  ctx.stroke();
  ctx.fillStyle = '#c0c0d8';
  ctx.beginPath();
  ctx.moveTo(x + 18 * s, y - 116 * s);
  ctx.lineTo(x + 14 * s, y - 108 * s);
  ctx.lineTo(x + 22 * s, y - 108 * s);
  ctx.closePath();
  ctx.fill();
}

function drawSongJiang(ctx, x, y, t) {
  // Imposing red-robed figure, raised sword
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Robe
  ctx.fillStyle = '#7f1f26';
  ctx.beginPath();
  ctx.moveTo(x - 26, y);
  ctx.lineTo(x - 18, y - 80);
  ctx.lineTo(x + 18, y - 80);
  ctx.lineTo(x + 26, y);
  ctx.closePath();
  ctx.fill();
  // Inner robe trim
  ctx.fillStyle = '#aa2a34';
  ctx.fillRect(x - 4, y - 78, 8, 78);
  ctx.fillStyle = '#d9b36b';
  ctx.fillRect(x - 22, y - 30, 44, 4);
  // Head
  ctx.fillStyle = '#d8a870';
  ctx.beginPath();
  ctx.arc(x, y - 92, 16, 0, Math.PI * 2);
  ctx.fill();
  // Hat
  ctx.fillStyle = '#101010';
  ctx.fillRect(x - 18, y - 110, 36, 6);
  ctx.fillRect(x - 14, y - 116, 28, 8);
  // Beard
  ctx.fillStyle = '#3a2010';
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 84);
  ctx.lineTo(x, y - 70);
  ctx.lineTo(x + 8, y - 84);
  ctx.closePath();
  ctx.fill();
  // Raised right arm with sword
  ctx.fillStyle = '#7f1f26';
  ctx.save();
  ctx.translate(x + 18, y - 70);
  ctx.rotate(-0.6);
  ctx.fillRect(-6, -40, 12, 40);
  ctx.restore();
  // Sword above head
  const sx = x + 32, sy = y - 130;
  ctx.strokeStyle = '#c8a060';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 28, y - 100);
  ctx.lineTo(sx + 14, sy - 30);
  ctx.stroke();
  ctx.fillStyle = '#e8d8a0';
  ctx.beginPath();
  ctx.moveTo(sx + 14, sy - 38);
  ctx.lineTo(sx + 8, sy - 26);
  ctx.lineTo(sx + 22, sy - 26);
  ctx.closePath();
  ctx.fill();
  // Glow on sword
  const swordGlow = ctx.createRadialGradient(sx + 14, sy - 32, 0, sx + 14, sy - 32, 40);
  swordGlow.addColorStop(0, `rgba(255, 240, 180, ${0.4 + Math.sin(t * 2) * 0.1})`);
  swordGlow.addColorStop(1, 'rgba(255, 200, 100, 0)');
  ctx.fillStyle = swordGlow;
  ctx.beginPath(); ctx.arc(sx + 14, sy - 32, 40, 0, Math.PI * 2); ctx.fill();
}

function drawStrangerHero(ctx, x, y, t) {
  // White-glowing protagonist
  const aura = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, 70);
  const pulse = 0.25 + Math.sin(t * 2) * 0.08;
  aura.addColorStop(0, `rgba(170, 220, 255, ${pulse})`);
  aura.addColorStop(1, 'rgba(170, 220, 255, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(x, y - 30, 70, 0, Math.PI * 2); ctx.fill();
  // Pale robe
  ctx.fillStyle = '#f0ece0';
  ctx.beginPath();
  ctx.moveTo(x - 22, y);
  ctx.lineTo(x - 16, y - 70);
  ctx.lineTo(x + 16, y - 70);
  ctx.lineTo(x + 22, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#aaddff';
  ctx.fillRect(x - 4, y - 68, 8, 60);
  // Head
  ctx.fillStyle = '#e8c880';
  ctx.beginPath();
  ctx.arc(x, y - 80, 14, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = '#1a1010';
  ctx.fillRect(x - 12, y - 94, 24, 6);
}

const SCENE_DRAWERS = {
  student: drawStudentScene,
  fever: drawFeverScene,
  liangshan: drawLiangshanScene,
  raiders: drawRaiderScene,
  heroes: drawHeroGatherScene,
};

function SceneCanvas2D({ sceneId, bg }) {
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
      const draw = SCENE_DRAWERS[sceneId];
      if (draw) draw(ctx, vw, vh, t);
      ctx.restore();
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [sceneId, bg]);
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ── Cinematic scene data ────────────────────────────────────────
const SCENES = [
  {
    id: 'student',
    duration: 5500,
    bg: '#0a0818',
    lines: [
      { t: 0,    text: 'Shanghai, 2024.', sub: null },
      { t: 1800, text: 'The night before the Song dynasty history exam.', sub: null },
      { t: 3800, text: 'He has been studying for 36 hours straight.', sub: null },
    ],
  },
  {
    id: 'fever',
    duration: 5000,
    bg: '#0a0010',
    lines: [
      { t: 0,    text: 'A fever takes hold...', sub: null },
      { t: 1800, text: 'The ancient words on the page begin to move.', sub: null },
      { t: 3400, text: '"108 heroes... sworn brothers... Liangshan..."', sub: null },
    ],
  },
  {
    id: 'liangshan',
    duration: 6000,
    bg: '#b8ccf0',
    lines: [
      { t: 0,    text: 'He opens his eyes.', sub: null },
      { t: 1800, text: 'Song dynasty China. The age of the 108 heroes.', sub: '宋朝 — 梁山泊' },
      { t: 4000, text: 'The fortress of Liangshan rises on the horizon.', sub: null },
    ],
  },
  {
    id: 'raiders',
    duration: 5500,
    bg: '#0a0808',
    lines: [
      { t: 0,    text: 'But the kingdom is not at peace.', sub: null },
      { t: 1800, text: 'Raiders burn villages. Magistrates oppress the people.', sub: null },
      { t: 3600, text: 'The road home runs through blood.', sub: null },
    ],
  },
  {
    id: 'heroes',
    duration: 6500,
    bg: '#1a0808',
    lines: [
      { t: 0,    text: 'Song Jiang, leader of the 108 heroes, finds the stranger.', sub: '宋江' },
      { t: 2200, text: '"Only by uniting all 108 sworn brothers can order be restored."', sub: null },
      { t: 4400, text: '"...and only then will you find your way home."', sub: null },
    ],
  },
];

export default function OpeningCinematic({ onComplete }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [visibleLines, setVisibleLines] = useState([]);
  const [transitioning, setTransitioning] = useState(false);
  const lineTimers = useRef([]);
  const sceneTimer = useRef(null);

  const scene = SCENES[sceneIdx];

  useEffect(() => {
    lineTimers.current.forEach(clearTimeout);
    lineTimers.current = [];
    setVisibleLines([]);

    scene.lines.forEach((line, i) => {
      lineTimers.current[i] = setTimeout(() => {
        setVisibleLines((prev) => [...prev, line]);
      }, line.t);
    });

    return () => lineTimers.current.forEach(clearTimeout);
  }, [sceneIdx]);

  useEffect(() => {
    clearTimeout(sceneTimer.current);
    sceneTimer.current = setTimeout(() => {
      if (sceneIdx < SCENES.length - 1) {
        setTransitioning(true);
        setTimeout(() => {
          setSceneIdx((s) => s + 1);
          setTransitioning(false);
        }, 600);
      } else {
        setTransitioning(true);
        setTimeout(onComplete, 700);
      }
    }, scene.duration);
    return () => clearTimeout(sceneTimer.current);
  }, [sceneIdx]);

  const skip = () => {
    lineTimers.current.forEach(clearTimeout);
    clearTimeout(sceneTimer.current);
    setTransitioning(true);
    setTimeout(onComplete, 500);
  };

  return (
    <div className={`cinematic-overlay ${transitioning ? 'fade-out' : 'fade-in'}`}>
      <div className="cinematic-canvas">
        <SceneCanvas2D key={sceneIdx} sceneId={scene.id} bg={scene.bg} />
      </div>

      <div className="cine-bar top" />
      <div className="cine-bar bottom" />

      <div className="cine-vignette" />

      <div className="cine-text-area">
        {visibleLines.map((line, i) => (
          <div key={i} className="cine-line-wrap">
            <p className="cine-line">{line.text}</p>
            {line.sub && <p className="cine-line-sub">{line.sub}</p>}
          </div>
        ))}
      </div>

      <div className="cine-dots">
        {SCENES.map((_, i) => (
          <div key={i} className={`cine-dot ${i === sceneIdx ? 'active' : i < sceneIdx ? 'done' : ''}`} />
        ))}
      </div>

      <button className="cine-skip" onClick={skip}>Skip ›</button>

      {sceneIdx === SCENES.length - 1 && (
        <div className="cine-title-flash">
          <div className="cine-title-chi">夢</div>
          <div className="cine-title-en">Dream of Water Margin</div>
        </div>
      )}
    </div>
  );
}
