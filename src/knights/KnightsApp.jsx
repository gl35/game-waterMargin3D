// ── Knights of Valour-style action shell ──
// Side-scrolling beat-em-up with 2.5D floor depth, combo strings, HP-cost
// magic, item pickups, and breakable barrels. Single RAF, perf-tuned.
import { useEffect, useMemo, useRef, useState } from 'react';
import { HEROES, getHero } from './heroes.js';
import { getMoves } from './moves.js';
import { ITEMS, rollDrop } from './items.js';
import { STAGES, getStage } from './stages.js';
import { ENEMIES, makeEnemy } from './enemies.js';
import { STORY, getStory, PROLOGUE_LINES, FINALE_LINES } from './story.js';
import { createRenderer, Z_MIN, Z_MAX } from './renderer.js';
import { preloadKnightsSprites } from './preload.js';
import {
  sfxHit, sfxCrit, sfxKill, sfxClick, sfxBanner,
  sfxFootstep, sfxPickup, isMuted, setMuted,
} from '../audio/sfx.js';

const SAVE_KEY = 'knights_save_v1';
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); }
  catch { return null; }
}
function persistSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }
  catch { /* ignore */ }
}

const COMBO_WINDOW = 0.55;       // seconds after a hit during which the next attack chains
const GRAVITY = 1900;            // px/s² for jump physics
const ZONE_PUSH = 0;             // wave camera lock x — set by waves

function compact(arr, alive) {
  let w = 0;
  for (let r = 0; r < arr.length; r++) if (alive(arr[r])) arr[w++] = arr[r];
  arr.length = w;
}

function makeHero(heroDef) {
  const s = heroDef.stats;
  return {
    id: heroDef.id, color: heroDef.color, sprite: heroDef.sprite,
    x: 100, z: (Z_MIN + Z_MAX) / 2,
    vx: 0, vz: 0,
    y: 0, vy: 0,                   // airborne offset & vertical velocity
    facing: 1,
    hp: s.hpMax, hpMax: s.hpMax,
    atk: s.atk, atkSpeed: s.atkSpeed, atkRange: s.atkRange,
    moveSpeed: s.moveSpeed, jumpPower: s.jumpPower, dashSpeed: s.dashSpeed,
    magicCostPct: s.magicCostPct,
    walking: false, walkPhase: 0,
    attacking: 0,                  // remaining duration of current attack
    attackHitDone: false,
    attackMove: null,
    comboStep: 0, comboTimer: 0,
    dashing: 0, dashCdLeft: 0,
    jumping: false, land: 0,       // land = landing-squash timer
    invuln: 0, hitFlash: 0,
    buffs: [],
    coins: 0, xp: 0,
    bobPhase: 0,
  };
}

export default function KnightsApp() {
  const [screen, setScreen] = useState('title');
  const [stageId, setStageId] = useState('mountain_pass');
  const [chosenHeroId, setChosenHeroId] = useState('songjiang');
  const [muted, setMutedState] = useState(false);
  const [save, setSave] = useState(() => loadSave() || { unlocked: ['mountain_pass'], coins: 0, hero: 'songjiang' });
  const [showHowTo, setShowHowTo] = useState(true);
  const [endStats, setEndStats] = useState(null);
  const [hudTick, setHudTick] = useState(0);
  const [isTouch] = useState(() =>
    typeof window !== 'undefined' &&
    ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
     (navigator.maxTouchPoints || 0) > 0));

  const gameRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const inputRef = useRef({
    left: false, right: false, up: false, down: false,
    attackEdge: false, jumpEdge: false, magicEdge: false,
    dashEdge: false, attackHeld: false,      // attackHeld: touch hold-to-attack
  });

  function nextStageId(id) {
    const i = STAGES.findIndex(s => s.id === id);
    return i >= 0 && i + 1 < STAGES.length ? STAGES[i + 1].id : null;
  }

  function pushBanner(g, text, dur = 1.5, size = 38) {
    g.vfx.push({
      kind: 'banner', text, size, dur, t: 0,
      x: window.innerWidth / 2, y: window.innerHeight * 0.30,
      world: false,
    });
  }
  function pushDamage(g, x, z, value, crit = false, heal = false) {
    g.vfx.push({ kind: 'damageNumber', x, z, value, crit, heal, dur: 0.9, t: 0, world: true, yOff: -100 });
  }
  function pushPop(g, x, z, color) {
    g.vfx.push({ kind: 'pop', x, z, color: color || '#ffe080', dur: 0.3, t: 0, world: true, yOff: -50 });
  }

  // ── Game-feel: screen shake + particle bursts ──
  function addShake(g, amt) { g.shake = Math.min(1, (g.shake || 0) + amt); }

  function spawnSpark(g, x, z, n, color) {
    if (g.particles.length > 360) return;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 130 + Math.random() * 280;
      g.particles.push({
        kind: 'spark', x, z, y: 42 + Math.random() * 34,
        vx: Math.cos(ang) * spd, vy: Math.abs(Math.sin(ang)) * spd * 0.8 + 70, vz: 0,
        life: 0.18 + Math.random() * 0.2, max: 0.4,
        size: 2 + Math.random() * 2.2, color: color || '#ffe6a0', grav: true,
      });
    }
  }
  function spawnDust(g, x, z, n, color) {
    if (g.particles.length > 360) return;
    for (let i = 0; i < n; i++) {
      g.particles.push({
        kind: 'dust', x: x + (Math.random() * 2 - 1) * 9, z,
        y: 2, vx: (Math.random() * 2 - 1) * 45, vy: 22 + Math.random() * 34, vz: 0,
        life: 0.3 + Math.random() * 0.28, max: 0.6,
        size: 5 + Math.random() * 4, color: color || 'rgba(186,156,116,1)', grav: false,
      });
    }
  }
  function spawnDebris(g, x, z, n, color) {
    if (g.particles.length > 360) return;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() * 2 - 1) * 0.95;
      const spd = 150 + Math.random() * 220;
      g.particles.push({
        kind: 'debris', x, z, y: 18 + Math.random() * 22,
        vx: Math.cos(ang) * spd * 0.7, vy: Math.abs(Math.sin(ang)) * spd + 130, vz: 0,
        life: 0.7 + Math.random() * 0.45, max: 1.15,
        size: 4 + Math.random() * 5, color: color || '#7a4a28',
        rot: Math.random() * Math.PI, vr: (Math.random() * 2 - 1) * 13, grav: true, bounce: true,
      });
    }
  }
  function spawnEmber(g) {
    g.particles.push({
      kind: 'ember',
      x: g.camX + Math.random() * window.innerWidth,
      z: Z_MIN + Math.random() * (Z_MAX - Z_MIN),
      y: Math.random() * 44, vx: (Math.random() * 2 - 1) * 11, vy: 18 + Math.random() * 24, vz: 0,
      life: 1.6 + Math.random() * 1.5, max: 3.1,
      size: 1 + Math.random() * 1.7, color: Math.random() < 0.5 ? '#ff9a4a' : '#ffcf7a', grav: false,
    });
  }

  function startStage(id, heroId) {
    const stage = getStage(id);
    const heroDef = getHero(heroId);
    const moves = getMoves(heroDef.moveId);
    const hero = makeHero(heroDef);
    const barrels = (stage.barrels || []).map((bx, i) => ({
      id: 'b' + i, x: bx, z: Z_MIN + 30 + (i % 3) * 60, broken: false,
    }));
    const g = {
      stageId: id, stage, hero,
      heroKit: moves, heroDef,
      enemies: [], projectiles: [], vfx: [], items: [],
      barrels,
      time: 0, camX: 0,
      waveIdx: 0, waveActive: false, waveLockX: 0,
      stageComplete: false, stageFailed: false,
      hitStopUntil: 0,
      bg: stage.bg,
      score: 0, kills: 0,
      lastFootstepT: 0,
      particles: [], shake: 0, emberT: 0, zoom: 1,
      comboCount: 0, comboT: 0, comboPop: 0,
      _drawList: [],
    };
    gameRef.current = g;
    window.__KN = g; // debug/test hook
    pushBanner(g, stage.name, 1.6);
    if (heroDef.opening) g.vfx.push({
      kind: 'banner', text: heroDef.opening, size: 22, dur: 2.6, t: -1.4,   // appears after the stage title
      x: window.innerWidth / 2, y: window.innerHeight * 0.40, world: false,
    });
    sfxBanner();
    setScreen('stage');
    setShowHowTo(false);
  }

  function spawnWaveEnemies(g, wave) {
    const lockX = wave.atX + window.innerWidth * 0.35;
    g.waveLockX = lockX;
    g.waveActive = true;
    if (wave.boss) {
      const e = makeEnemy(wave.boss, 1 + Math.floor((g.stage.chapter || 1) * 0.5));
      e.x = lockX + window.innerWidth * 0.45;
      e.z = (Z_MIN + Z_MAX) / 2;
      e.facing = -1;
      g.enemies.push(e);
      pushBanner(g, wave.intro || 'A boss arrives.', 2.0);
      return;
    }
    let i = 0;
    for (const [type, count] of wave.spawns) {
      for (let n = 0; n < count; n++) {
        const e = makeEnemy(type, g.stage.chapter || 1);
        const side = (i + n) % 2 === 0 ? 1 : -0.6;
        // Far-side spawns enter just past the lock edge (not half a screen
        // beyond it) so they reach the arena in a beat, not ten seconds.
        e.x = side > 0
          ? lockX + window.innerWidth * (0.08 + Math.random() * 0.12)
          : lockX - window.innerWidth * 0.25 - Math.random() * 80;
        e.z = Z_MIN + 20 + Math.random() * (Z_MAX - Z_MIN - 40);
        e.facing = side > 0 ? -1 : 1;
        g.enemies.push(e);
        i++;
      }
    }
  }

  function dropItem(g, x, z, key) {
    if (!key) return;
    const def = ITEMS[key];
    const glyph = key === 'meat' ? '🍖' : key === 'bun' ? '⚪'
      : key === 'wine' ? '🍶' : key === 'gold' ? '◯'
      : key === 'scroll' ? '巻' : key === 'weapon' ? '⚔' : '';
    g.items.push({
      id: 'i' + (g.time * 1000 | 0) + Math.random(),
      x, z, key, color: def.color, glyph,
      def, bobT: Math.random() * Math.PI * 2,
      life: 12,
    });
  }

  function applyItem(g, key) {
    const def = ITEMS[key];
    if (!def) return;
    if (def.heal) {
      const amt = Math.round(g.hero.hpMax * def.heal);
      g.hero.hp = Math.min(g.hero.hpMax, g.hero.hp + amt);
      pushDamage(g, g.hero.x, g.hero.z, amt, false, true);
    }
    if (def.dot) {
      g.hero.buffs.push({ kind: 'dot', heal: def.dot.heal, dur: def.dot.dur, t: 0 });
    }
    if (def.buff) {
      g.hero.buffs.push({
        atk: def.buff.atk || 0, atkSpeed: def.buff.atkSpeed || 0,
        dur: def.buff.dur || 8, t: 0,
      });
    }
    if (def.score) g.score += def.score;
    spawnSpark(g, g.hero.x, g.hero.z, 7, def.color || '#fff');
    sfxPickup(def.score ? 'gold' : (def.heal ? 'heal' : 'scroll'));
  }

  function damageEnemy(g, e, amount, opts) {
    if (e.dead) return 0;
    const isCrit = opts && opts.crit !== undefined ? opts.crit : Math.random() < 0.08;
    const dmg = Math.round(amount * (isCrit ? 1.8 : 1));
    e.hp -= dmg;
    e.hitFlash = 0.35;
    e.stun = Math.max(e.stun || 0, (opts && opts.stun) || 0.10);
    e.windup = 0;                          // staggering interrupts their wind-up
    const kb = (opts && opts.knockback) || 0;
    e.kbVx = kb * (Math.sign(e.x - g.hero.x) || 1);
    if (opts && opts.launches && !e.boss) {
      e.vy = 380;
      e.launched = 0.8;
    }
    pushDamage(g, e.x, e.z, dmg, isCrit);
    pushPop(g, e.x, e.z, isCrit ? '#fff076' : '#fff');
    spawnSpark(g, e.x, e.z, isCrit ? 14 : 8, isCrit ? '#fff1a0' : '#ffd9a0');
    addShake(g, isCrit ? 0.26 : 0.12);
    if (isCrit) g.zoom = Math.max(g.zoom || 1, 1.03);   // crit zoom-punch
    if (isCrit) sfxCrit(); else sfxHit();
    const stopMs = (isCrit ? 70 : (opts && opts.hitstop) || 30);
    g.hitStopUntil = Math.max(g.hitStopUntil, performance.now() + stopMs);

    // Combo counter ticks on every connected hit.
    g.comboCount = (g.comboCount || 0) + 1;
    g.comboT = 1.1;
    g.comboPop = 0.18;

    if (e.hp <= 0) {
      e.dead = true;
      e.deadT = g.time;
      // Launch the corpse: fly up + spin away from the hero, then fade.
      e.deathVel = e.boss ? 150 : 340 + Math.random() * 130;
      e.kbVx = (Math.sign(e.x - g.hero.x) || 1) * (e.boss ? 30 : 150 + Math.random() * 130);
      e.deathVr = (Math.sign(e.kbVx) || 1) * (e.boss ? 1.4 : 7 + Math.random() * 4);
      e.deathY = 0; e.deathSpin = 0; e.deathFade = 0;
      addShake(g, e.boss ? 0.5 : 0.2);
      g.zoom = Math.max(g.zoom || 1, e.boss ? 1.08 : 1.05);   // kill zoom-punch
      spawnSpark(g, e.x, e.z, e.boss ? 28 : 10, '#ffd0a0');
      const earned = e.xp || 6;
      g.hero.xp += earned;
      g.hero.coins += Math.round(earned * 0.5);
      g.score += earned * 2;
      g.kills++;
      sfxKill();
      const dropKey = rollDrop(e.drop);
      if (dropKey) dropItem(g, e.x, e.z, dropKey);
    }
    return dmg;
  }

  function damageHero(g, amount) {
    const h = g.hero;
    if (h.invuln > 0) return 0;
    h.hp -= amount;
    h.hitFlash = 0.4;
    h.invuln = 0.55;
    addShake(g, 0.32);
    spawnSpark(g, h.x, h.z, 9, '#ff8484');
    g.comboCount = 0; g.comboT = 0;        // taking a hit drops your combo
    sfxHit();
    if (h.hp <= 0) {
      h.hp = 0;
      g.stageFailed = true;
      addShake(g, 0.6);
    }
    return amount;
  }

  // Execute the current combo step's hitbox and damage application.
  function executeAttack(g, move) {
    const h = g.hero;
    const dir = h.facing;
    let activeAtk = h.atk * (move.dmgMult || 1);
    for (let i = 0; i < h.buffs.length; i++) if (h.buffs[i].atk) activeAtk *= 1 + h.buffs[i].atk;

    // Slash VFX
    g.vfx.push({
      kind: move.beam ? 'beam' : move.aoe ? 'aoe' : 'slash',
      x: h.x, z: h.z, yOff: -50,
      dir, range: move.xRange,
      color: g.heroDef.color || '#ffe080',
      width: move.zRange,
      dur: move.dur || 0.22, t: 0, world: true,
    });

    if (move.projectile) {
      const spread = move.fan || 1;
      const speed = 720;
      for (let k = 0; k < spread; k++) {
        const offZ = (k - (spread - 1) / 2) * 22;
        g.projectiles.push({
          kind: 'arrow',
          x: h.x + dir * 30, z: h.z + offZ, yOff: -50,
          vx: dir * speed, vz: 0,
          angle: dir < 0 ? Math.PI : 0,
          dmg: activeAtk / spread, enemy: false,
          life: 1.2, pierces: !!move.pierces,
          stun: 0.10, knockback: move.knockback || 8,
        });
      }
      return;
    }

    // Hit each enemy in range. Multi-hit moves use `hits`.
    const totalHits = move.hits || 1;
    const perHit = activeAtk / totalHits;
    const z = h.z;
    let hitCount = 0;
    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (e.dead) continue;
      const dx = e.x - h.x;
      if (Math.sign(dx) !== dir && Math.abs(dx) > 6) continue;
      if (Math.abs(dx) > move.xRange) continue;
      if (Math.abs(e.z - z) > move.zRange) continue;
      // Apply all hits with brief delay between
      for (let k = 0; k < totalHits; k++) {
        if (k === 0) {
          damageEnemy(g, e, perHit, { knockback: move.knockback || 0, stun: 0.10, hitstop: move.hitstop || 30, launches: move.launches });
        } else {
          setTimeout(() => {
            if (!gameRef.current || gameRef.current !== g) return;
            if (e.dead) return;
            damageEnemy(g, e, perHit, { knockback: (move.knockback || 0) * 0.3, stun: 0.06, hitstop: 20 });
          }, k * 60);
        }
      }
      hitCount++;
      if (!move.aoe && !move.pierces && hitCount >= 2) break; // typical combo hits 1-2 mobs unless AOE/pierce
    }

    // Also break barrels in range
    for (let i = 0; i < g.barrels.length; i++) {
      const b = g.barrels[i];
      if (b.broken) continue;
      const dx = b.x - h.x;
      if (Math.sign(dx) !== dir && Math.abs(dx) > 12) continue;
      if (Math.abs(dx) > move.xRange) continue;
      if (Math.abs(b.z - z) > Math.max(move.zRange, 40)) continue;
      b.broken = true;
      pushPop(g, b.x, b.z, '#caa078');
      spawnDebris(g, b.x, b.z, 11, '#7a4a28');
      spawnDust(g, b.x, b.z, 5);
      addShake(g, 0.1);
      const dropKey = rollDrop('barrel');
      if (dropKey) dropItem(g, b.x, b.z, dropKey);
    }
  }

  function tryAttack(g) {
    const h = g.hero;
    if (h.attacking > 0) return;
    const kit = g.heroKit;
    let move;
    if (h.y < -4) {                       // airborne → jump attack
      move = kit.jumpAttack;
    } else if (h.dashing > 0) {
      move = kit.dashAttack;
    } else {
      move = kit.combo[h.comboStep];
      h.comboStep = (h.comboStep + 1) % kit.combo.length;
      h.comboTimer = COMBO_WINDOW;
    }
    h.attacking = move.dur;
    h.attackMove = move;
    h.attackHitDone = false;
  }

  function tryJump(g) {
    const h = g.hero;
    if (h.y < -4 || h.attacking > 0) return; // already airborne or busy
    h.vy = -h.jumpPower;
    h.y = -1;
  }

  function tryDash(g) {
    const h = g.hero;
    if (h.dashing > 0 || h.dashCdLeft > 0 || h.y < -4) return;
    h.dashing = 0.25;
    h.dashCdLeft = 0.7;
    h.invuln = Math.max(h.invuln, 0.15);
  }

  function tryMagic(g) {
    const h = g.hero;
    if (h.attacking > 0) return;
    const m = g.heroKit.magic;
    const cost = Math.round(h.hpMax * (m.cost || 0.10));
    if (h.hp <= cost + 1) return;          // refuse if would suicide
    h.hp -= cost;
    h.attacking = 0.45;
    h.attackMove = null;
    pushBanner(g, m.name, 0.9, 30);
    addShake(g, 0.34);
    spawnSpark(g, h.x, h.z, 18, m.color || '#fff');
    sfxBanner();

    if (m.self && m.buff) {
      h.buffs.push({ atk: m.buff.atk || 0, atkSpeed: m.buff.atkSpeed || 0, dur: m.buff.dur || 6, t: 0 });
      g.vfx.push({ kind: 'aoe', x: h.x, z: h.z, yOff: -40, range: 100, color: m.color, dur: 0.6, t: 0, world: true });
      return;
    }
    const dir = h.facing;
    g.vfx.push({
      kind: m.beam ? 'beam' : m.rain ? 'rain' : 'spin',
      x: h.x, z: h.z, yOff: -50,
      dir, range: m.range, width: m.zRange,
      color: m.color, dur: 0.9, t: 0, world: true,
      seed: g.time * 100 | 0,
    });
    let activeAtk = h.atk * m.dmgMult;
    for (let i = 0; i < h.buffs.length; i++) if (h.buffs[i].atk) activeAtk *= 1 + h.buffs[i].atk;
    const perHit = activeAtk / (m.hits || 1);
    for (let k = 0; k < (m.hits || 1); k++) {
      setTimeout(() => {
        if (!gameRef.current || gameRef.current !== g) return;
        for (let i = 0; i < g.enemies.length; i++) {
          const e = g.enemies[i];
          if (e.dead) continue;
          if (m.beam) {
            const dx = e.x - h.x;
            if (Math.sign(dx) !== dir && Math.abs(dx) > 6) continue;
            if (Math.abs(dx) > m.range) continue;
            if (Math.abs(e.z - h.z) > (m.zRange || 60)) continue;
          } else {
            if (Math.abs(e.x - h.x) > m.range) continue;
            if (Math.abs(e.z - h.z) > (m.zRange || 200)) continue;
          }
          damageEnemy(g, e, perHit, { knockback: m.knockback || 30, stun: 0.15, hitstop: m.hitstop || 40 });
        }
      }, k * 80);
    }
  }

  // ── Main tick ──
  function tick(g, dt) {
    g.time += dt;
    const h = g.hero;
    const inp = inputRef.current;

    // Buffs (incl. heal-over-time)
    for (let i = 0; i < h.buffs.length; i++) {
      const b = h.buffs[i];
      b.t += dt;
      if (b.kind === 'dot' && b.heal) {
        h.hp = Math.min(h.hpMax, h.hp + h.hpMax * b.heal * dt / b.dur);
      }
    }
    compact(h.buffs, b => b.t < b.dur);

    // Hero input → movement
    let mvx = 0, mvz = 0;
    if (h.attacking <= 0 && h.dashing <= 0) {
      if (inp.left)  mvx -= 1;
      if (inp.right) mvx += 1;
      if (inp.up)    mvz -= 1;
      if (inp.down)  mvz += 1;
    }
    if (mvx !== 0 || mvz !== 0) {
      const mag = Math.hypot(mvx, mvz);
      mvx /= mag; mvz /= mag;
      h.walking = true;
    } else {
      h.walking = false;
    }
    if (mvx !== 0) h.facing = mvx > 0 ? 1 : -1;

    if (h.dashing > 0) {
      h.dashing -= dt;
      h.x += h.facing * h.dashSpeed * dt;
      spawnDust(g, h.x - h.facing * 12, h.z, 1);
    } else if (h.attacking <= 0) {
      h.x += mvx * h.moveSpeed * dt;
      h.z += mvz * h.moveSpeed * dt;
    }

    // Clamp z to floor band
    if (h.z < Z_MIN) h.z = Z_MIN;
    if (h.z > Z_MAX) h.z = Z_MAX;

    // Camera lock during wave
    let leftX = g.camX;
    let rightX = g.camX + g.stage.width;
    if (g.waveActive) rightX = g.waveLockX;
    if (h.x < leftX + 60) h.x = leftX + 60;
    if (h.x > rightX - 60) h.x = rightX - 60;

    // Airborne physics
    if (h.y < 0 || h.vy !== 0) {
      h.y += h.vy * dt;
      h.vy += GRAVITY * dt;
      if (h.y >= 0) {
        if (h.vy > 250) { h.land = 0.15; spawnDust(g, h.x, h.z, 7); addShake(g, 0.12); }
        h.y = 0; h.vy = 0;
      }
    }
    if (h.land > 0) h.land = Math.max(0, h.land - dt);

    // Walk phase & footsteps
    if (h.walking && h.y >= 0) {
      h.walkPhase += dt * 5.5;
      if (g.time - g.lastFootstepT > 0.30) {
        sfxFootstep(); g.lastFootstepT = g.time;
        spawnDust(g, h.x - h.facing * 6, h.z, 2);
      }
    }

    // Combo timer
    h.comboTimer -= dt;
    if (h.comboTimer <= 0) h.comboStep = 0;

    // Edge-trigger inputs (holding the touch attack button auto-chains)
    if (inp.attackHeld) inp.attackEdge = true;
    if (inp.attackEdge) { inp.attackEdge = false; tryAttack(g); }
    if (inp.jumpEdge)   { inp.jumpEdge   = false; tryJump(g);   }
    if (inp.magicEdge)  { inp.magicEdge  = false; tryMagic(g);  }
    if (inp.dashEdge)   { inp.dashEdge   = false; tryDash(g);   }

    // Attack lifecycle — apply hits at the move's midpoint
    if (h.attacking > 0) {
      const move = h.attackMove;
      if (move && !h.attackHitDone) {
        const elapsedFraction = 1 - (h.attacking / move.dur);
        if (elapsedFraction >= 0.18) {
          executeAttack(g, move);
          h.attackHitDone = true;
        }
      }
      h.attacking -= dt;
    }

    h.dashCdLeft = Math.max(0, h.dashCdLeft - dt);
    if (h.hitFlash > 0) h.hitFlash -= dt;
    if (h.invuln > 0) h.invuln -= dt;
    h.bobPhase += dt * 2.5;

    // Camera follow (only forward; never scrolls back to keep arcade feel)
    const target = Math.max(g.camX, h.x - window.innerWidth * 0.42);
    g.camX += (target - g.camX) * Math.min(1, dt * 5);
    if (g.camX < 0) g.camX = 0;
    if (g.camX > g.stage.width - window.innerWidth) g.camX = Math.max(0, g.stage.width - window.innerWidth);

    // Wave triggers
    if (!g.waveActive && !g.stageComplete && g.waveIdx < g.stage.waves.length) {
      const w = g.stage.waves[g.waveIdx];
      if (h.x >= w.atX) {
        spawnWaveEnemies(g, w);
      }
    }

    // Enemy AI + physics
    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (e.dead) {
        // Death tumble: gravity arc + spin + horizontal knockback slide.
        e.deathVel = (e.deathVel || 0) - GRAVITY * dt;
        e.deathY = Math.max(0, (e.deathY || 0) + e.deathVel * dt);
        e.x += (e.kbVx || 0) * dt;
        e.kbVx = (e.kbVx || 0) * Math.pow(0.05, dt);
        e.deathSpin = (e.deathSpin || 0) + (e.deathVr || 0) * dt;
        e.deathFade = Math.min(1, (g.time - e.deadT) / 0.62);
        continue;
      }
      e.bobPhase += dt * 3.5;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.atkAnim > 0) e.atkAnim -= dt;

      // Airborne (launched)
      if (e.y < 0 || e.vy !== 0) {
        e.y += e.vy * dt;
        e.vy += GRAVITY * dt;
        if (e.y >= 0) { e.y = 0; e.vy = 0; }
      }
      if (e.launched > 0) {
        e.launched -= dt;
        e.x += (e.kbVx || 0) * dt * 1.2;
        continue;
      }

      if (e.stun > 0) {
        e.stun -= dt;
        e.x += (e.kbVx || 0) * dt;
        e.kbVx *= Math.pow(0.001, dt);
        continue;
      }

      const dx = h.x - e.x;
      const dz = h.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.facing = Math.sign(dx) || e.facing;

      // Movement toward player based on AI. While winding up an attack the
      // enemy is committed and plants in place, so the telegraph stays fair.
      const desiredMelee = e.atkRange * 0.85;
      if (e.windup <= 0 && (e.ai === 'kite' || e.ai === 'boss-kite')) {
        // Archers ALWAYS slide their Z toward the hero (so the hero can
        // close into melee range without the archer kiting diagonally off
        // the row). They only adjust X to keep distance.
        const minKeep = e.boss ? 220 : 60;
        const maxIdle = e.atkRange;
        const dxAbs = Math.abs(dx);
        const dzAbs = Math.abs(dz);
        if (dzAbs > 8) {
          e.z += Math.sign(dz) * e.moveSpeed * dt * 0.7;
        }
        // The hero is clamped to waveLockX - 60 during a wave, so an archer
        // hovering past the lock is unreachable forever. March them into the
        // arena fast first; once inside, normal keep-distance — but retreat
        // can never carry them back out.
        const arenaR = g.waveActive ? g.waveLockX - 20 : Infinity;
        const arenaL = g.camX + 40;
        if (e.x > arenaR) {
          e.x = Math.max(arenaR, e.x - e.moveSpeed * 3 * dt);
        } else if (dxAbs < minKeep) {
          e.x += -Math.sign(dx) * e.moveSpeed * dt;
          if (e.x > arenaR) e.x = arenaR;
          if (e.x < arenaL) e.x = arenaL;
        } else if (dxAbs > maxIdle) {
          e.x += Math.sign(dx) * e.moveSpeed * dt * 0.6;
        }
      } else if (e.windup <= 0 && (e.ai === 'rush' || e.ai === 'charge' || e.ai === 'boss')) {
        if (dist > desiredMelee) {
          const ang = Math.atan2(dz, dx);
          e.x += Math.cos(ang) * e.moveSpeed * dt;
          e.z += Math.sin(ang) * e.moveSpeed * dt;
        }
      }
      if (e.z < Z_MIN) e.z = Z_MIN;
      if (e.z > Z_MAX) e.z = Z_MAX;

      e.atkCdLeft = Math.max(0, e.atkCdLeft - dt);
      if (e.windup > 0) {
        // Telegraph resolves into the strike. The hero can dash/step out of
        // the danger zone during the wind-up to make the blow whiff.
        e.windup -= dt;
        if (e.windup <= 0) {
          const sdx = h.x - e.x, sdz = h.z - e.z;
          const sdist = Math.hypot(sdx, sdz);
          if (e.projectileSpeed && sdist > 100) {
            g.projectiles.push({
              kind: 'arrow',
              x: e.x, z: e.z, yOff: -60,
              vx: Math.sign(sdx) * e.projectileSpeed, vz: 0,
              angle: Math.sign(sdx) < 0 ? Math.PI : 0,
              dmg: e.atk, enemy: true, life: 1.5, color: '#a44',
            });
          } else if (sdist < e.atkRange + 34 && Math.abs(sdz) < 46) {
            damageHero(g, e.atk);
          }
          // else: the hero dodged — the blow finds empty air.
        }
      } else if (e.atkCdLeft <= 0 && dist < e.atkRange && Math.abs(dz) < 36) {
        e.atkCdLeft = e.atkCooldown * (0.85 + Math.random() * 0.3);
        e.windup = e.windupMax;                // begin the telegraph wind-up
        e.atkAnim = 0.4;                        // sprite lunge/draw animation
      }
    }
    compact(g.enemies, e => !(e.dead && g.time - e.deadT > 0.7));

    // Projectiles
    for (let i = 0; i < g.projectiles.length; i++) {
      const p = g.projectiles[i];
      p.x += p.vx * dt;
      p.z += (p.vz || 0) * dt;
      p.life -= dt;
      if (p.enemy) {
        if (Math.abs(p.x - h.x) < 28 && Math.abs(p.z - h.z) < 30 && h.y > -40) {
          damageHero(g, p.dmg);
          p.life = 0;
        }
      } else {
        for (let j = 0; j < g.enemies.length; j++) {
          const e = g.enemies[j];
          if (e.dead) continue;
          if (Math.abs(p.x - e.x) > (e.width || 60) / 2 + 6) continue;
          if (Math.abs(p.z - e.z) > 28) continue;
          damageEnemy(g, e, p.dmg, { stun: p.stun, knockback: p.knockback || 12, hitstop: 35 });
          if (!p.pierces) { p.life = 0; break; }
        }
      }
    }
    compact(g.projectiles, p => p.life > 0);

    // Items (pickup if close)
    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      it.bobT += dt;
      it.life -= dt;
      if (Math.abs(it.x - h.x) < 28 && Math.abs(it.z - h.z) < 30) {
        applyItem(g, it.key);
        it.life = 0;
      }
    }
    compact(g.items, it => it.life > 0);

    // VFX
    for (let i = 0; i < g.vfx.length; i++) g.vfx[i].t += dt;
    compact(g.vfx, fx => fx.t < fx.dur);

    // Particles (sparks, dust, debris, embers)
    for (let i = 0; i < g.particles.length; i++) {
      const p = g.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      if (p.vz) p.z += p.vz * dt;
      if (p.grav) p.vy -= GRAVITY * 0.5 * dt;     // p.vy is +up; gravity pulls it down
      p.y += p.vy * dt;
      if (p.y < 0) {
        if (p.bounce && p.vy < -30) { p.y = 0; p.vy = -p.vy * 0.42; p.vx *= 0.6; }
        else { p.y = 0; if (p.kind !== 'dust') p.life = Math.min(p.life, 0.06); }
      }
      if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
    }
    compact(g.particles, p => p.life > 0);

    // Ambient embers drifting up from the burning valley
    g.emberT -= dt;
    if (g.emberT <= 0 && g.particles.length < 200) {
      g.emberT = 0.16 + Math.random() * 0.22;
      spawnEmber(g);
    }

    // Screen-shake + zoom-punch + combo-counter decay
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 2.2);
    if (g.zoom > 1) g.zoom = Math.max(1, g.zoom - dt * 0.55);
    if (g.comboT > 0) { g.comboT -= dt; if (g.comboT <= 0) g.comboCount = 0; }
    if (g.comboPop > 0) g.comboPop -= dt;

    // Wave completion
    if (g.waveActive) {
      let alive = 0;
      for (let i = 0; i < g.enemies.length; i++) if (!g.enemies[i].dead) alive++;
      if (alive === 0) {
        g.waveActive = false;
        g.waveIdx++;
        h.hp = Math.min(h.hpMax, h.hp + h.hpMax * 0.08);
        if (g.waveIdx >= g.stage.waves.length) {
          g.stageComplete = true;
          pushBanner(g, 'Stage Cleared', 2.2);
          sfxBanner();
        }
      }
    }
  }

  // ── Single RAF: tick + render ──
  useEffect(() => {
    if (screen !== 'stage') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = createRenderer(canvas);
    rendererRef.current.resize(window.innerWidth, window.innerHeight);

    const onResize = () => {
      if (rendererRef.current) rendererRef.current.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    let lastT = performance.now();
    const loop = () => {
      const now = performance.now();
      let dt = (now - lastT) / 1000;
      lastT = now;
      if (dt > 0.06) dt = 0.06;
      const g = gameRef.current;
      if (g) {
        if (now >= g.hitStopUntil) {
          tick(g, dt);
        } else {
          for (let i = 0; i < g.vfx.length; i++) g.vfx[i].t += dt * 0.4;
          compact(g.vfx, fx => fx.t < fx.dur);
        }
        rendererRef.current.render(g);

        if (g.stageFailed) {
          setEndStats({ stageId: g.stageId, stageName: g.stage.name, kills: g.kills,
            coins: g.hero.coins, xp: g.hero.xp, score: g.score, cleared: false });
          setScreen('gameover');
        } else if (g.stageComplete) {
          const next = nextStageId(g.stageId);
          const s = { ...save };
          const totalCoins = (g.stage.rewards?.coin || 0) + g.hero.coins;
          const totalXp = (g.stage.rewards?.xp || 0) + g.hero.xp;
          s.coins = (s.coins || 0) + totalCoins;
          if (next && !s.unlocked.includes(next)) s.unlocked = [...s.unlocked, next];
          s.hero = chosenHeroId;
          persistSave(s); setSave(s);
          setEndStats({ stageId: g.stageId, stageName: g.stage.name, kills: g.kills,
            coins: totalCoins, xp: totalXp, score: g.score, cleared: true, nextId: next });
          setScreen('reward');
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
    };
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [screen, save, chosenHeroId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Cheap HUD ticker
  useEffect(() => {
    if (screen !== 'stage') return;
    const id = setInterval(() => setHudTick(t => t + 1), 125);
    return () => clearInterval(id);
  }, [screen]);

  // Sprite preload — only the Knights subset
  useEffect(() => { preloadKnightsSprites(); }, []);

  // Keyboard
  useEffect(() => {
    if (screen !== 'stage') return;
    const onDown = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft')  inputRef.current.left = true;
      if (k === 'd' || k === 'arrowright') inputRef.current.right = true;
      if (k === 'w' || k === 'arrowup')    inputRef.current.up = true;
      if (k === 's' || k === 'arrowdown')  inputRef.current.down = true;
      if (k === 'j' || k === 'x')          { if (!e.repeat) inputRef.current.attackEdge = true; }
      if (k === 'k' || k === 'z' || k === ' ') { if (!e.repeat) inputRef.current.jumpEdge = true; }
      if (k === 'l' || k === 'c')          { if (!e.repeat) inputRef.current.magicEdge = true; }
      if (k === 'shift')                   { if (!e.repeat) inputRef.current.dashEdge = true; }
      if (k === 'm') { setMuted(!isMuted()); setMutedState(isMuted()); }
      if (k === 'escape') setShowHowTo(s => !s);
    };
    const onUp = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft')  inputRef.current.left = false;
      if (k === 'd' || k === 'arrowright') inputRef.current.right = false;
      if (k === 'w' || k === 'arrowup')    inputRef.current.up = false;
      if (k === 's' || k === 'arrowdown')  inputRef.current.down = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [screen]);

  const heroDef = useMemo(() => getHero(chosenHeroId), [chosenHeroId]);
  const moves = useMemo(() => getMoves(heroDef.moveId), [heroDef]);

  return (
    <div className="knights-root">
      {screen === 'stage' && (<canvas ref={canvasRef} className="knights-canvas" />)}

      {screen === 'title' && (
        <div className="knights-overlay knights-title">
          <h1 className="knights-h1">Knights of Liangshan</h1>
          <p className="knights-subtitle">Three-One-Oh-Eight · Water Margin Arcade</p>
          <button className="knights-btn primary" onClick={() => { sfxClick(); setScreen('select'); }}>
            Insert Coin
          </button>
          <div className="knights-howto">
            <h3>Controls</h3>
            <ul>
              <li><b>WASD / Arrows</b> — move (8-direction on the floor)</li>
              <li><b>J / X</b> — attack (chain 4 hits)</li>
              <li><b>K / Z / Space</b> — jump (jump → attack = aerial)</li>
              <li><b>L / C</b> — special (costs HP, like the arcade)</li>
              <li><b>Shift</b> — dash · <b>M</b> — mute · <b>Esc</b> — pause</li>
            </ul>
            <p className="knights-hint">Smash barrels for food. Eat meat to heal. Brawl on.</p>
          </div>
        </div>
      )}

      {screen === 'select' && (
        <div className="knights-overlay knights-select">
          <h2>Choose Your Knight</h2>
          <div className="knights-hero-grid">
            {HEROES.map(hd => (
              <button key={hd.id}
                className={`knights-hero-card ${chosenHeroId === hd.id ? 'sel' : ''}`}
                onClick={() => { sfxClick(); setChosenHeroId(hd.id); }}>
                <div className="knights-hero-portrait" style={{ background: hd.portrait }}>{hd.name}</div>
                <div className="knights-hero-meta">
                  <div className="knights-hero-name">{hd.title}</div>
                  <p className="knights-hero-blurb">{hd.blurb}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="knights-moves">
            <div className="knights-moves-row">
              {moves.combo.map((m, i) => (
                <div key={i} className="knights-move-slot">
                  <div className="knights-move-num">{i + 1}</div>
                  <div className="knights-move-name">{m.name}</div>
                  <div className="knights-move-dmg">×{m.dmgMult.toFixed(1)}</div>
                </div>
              ))}
            </div>
            <div className="knights-moves-special">
              <div className="knights-move-slot ult">
                <div className="knights-move-num">SP</div>
                <div className="knights-move-name">{moves.magic.name}</div>
                <div className="knights-move-cost">−{Math.round(moves.magic.cost * 100)}% HP</div>
                <div className="knights-move-desc">{moves.magic.description}</div>
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: 16 }}>Choose Your Stage</h3>
          <div className="knights-stage-grid">
            {STAGES.map(s => {
              const locked = !(save.unlocked || []).includes(s.id);
              return (
                <button key={s.id}
                  className={`knights-stage-card ${stageId === s.id ? 'sel' : ''} ${locked ? 'locked' : ''}`}
                  disabled={locked}
                  onClick={() => { sfxClick(); setStageId(s.id); }}>
                  <div className="knights-stage-chap">ROUND {s.chapter}</div>
                  <div className="knights-stage-name">{s.name}</div>
                  <div className="knights-stage-waves">{s.waves.length} waves</div>
                  {locked && <div className="knights-stage-lock">LOCKED</div>}
                </button>
              );
            })}
          </div>

          <div className="knights-row" style={{ marginTop: 18, gap: 16 }}>
            <button className="knights-btn" onClick={() => { sfxClick(); setScreen('title'); }}>Back</button>
            <button className="knights-btn primary" onClick={() => { sfxClick(); setScreen('story'); }}>
              Fight!
            </button>
          </div>
        </div>
      )}

      {screen === 'story' && (
        <StoryScreen
          stageId={stageId}
          heroDef={heroDef}
          onBegin={() => { sfxClick(); startStage(stageId, chosenHeroId); }}
          onBack={() => { sfxClick(); setScreen('select'); }}
        />
      )}

      {screen === 'stage' && gameRef.current && (
        <StageHUD g={gameRef.current} heroDef={heroDef} moves={moves}
          tick={hudTick}
          muted={muted}
          onMute={() => { setMuted(!isMuted()); setMutedState(isMuted()); }}
          onPause={() => setShowHowTo(s => !s)}
          showHowTo={showHowTo}
          dismissHowTo={() => setShowHowTo(false)}
        />
      )}

      {screen === 'stage' && isTouch && <TouchControls inputRef={inputRef} />}

      {screen === 'reward' && endStats && (
        <div className="knights-overlay knights-reward">
          <h2>Round Cleared</h2>
          <h3>{endStats.stageName}</h3>
          {(() => {
            const st = STORY[endStats.stageId];
            const outro = st ? st.outro : [];
            const isFinal = !endStats.nextId;
            if (!outro.length && !isFinal) return null;
            return (
              <div className="kn-story-scroll kn-reward-scroll">
                {outro.map((ln, i) => (
                  <p className="kn-story-line" key={i} style={{ animationDelay: `${0.2 + i * 0.5}s` }}>{ln}</p>
                ))}
                {isFinal && FINALE_LINES.map((ln, i) => (
                  <p className="kn-story-line kn-finale" key={'f' + i}
                    style={{ animationDelay: `${0.2 + (outro.length + i) * 0.5}s` }}>{ln}</p>
                ))}
              </div>
            );
          })()}
          <div className="knights-reward-stats">
            <div>Kills: <b>{endStats.kills}</b></div>
            <div>Coins: <b>{endStats.coins}</b></div>
            <div>XP: <b>{endStats.xp}</b></div>
            <div>Score: <b>{endStats.score}</b></div>
          </div>
          <div className="knights-row" style={{ gap: 16, marginTop: 20 }}>
            <button className="knights-btn" onClick={() => { sfxClick(); setScreen('select'); }}>Lobby</button>
            {endStats.nextId && (
              <button className="knights-btn primary" onClick={() => {
                sfxClick();
                setStageId(endStats.nextId);
                startStage(endStats.nextId, chosenHeroId);
              }}>Next Round</button>
            )}
          </div>
        </div>
      )}

      {screen === 'gameover' && endStats && (
        <div className="knights-overlay knights-gameover">
          <h2>Continue?</h2>
          <p>The bandits dragged you off {endStats.stageName}.</p>
          <div className="knights-reward-stats">
            <div>Kills before falling: <b>{endStats.kills}</b></div>
            <div>Score: <b>{endStats.score}</b></div>
          </div>
          <div className="knights-row" style={{ gap: 16, marginTop: 20 }}>
            <button className="knights-btn" onClick={() => { sfxClick(); setScreen('select'); }}>Lobby</button>
            <button className="knights-btn primary" onClick={() => { sfxClick(); startStage(endStats.stageId, chosenHeroId); }}>
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StoryScreen({ stageId, heroDef, onBegin, onBack }) {
  const s = getStory(stageId);
  const lines = s.prologue ? [...PROLOGUE_LINES, ...s.intro] : s.intro;
  return (
    <div className="knights-overlay knights-story">
      <div className="kn-story-chapter">{s.chapter}</div>
      <h1 className="kn-story-zh">{s.titleZh}</h1>
      <div className="kn-story-title">{s.title}</div>
      <div className="kn-story-scroll">
        {lines.map((ln, i) => (
          <p className="kn-story-line" key={i} style={{ animationDelay: `${0.15 + i * 0.5}s` }}>{ln}</p>
        ))}
      </div>
      {heroDef && heroDef.opening && (
        <div className="kn-story-vow" style={{ animationDelay: `${0.15 + lines.length * 0.5}s` }}>
          <span className="kn-vow-mark" style={{ background: heroDef.portrait }}>{heroDef.name}</span>
          “{heroDef.opening}”
        </div>
      )}
      <div className="knights-row" style={{ gap: 16, marginTop: 22 }}>
        <button className="knights-btn" onClick={onBack}>Back</button>
        <button className="knights-btn primary" onClick={onBegin}>March Out ▶</button>
      </div>
    </div>
  );
}

// ── On-screen touch controls (phones / tablets) ──
// A fixed movement joystick (left) + action buttons (right) that write into
// the SAME inputRef the keyboard uses, so the game loop needs no changes.
function TouchControls({ inputRef }) {
  const joyRef = useRef(null);
  const joySt = useRef({ id: null, cx: 0, cy: 0, r: 50 });
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  const clearDirs = () => {
    const inp = inputRef.current;
    inp.left = inp.right = inp.up = inp.down = false;
  };
  const applyDir = (dx, dy) => {
    const inp = inputRef.current;
    const r = joySt.current.r;
    if (Math.hypot(dx, dy) < r * 0.28) { clearDirs(); return; }  // dead zone
    const nx = dx / r, ny = dy / r, dead = 0.34;
    inp.left = nx < -dead; inp.right = nx > dead;
    inp.up = ny < -dead;   inp.down = ny > dead;
  };
  const joyDown = (e) => {
    e.preventDefault();
    const rect = joyRef.current.getBoundingClientRect();
    joySt.current = {
      id: e.pointerId,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      r: rect.width / 2 - 6,
    };
    try { joyRef.current.setPointerCapture(e.pointerId); } catch { /* ok */ }
    joyMove(e);
  };
  const joyMove = (e) => {
    if (joySt.current.id !== e.pointerId) return;
    let dx = e.clientX - joySt.current.cx;
    let dy = e.clientY - joySt.current.cy;
    const r = joySt.current.r, mag = Math.hypot(dx, dy);
    if (mag > r) { dx = (dx / mag) * r; dy = (dy / mag) * r; }
    setThumb({ x: dx, y: dy });
    applyDir(dx, dy);
  };
  const joyUp = (e) => {
    if (joySt.current.id !== e.pointerId) return;
    joySt.current.id = null;
    setThumb({ x: 0, y: 0 });
    clearDirs();
  };

  const press = (field) => (e) => { e.preventDefault(); inputRef.current[field] = true; };
  // Attack: tap = one hit, hold = auto-chain. Capture the pointer so a finger
  // that slides off the button still delivers pointerup (no stuck auto-attack).
  const atkDown = (e) => {
    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch { /* ok */ }
    inputRef.current.attackHeld = true;
    inputRef.current.attackEdge = true;
  };
  const atkUp = (e) => { e.preventDefault(); inputRef.current.attackHeld = false; };

  return (
    <div className="kn-touch">
      <div className="kn-joy" ref={joyRef}
        onPointerDown={joyDown} onPointerMove={joyMove}
        onPointerUp={joyUp} onPointerCancel={joyUp}>
        <div className="kn-joy-thumb" style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }} />
      </div>
      <div className="kn-btns">
        <button className="kn-tbtn sp"  onPointerDown={press('magicEdge')}>絕</button>
        <button className="kn-tbtn dsh" onPointerDown={press('dashEdge')}>閃</button>
        <button className="kn-tbtn jmp" onPointerDown={press('jumpEdge')}>跳</button>
        <button className="kn-tbtn atk" onPointerDown={atkDown}
          onPointerUp={atkUp} onPointerCancel={atkUp}>攻</button>
      </div>
    </div>
  );
}

function StageHUD({ g, heroDef, moves, muted, onMute, onPause, showHowTo, dismissHowTo }) {
  const h = g.hero;
  return (
    <>
      <div className="knights-hud knights-hud-tl">
        <div className="knights-hp-row">
          <div className="knights-hero-chip" style={{ background: heroDef.portrait }}>
            {heroDef.name}
          </div>
          <div className="knights-bars">
            <div className="knights-bar hp">
              <div className="knights-bar-fill" style={{ width: `${100 * h.hp / h.hpMax}%` }} />
              <div className="knights-bar-text">{Math.max(0, Math.round(h.hp))} / {h.hpMax}</div>
            </div>
            <div className="knights-stats">
              <span className="knights-coin">◯ {h.coins}</span>
              <span className="knights-xp">XP {h.xp}</span>
              <span className="knights-combo">Combo {h.comboStep > 0 ? h.comboStep : '–'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="knights-hud knights-hud-tr">
        <div className="knights-stage-label">{g.stage.name}</div>
        <div className="knights-row" style={{ gap: 6 }}>
          <button className="knights-btn small" onClick={onMute}>{muted ? '🔇' : '🔊'}</button>
          <button className="knights-btn small" onClick={onPause}>Pause</button>
        </div>
      </div>

      <div className="knights-hud knights-hud-bottom">
        <div className="knights-skill-card sp" title={moves.magic.description}>
          <div className="knights-skill-num">SP</div>
          <div className="knights-skill-name">{moves.magic.name}</div>
          <div className="knights-skill-cost">−{Math.round(moves.magic.cost * 100)}% HP</div>
        </div>
        {moves.combo.map((m, i) => (
          <div key={i} className="knights-skill-card" style={{ borderColor: i === (h.comboStep || 0) % moves.combo.length ? '#ffd676' : '' }}>
            <div className="knights-skill-num">{i + 1}</div>
            <div className="knights-skill-name">{m.name}</div>
            <div className="knights-skill-cost">×{m.dmgMult.toFixed(1)}</div>
          </div>
        ))}
      </div>

      {showHowTo && (
        <div className="knights-modal" onClick={dismissHowTo}>
          <div className="knights-modal-card" onClick={e => e.stopPropagation()}>
            <h3>Controls</h3>
            <ul>
              <li><b>WASD / Arrows</b> — 8-direction floor movement</li>
              <li><b>J / X</b> — attack (chain combo)</li>
              <li><b>K / Z / Space</b> — jump (+ attack = aerial)</li>
              <li><b>L / C</b> — special (costs HP)</li>
              <li><b>Shift</b> — dash</li>
              <li><b>M</b> — mute · <b>Esc</b> — pause</li>
            </ul>
            <p style={{ fontStyle: 'italic', color: '#caa07a' }}>
              Pick up meat / wine / scrolls from barrels and felled foes.
            </p>
            <button className="knights-btn primary" onClick={dismissHowTo}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
