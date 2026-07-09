// ── 五行 Five-Elements combat + 炼妖壶 Refining Pot ──
// Inspired by the classic Xuanyuan Sword systems (original implementation —
// no third-party code or assets). Every fighter carries one of the five
// phases; the overcoming cycle (相剋) boosts or dampens damage:
//   金克木  木克土  土克水  水克火  火克金
// Slain foes may leave a spirit for the Refining Pot; three spirits of an
// element fuse into a permanent charm against that element.

export const ELEMENTS = {
  metal: { key: 'metal', zh: '金', name: 'Metal', color: '#ffd676' },
  wood:  { key: 'wood',  zh: '木', name: 'Wood',  color: '#8adf7a' },
  earth: { key: 'earth', zh: '土', name: 'Earth', color: '#caa06a' },
  water: { key: 'water', zh: '水', name: 'Water', color: '#7ac0ff' },
  fire:  { key: 'fire',  zh: '火', name: 'Fire',  color: '#ff7a5a' },
};
export const ELEMENT_KEYS = ['metal', 'wood', 'earth', 'water', 'fire'];

// attacker's element → the element it overcomes
export const OVERCOMES = {
  metal: 'wood', wood: 'earth', earth: 'water', water: 'fire', fire: 'metal',
};

// Damage multiplier for attacker element vs defender element.
export function elementMult(atkEl, defEl) {
  if (!atkEl || !defEl) return 1;
  if (OVERCOMES[atkEl] === defEl) return 1.3;   // 相剋 — overcoming
  if (OVERCOMES[defEl] === atkEl) return 0.8;   // overcome by the defender
  return 1;
}

// Charm bonus from the Refining Pot: each fused charm tier against the
// OPPONENT's element adds damage dealt and shaves damage taken.
export const CHARM_MAX_TIER = 3;
export const charmDealt = (charms, defEl) => 1 + 0.06 * ((charms && charms[defEl]) || 0);
export const charmTaken = (charms, atkEl) => 1 - 0.06 * ((charms && charms[atkEl]) || 0);

export const SPIRITS_PER_FUSE = 3;
// Chance a slain (non-boss) foe leaves a spirit; special-kills always do.
export const SPIRIT_CHANCE = 0.3;
