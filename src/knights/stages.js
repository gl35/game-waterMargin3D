// ── Stage definitions (side-scrolling beat-em-up) ──
// A stage is a fixed-length scroll with scripted waves. Player advances to
// the right; the camera locks when a wave is active until all foes fall.
// `width` is the total scroll length in world units.
export const STAGES = [
  {
    id: 'mountain_pass', chapter: 1,
    name: 'The Bandit Mountain Pass', width: 4800,
    bg: { sky: 'bg/sky_ch1', mountains: 'bg/mountains_ch1', ground: 'bg/ground_ch1' },
    intro: 'Smoke still hangs over the valley. The raiders are not far ahead.',
    barrels: [400, 950, 1550, 2200, 2800, 3500, 4150],
    waves: [
      { atX: 600,  spawns: [['raider', 3]] },
      { atX: 1200, spawns: [['raider', 2], ['scout', 2]] },
      { atX: 1800, spawns: [['archer', 2], ['raider', 2]] },
      { atX: 2400, spawns: [['scout', 3], ['brute', 1]] },
      { atX: 3000, spawns: [['halberd', 2], ['raider', 2]] },
      { atX: 3700, spawns: [['archer', 2], ['brute', 1], ['raider', 2]] },
      { atX: 4400, boss: 'captain', intro: 'Captain Zhao steps from the smoke.' },
    ],
    rewards: { coin: 120, xp: 200 },
  },
  {
    id: 'magistrate_wall', chapter: 2,
    name: 'Zhu Family Manor', width: 5600,
    bg: { sky: 'bg/sky_ch2', mountains: 'bg/mountains_ch2', ground: 'bg/ground_ch2' },
    intro: 'Behind these walls Lin Chong\'s wife waits.',
    barrels: [500, 1100, 1700, 2400, 3100, 3800, 4500, 5100],
    waves: [
      { atX: 600,  spawns: [['halberd', 3]] },
      { atX: 1300, spawns: [['halberd', 2], ['archer', 2]] },
      { atX: 2000, spawns: [['brute', 2], ['halberd', 2]] },
      { atX: 2700, spawns: [['archer', 3], ['scout', 2]] },
      { atX: 3400, spawns: [['halberd', 3], ['brute', 1]] },
      { atX: 4100, spawns: [['archer', 3], ['brute', 2]] },
      { atX: 4800, spawns: [['halberd', 4]] },
      { atX: 5300, boss: 'warlord', intro: 'Luan Tingyu, master-at-arms of Zhu Manor, blocks the inner gate.' },
    ],
    rewards: { coin: 220, xp: 380 },
  },
  {
    id: 'hidden_court', chapter: 3,
    name: 'The Sorcerer of Gaotang', width: 6400,
    bg: { sky: 'bg/sky_ch2', mountains: 'bg/mountains_ch1', ground: 'bg/ground_ch1' },
    intro: 'A purple lantern hangs in the mist where no lantern hung before.',
    barrels: [400, 900, 1500, 2200, 2900, 3700, 4400, 5200, 5900],
    waves: [
      { atX: 600,  spawns: [['scout', 4]] },
      { atX: 1300, spawns: [['archer', 3], ['brute', 1]] },
      { atX: 2000, spawns: [['brute', 3], ['archer', 2]] },
      { atX: 2700, spawns: [['halberd', 3], ['archer', 2]] },
      { atX: 3400, spawns: [['halberd', 4], ['brute', 2]] },
      { atX: 4100, spawns: [['archer', 4], ['brute', 2]] },
      { atX: 4800, spawns: [['brute', 4], ['halberd', 3]] },
      { atX: 5500, spawns: [['archer', 4], ['halberd', 3]] },
      { atX: 6100, boss: 'sorcerer', intro: 'Gao Lian raises both hands. The conjured mist answers.' },
    ],
    rewards: { coin: 360, xp: 620 },
  },
];

export const getStage = (id) => STAGES.find(s => s.id === id) || STAGES[0];
