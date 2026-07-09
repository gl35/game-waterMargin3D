// ── RPG progression: levels, XP curve, camp upgrades ──
// XP is PERSISTENT per hero (kept even on defeat — a lost fight still
// trains you). Levels raise base stats; camp upgrades are bought with
// coins in the lobby and apply to every hero.

export const MAX_LEVEL = 20;

// XP needed to go from level n to n+1.
export function xpToNext(lv) {
  return Math.round((100 + 55 * Math.pow(lv - 1, 1.35)) / 5) * 5;
}

// Total XP → level + progress into the current level.
export function levelFromXp(xp) {
  let lv = 1, rest = Math.max(0, xp | 0);
  while (lv < MAX_LEVEL && rest >= xpToNext(lv)) {
    rest -= xpToNext(lv);
    lv++;
  }
  return { level: lv, into: rest, need: lv >= MAX_LEVEL ? 0 : xpToNext(lv) };
}

// Camp upgrades (persist in the save, apply to all heroes).
export const UPGRADES = [
  { id: 'atk', name: 'Whetstone', desc: '+8% attack per tier',
    icon: '⚔', tiers: 5, costs: [120, 220, 380, 620, 950] },
  { id: 'hp', name: 'Ox-hide Armor', desc: '+10% max HP per tier',
    icon: '🛡', tiers: 5, costs: [120, 220, 380, 620, 950] },
  { id: 'fortune', name: 'Lucky Sash', desc: '+20% coins & XP per tier',
    icon: '🪙', tiers: 3, costs: [200, 450, 800] },
];

// Final combat stats for a hero at a level with the save's upgrades.
export function statsFor(heroDef, level, upgrades) {
  const u = upgrades || {};
  const s = heroDef.stats;
  const lvK = level - 1;
  return {
    ...s,
    hpMax: Math.round(s.hpMax * (1 + 0.08 * lvK + 0.10 * (u.hp || 0))),
    atk: Math.round(s.atk * (1 + 0.06 * lvK + 0.08 * (u.atk || 0))),
  };
}

export const fortuneMult = (upgrades) => 1 + 0.2 * ((upgrades && upgrades.fortune) || 0);

// ── 仙术 Skill milestones ──
// Levels don't just add stats — they unlock arts. New heroes start with the
// 3-hit combo and their special; the rest is earned.
export const SKILLS = [
  { id: 'dashAttack', lv: 3,  zh: '疾風斬', name: 'Gale Cut',
    desc: 'Attack while dashing for a charging strike' },
  { id: 'jumpAttack', lv: 5,  zh: '飛燕落', name: 'Falling Swallow',
    desc: 'Attack in mid-air for a diving blow' },
  { id: 'combo4',     lv: 7,  zh: '第四式', name: 'Fourth Form',
    desc: 'Extends the combo chain to a heavy 4th finisher' },
  { id: 'empower',    lv: 10, zh: '仙術精通', name: 'Arcane Mastery',
    desc: 'Special deals +30% damage and costs less HP' },
  { id: 'crit',       lv: 14, zh: '會心', name: 'Vital Eye',
    desc: 'Critical strike chance nearly doubles' },
];

// Set of skill ids available at a level.
export function skillsFor(level) {
  const s = {};
  for (const sk of SKILLS) if (level >= sk.lv) s[sk.id] = true;
  return s;
}
