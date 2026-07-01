// ── Shui Hu Zhuan (水浒传 · Water Margin) storyline ──
// Three faithful episodes of Liangshan's rise, framed for the beat-em-up.
// Each stage maps to a real arc of the novel:
//   mountain_pass  → 逼上梁山  "Driven to Liangshan" (Lin Chong's flight)
//   magistrate_wall→ 三打祝家庄 the Three Assaults on the Zhu Family Manor
//   hidden_court   → 大破高唐州 breaking the sorcerer Gao Lian of Gaotang
//
// Lines are short prose; the StoryScreen reveals them one at a time.

export const PROLOGUE_LINES = [
  'The reign-marks of Zhenghe fall like ash. In the Eastern Capital, Marshal Gao Qiu sells commissions and breaks honest men for sport.',
  'When the law itself turns bandit, the wronged have only one road left — the reed-water of Liangshan Marsh, where a single banner flies.',
  '替天行道 — to carry out Heaven\'s will where the Emperor will not. One hundred and eight Stars of Destiny are falling to earth. You are one of them.',
];

export const STORY = {
  mountain_pass: {
    chapter: 'Chapter One',
    titleZh: '逼上梁山',
    title: 'Driven to Liangshan',
    prologue: true,
    intro: [
      'You were an honest sword once — until a forged charge and a knife in the dark left you a fugitive on the Cangzhou road.',
      'Gao Qiu\'s garrison captain bars the mountain road, and his raiders hunt stragglers through the snow.',
      'Cut through them. The marsh is waiting, and the banner needs every blade.',
    ],
    outro: [
      'The captain falls in the red snow. Behind you the road south lies open; ahead, the reeds of Liangshan glint like a drawn blade.',
      'One more outlaw climbs the mountain. The banner gains a star.',
    ],
  },
  magistrate_wall: {
    chapter: 'Chapter Two',
    titleZh: '三打祝家庄',
    title: 'The Three Assaults on Zhu Manor',
    intro: [
      'Liangshan\'s larder runs thin, and the band turns east toward the Zhu Family Manor, whose swords are sworn to the magistrate.',
      'Behind its walls the master-at-arms Luan Tingyu holds captured brothers in chains, deep in the maze of Pennant Lane.',
      'Twice the band has charged those gates and twice been thrown back. This is the third assault — and it does not fail.',
    ],
    outro: [
      'Luan Tingyu yields his blade; the manor gates burn and the captured brothers walk free.',
      'But word arrives from the west: a kinsman of the band lies in a Gaotang dungeon, and his jailer is no ordinary man.',
    ],
  },
  hidden_court: {
    chapter: 'Chapter Three',
    titleZh: '大破高唐州',
    title: 'The Sorcerer of Gaotang',
    intro: [
      'Gaotang Prefecture answers to Gao Lian — cousin to the Marshal, and a sorcerer who bends wind, fire, and beasts to his will.',
      'He has thrown Chai Jin, protector of the band, into a pit to die. The first Liangshan charge broke against his conjured storm.',
      'Now Gongsun Sheng descends with the Five-Thunder rites. Hold the line while the Taoist breaks the spell — then end the sorcerer yourself.',
    ],
    outro: [
      'The conjured mist tears apart under the Five-Thunder seal. Gao Lian falls, and Chai Jin rises from the pit alive.',
      'Three roads, three victories — and the Stars of Destiny now burn together over Liangshan Marsh.',
    ],
  },
};

export const FINALE_LINES = [
  'The chronicle of the Water Margin has only begun.',
  '替天行道 — the Way is carried out.',
];

export const getStory = (id) => STORY[id] || STORY.mountain_pass;
