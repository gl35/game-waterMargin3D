// XP needed to reach each level (cumulative) — tuned for ~10-15 min to Lv5
const XP_TABLE = [0, 60, 150, 290, 480, 720, 1020, 1400, 1860, 2420, 3100];

export function getLevel(xp) {
  let level = 1;
  for (let i = 1; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i + 1;
    else break;
  }
  return Math.min(level, XP_TABLE.length);
}

export function getXpToNext(xp) {
  const level = getLevel(xp);
  if (level >= XP_TABLE.length) return 0;
  return XP_TABLE[level] - xp;
}

export function getXpForNext(xp) {
  const level = getLevel(xp);
  if (level >= XP_TABLE.length) return 1;
  return XP_TABLE[level] - XP_TABLE[level - 1];
}

export function getXpProgress(xp) {
  const level = getLevel(xp);
  if (level >= XP_TABLE.length) return 1;
  const base = XP_TABLE[level - 1];
  const needed = XP_TABLE[level] - base;
  return (xp - base) / needed;
}

// Per-level stat bonuses
export function getStats(level) {
  return {
    maxHp:       80 + level * 12,
    damage:      8  + level * 3,
    speed:       18 + Math.min(level * 0.6, 8),   // caps at ~26
    attackRange: 20 + Math.min(level * 1.2, 10),   // auto-attack radius
    // Super move unlock thresholds
    dragonUnlocked: level >= 2,
    stormUnlocked:  level >= 4,
    shadowUnlocked: level >= 6,
  };
}

// Gold costs for shop upgrades
export const SHOP_UPGRADES = [
  { id: 'hp_boost',    label: '❤️ +20 Max HP',       cost: 40,  stat: 'maxHp',   amount: 20 },
  { id: 'dmg_boost',   label: '⚔️ +5 Damage',         cost: 55,  stat: 'damage',  amount: 5  },
  { id: 'spd_boost',   label: '💨 +2 Speed',           cost: 45,  stat: 'speed',   amount: 2  },
  { id: 'range_boost', label: '📡 +3 Attack Range',    cost: 60,  stat: 'range',   amount: 3  },
  { id: 'heal_full',   label: '🧪 Full Heal',          cost: 30,  stat: 'healFull',amount: 0  },
];
