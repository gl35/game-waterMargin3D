// ── Playable heroes (Water Margin roster, Knights-of-Valour stat shape) ──
// KoV signature: no MP. Specials cost HP ("blood magic"). Heroes have a
// combo string (4 chained attacks), a jump attack, a dash attack, and a
// signature special.
export const HEROES = [
  {
    id: 'songjiang', name: 'Song Jiang', title: 'Crimson Captain',
    sprite: 'npc/songjiang', color: '#ffc26b', portrait: '#e08a3a',
    moveId: 'captain', el: 'earth',
    stats: { hpMax: 1400, atk: 38, atkSpeed: 1.0, atkRange: 96,
      moveSpeed: 240, jumpPower: 540, dashSpeed: 520, magicCostPct: 0.10 },
    blurb: 'Steady captain. Rallying shouts heal allies and stagger crowds.',
    opening: 'Brothers of the marsh — hold the line. Heaven watches our banner!',
  },
  {
    id: 'linchong', name: 'Lin Chong', title: 'Spear of the Pine',
    sprite: 'npc/linchong', color: '#9bc7ff', portrait: '#5a8fcf',
    moveId: 'spear', el: 'wood',
    stats: { hpMax: 1180, atk: 44, atkSpeed: 1.4, atkRange: 140,
      moveSpeed: 250, jumpPower: 560, dashSpeed: 540, magicCostPct: 0.08 },
    blurb: 'Spear thrusts pierce armor and line up a whole row.',
    opening: 'Gao Qiu taught me patience. My spear will teach him regret.',
  },
  {
    id: 'wusong', name: 'Wu Song', title: 'Tiger Slayer',
    sprite: 'npc/wusong', color: '#ff8b6b', portrait: '#b04a26',
    moveId: 'berserker', el: 'metal',
    stats: { hpMax: 1700, atk: 52, atkSpeed: 0.85, atkRange: 84,
      moveSpeed: 220, jumpPower: 520, dashSpeed: 480, magicCostPct: 0.14 },
    blurb: 'Heaviest fists on the mountain. Each strike lands like a falling pine.',
    opening: 'I killed a tiger on Jingyang Ridge with these hands. Bandits are easier.',
  },
  {
    id: 'huarong', name: 'Hua Rong', title: 'Little Li Guang',
    sprite: 'npc/huarong', color: '#9cffb5', portrait: '#3aa75d',
    moveId: 'archer', el: 'wood',
    stats: { hpMax: 1050, atk: 32, atkSpeed: 1.7, atkRange: 380,
      moveSpeed: 255, jumpPower: 580, dashSpeed: 560, magicCostPct: 0.07 },
    blurb: 'No bandit closes the gap before the third arrow flies.',
    opening: 'Nock, draw, loose. You will not reach me.',
  },
  {
    id: 'husanniang', name: 'Hu Sanniang', title: 'Ten-Foot Green',
    sprite: 'npc/husanniang', color: '#ff9cd6', portrait: '#c84e92',
    moveId: 'twin', el: 'water',
    stats: { hpMax: 1100, atk: 30, atkSpeed: 2.0, atkRange: 96,
      moveSpeed: 275, jumpPower: 600, dashSpeed: 600, magicCostPct: 0.08 },
    blurb: 'Twin sabers turn a crowd into ribbon. Fastest blades on Liangshan.',
    opening: 'Two sabers, one dance. Try to keep up.',
  },
  {
    id: 'likui', name: 'Li Kui', title: 'Black Whirlwind',
    sprite: 'npc/likui', color: '#8a8a8a', portrait: '#3a3a3a',
    moveId: 'whirlwind', el: 'fire',
    stats: { hpMax: 1900, atk: 46, atkSpeed: 1.0, atkRange: 110,
      moveSpeed: 225, jumpPower: 520, dashSpeed: 500, magicCostPct: 0.12 },
    blurb: 'Two axes, no plan. Loud, fast, and built like a temple bell.',
    opening: 'HAHA! Stand still so my axes can find you!',
  },
];

export const getHero = (id) => HEROES.find(h => h.id === id) || HEROES[0];
