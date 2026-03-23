import { INITIAL_CHAPTER_STATE, CHAPTER2_STATE } from './config';

export const STORY_SAVE_KEY = 'dowm.story-progress.v1';

const clone = (payload) => (typeof structuredClone === 'function'
  ? structuredClone(payload)
  : JSON.parse(JSON.stringify(payload))
);

export function createStoryProgress(overrides = {}) {
  return {
    player: {
      hp: 100,
      gold: 50,
      ...overrides.player,
    },
    stats: {
      heroesRecruited: 0,
      ...overrides.stats,
    },
    tonkeyUnlocked: overrides.tonkeyUnlocked ?? false,
    recruits: {
      linchong: false,
      songjiang: false,
      tonkey: false,
      ...overrides.recruits,
    },
    chapterState: {
      ...clone(INITIAL_CHAPTER_STATE),
      ...(overrides.chapterState || {}),
    },
  };
}

export function handleNpcDialog(progress, npcId) {
  const next = clone(progress);
  const events = [];

  if (next.chapterState.stage === 'chapter0_intro' && npcId === 'wuyong') {
    next.chapterState.stage = 'chapter0_recruit';
    next.chapterState.objective = 'Recruit Lin Chong and ask Tonkey to join your Liangshan escort.';
    events.push('wuYong_mission_unlocked');
  }

  if (next.chapterState.stage === 'chapter0_ready' && npcId === 'songjiang') {
    next.chapterState.chapter = 1;
    next.chapterState.stage = 'talk_villager';
    next.chapterState.objective = 'Travel east and speak with Village Elder Liu.';
    events.push('chapter1_started');
  }

  if (next.chapterState.stage === 'talk_villager' && npcId === 'villager') {
    next.chapterState.stage = 'clear_raiders';
    next.chapterState.objective = `Defeat named raiders (${next.chapterState.raidersDefeated}/${next.chapterState.raidersTarget}).`;
    events.push('villager_briefed');
  }

  if (next.chapterState.stage === 'return_songjiang' && npcId === 'songjiang') {
    next.chapterState.stage = 'complete';
    next.chapterState.completed = true;
    next.chapterState.objective = 'Chapter complete. Await Chapter 2.';
    next.player.gold += 100;
    events.push('chapter1_complete');
  }

  return { progress: next, events };
}

export function registerRecruitment(progress, npcId) {
  const next = clone(progress);
  if (!next.recruits[npcId]) {
    next.recruits[npcId] = true;
    next.stats.heroesRecruited += 1;
  }
  reevaluateEscortReadiness(next);
  return next;
}

export function unlockTonkey(progress) {
  const next = clone(progress);
  next.tonkeyUnlocked = true;
  next.recruits.tonkey = true;
  reevaluateEscortReadiness(next);
  return next;
}

function reevaluateEscortReadiness(progress) {
  if (
    progress.chapterState.stage === 'chapter0_recruit'
    && progress.tonkeyUnlocked
    && progress.recruits.linchong
  ) {
    progress.chapterState.stage = 'chapter0_ready';
    progress.chapterState.objective = 'Report to Song Jiang to begin Chapter 1.';
  }
}

export function recordRaiderKill(progress) {
  const next = clone(progress);
  const ch = next.chapterState.chapter;

  // Auto-advance to combat stage if still in early setup stages
  if (['chapter0_intro','chapter0_recruit','chapter0_ready','talk_villager'].includes(next.chapterState.stage)) {
    next.chapterState.chapter = 1;
    next.chapterState.stage = 'clear_raiders';
    next.chapterState.objective = `Defeat raiders (0/${next.chapterState.raidersTarget}).`;
  }

  next.chapterState.raidersDefeated += 1;
  const label = ch === 2 ? 'guards' : 'raiders';
  next.chapterState.objective = `Defeat ${label} (${next.chapterState.raidersDefeated}/${next.chapterState.raidersTarget}).`;

  if (
    next.chapterState.raidersDefeated >= next.chapterState.raidersTarget
    && !next.chapterState.minibossSpawned
  ) {
    next.chapterState.minibossSpawned = true;
    next.chapterState.stage = 'defeat_miniboss';
    next.chapterState.objective = ch === 2
      ? '⚔️ Warlord Gao emerges — defeat him!'
      : '⚔️ A powerful captain has appeared — defeat him!';
  }

  return next;
}

export function recordMiniBossDefeat(progress) {
  const next = clone(progress);
  next.chapterState.minibossDefeated = true;
  next.chapterState.stage = 'complete';
  next.chapterState.completed = true;
  const ch = next.chapterState.chapter;
  next.chapterState.objective = ch === 2
    ? 'Chapter 2 complete! The Magistrate falls.'
    : 'Chapter 1 complete! Victory is yours.';
  next.player.gold += ch === 2 ? 200 : 100;
  return next;
}

export function advanceToChapter2(progress) {
  const next = clone(progress);
  next.chapterState = clone(CHAPTER2_STATE);
  return next;
}

export function saveStoryProgress(progress, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return;
  storage.setItem(STORY_SAVE_KEY, JSON.stringify(progress));
}

export function loadStoryProgress(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return createStoryProgress();
  const raw = storage.getItem(STORY_SAVE_KEY);
  if (!raw) return createStoryProgress();
  try {
    const parsed = JSON.parse(raw);
    return createStoryProgress(parsed);
  } catch (error) {
    console.warn('Failed to parse story save; starting fresh.', error);
    return createStoryProgress();
  }
}
