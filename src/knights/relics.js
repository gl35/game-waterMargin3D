// ── 寶物 Boss relics ──
// Each boss guards one relic, guaranteed the first time you fell them
// (repeat kills pay a coin bounty instead). Relics live in the account
// collection; any hero can equip any owned relic in the lobby.

export const RELICS = [
  {
    id: 'iron_writ', boss: 'captain', zh: '鐵面令', name: 'Iron Writ',
    desc: '+10% attack · +5% crit chance',
    effects: { atkPct: 0.10, critAdd: 0.05 },
  },
  {
    id: 'zhu_banner', boss: 'warlord', zh: '祝家戰旗', name: 'Zhu War Banner',
    desc: '+15% max HP · take 5% less damage',
    effects: { hpPct: 0.15, takenMult: 0.95 },
  },
  {
    id: 'thunder_talisman', boss: 'sorcerer', zh: '五雷符', name: 'Five-Thunder Talisman',
    desc: 'Special +15% damage · costs 25% less HP',
    effects: { spDmgMult: 1.15, spCostMult: 0.75 },
  },
  {
    id: 'mirror_shard', boss: 'phantom', zh: '風月鏡碎', name: 'Mirror Shard',
    desc: '+5% attack · your strikes are never element-resisted',
    effects: { atkPct: 0.05, minElementMult: 1.0 },
  },
];

export const relicByBoss = (typeId) => RELICS.find(r => r.boss === typeId) || null;
export const relicById = (id) => RELICS.find(r => r.id === id) || null;
