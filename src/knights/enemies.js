// ── Enemy archetypes ──
// Stats shaped for a beat-em-up: lower HP per mob (you face 4-8 on screen),
// higher movement so they crowd you, telegraphed attacks. AI: charge,
// kite (archer), rush (berserker), boss (mixed).
export const ENEMIES = {
  raider:    { name: 'Bandit',         sprite: 'enemy/raider',    drop: 'trash',
    hp: 95,  atk: 13, moveSpeed: 95,  atkRange: 70,  atkCooldown: 1.5,
    width: 56, height: 88, color: '#c66', ai: 'charge', xp: 6 },
  scout:     { name: 'Scout',          sprite: 'enemy/scout',     drop: 'trash',
    hp: 70,  atk: 10, moveSpeed: 135, atkRange: 60,  atkCooldown: 1.2,
    width: 50, height: 84, color: '#caa', ai: 'charge', xp: 5 },
  archer:    { name: 'Bandit Archer',  sprite: 'enemy/archer',    drop: 'tough',
    hp: 80,  atk: 15, moveSpeed: 65,  atkRange: 360, atkCooldown: 2.0,
    projectileSpeed: 340, width: 54, height: 88, color: '#a86', ai: 'kite', xp: 8 },
  brute:     { name: 'Brute',          sprite: 'enemy/berserker', drop: 'tough',
    hp: 170, atk: 19, moveSpeed: 140, atkRange: 76,  atkCooldown: 1.0,
    width: 64, height: 96, color: '#a44', ai: 'rush', xp: 12 },
  halberd:   { name: 'Halberdier',     sprite: 'enemy/guard',     drop: 'tough',
    hp: 200, atk: 17, moveSpeed: 75,  atkRange: 130, atkCooldown: 1.6,
    width: 64, height: 100, color: '#777', ai: 'charge', reach: true, xp: 14 },
  captain:   { name: 'Captain Zhao',   sprite: 'enemy/captain',   drop: 'boss',
    hp: 1600, atk: 32, moveSpeed: 95, atkRange: 110, atkCooldown: 1.2,
    width: 92, height: 132, color: '#933', ai: 'boss', boss: true, xp: 80 },
  warlord:   { name: 'Luan Tingyu',    sprite: 'enemy/warlord',   drop: 'boss',
    hp: 2800, atk: 44, moveSpeed: 85, atkRange: 120, atkCooldown: 1.4,
    width: 110, height: 148, color: '#511', ai: 'boss', boss: true, xp: 140 },
  sorcerer:  { name: 'Gao Lian',       sprite: 'enemy/warlord',   drop: 'boss',
    hp: 3400, atk: 38, moveSpeed: 70, atkRange: 480, atkCooldown: 1.3,
    projectileSpeed: 300, width: 96, height: 140, color: '#629',
    ai: 'boss-kite', boss: true, xp: 220 },
};

let _eid = 0;
export function makeEnemy(typeId, level = 1) {
  const t = ENEMIES[typeId] || ENEMIES.raider;
  const scale = 1 + (level - 1) * 0.12;
  return {
    id: ++_eid,
    typeId, name: t.name, sprite: t.sprite,
    hp: Math.round(t.hp * scale), hpMax: Math.round(t.hp * scale),
    atk: Math.round(t.atk * scale), moveSpeed: t.moveSpeed,
    atkRange: t.atkRange, atkCooldown: t.atkCooldown, atkCdLeft: 0.4 + Math.random() * 0.6,
    width: t.width, height: t.height, color: t.color,
    ai: t.ai, boss: !!t.boss, drop: t.drop,
    projectileSpeed: t.projectileSpeed || 0, reach: !!t.reach,
    x: 0, z: 0, vx: 0, vz: 0, facing: -1,
    hitFlash: 0, stun: 0, kbVx: 0, kbVz: 0, atkAnim: 0,
    // Telegraphed attack wind-up — gives the player a beat to dodge.
    windup: 0, windupMax: t.projectileSpeed ? 0.5 : t.boss ? 0.45 : (t.ai === 'rush' ? 0.34 : 0.3),
    launched: 0, vy: 0, y: 0,                   // y = airborne offset
    dead: false, deadT: 0,
    deathY: 0, deathVel: 0, deathSpin: 0, deathVr: 0, deathFade: 0,
    bobPhase: Math.random() * Math.PI * 2,
    xp: t.xp,
  };
}
