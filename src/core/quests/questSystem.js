export const QUEST_SAVE_KEY = 'dowm.quest-progress.v1';

export const QUEST_DEFS = {
  roadside_trouble: {
    id: 'roadside_trouble',
    title: 'Roadside Trouble',
    summary: 'Help Elder Liu coordinate the Liangshan response.',
    giverId: 'villager',
    steps: [
      { id: 'briefing', type: 'talk', npcId: 'villager', text: 'Receive the briefing from Elder Liu.' },
      { id: 'ally', type: 'talk', npcId: 'tonkey', text: 'Recruit Tonkey for the escort route.' },
      { id: 'report', type: 'talk', npcId: 'songjiang', text: 'Report back to Song Jiang.' },
    ],
    reward: {
      gold: 120,
      hpRestore: 25,
    },
  },
};

const clone = (payload) => (typeof structuredClone === 'function'
  ? structuredClone(payload)
  : JSON.parse(JSON.stringify(payload))
);

function createQuestState(def) {
  return {
    id: def.id,
    state: 'available',
    stepIndex: 0,
    acceptedAt: null,
    completedAt: null,
    claimedAt: null,
  };
}

export function createQuestProgress(overrides = {}) {
  const quests = Object.values(QUEST_DEFS).reduce((acc, def) => {
    acc[def.id] = createQuestState(def);
    return acc;
  }, {});

  return {
    activeQuestId: null,
    quests: {
      ...quests,
      ...(overrides.quests || {}),
    },
    ...(overrides.activeQuestId ? { activeQuestId: overrides.activeQuestId } : {}),
  };
}

function withQuest(progress, questId) {
  const next = clone(progress);
  const quest = next.quests[questId];
  if (!quest) return { next, quest: null, def: null };
  return { next, quest, def: QUEST_DEFS[questId] };
}

export function tryAcceptQuest(progress, npcId) {
  const questDef = Object.values(QUEST_DEFS).find((def) => def.giverId === npcId);
  if (!questDef) return { progress, events: [] };

  const { next, quest } = withQuest(progress, questDef.id);
  if (!quest || quest.state !== 'available') {
    return { progress, events: [] };
  }

  quest.state = 'active';
  quest.acceptedAt = Date.now();
  next.activeQuestId = quest.id;

  return {
    progress: next,
    events: [{ type: 'quest_accepted', questId: quest.id }],
  };
}

export function advanceQuestByNpc(progress, npcId) {
  if (!progress.activeQuestId) return { progress, events: [] };

  const { next, quest, def } = withQuest(progress, progress.activeQuestId);
  if (!quest || !def || quest.state !== 'active') return { progress, events: [] };

  const step = def.steps[quest.stepIndex];
  if (!step || step.type !== 'talk' || step.npcId !== npcId) {
    return { progress, events: [] };
  }

  quest.stepIndex += 1;
  const events = [{ type: 'quest_step_completed', questId: quest.id, stepId: step.id }];

  if (quest.stepIndex >= def.steps.length) {
    quest.state = 'completed';
    quest.completedAt = Date.now();
    next.activeQuestId = null;
    events.push({ type: 'quest_completed', questId: quest.id });
  }

  return { progress: next, events };
}

export function claimQuestReward(progress, storyProgress, questId) {
  const { next, quest, def } = withQuest(progress, questId);
  if (!quest || !def || quest.state !== 'completed' || quest.claimedAt) {
    return { questProgress: progress, storyProgress, reward: null };
  }

  const storyNext = clone(storyProgress);
  const hpMax = storyNext.player.hpMax || 100;

  quest.state = 'claimed';
  quest.claimedAt = Date.now();

  if (def.reward?.gold) {
    storyNext.player.gold += def.reward.gold;
  }
  if (def.reward?.hpRestore) {
    storyNext.player.hp = Math.min(hpMax, storyNext.player.hp + def.reward.hpRestore);
  }

  return {
    questProgress: next,
    storyProgress: storyNext,
    reward: { ...def.reward, title: def.title },
  };
}

export function getQuestLog(progress) {
  return Object.values(QUEST_DEFS).map((def) => {
    const state = progress.quests[def.id] || createQuestState(def);
    const activeStep = def.steps[Math.min(state.stepIndex, def.steps.length - 1)] || null;
    return {
      id: def.id,
      title: def.title,
      summary: def.summary,
      state: state.state,
      stepIndex: state.stepIndex,
      stepCount: def.steps.length,
      activeStepText: state.state === 'active' && activeStep ? activeStep.text : null,
      reward: def.reward,
      canClaim: state.state === 'completed' && !state.claimedAt,
    };
  });
}

export function saveQuestProgress(progress, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return;
  storage.setItem(QUEST_SAVE_KEY, JSON.stringify(progress));
}

export function loadQuestProgress(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return createQuestProgress();
  const raw = storage.getItem(QUEST_SAVE_KEY);
  if (!raw) return createQuestProgress();

  try {
    const parsed = JSON.parse(raw);
    return createQuestProgress(parsed);
  } catch (error) {
    console.warn('Failed to parse quest save; starting fresh.', error);
    return createQuestProgress();
  }
}
