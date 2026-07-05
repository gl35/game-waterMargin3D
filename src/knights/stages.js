// ── Stage definitions (side-scrolling beat-em-up) ──
// A stage is a fixed-length scroll with scripted waves. Player advances to
// the right; the camera locks when a wave is active until all foes fall AND
// the wave's mission objective (cage / gate / defend) is done.
//
// Per-wave extras:
//   bark:   { who: 'enemy'|'hero', text }   speech bubble when the wave starts
//   cage:   { occupant, name }              breakable prison — smash to free
//   gate:   { hp, name }                    barrier at the wave lock — smash it
//   defend: { dur, hp, name, sprite,        protect the ritual caster for dur
//             bursts: [{at, spawns}] }      seconds against timed bursts
//   dialog: [{ who: 'boss'|'hero', text }]  exchange lines on a boss wave
//
// `theme` keys the renderer palette: dusk | night | mist.
export const STAGES = [
  {
    id: 'mountain_pass', chapter: 1, theme: 'dusk',
    name: 'The Bandit Mountain Pass', width: 4800,
    mission: 'Free the three caged villagers',
    objective: { text: 'Free the caged villagers', max: 3 },
    bg: { sky: 'bg/sky_ch1', mountains: 'bg/mountains_ch1', ground: 'bg/ground_ch1' },
    intro: 'Smoke still hangs over the valley. The raiders are not far ahead.',
    barrels: [400, 950, 1550, 2200, 2800, 3500, 4150],
    waves: [
      { atX: 600,  spawns: [['raider', 3]],
        bark: { who: 'enemy', text: 'Nobody walks the pass without paying the mountain toll!' } },
      { atX: 1200, spawns: [['raider', 2], ['scout', 2]],
        cage: { occupant: 'npc/baisheng', name: 'Villager' },
        bark: { who: 'hero', text: 'Hold on — I will cut you loose!' } },
      { atX: 1800, spawns: [['archer', 2], ['raider', 2]] },
      { atX: 2400, spawns: [['scout', 3], ['brute', 1]],
        cage: { occupant: 'npc/baisheng', name: 'Villager' } },
      { atX: 3000, spawns: [['halberd', 2], ['raider', 2]],
        bark: { who: 'enemy', text: 'The captain pays gold for Liangshan heads!' } },
      { atX: 3700, spawns: [['archer', 2], ['brute', 1], ['raider', 2]],
        cage: { occupant: 'npc/baisheng', name: 'Villager' } },
      { atX: 4400, boss: 'captain', intro: 'Captain Zhao steps from the smoke.',
        dialog: [
          { who: 'boss', text: 'The Marshal wants your head in a box, outlaw.' },
          { who: 'hero', text: 'Tell Gao Qiu the mountain sends its answer.' },
        ] },
    ],
    rewards: { coin: 120, xp: 200 },
  },
  {
    id: 'magistrate_wall', chapter: 2, theme: 'night',
    name: 'Zhu Family Manor', width: 5600,
    mission: 'Breach the gate, free Shi Xiu',
    objective: { text: 'Breach the manor · free Shi Xiu', max: 2 },
    bg: { sky: 'bg/sky_ch2', mountains: 'bg/mountains_ch2', ground: 'bg/ground_ch2' },
    intro: 'Behind these walls the captured brothers wait in chains.',
    barrels: [500, 1100, 1700, 2400, 3100, 3800, 4500, 5100],
    waves: [
      { atX: 600,  spawns: [['halberd', 3]],
        bark: { who: 'enemy', text: 'The Zhus feed marsh rats like you to the moat!' } },
      { atX: 1300, spawns: [['halberd', 2], ['archer', 2]] },
      { atX: 2000, spawns: [['brute', 2], ['halberd', 2]] },
      { atX: 2700, spawns: [['archer', 3], ['scout', 2]],
        gate: { hp: 520, name: 'Manor Gate' },
        bark: { who: 'hero', text: 'Third assault. This time the gate comes DOWN.' } },
      { atX: 3400, spawns: [['halberd', 3], ['brute', 1]] },
      { atX: 4100, spawns: [['archer', 3], ['brute', 2]],
        cage: { occupant: 'npc/shixiu', name: 'Shi Xiu' },
        bark: { who: 'enemy', text: 'The prisoner dies at dawn — kill the visitor first!' } },
      { atX: 4800, spawns: [['halberd', 4]] },
      { atX: 5300, boss: 'warlord', intro: 'Luan Tingyu, master-at-arms of Zhu Manor, blocks the inner gate.',
        dialog: [
          { who: 'boss', text: 'Three assaults, three failures. The Zhus taught me the spear at seven.' },
          { who: 'hero', text: 'Then the Zhus can bury you with it.' },
        ] },
    ],
    rewards: { coin: 220, xp: 380 },
  },
  {
    id: 'hidden_court', chapter: 3, theme: 'mist',
    name: 'The Sorcerer of Gaotang', width: 6400,
    mission: "Shield Gongsun Sheng's thunder rite",
    objective: { text: 'Shield the Five-Thunder rite', max: 1 },
    bg: { sky: 'bg/sky_ch2', mountains: 'bg/mountains_ch1', ground: 'bg/ground_ch1' },
    intro: 'A purple lantern hangs in the mist where no lantern hung before.',
    barrels: [400, 900, 1500, 2200, 2900, 3700, 4400, 5200, 5900],
    waves: [
      { atX: 600,  spawns: [['scout', 4]],
        bark: { who: 'enemy', text: 'The Prefect\'s mist drinks men whole. Turn back.' } },
      { atX: 1300, spawns: [['archer', 3], ['brute', 1]] },
      { atX: 2000, spawns: [['brute', 3], ['archer', 2]] },
      { atX: 2700, spawns: [['halberd', 3], ['archer', 2]],
        bark: { who: 'hero', text: 'This fog is not weather. Keep moving.' } },
      { atX: 3400, spawns: [['scout', 2]],
        defend: {
          dur: 24, hp: 600, name: 'Gongsun Sheng', sprite: 'npc/wuyong',
          bursts: [
            { at: 2,  spawns: [['raider', 2], ['scout', 1]] },
            { at: 9,  spawns: [['scout', 2], ['archer', 1]] },
            { at: 16, spawns: [['brute', 1], ['raider', 2]] },
          ],
        },
        bark: { who: 'hero', text: 'Begin the rite, master — nothing gets past me.' } },
      { atX: 4100, spawns: [['archer', 4], ['brute', 2]] },
      { atX: 4800, spawns: [['brute', 4], ['halberd', 3]] },
      { atX: 5500, spawns: [['archer', 4], ['halberd', 3]],
        bark: { who: 'enemy', text: 'Lord Gao Lian will hang your skin from the lantern!' } },
      { atX: 6100, boss: 'sorcerer', intro: 'Gao Lian raises both hands. The conjured mist answers.',
        dialog: [
          { who: 'boss', text: 'My cousin the Marshal asked for your head. I promised him your soul.' },
          { who: 'hero', text: 'Your mist is broken, sorcerer. Now it is only you.' },
        ] },
    ],
    rewards: { coin: 360, xp: 620 },
  },
  // ── Crossover chapter: Dream of the Red Chamber (红楼梦) ──
  // After Gaotang the hero falls asleep at the victory feast and wanders
  // into the Land of Illusion. Garden NPCs (Jia Baoyu, Lin Daiyu) speak when
  // approached; the Precious Mirror of Romance spills phantoms; the final
  // trial is the hero's own reflection.
  {
    id: 'red_chamber', chapter: 4, theme: 'dream',
    name: 'Dream of the Red Chamber', width: 6000,
    mission: 'Shatter the twin Mirrors of Romance',
    objective: { text: 'Shatter the Mirrors of Romance', max: 2 },
    bg: {},
    intro: 'The wine was strong. The dream is stronger.',
    barrels: [500, 1200, 1900, 2600, 3300, 4000, 4700, 5400],
    npcs: [
      { sprite: 'npc/zhengtianshou', name: 'Jia Baoyu', x: 860, z: 150, color: '#9cc8ff',
        line: 'Steel, in the Land of Illusion? How vigorous. Sister Lin will want to see this.' },
      { sprite: 'npc/sunerniang', name: 'Lin Daiyu', x: 1935, z: 165, color: '#ffb0cc', petals: true,
        line: 'I bury petals, not men. Mind where your boots fall, outlaw.' },
    ],
    waves: [
      { atX: 600,  spawns: [['scout', 4]],
        bark: { who: 'enemy', text: 'You do not belong in this dream, star of violence.' } },
      { atX: 1300, spawns: [['raider', 2], ['archer', 2]] },
      { atX: 2000, spawns: [['archer', 2], ['scout', 2]],
        mirror: { hp: 420, name: '風月寶鑑 · Mirror of Romance' },
        bark: { who: 'hero', text: 'A mirror that bleeds shadows. Then it can bleed.' } },
      { atX: 2700, spawns: [['brute', 2], ['halberd', 2]] },
      { atX: 3400, spawns: [['scout', 3], ['archer', 2]],
        bark: { who: 'enemy', text: 'Stay, brother. Sleep. The garden keeps all who dream.' } },
      { atX: 4200, spawns: [['brute', 1], ['halberd', 2]],
        mirror: { hp: 480, name: '風月寶鑑 · Mirror of Romance' } },
      { atX: 4900, spawns: [['halberd', 3], ['brute', 2]] },
      { atX: 5600, boss: 'phantom', intro: 'The last mirror does not break. It steps out.',
        dialog: [
          { who: 'npc', name: '警幻仙姑 Jing Huan', text: 'Mortal star. The Mirror shows what you are. Defeat yourself, or dream here forever.' },
          { who: 'boss', text: 'I am the you that never left the mountain.' },
          { who: 'hero', text: 'Then you already know how this ends.' },
        ] },
    ],
    rewards: { coin: 500, xp: 900 },
  },
];

export const getStage = (id) => STAGES.find(s => s.id === id) || STAGES[0];
