// ── Turn-based battle screen (轩辕剑·天之痕-style, original code) ──
// Party of up to 3 vs an enemy group. Round order by speed; hero turns open
// a command menu: Attack / Arts (MP) / Items / Defend / 炼妖 Capture.
// Five-phase element math, charms and relics all apply. Victory pays XP,
// coins and pot spirits; capture guarantees a spirit and ends that foe.
import { useEffect, useRef, useState } from 'react';
import { drawSprite } from '../scene2d/sprites.js';
import { ELEMENTS, elementMult, charmDealt, charmTaken } from './elements.js';
import { makeEnemy } from './enemies.js';
import { sfxHit, sfxCrit, sfxKill, sfxClick, sfxBanner, sfxPickup } from '../audio/sfx.js';

// Battle backdrops per stage theme (sky → ground)
const BG = {
  dusk:  ['#2a1a2e', '#6a4830', '#3a2418'],
  night: ['#070b16', '#2b3143', '#171b29'],
  mist:  ['#190f28', '#3b2f47', '#211a2b'],
  dream: ['#2a1b40', '#5c4660', '#362a40'],
};

const rand = (a, b) => a + Math.random() * (b - a);

// Build a hero's battle-skill list from their kit + unlocked arts.
function skillsOf(member) {
  const kit = member.kit;
  const list = [];
  if (member.skills.dashAttack) list.push({ id: 'dash', zh: '疾風斬', name: kit.dashAttack.name, mult: kit.dashAttack.dmgMult, mp: 20, target: 'one' });
  if (member.skills.jumpAttack) list.push({ id: 'jump', zh: '飛燕落', name: kit.jumpAttack.name, mult: kit.jumpAttack.dmgMult, mp: 26, target: 'one' });
  if (member.skills.combo4) {
    const fin = kit.combo[kit.combo.length - 1];
    list.push({ id: 'fourth', zh: '第四式', name: fin.name, mult: fin.dmgMult + 0.5, mp: 34, target: 'one' });
  }
  const m = kit.magic;
  list.push({
    id: 'magic', zh: '仙術', name: m.name,
    mult: (m.dmgMult || 1.2) * (member.skills.empower ? 1.3 : 1) * (member.relicSpDmg || 1),
    mp: Math.round(40 * (member.relicSpCost || 1)), target: 'all', color: m.color,
    heal: m.self ? 0.30 : 0,      // self-buff specials become a party heal
  });
  return list;
}

export default function Battle({ g, battle, onEnd }) {
  const canvasRef = useRef(null);
  const stRef = useRef(null);                  // mutable battle state
  const [, force] = useState(0);
  const rerender = () => force(x => x + 1);

  // ── one-time setup ──
  if (!stRef.current) {
    const party = g.party.map((m, i) => ({
      kind: 'hero', ref: m, name: m.defName, sprite: m.sprite, el: m.el,
      slot: i, defend: false, dead: m.hp <= 0,
      ax: 0, ay: 0, flash: 0,                  // anim offsets
    }));
    const foes = [];
    battle.group.forEach(([type, count]) => {
      for (let n = 0; n < count && foes.length < 4; n++) {
        const e = makeEnemy(type, battle.chapter || 1);
        e.atk = Math.round(e.atk * 3.2);       // turn-based rebalance
        if (battle.bossSprite && e.boss) { e.sprite = battle.bossSprite; e.name = battle.bossName || e.name; }
        foes.push({
          kind: 'foe', ref: e, name: e.name, sprite: e.sprite, el: e.el,
          hp: e.hp, hpMax: e.hpMax, spd: e.moveSpeed, boss: e.boss,
          slot: foes.length, defend: false, dead: false, ax: 0, ay: 0, flash: 0,
        });
      }
    });
    stRef.current = {
      party, foes,
      reinforcements: battle.reinforcements || [],
      phase: battle.intro && battle.intro.length ? 'intro' : 'round',
      introIdx: 0,
      queue: [], turn: null,
      menu: null, submenu: null, pendingSkill: null,
      floaters: [], banner: battle.name || '', bannerT: 1.6,
      shake: 0, time: 0,
      results: { xp: 0, coins: 0, spirits: {}, captured: 0, kills: 0 },
      over: false,
      log: '',
    };
  }
  const st = stRef.current;

  const aliveParty = () => st.party.filter(p => !p.dead);
  const aliveFoes = () => st.foes.filter(f => !f.dead);

  function floater(x, y, text, color, big = false) {
    st.floaters.push({ x, y, text, color, t: 0, big });
  }

  function slotPos(c) {
    const W = window.innerWidth, H = Math.min(window.innerHeight * 0.62, 560);
    if (c.kind === 'hero') {
      return { x: W * 0.72 + c.slot * W * 0.075, y: H * 0.52 + c.slot * H * 0.17 };
    }
    const col = c.slot % 2, row = (c.slot / 2) | 0;
    return { x: W * 0.24 - col * W * 0.085, y: H * 0.45 + row * H * 0.24 + col * H * 0.10 };
  }

  // ── damage helpers ──
  function heroAtkValue(m) { return m.atk * (m.atkBuff || 1); }
  function hitFoe(member, foe, mult) {
    let em = elementMult(member.el, foe.el);
    if (member.relicMinEl && em < member.relicMinEl) em = member.relicMinEl;
    const crit = Math.random() < member.critChance;
    let dmg = heroAtkValue(member) * mult * em * charmDealt(g.charms, foe.el) * rand(0.92, 1.08);
    if (crit) dmg *= 1.8;
    if (foe.defend) dmg *= 0.55;
    dmg = Math.max(1, Math.round(dmg));
    foe.hp -= dmg;
    foe.flash = 0.35;
    st.shake = Math.min(1, st.shake + (crit ? 0.5 : 0.25));
    const p = slotPos(foe);
    floater(p.x, p.y - 120, `${dmg}`, crit ? '#fff076' : em > 1 ? '#b8ffb0' : em < 1 ? '#bfbfbf' : '#ffd0d0', crit);
    if (crit) sfxCrit(); else sfxHit();
    if (foe.hp <= 0) killFoe(foe);
    return dmg;
  }
  function killFoe(foe, captured = false) {
    foe.dead = true;
    st.results.kills++;
    const e = foe.ref;
    const xp = Math.round((e.xp || 6) * g.fortune * (captured ? 0.5 : 1));
    st.results.xp += xp;
    st.results.coins += Math.round(xp * 0.6);
    if (!foe.boss && foe.el) {
      const got = captured || Math.random() < 0.3;
      if (got) {
        st.results.spirits[foe.el] = (st.results.spirits[foe.el] || 0) + 1;
        const p = slotPos(foe);
        floater(p.x, p.y - 150, `壺 +1 ${ELEMENTS[foe.el].zh}靈`, ELEMENTS[foe.el].color);
        sfxPickup('scroll');
      }
    }
    if (!captured) sfxKill();
  }
  function hitHero(foe, member) {
    const pm = member.ref;
    let dmg = foe.ref.atk * elementMult(foe.el, pm.el) * charmTaken(g.charms, foe.el) * (pm.relicTaken || 1) * rand(0.9, 1.1);
    if (member.defend) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    pm.hp -= dmg;
    member.flash = 0.35;
    st.shake = Math.min(1, st.shake + 0.3);
    const p = slotPos(member);
    floater(p.x, p.y - 130, `${dmg}`, '#ff9c8a');
    sfxHit();
    if (pm.hp <= 0) { pm.hp = 0; member.dead = true; }
  }

  // ── turn engine ──
  function buildQueue() {
    st.queue = [...aliveParty(), ...aliveFoes()]
      .sort((a, b) => (b.kind === 'hero' ? b.ref.moveSpeed : b.spd) - (a.kind === 'hero' ? a.ref.moveSpeed : a.spd));
  }
  function nextTurn() {
    if (st.over) return;
    // victory / reinforcements / defeat checks
    if (!aliveFoes().length) {
      if (st.reinforcements.length) {
        const grp = st.reinforcements.shift();
        grp.forEach(([type, count]) => {
          for (let n = 0; n < count && st.foes.filter(f => !f.dead).length < 4; n++) {
            const e = makeEnemy(type, battle.chapter || 1);
            e.atk = Math.round(e.atk * 3.2);
            const deadSlots = st.foes.filter(f => f.dead).map(f => f.slot);
            const slot = deadSlots.length ? deadSlots.shift() : st.foes.length;
            st.foes = st.foes.filter(f => !f.dead || f.slot !== slot);
            st.foes.push({ kind: 'foe', ref: e, name: e.name, sprite: e.sprite, el: e.el,
              hp: e.hp, hpMax: e.hpMax, spd: e.moveSpeed, boss: e.boss,
              slot, defend: false, dead: false, ax: 0, ay: 0, flash: 0 });
          }
        });
        st.banner = '敵方增援 — reinforcements!';
        st.bannerT = 1.5;
        sfxBanner();
        buildQueue();
      } else {
        return finish(true);
      }
    }
    if (!aliveParty().length) return finish(false);

    if (!st.queue.length) buildQueue();
    const c = st.queue.shift();
    if (!c || c.dead) return nextTurn();
    st.turn = c;
    c.defend = false;
    if (c.kind === 'hero') {
      c.ref.mp = Math.min(c.ref.mpMax, c.ref.mp + 12);   // regen on turn start
      st.menu = 'main'; st.submenu = null; st.pendingSkill = null;
      rerender();
    } else {
      st.menu = null;
      setTimeout(() => foeAct(c), 550);
      rerender();
    }
  }
  function finish(victory) {
    if (st.over) return;
    st.over = true;
    st.menu = null;
    st.banner = victory ? '勝利 — Victory!' : '全滅 — the party falls…';
    st.bannerT = 2.0;
    sfxBanner();
    setTimeout(() => onEnd({ victory, ...st.results }), victory ? 1500 : 1900);
    rerender();
  }

  function animateStrike(actor, target, after) {
    const a = slotPos(actor), t = slotPos(target);
    const dx = (t.x - a.x) * 0.55, dy = (t.y - a.y) * 0.55;
    const start = performance.now();
    const dur = 340;
    const step = (now) => {
      const k = Math.min(1, (now - start) / dur);
      const lunge = k < 0.5 ? k * 2 : (1 - k) * 2;
      actor.ax = dx * lunge; actor.ay = dy * lunge;
      if (k >= 0.5 && !actor._hitDone) { actor._hitDone = true; after(); rerender(); }
      if (k < 1) requestAnimationFrame(step);
      else { actor.ax = 0; actor.ay = 0; actor._hitDone = false; setTimeout(nextTurn, 420); }
    };
    requestAnimationFrame(step);
  }

  function foeAct(foe) {
    if (st.over || foe.dead) return nextTurn();
    const targets = aliveParty();
    if (!targets.length) return finish(false);
    const target = targets[(Math.random() * targets.length) | 0];
    animateStrike(foe, target, () => hitHero(foe, target));
  }

  // ── player commands ──
  function cmdAttack(target) {
    const c = st.turn;
    st.menu = null; rerender();
    animateStrike(c, target, () => hitFoe(c.ref, target, 1.0, false));
  }
  function cmdSkill(skill, target) {
    const c = st.turn;
    c.ref.mp -= skill.mp;
    st.menu = null; rerender();
    if (skill.heal) {                          // rally-type art: heal the party
      st.party.forEach(p => {
        if (p.dead) return;
        const amt = Math.round(p.ref.hpMax * skill.heal);
        p.ref.hp = Math.min(p.ref.hpMax, p.ref.hp + amt);
        const pos = slotPos(p);
        floater(pos.x, pos.y - 130, `+${amt}`, '#a0ff90');
      });
      sfxPickup('heal');
      setTimeout(nextTurn, 700);
      return;
    }
    if (skill.target === 'all') {
      st.shake = Math.min(1, st.shake + 0.5);
      st.flashColor = skill.color || '#ffe6a0';
      st.flashT = 0.4;
      aliveFoes().forEach(f => hitFoe(c.ref, f, skill.mult * 0.8, true));
      sfxBanner();
      setTimeout(nextTurn, 800);
    } else {
      animateStrike(c, target, () => hitFoe(c.ref, target, skill.mult, true));
    }
  }
  function cmdItem(key) {
    const c = st.turn;
    g.inventory[key]--;
    st.menu = null; rerender();
    const pm = c.ref;
    if (key === 'meat') {
      const amt = Math.round(pm.hpMax * 0.4);
      pm.hp = Math.min(pm.hpMax, pm.hp + amt);
      floater(slotPos(c).x, slotPos(c).y - 130, `+${amt}`, '#a0ff90');
    } else if (key === 'wine') {
      pm.mp = Math.min(pm.mpMax, pm.mp + 50);
      floater(slotPos(c).x, slotPos(c).y - 130, '+50 MP', '#9cc8ff');
    } else if (key === 'scroll') {
      st.party.forEach(p => { if (!p.dead) p.ref.atkBuff = 1.2; });
      floater(slotPos(c).x, slotPos(c).y - 130, 'ATK ▲ +20%', '#ffd676');
    }
    sfxPickup(key === 'meat' ? 'heal' : 'scroll');
    setTimeout(nextTurn, 550);
  }
  function cmdDefend() {
    const c = st.turn;
    c.defend = true;
    c.ref.mp = Math.min(c.ref.mpMax, c.ref.mp + 15);
    floater(slotPos(c).x, slotPos(c).y - 120, '防禦', '#9cc8ff');
    st.menu = null; rerender();
    sfxClick();
    setTimeout(nextTurn, 450);
  }
  function cmdCapture(target) {
    st.menu = null; rerender();
    st.results.captured++;
    const p = slotPos(target);
    floater(p.x, p.y - 110, `炼妖 — ${target.name} refined!`, '#c9a0ff', true);
    killFoe(target, true);
    target.capturedFx = 1;
    sfxPickup('scroll');
    setTimeout(nextTurn, 750);
  }

  // ── render loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0, last = performance.now();
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = Math.min(window.innerHeight * 0.62, 560);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      st.time += dt;
      if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 2.4);
      if (st.bannerT > 0) st.bannerT -= dt;
      if (st.flashT > 0) st.flashT -= dt;
      const W = canvas.width, H = canvas.height;
      const bg = BG[battle.theme] || BG.dusk;

      ctx.save();
      if (st.shake > 0.01) {
        const amp = st.shake * st.shake * 9;
        ctx.translate(rand(-amp, amp), rand(-amp, amp));
      }
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, bg[0]); grad.addColorStop(0.55, bg[1]); grad.addColorStop(1, bg[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      // ground line
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-20, H * 0.86, W + 40, H * 0.2);

      const drawC = (c) => {
        if (c.dead && !c.capturedFx) return;
        if (c.flash > 0) c.flash -= dt;
        const p = slotPos(c);
        const bob = Math.sin(st.time * 2 + c.slot * 1.7) * 3;
        const isTurn = st.turn === c && !st.over;
        let alpha = 1, scale = c.boss ? 1.05 : 0.85;
        if (c.capturedFx) {
          c.capturedFx = Math.max(0, c.capturedFx - dt * 1.4);
          alpha = c.capturedFx;
          scale *= 0.4 + c.capturedFx * 0.6;
        }
        // shadow
        ctx.save();
        ctx.globalAlpha = 0.3 * alpha;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(p.x + c.ax, p.y + 4, 34, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = alpha;
        drawSprite(ctx, c.sprite, p.x + c.ax, p.y + c.ay - bob, {
          flip: c.kind === 'foe', anchorY: 'bottom', scale,
        });
        ctx.restore();
        if (c.flash > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(0.5, c.flash * 1.8);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = c.kind === 'foe' ? '#ffe0c0' : '#ff8080';
          ctx.beginPath();
          ctx.ellipse(p.x + c.ax, p.y - 60, 34, 62, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // turn arrow
        if (isTurn) {
          ctx.fillStyle = '#ffd676';
          const ty = p.y - 148 + Math.sin(st.time * 5) * 4;
          ctx.beginPath();
          ctx.moveTo(p.x - 8, ty); ctx.lineTo(p.x + 8, ty); ctx.lineTo(p.x, ty + 11);
          ctx.closePath(); ctx.fill();
        }
        // foe hp bar + element
        if (c.kind === 'foe') {
          const bw = c.boss ? 92 : 56;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(p.x - bw / 2 - 1, p.y - 136, bw + 2, 7);
          ctx.fillStyle = c.boss ? '#c44' : '#d77';
          ctx.fillRect(p.x - bw / 2, p.y - 135, bw * Math.max(0, c.hp / c.hpMax), 5);
          const meta = ELEMENTS[c.el];
          if (meta) {
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.beginPath(); ctx.arc(p.x - bw / 2 - 12, p.y - 132, 8, 0, 7); ctx.fill();
            ctx.strokeStyle = meta.color; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = meta.color;
            ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(meta.zh, p.x - bw / 2 - 12, p.y - 131);
            ctx.textBaseline = 'alphabetic';
          }
          // capture hint
          if (!c.boss && c.hp / c.hpMax < 0.25) {
            ctx.fillStyle = '#c9a0ff';
            ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
            ctx.fillText('可炼', p.x + bw / 2 + 16, p.y - 128);
          }
        }
      };
      st.foes.forEach(drawC);
      st.party.forEach(drawC);

      // floaters
      for (const f of st.floaters) {
        f.t += dt;
        ctx.font = `bold ${f.big ? 26 : 17}px system-ui`;
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(f.text, f.x, f.y - f.t * 46);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - f.t * 46);
        ctx.globalAlpha = 1;
      }
      st.floaters = st.floaters.filter(f => f.t < 1.1);

      // skill flash
      if (st.flashT > 0) {
        ctx.globalAlpha = st.flashT * 1.4;
        ctx.fillStyle = st.flashColor || '#fff';
        ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      // banner
      if (st.bannerT > 0 && st.banner) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, st.bannerT * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 30px system-ui';
        ctx.textAlign = 'center';
        const m = ctx.measureText(st.banner);
        ctx.fillRect(W / 2 - m.width / 2 - 22, 26, m.width + 44, 48);
        ctx.fillStyle = '#fff8c4';
        ctx.fillText(st.banner, W / 2, 59);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // kick off the engine
    if (st.phase === 'round' && !st.turn) nextTurn();

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── DOM UI ──
  const turnHero = st.turn && st.turn.kind === 'hero' && !st.over ? st.turn : null;
  const skills = turnHero ? skillsOf(turnHero.ref) : [];
  const captureTargets = aliveFoes().filter(f => !f.boss && f.hp / f.hpMax < 0.25);

  return (
    <div className="kn-battle">
      <canvas ref={canvasRef} className="kn-battle-canvas" />

      {/* intro dialog (boss confrontations) */}
      {st.phase === 'intro' && (
        <div className="kn-btl-dialog" onClick={() => {
          sfxClick();
          st.introIdx++;
          if (st.introIdx >= battle.intro.length) { st.phase = 'round'; nextTurn(); }
          rerender();
        }}>
          <div className="kn-btl-dialog-name">{battle.intro[st.introIdx].name}</div>
          <div className="kn-btl-dialog-text">{battle.intro[st.introIdx].text}</div>
          <div className="kn-btl-dialog-hint">tap ▸</div>
        </div>
      )}

      {/* party status panels */}
      <div className="kn-btl-party">
        {st.party.map((p, i) => (
          <div key={i} className={`kn-btl-member ${p.dead ? 'down' : ''} ${st.turn === p ? 'active' : ''}`}>
            <div className="kn-btl-mname">
              <span style={{ color: ELEMENTS[p.el]?.color }}>{ELEMENTS[p.el]?.zh}</span> {p.name}
              <span className="kn-btl-lv"> LV{p.ref.level}</span>
            </div>
            <div className="kn-btl-bar hp"><div style={{ width: `${100 * Math.max(0, p.ref.hp) / p.ref.hpMax}%` }} /></div>
            <div className="kn-btl-bartext">{Math.max(0, Math.round(p.ref.hp))}/{p.ref.hpMax}</div>
            <div className="kn-btl-bar mp"><div style={{ width: `${100 * p.ref.mp / p.ref.mpMax}%` }} /></div>
            <div className="kn-btl-bartext mp">{Math.round(p.ref.mp)} MP</div>
          </div>
        ))}
      </div>

      {/* command menu */}
      {turnHero && st.menu === 'main' && (
        <div className="kn-btl-menu">
          <div className="kn-btl-whose">{turnHero.name}'s turn</div>
          <div className="kn-btl-cmds">
            <button className="kn-btl-cmd atk" onClick={() => { sfxClick(); st.menu = 'target-attack'; rerender(); }}>攻擊 Attack</button>
            <button className="kn-btl-cmd art" onClick={() => { sfxClick(); st.menu = 'skills'; rerender(); }}>仙術 Arts</button>
            <button className="kn-btl-cmd itm" onClick={() => { sfxClick(); st.menu = 'items'; rerender(); }}>物品 Items</button>
            <button className="kn-btl-cmd def" onClick={cmdDefend}>防禦 Defend</button>
            <button className="kn-btl-cmd cap" disabled={!captureTargets.length}
              title="Refine a weakened foe (below 25% HP) into the pot"
              onClick={() => { sfxClick(); st.menu = 'target-capture'; rerender(); }}>炼妖 Capture</button>
          </div>
        </div>
      )}
      {turnHero && st.menu === 'skills' && (
        <div className="kn-btl-menu">
          <div className="kn-btl-whose">仙術 — Arts</div>
          <div className="kn-btl-cmds">
            {skills.map(sk => (
              <button key={sk.id} className="kn-btl-cmd art" disabled={turnHero.ref.mp < sk.mp}
                onClick={() => {
                  sfxClick();
                  if (sk.target === 'all' || sk.heal) cmdSkill(sk, null);
                  else { st.pendingSkill = sk; st.menu = 'target-skill'; rerender(); }
                }}>
                {sk.zh} {sk.name} <span className="kn-btl-mp">{sk.mp}MP</span>
              </button>
            ))}
            <button className="kn-btl-cmd back" onClick={() => { sfxClick(); st.menu = 'main'; rerender(); }}>◂ Back</button>
          </div>
        </div>
      )}
      {turnHero && st.menu === 'items' && (
        <div className="kn-btl-menu">
          <div className="kn-btl-whose">物品 — Items</div>
          <div className="kn-btl-cmds">
            <button className="kn-btl-cmd itm" disabled={!g.inventory.meat} onClick={() => cmdItem('meat')}>
              🍖 Meat ×{g.inventory.meat} <span className="kn-btl-mp">heal 40%</span>
            </button>
            <button className="kn-btl-cmd itm" disabled={!g.inventory.wine} onClick={() => cmdItem('wine')}>
              🍶 Wine ×{g.inventory.wine} <span className="kn-btl-mp">+50 MP</span>
            </button>
            <button className="kn-btl-cmd itm" disabled={!g.inventory.scroll} onClick={() => cmdItem('scroll')}>
              巻 Scroll ×{g.inventory.scroll} <span className="kn-btl-mp">party ATK ▲</span>
            </button>
            <button className="kn-btl-cmd back" onClick={() => { sfxClick(); st.menu = 'main'; rerender(); }}>◂ Back</button>
          </div>
        </div>
      )}
      {turnHero && (st.menu === 'target-attack' || st.menu === 'target-skill' || st.menu === 'target-capture') && (
        <div className="kn-btl-menu">
          <div className="kn-btl-whose">
            {st.menu === 'target-capture' ? 'Refine which spirit?' : 'Strike which foe?'}
          </div>
          <div className="kn-btl-cmds">
            {(st.menu === 'target-capture' ? captureTargets : aliveFoes()).map(f => (
              <button key={f.slot} className="kn-btl-cmd tgt" onClick={() => {
                sfxClick();
                if (st.menu === 'target-attack') cmdAttack(f);
                else if (st.menu === 'target-skill') cmdSkill(st.pendingSkill, f);
                else cmdCapture(f);
              }}>
                <span style={{ color: ELEMENTS[f.el]?.color }}>{ELEMENTS[f.el]?.zh}</span> {f.name}
                <span className="kn-btl-mp">{Math.max(0, Math.round(100 * f.hp / f.hpMax))}%</span>
              </button>
            ))}
            <button className="kn-btl-cmd back" onClick={() => { sfxClick(); st.menu = 'main'; rerender(); }}>◂ Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
