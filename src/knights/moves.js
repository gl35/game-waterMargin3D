// ── Movesets ──
// Each move is a single attack action: hitbox geometry, damage multiplier,
// hitstop, knockback. A "combo" is a fixed string of moves indexed by
// the hero's current combo step (0..N-1). Pressing attack while comboTimer > 0
// advances to the next step; otherwise the chain resets to 0.
//
// Geometry coords are in WORLD UNITS relative to the hero:
//   xRange: forward reach
//   zRange: half-band of depth that the hit covers (≤ 30 keeps it tight)

// 4-hit ground combo, 1 dash attack, 1 jump attack, 1 special per move-id.
const MOVES = {
  captain: {
    combo: [
      { name: 'jab',   xRange: 100, zRange: 36, dmgMult: 1.0, dur: 0.16, hitstop: 30, knockback: 8 },
      { name: 'cross', xRange: 105, zRange: 36, dmgMult: 1.1, dur: 0.18, hitstop: 35, knockback: 10 },
      { name: 'slash', xRange: 130, zRange: 40, dmgMult: 1.4, dur: 0.22, hitstop: 45, knockback: 18 },
      { name: 'launch',xRange: 110, zRange: 42, dmgMult: 1.7, dur: 0.30, hitstop: 70, knockback: 60, launches: true },
    ],
    dashAttack: { name: 'shoulder', xRange: 130, zRange: 38, dmgMult: 1.5, dur: 0.22, hitstop: 50, knockback: 80 },
    jumpAttack: { name: 'drop',     xRange: 110, zRange: 50, dmgMult: 1.6, dur: 0.24, hitstop: 50, knockback: 30, downward: true },
    magic: { name: 'Heaven\'s Rally', cost: 0.10, range: 320, zRange: 200, hits: 8,
      dmgMult: 0.8, knockback: 50, hitstop: 60, color: '#ffd07a',
      description: 'A shockwave ring blasts every foe near you.' },
  },
  spear: {
    combo: [
      { name: 'thrust1', xRange: 150, zRange: 28, dmgMult: 1.0, dur: 0.14, hitstop: 25, knockback: 6 },
      { name: 'thrust2', xRange: 160, zRange: 28, dmgMult: 1.1, dur: 0.15, hitstop: 28, knockback: 8 },
      { name: 'sweep',   xRange: 130, zRange: 50, dmgMult: 1.3, dur: 0.22, hitstop: 40, knockback: 20 },
      { name: 'pierce',  xRange: 200, zRange: 26, dmgMult: 1.8, dur: 0.28, hitstop: 65, knockback: 50, pierces: true },
    ],
    dashAttack: { name: 'lance', xRange: 220, zRange: 28, dmgMult: 1.8, dur: 0.22, hitstop: 55, knockback: 50, pierces: true },
    jumpAttack: { name: 'stab',  xRange: 130, zRange: 36, dmgMult: 1.5, dur: 0.20, hitstop: 45, knockback: 30, downward: true },
    magic: { name: 'Dragon\'s Coil', cost: 0.08, range: 700, zRange: 60, hits: 4,
      dmgMult: 1.8, knockback: 80, hitstop: 70, color: '#c2ddff', beam: true,
      description: 'A coiling spear-dragon pierces the whole row.' },
  },
  berserker: {
    combo: [
      { name: 'haymaker', xRange: 110, zRange: 40, dmgMult: 1.3, dur: 0.22, hitstop: 50, knockback: 25 },
      { name: 'cleave',   xRange: 110, zRange: 44, dmgMult: 1.4, dur: 0.24, hitstop: 55, knockback: 28 },
      { name: 'uppercut', xRange: 100, zRange: 40, dmgMult: 1.7, dur: 0.30, hitstop: 60, knockback: 35, launches: true },
      { name: 'slam',     xRange: 130, zRange: 80, dmgMult: 2.2, dur: 0.42, hitstop: 110, knockback: 80, aoe: true },
    ],
    dashAttack: { name: 'bullrush', xRange: 130, zRange: 40, dmgMult: 1.8, dur: 0.26, hitstop: 70, knockback: 80 },
    jumpAttack: { name: 'press',    xRange: 110, zRange: 60, dmgMult: 2.0, dur: 0.28, hitstop: 80, knockback: 40, downward: true, aoe: true },
    magic: { name: 'Tiger Spirit', cost: 0.14, range: 0, zRange: 0, hits: 0,
      dmgMult: 0, knockback: 0, hitstop: 0, color: '#ffd4a8',
      buff: { atk: 0.50, atkSpeed: 0.40, dur: 7 }, self: true,
      description: 'Your strikes carry the tiger\'s wrath for 7 seconds.' },
  },
  archer: {
    combo: [
      { name: 'arrow1', xRange: 380, zRange: 22, dmgMult: 1.0, dur: 0.18, hitstop: 25, knockback: 8, projectile: 'arrow' },
      { name: 'arrow2', xRange: 380, zRange: 22, dmgMult: 1.0, dur: 0.18, hitstop: 25, knockback: 8, projectile: 'arrow' },
      { name: 'pierce', xRange: 480, zRange: 24, dmgMult: 1.4, dur: 0.24, hitstop: 35, knockback: 12, projectile: 'arrow', pierces: true },
      { name: 'volley', xRange: 420, zRange: 80, dmgMult: 1.2, dur: 0.30, hitstop: 40, knockback: 14, projectile: 'arrow', fan: 5 },
    ],
    dashAttack: { name: 'kick',  xRange: 110, zRange: 36, dmgMult: 1.0, dur: 0.18, hitstop: 30, knockback: 40 },
    jumpAttack: { name: 'plunge',xRange: 360, zRange: 28, dmgMult: 1.4, dur: 0.20, hitstop: 35, knockback: 18, projectile: 'arrow' },
    magic: { name: 'Star Volley', cost: 0.07, range: 900, zRange: 200, hits: 10,
      dmgMult: 1.2, knockback: 22, hitstop: 35, color: '#d6ffe0', rain: true,
      description: 'Ten arrows of starlight pour onto the field.' },
  },
  twin: {
    combo: [
      { name: 'cut1', xRange: 96,  zRange: 30, dmgMult: 0.8, dur: 0.10, hitstop: 20, knockback: 4 },
      { name: 'cut2', xRange: 100, zRange: 30, dmgMult: 0.8, dur: 0.10, hitstop: 20, knockback: 4 },
      { name: 'cut3', xRange: 110, zRange: 32, dmgMult: 0.9, dur: 0.12, hitstop: 25, knockback: 8 },
      { name: 'flurry', xRange: 130, zRange: 38, dmgMult: 1.6, dur: 0.30, hitstop: 60, knockback: 25, hits: 4 },
    ],
    dashAttack: { name: 'glide', xRange: 130, zRange: 28, dmgMult: 1.4, dur: 0.20, hitstop: 40, knockback: 30, hits: 2 },
    jumpAttack: { name: 'cross', xRange: 110, zRange: 36, dmgMult: 1.2, dur: 0.18, hitstop: 30, knockback: 18, downward: true, hits: 2 },
    magic: { name: 'Crimson Storm', cost: 0.08, range: 200, zRange: 180, hits: 12,
      dmgMult: 0.7, knockback: 18, hitstop: 25, color: '#ff9cd6',
      description: 'A whirling storm of petal-blades around you.' },
  },
  whirlwind: {
    combo: [
      { name: 'chop1', xRange: 110, zRange: 40, dmgMult: 1.1, dur: 0.18, hitstop: 35, knockback: 12 },
      { name: 'chop2', xRange: 110, zRange: 40, dmgMult: 1.1, dur: 0.18, hitstop: 35, knockback: 12 },
      { name: 'cleave',xRange: 130, zRange: 50, dmgMult: 1.5, dur: 0.24, hitstop: 50, knockback: 25 },
      { name: 'twoaxe',xRange: 120, zRange: 60, dmgMult: 2.0, dur: 0.36, hitstop: 90, knockback: 60, hits: 2 },
    ],
    dashAttack: { name: 'charge', xRange: 140, zRange: 44, dmgMult: 1.6, dur: 0.22, hitstop: 55, knockback: 60 },
    jumpAttack: { name: 'split',  xRange: 110, zRange: 52, dmgMult: 1.8, dur: 0.26, hitstop: 60, knockback: 35, downward: true, aoe: true },
    magic: { name: 'Black Whirlwind', cost: 0.12, range: 240, zRange: 200, hits: 16,
      dmgMult: 0.6, knockback: 18, hitstop: 30, color: '#1a1a1a',
      description: 'A black vortex of axes — survive at your own risk.' },
  },
};

export const getMoves = (id) => MOVES[id] || MOVES.captain;
