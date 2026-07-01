import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { GameCanvas } from './scene2d/Scene';
import { NPCS } from './core/story/config';
import { tileToWorldPosition } from './core/story/coordinates';
import { createStoryProgress, handleNpcDialog, recordMiniBossDefeat, recordRaiderKill, saveStoryProgress, advanceToChapter2 } from './core/story/stateMachine';
import {
  advanceQuestByNpc,
  claimQuestReward,
  getQuestLog,
  loadQuestProgress,
  saveQuestProgress,
  tryAcceptQuest,
} from './core/quests/questSystem';
import { HERO_SKINS } from './core/hero/skins';
import VictoryBanquet from './VictoryBanquet';
import OpeningCinematic from './OpeningCinematic';
import { createEnemies, createChapter2Enemies, createChapter3Enemies, damageEnemy, knockbackEnemy, getClosestLiveEnemy, respawnEnemies, stepEnemies } from './core/combat/enemies';
import { getLevel, getXpProgress, getXpForNext, getStats, SHOP_UPGRADES } from './core/hero/progression';
import { sfxHit, sfxCrit, sfxKill, sfxPickup, sfxDialogBlip, sfxBanner, sfxClick } from './audio/sfx';

const npcWorld = NPCS.map((npc) => ({ ...npc, world: tileToWorldPosition(npc) }));

const DIALOG_HINTS = {
  wuyong: '[Act 1] A tear in fate dragged you here. Earn Liangshan\'s trust — Lin Chong waits, and the road home runs through both chapters.',
  songjiang_ready: '[Act 1] Your party gathers. Walk the Liangshan path and shatter Captain Zhao to open the road south.',
  villager: '[Main Mission] Hunt the raider patrols. Captain Zhao falls last.',
  songjiang_return: '[Act 1 → Act 2] You returned with the captain\'s mask. Lin Chong rides for the magistrate next — claim your reward and prepare.',
  tonkey: '[Press E to ask Tonkey to follow you.]',
};

const INTERACT_PROMPT = 'Press E to interact';

const ACTION_SLOTS = [
  { id: 'gourd', label: 'Heal Brew', cooldownMs: 12000 },
  { id: 'staff', label: 'Scout Ping', cooldownMs: 9000 },
  { id: 'axe', label: 'Forage', cooldownMs: 10000 },
  { id: 'glove', label: 'Focus', cooldownMs: 15000 },
  { id: 'camp', label: 'Camp Rest', cooldownMs: 22000 },
];

const SUPER_MOVES = [
  {
    id: 'dragon',
    label: '🐉 Dragon Strike',
    desc: 'Unleash a piercing spear lunge — deals 60 damage to all enemies nearby',
    cooldownMs: 18000,
    color: '#ff6820',
    key: 'Digit1',
  },
  {
    id: 'storm',
    label: '⚡ Storm Sweep',
    desc: 'Spinning blade storm hits all enemies in range for 35 damage each',
    cooldownMs: 22000,
    color: '#60c8ff',
    key: 'Digit2',
  },
  {
    id: 'shadow',
    label: '🌑 Shadow Blink',
    desc: 'Vanish and reappear behind the nearest enemy dealing 80 crit damage',
    cooldownMs: 28000,
    color: '#a060ff',
    key: 'Digit3',
  },
];

const TAVERN_CREW = [
  {
    id: 'scout',
    name: 'Tonkey',
    title: 'Summit Escort',
    line: '“If I hauled you here, I can haul you home. Eat up.”',
    color: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
  },
  {
    id: 'strategist',
    name: 'D7u',
    title: 'Runaway Strategist',
    line: '“Relax. I mapped the magistrate patrols between sips of beer.”',
    color: 'linear-gradient(135deg, #c2ffd8, #465efb)',
  },
  {
    id: 'chef',
    name: 'Bo the Chef',
    title: 'Field Provisioner',
    line: '“Eat now. Fight later. Also, stop dripping soup on the map.”',
    color: 'linear-gradient(135deg, #f6d365, #fda085)',
  },
];

// ── Hit-stop: a brief simulation freeze gives heavy hits real weight.
// Both ticks (App.jsx enemy step + Scene.jsx hero/camera) check Date.now()
// against window.__hitStopUntil and skip simulation when it's in the future.
function triggerHitStop(durationMs) {
  if (typeof window === 'undefined') return;
  const until = Date.now() + durationMs;
  if ((window.__hitStopUntil || 0) < until) window.__hitStopUntil = until;
}

// Per-NPC recruitment hooks. Original short prose lines used in dialog.
const TRIAL_OPENINGS = {
  songjiang:  'Liangshan asks one thing — proof. Words bend; blade does not.',
  linchong:   'Steel is honest. Show me yours against the magistrate\'s dogs.',
  wuyong:     'A strategist needs a sword arm worth the maps I draw. Earn it.',
  chaogai:    'I built this oath. Spill raider blood and it becomes yours too.',
  huarong:    'An archer counts arrows by enemies down. Bring me a tally.',
  likui:      'Don\'t talk! Crack skulls! Then we drink.',
  lujunyi:    'Show me your stride before I share my road. The path begins with their fall.',
  guansheng:  'A great blade honors a great cause — make the cause clear in red.',
  huyanzhuo:  'My whips remember names. Earn yours among the magistrate\'s ranks.',
  husanniang: 'I do not fight beside men who hesitate. Cut a few down, then come back.',
  wusong:     'A jar of wine for every magistrate man you put down. Go earn the first.',
  yanqing:    'A wandering player carries more than music. Show me the shape of your wandering.',
  daizong:    'Pace yourself. Stride enough patrols flat and I\'ll carry word for you.',
  qinming:    'Heat is honest. Light a few patrols up and I\'ll burn beside you.',
  dongping:   'A spear is a question. Answer mine with a few of theirs falling.',
  zhutong:    'I have seen bad men in good uniforms. Show me yours is clean. Three patrols.',
  xuning:     'Bring the family spear payment in raider blood. Then we ride.',
  liutang:    'I burn down the road, you keep up. Show me you can keep up — clear it for me.',
  shixiu:     'No retreat. Drop a few of them. If you make it back, so will I.',
};
const TRIAL_JOIN_LINES = {
  songjiang:  'Then walk with us. The road to Liangshan widens by your hand.',
  linchong:   'You move like one who has nothing left to lose. Good. Stay close.',
  wuyong:     'Your tally matches my maps. I will go where you lead.',
  chaogai:    'Brother-of-the-oath. Liangshan is yours as much as mine.',
  huarong:    'My quiver is yours. Tell me where to aim and stand back.',
  likui:      'You hit hard! I like you! Where to next?',
  lujunyi:    'A patient road, well walked. I follow.',
  guansheng:  'Honor met. My blade is at your side.',
  huyanzhuo:  'Two whips, one rider, beside one stranger. Lead on.',
  husanniang: 'You do not hesitate. Good. The sabers ride with you.',
  wusong:     'Wine first. Then magistrates. In that order, always.',
  yanqing:    'You have a stride worth a song. I\'ll write you one in steel.',
  daizong:    'Three hundred li, your direction. Lead on.',
  qinming:    'Sparks together, then. Where do we burn next?',
  dongping:   'Twin spears at your right shoulder. Try not to flinch.',
  zhutong:    'Clean enough. The beard rides at your side.',
  xuning:     'Family debt closing. Spear is yours to point.',
  liutang:    'You kept up. I like that. Lead, red road runner.',
  shixiu:     'Then we go forward together. No turning. Ever.',
};
function trialOpening(id) { return TRIAL_OPENINGS[id] || 'Prove yourself in battle. Return when you have.'; }
function trialJoinLine(id) { return TRIAL_JOIN_LINES[id] || 'Well fought. I follow.'; }

// ── Persistence: pack the "new" state (party + story flags) into localStorage.
//    Existing saveStoryProgress / saveQuestProgress handle their own slices.
const EXTRAS_KEY = 'dwm_extras_v1';
function saveExtras(payload) {
  try {
    localStorage.setItem(EXTRAS_KEY, JSON.stringify({
      version: 1,
      recruited: Array.from(payload.recruited || []),
      trials: payload.trials || {},
      linchongBriefed: !!payload.linchongBriefed,
      sorcererRevealed: !!payload.sorcererRevealed,
      sorcererDown: !!payload.sorcererDown,
      endingChoice: payload.endingChoice || null,
      heroSkinIndex: payload.heroSkinIndex || 0,
      statBonuses: payload.statBonuses || { maxHp: 0, damage: 0, speed: 0, range: 0 },
      combatXp: payload.combatXp || 0,
      horsePos: payload.horsePos || { x: -15, z: 20 },
      // Save companion identities + their HP so they don't all snap back to full
      companions: (payload.companions || []).map((c) => ({
        id: c.id, hp: c.hp, maxHp: c.maxHp,
      })),
    }));
  } catch {}
}
function loadExtras() {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj.version !== 1) return null;
    return obj;
  } catch { return null; }
}

// Per-hero combat traits — range, damage band, cooldown, optional special ability
const HERO_TRAITS = {
  songjiang:  { range: 5, dmg: [10, 14], cooldown: 1100, special: 'rally' },
  wuyong:     { range: 6, dmg: [6, 10],  cooldown: 1000 },
  linchong:   { range: 4, dmg: [12, 16], cooldown: 950 },
  tonkey:     { range: 4, dmg: [10, 14], cooldown: 1000 },
  villager:   { range: 3, dmg: [4, 6],   cooldown: 1400 },
  chaogai:    { range: 5, dmg: [11, 15], cooldown: 1100 },
  huarong:    { range: 9, dmg: [6, 10],  cooldown: 700 },               // archer
  likui:      { range: 3, dmg: [16, 24], cooldown: 1500 },              // berserker
  lujunyi:    { range: 5, dmg: [13, 17], cooldown: 1000 },
  guansheng:  { range: 5, dmg: [14, 18], cooldown: 1100 },              // swordmaster
  huyanzhuo:  { range: 5, dmg: [9, 13],  cooldown: 950, special: 'knockback' }, // cavalry
  andaoquan:  { range: 8, dmg: [0, 0],   cooldown: 4500, special: 'heal' },   // healer
  shiqian:    { range: 4, dmg: [7, 10],  cooldown: 800, special: 'gold' },    // thief
  // Expanded roster combat profiles
  husanniang: { range: 4, dmg: [11, 15], cooldown: 800 },               // dual sabers — fast
  wusong:     { range: 3, dmg: [18, 26], cooldown: 1300 },              // bare-fist tiger killer
  yanqing:    { range: 8, dmg: [7, 11],  cooldown: 750 },               // wandering archer
  daizong:    { range: 5, dmg: [8, 12],  cooldown: 600, special: 'gold' }, // fast courier
  qinming:    { range: 4, dmg: [15, 20], cooldown: 1200, special: 'knockback' }, // mace fire
  dongping:   { range: 5, dmg: [12, 16], cooldown: 900 },               // twin spears
  zhutong:    { range: 5, dmg: [11, 15], cooldown: 1000, special: 'rally' }, // constable rally
  xuning:     { range: 5, dmg: [13, 17], cooldown: 950 },               // golden spear
  liutang:    { range: 3, dmg: [14, 19], cooldown: 1000 },              // hot-blooded brawler
  shixiu:     { range: 4, dmg: [12, 17], cooldown: 850 },               // desperate striker
};
function heroTrait(id) {
  return HERO_TRAITS[id] || { range: 5, dmg: [8, 12], cooldown: 1200 };
}

function composeDialogText(npc, story) {
  let text = npc.dialog;
  const { stage } = story.chapterState;

  if (npc.id === 'wuyong' && stage === 'chapter0_intro') text += `\n\n${DIALOG_HINTS.wuyong}`;
  if (npc.id === 'songjiang' && stage === 'chapter0_ready') text += `\n\n${DIALOG_HINTS.songjiang_ready}`;
  if (npc.id === 'villager' && stage === 'talk_villager') text += `\n\n${DIALOG_HINTS.villager}`;
  if (npc.id === 'songjiang' && stage === 'return_songjiang') text += `\n\n${DIALOG_HINTS.songjiang_return}`;
  if (npc.id === 'tonkey' && !story.tonkeyUnlocked) text += `\n${DIALOG_HINTS.tonkey}`;

  return text;
}

export default function App() {
  // Load saved extras once at mount — referenced by many useState initializers below
  const _savedExtras = useMemo(() => loadExtras(), []);
  const [story, setStory] = useState(() => createStoryProgress());
  const [questProgress, setQuestProgress] = useState(() => loadQuestProgress());
  const [questNotice, setQuestNotice] = useState(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [dialogReveal, setDialogReveal] = useState(0); // chars revealed by typewriter
  // Chapter-title banner — flashes on screen when advancing to a new chapter
  const [chapterBanner, setChapterBanner] = useState(null); // { title, subtitle } | null
  const [highlightedNpcId, setHighlightedNpcId] = useState(null);
  const [heroSkinIndex, setHeroSkinIndex] = useState(() => _savedExtras?.heroSkinIndex || 0);
  const [showTavernScene, setShowTavernScene] = useState(false);
  const [showVictoryBanquet, setShowVictoryBanquet] = useState(false);
  const [showOpening, setShowOpening] = useState(() => !sessionStorage.getItem('cine_seen'));
  const [showMainMenu, setShowMainMenu] = useState(false);
  const prevStage = useRef(null);

  const handleFullRestart = useCallback(() => {
    // Wipe all saved state
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    // Reset all React state to initial
    setStory(createStoryProgress());
    setQuestProgress(loadQuestProgress());
    setEnemies(createEnemies());
    setCombatXp(0);
    setComboCount(0);
    setComboStep(0);
    setStamina(100);
    setIsMounted(false);
    setLockedTarget(null);
    setHighlightedEnemyId(null);
    setHighlightedNpcId(null);
    setStatBonuses({ maxHp: 0, damage: 0, speed: 0, range: 0 });
    setSlotCooldowns({});
    setSuperCooldowns({});
    setShowVictoryBanquet(false);
    setShowMainMenu(false);
    setDialog(null);
    prevStage.current = null;
    // Replay opening cinematic
    setShowOpening(true);
  }, []);

  // Hide the HTML loading screen as soon as React mounts
  useEffect(() => { window.__hideLoading?.(); }, []);
  const [mobileMove, setMobileMove] = useState({ forward: false, backward: false, left: false, right: false });
  const [slotCooldowns, setSlotCooldowns] = useState({});
  const [interactRadius, setInteractRadius] = useState(6);
  const [enemies, setEnemies] = useState(() => createEnemies());
  const [highlightedEnemyId, setHighlightedEnemyId] = useState(null);
  const [combatXp, setCombatXp] = useState(() => _savedExtras?.combatXp || 0);
  const [lastEnemyHitAt, setLastEnemyHitAt] = useState(0);
  const [attackFx, setAttackFx] = useState({ at: 0, enemyId: null, damage: 0 });
  const [superFx, setSuperFx] = useState({ at: 0, type: null });
  const [superCooldowns, setSuperCooldowns] = useState({});
  const [damagePopups, setDamagePopups] = useState([]);
  const [comboCount, setComboCount] = useState(0);
  const [comboStep, setComboStep] = useState(0);       // 0,1,2 = light1,light2,light3
  const [screenShake, setScreenShake] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [isDodging, setIsDodging] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0);    // 0-1
  const [stamina, setStamina] = useState(100);
  const [lockedTarget, setLockedTarget] = useState(null);
  const [killFlash, setKillFlash] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const prevLevel = useRef(1);
  const [shopOpen, setShopOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [horsePos, setHorsePos] = useState(() => _savedExtras?.horsePos || { x: -15, z: 20 });
  // ── Companion / recruitment system (init from saved extras if present) ──
  const [recruited, setRecruited] = useState(() => new Set(_savedExtras?.recruited || []));
  const [trials, setTrials] = useState(() => _savedExtras?.trials || {});
  const [companions, setCompanions] = useState(() => {
    // Re-spawn companions next to the hero based on the saved recruited list
    const saved = _savedExtras;
    if (!saved?.recruited?.length) return [];
    const heroSpawn = { x: 0, z: 12 };
    return saved.recruited.map((id, i) => {
      const savedHp = (saved.companions || []).find((c) => c.id === id);
      return {
        id,
        x: heroSpawn.x - 2 + i * 0.5,
        z: heroSpawn.z + 3 + i * 0.4,
        hp: savedHp?.hp ?? 100,
        maxHp: savedHp?.maxHp ?? 100,
        lastAttackAt: 0,
      };
    });
  });
  const totalKills = story.stats.raidersDefeated + (story.stats.minibossesDefeated || 0);
  const companionAttackTimer = useRef(0);
  // ── Item drops: pickups spawned on enemy death ──
  // { id, x, z, type: 'heal' | 'gold' | 'energy' | 'scroll', spawnedAt }
  const [items, setItems] = useState([]);
  const itemSeqRef = useRef(0);
  // Story gates between chapters — Lin Chong briefs the wife rescue before Ch.2
  const [linchongBriefed, setLinchongBriefed] = useState(() => !!_savedExtras?.linchongBriefed);
  const [sorcererRevealed, setSorcererRevealed] = useState(() => !!_savedExtras?.sorcererRevealed);
  const [sorcererDown, setSorcererDown] = useState(() => !!_savedExtras?.sorcererDown);
  const [endingChoice, setEndingChoice] = useState(() => _savedExtras?.endingChoice || null);
  const [statBonuses, setStatBonuses] = useState(() => _savedExtras?.statBonuses || { maxHp: 0, damage: 0, speed: 0, range: 0 });
  const heroPosition = useRef({ x: 0, y: 0, z: 12 });
  const lastComboAt = useRef(0);
  const autoAttackTimer = useRef(0);
  const chargeStartRef = useRef(0);
  const dodgeUntilRef = useRef(0);
  const lastStaminaUse = useRef(0);

  const heroSkin = HERO_SKINS[heroSkinIndex];

  // ── Hidden NPCs: gated by story state ──
  // Lin Chong's wife stays out of sight until Warlord Gao falls (or chapter advances past Ch2)
  const hiddenNpcs = useMemo(() => {
    const set = new Set();
    const ch = story.chapterState.chapter;
    const warlordDead = ch >= 3
      || (ch >= 2 && enemies.some((e) => e.type === 'warlord' && e.dead));
    if (!warlordDead) set.add('linchongwife');
    return set;
  }, [story.chapterState.chapter, enemies]);

  const openTavernScene = useCallback(() => setShowTavernScene(true), []);
  const closeTavernScene = useCallback(() => setShowTavernScene(false), []);

  // Trigger victory banquet when chapter completes (any path)
  useEffect(() => {
    const stage = story.chapterState.stage;
    if (prevStage.current !== 'complete' && stage === 'complete') {
      setTimeout(() => setShowVictoryBanquet(true), 1200);
    }
    prevStage.current = stage;
  }, [story.chapterState.stage]);

  const playerLevel = useMemo(() => getLevel(combatXp), [combatXp]);
  const xpProgress  = useMemo(() => getXpProgress(combatXp), [combatXp]);
  const xpForNext   = useMemo(() => getXpForNext(combatXp), [combatXp]);
  const heroStats   = useMemo(() => {
    const base = getStats(playerLevel);
    return {
      ...base,
      maxHp:  base.maxHp  + statBonuses.maxHp,
      damage: base.damage + statBonuses.damage + (isMounted ? 8 : 0),
      speed:  base.speed  + statBonuses.speed  + (isMounted ? 14 : 0),
      attackRange: base.attackRange + statBonuses.range + (isMounted ? 8 : 0),
    };
  }, [playerLevel, statBonuses, isMounted]);

  // Detect level-up (must be after playerLevel is defined)
  useEffect(() => {
    if (playerLevel > prevLevel.current) {
      prevLevel.current = playerLevel;
      setLevelUpFlash(true);
      setQuestNotice(`🌟 LEVEL UP! You are now Level ${playerLevel}! +HP +DMG +SPD`);
      setTimeout(() => setLevelUpFlash(false), 1800);
    }
  }, [playerLevel]);

  const hud = useMemo(() => ({
    hp: story.player.hp,
    maxHp: heroStats.maxHp,
    gold: story.player.gold,
    heroes: story.stats.heroesRecruited,
    objective: story.chapterState.objective,
  }), [story, heroStats]);

  const handleShopBuy = useCallback((upgradeId) => {
    const upgrade = SHOP_UPGRADES.find((u) => u.id === upgradeId);
    if (!upgrade) return;
    if (story.player.gold < upgrade.cost) {
      setQuestNotice(`Not enough gold! Need ${upgrade.cost}g`);
      return;
    }
    setStory((prev) => ({ ...prev, player: { ...prev.player, gold: prev.player.gold - upgrade.cost } }));
    if (upgrade.stat === 'healFull') {
      setStory((prev) => ({ ...prev, player: { ...prev.player, hp: heroStats.maxHp } }));
      setQuestNotice('🧪 Fully healed!');
    } else if (upgrade.stat === 'maxHp') {
      setStatBonuses((b) => ({ ...b, maxHp: b.maxHp + upgrade.amount }));
      setQuestNotice(`${upgrade.label} purchased!`);
    } else if (upgrade.stat === 'damage') {
      setStatBonuses((b) => ({ ...b, damage: b.damage + upgrade.amount }));
      setQuestNotice(`${upgrade.label} purchased!`);
    } else if (upgrade.stat === 'speed') {
      setStatBonuses((b) => ({ ...b, speed: b.speed + upgrade.amount }));
      setQuestNotice(`${upgrade.label} purchased!`);
    } else if (upgrade.stat === 'range') {
      setStatBonuses((b) => ({ ...b, range: b.range + upgrade.amount }));
      setQuestNotice(`${upgrade.label} purchased!`);
    }
  }, [story.player.gold, heroStats.maxHp]);

  const questLog = useMemo(() => getQuestLog(questProgress), [questProgress]);
  const activeQuest = useMemo(
    () => questLog.find((quest) => quest.state === 'active') || questLog.find((quest) => quest.canClaim) || questLog[0],
    [questLog],
  );

  const updateStory = useCallback((next) => {
    setStory(next);
  }, []);

  // Chapter banner auto-fade after ~3.5 seconds
  useEffect(() => {
    if (!chapterBanner) return;
    const id = window.setTimeout(() => setChapterBanner(null), 3500);
    return () => window.clearTimeout(id);
  }, [chapterBanner]);

  // Auto-save extras to localStorage (throttled to ~2 Hz max)
  useEffect(() => {
    const id = window.setTimeout(() => {
      saveExtras({
        recruited, trials, linchongBriefed, sorcererRevealed, sorcererDown,
        endingChoice, heroSkinIndex, statBonuses, combatXp, horsePos,
        companions,
      });
    }, 500);
    return () => window.clearTimeout(id);
  }, [recruited, trials, linchongBriefed, sorcererRevealed, sorcererDown,
      endingChoice, heroSkinIndex, statBonuses, combatXp, horsePos, companions]);

  // Typewriter: reveal dialog text one chunk per tick (~45 chars/sec)
  useEffect(() => {
    if (!dialog?.text) return;
    setDialogReveal(0);
    const total = dialog.text.length;
    let cancelled = false;
    let blipCounter = 0;
    const step = () => {
      if (cancelled) return;
      setDialogReveal((r) => {
        if (r >= total) return r;
        const next = Math.min(total, r + 2);
        // Soft blip roughly every ~3rd tick (~14 blips/sec)
        if ((blipCounter++ % 3) === 0 && next < total) sfxDialogBlip();
        return next;
      });
    };
    const id = window.setInterval(step, 22);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [dialog]);

  const dismissDialog = useCallback(() => {
    // If the typewriter hasn't finished yet, complete the reveal first; else close.
    if (dialog && dialogReveal < (dialog.text?.length || 0)) {
      setDialogReveal(dialog.text.length);
      return;
    }
    setDialog(null);
    setDialogReveal(0);
  }, [dialog, dialogReveal]);

  const interactWithNpc = useCallback((npcId) => {
    const npc = npcWorld.find((entry) => entry.id === npcId);
    if (!npc) return;

    const { progress: storyProgress } = handleNpcDialog(story, npc.id);
    let nextQuestProgress = questProgress;
    const acceptResult = tryAcceptQuest(nextQuestProgress, npc.id);
    nextQuestProgress = acceptResult.progress;
    const advanceResult = advanceQuestByNpc(nextQuestProgress, npc.id);
    nextQuestProgress = advanceResult.progress;

    const questEvents = [...acceptResult.events, ...advanceResult.events];
    const questLines = [];

    if (questEvents.some((event) => event.type === 'quest_accepted')) {
      const acceptedQuest = getQuestLog(nextQuestProgress).find((quest) => quest.state === 'active');
      if (acceptedQuest) {
        questLines.push(`New Quest: ${acceptedQuest.title}`);
        questLines.push(acceptedQuest.activeStepText || 'Open the quest panel for objectives.');
        setQuestNotice(`Quest accepted: ${acceptedQuest.title}`);
      }
    }

    const stepEvent = questEvents.find((event) => event.type === 'quest_step_completed');
    if (stepEvent) {
      const updatedQuest = getQuestLog(nextQuestProgress).find((quest) => quest.id === stepEvent.questId);
      if (updatedQuest?.state === 'active') {
        questLines.push(`Quest progress: ${updatedQuest.stepIndex}/${updatedQuest.stepCount}`);
        if (updatedQuest.activeStepText) questLines.push(updatedQuest.activeStepText);
      }
    }

    if (questEvents.some((event) => event.type === 'quest_step_completed')) {
      setCombatXp((xp) => xp + 15); // XP per quest step
    }
    if (questEvents.some((event) => event.type === 'quest_completed')) {
      const completedQuest = getQuestLog(nextQuestProgress).find((quest) => quest.state === 'completed');
      if (completedQuest) {
        questLines.push(`Quest complete: ${completedQuest.title}`);
        questLines.push('Claim your reward from the quest panel.');
        setQuestNotice(`Quest complete: ${completedQuest.title}`);
        setCombatXp((xp) => xp + 40); // XP for full quest completion
      }
    }

    let composed = composeDialogText(npc, storyProgress);

    // ── Recruitment trial layer ──
    if (npc.recruitable && !recruited.has(npc.id)) {
      const trial = trials[npc.id];
      if (!trial) {
        // First meeting — start a trial
        const needed = npc.id === 'songjiang' || npc.id === 'chaogai' ? 1 : 3;
        setTrials((prev) => ({ ...prev, [npc.id]: { startKills: totalKills, needed } }));
        composed += `\n\n[Trial] ${trialOpening(npc.id)}\nDefeat ${needed} more enemies, then return to me.`;
      } else {
        const progress = Math.max(0, totalKills - trial.startKills);
        if (progress >= trial.needed) {
          // Recruit!
          setRecruited((prev) => {
            const next = new Set(prev);
            next.add(npc.id);
            return next;
          });
          setCompanions((prev) => [...prev, {
            id: npc.id,
            x: heroPosition.current.x - 2,
            z: heroPosition.current.z + 2,
            hp: 100, maxHp: 100,
            lastAttackAt: 0,
          }]);
          // Bump heroes-recruited stat in story
          setStory((prev) => ({
            ...prev,
            stats: { ...prev.stats, heroesRecruited: (prev.stats.heroesRecruited || 0) + 1 },
          }));
          setQuestNotice(`✨ ${npc.role} has joined your party!`);
          composed += `\n\n[Recruited] ${trialJoinLine(npc.id)}`;
        } else {
          composed += `\n\n[Trial: ${progress}/${trial.needed} enemies defeated] Press on — return when more have fallen.`;
        }
      }
    } else if (recruited.has(npc.id)) {
      composed += `\n\n[Following you in battle.]`;
    }

    // ── Act 2 trigger: Lin Chong briefs the wife rescue after Captain Zhao falls ──
    if (
      npc.id === 'linchong' &&
      story.chapterState.stage === 'complete' &&
      story.chapterState.chapter === 1 &&
      !linchongBriefed
    ) {
      setLinchongBriefed(true);
      composed += '\n\n[Briefing] "Zhao\'s mask is yours — proof we can break their patrols. Now the wall. They took her behind the magistrate\'s gate. We ride before the lanterns dim. You, me, Liangshan steel."';
      setQuestNotice('📜 Lin Chong briefed you. Chapter 2 is open — push the gate when ready.');
    }
    // ── Act 3 trigger: sorcerer reveal after Warlord Gao falls ──
    if (
      npc.id === 'wuyong' &&
      story.chapterState.stage === 'complete' &&
      story.chapterState.chapter === 2 &&
      !sorcererRevealed
    ) {
      setSorcererRevealed(true);
      composed += '\n\n[Revelation] "I read the warlord\'s seal as the smoke cleared. It is not magistrate ink. There is a third hand — a sorcerer who fed the warlord his cruelty. He holds the same thread that pulled you here. Find him, and you find the road home."';
      setQuestNotice('🌑 A sorcerer pulls the strings. Chapter 3 begins.');
    }

    setDialog({
      npc,
      text: questLines.length ? `${composed}\n\n${questLines.join('\n')}` : composed,
    });

    setQuestProgress(nextQuestProgress);
    updateStory(storyProgress);
  }, [questProgress, story, updateStory]);

  const attemptInteraction = useCallback(() => {
    // If already mounted, pressing E dismounts here — drop horse beside hero
    if (isMounted) {
      setIsMounted(false);
      // Place horse a short step to the hero's side so it doesn't overlap the hero
      setHorsePos({
        x: heroPosition.current.x - 3,
        z: heroPosition.current.z + 1,
      });
      setQuestNotice('🐴 Dismounted');
      return;
    }
    // Otherwise, mount if near the horse
    const dx = heroPosition.current.x - horsePos.x;
    const dz = heroPosition.current.z - horsePos.z;
    const distToHorse = Math.hypot(dx, dz);
    if (distToHorse < 8) {
      setIsMounted(true);
      setQuestNotice('🐴 Mounted! Speed +60%, sweep attacks');
      return;
    }
    if (!highlightedNpcId) return;
    interactWithNpc(highlightedNpcId);
  }, [highlightedNpcId, interactWithNpc, horsePos, isMounted]);

  const cycleHeroSkin = useCallback(() => {
    setHeroSkinIndex((prev) => (prev + 1) % HERO_SKINS.length);
  }, []);

  const [joystickState, setJoystickState] = useState({
    active: false,
    pointerId: null,
    baseX: 0,
    baseY: 0,
    knobX: 0,
    knobY: 0,
  });

  // ── Item drop spawning ──
  // Roughly 1 in 2.5 kills produces a pickup. Item type weighted: heal > gold > energy > scroll.
  const maybeSpawnDrop = useCallback((x, z) => {
    if (Math.random() > 0.40) return;
    const roll = Math.random();
    const type = roll < 0.42 ? 'heal' : roll < 0.72 ? 'gold' : roll < 0.90 ? 'energy' : 'scroll';
    itemSeqRef.current += 1;
    setItems((prev) => [...prev, {
      id: `item_${itemSeqRef.current}`,
      x: x + (Math.random() - 0.5) * 2,
      z: z + (Math.random() - 0.5) * 2,
      type,
      spawnedAt: Date.now(),
    }]);
  }, []);

  const handleClaimReward = useCallback((questId) => {
    const { questProgress: nextQuest, storyProgress: nextStory, reward } = claimQuestReward(questProgress, story, questId);
    if (!reward) return;
    setQuestProgress(nextQuest);
    setStory(nextStory);
    setQuestNotice(`Quest reward claimed: +${reward.gold || 0} gold, +${reward.hpRestore || 0} HP (${reward.title})`);
  }, [questProgress, story]);

  const handleActionSlot = useCallback((slotId) => {
    const now = Date.now();
    const slot = ACTION_SLOTS.find((entry) => entry.id === slotId);
    if (!slot) return;

    const readyAt = slotCooldowns[slotId] || 0;
    if (readyAt > now) {
      const secLeft = Math.ceil((readyAt - now) / 1000);
      setQuestNotice(`${slot.label} cooldown: ${secLeft}s`);
      return;
    }

    if (slotId === 'gourd') {
      const maxHp = story.player.hpMax || 100;
      if (story.player.hp >= maxHp) {
        setQuestNotice('HP already full.');
      } else {
        const healed = Math.min(30, maxHp - story.player.hp);
        setStory((prev) => ({
          ...prev,
          player: { ...prev.player, hp: Math.min(maxHp, prev.player.hp + 30) },
        }));
        setQuestNotice(`Used Heal Brew: +${healed} HP`);
      }
    }

    if (slotId === 'staff') {
      const nearest = npcWorld.reduce((best, npc) => {
        const dx = npc.world.x - heroPosition.current.x;
        const dz = npc.world.z - heroPosition.current.z;
        const dist = Math.hypot(dx, dz);
        if (!best || dist < best.dist) return { npc, dist };
        return best;
      }, null);

      if (nearest) {
        setHighlightedNpcId(nearest.npc.id);
        setQuestNotice(`Scout Ping: nearest NPC is ${nearest.npc.name}`);
      } else {
        setQuestNotice('Scout Ping found nothing nearby.');
      }
    }

    if (slotId === 'axe') {
      const goldFound = 15;
      setStory((prev) => ({
        ...prev,
        player: { ...prev.player, gold: prev.player.gold + goldFound },
      }));
      setQuestNotice(`Forage success: +${goldFound} gold`);
    }

    if (slotId === 'glove') {
      setInteractRadius(10);
      setQuestNotice('Focus active: easier NPC interaction for 12s');
      window.setTimeout(() => setInteractRadius(6), 12000);
    }

    if (slotId === 'camp') {
      const maxHp = story.player.hpMax || 100;
      const nextStory = {
        ...story,
        player: { ...story.player, hp: maxHp },
      };
      setStory(nextStory);
      saveStoryProgress(nextStory);
      saveQuestProgress(questProgress);
      setQuestNotice('Camp Rest: HP restored and progress saved');
    }

    setSlotCooldowns((prev) => ({ ...prev, [slotId]: now + slot.cooldownMs }));
  }, [questProgress, slotCooldowns, story]);

  const updateMobileMoveByVector = useCallback((x, y) => {
    const deadZone = 10;
    setMobileMove({
      forward: y < -deadZone,
      backward: y > deadZone,
      left: x < -deadZone,
      right: x > deadZone,
    });
  }, []);

  const resetMobileMove = useCallback(() => {
    setMobileMove({ forward: false, backward: false, left: false, right: false });
  }, []);

  const handleJoystickDown = useCallback((event) => {
    if (dialog || showTavernScene) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setJoystickState({
      active: true,
      pointerId: event.pointerId,
      baseX: event.clientX,
      baseY: event.clientY,
      knobX: 0,
      knobY: 0,
    });
    resetMobileMove();
  }, [dialog, resetMobileMove, showTavernScene]);

  const handleJoystickMove = useCallback((event) => {
    setJoystickState((prev) => {
      if (!prev.active || prev.pointerId !== event.pointerId) return prev;
      const rawX = event.clientX - prev.baseX;
      const rawY = event.clientY - prev.baseY;
      const max = 40;
      const clampedX = Math.max(-max, Math.min(max, rawX));
      const clampedY = Math.max(-max, Math.min(max, rawY));
      updateMobileMoveByVector(clampedX, clampedY);
      return { ...prev, knobX: clampedX, knobY: clampedY };
    });
  }, [updateMobileMoveByVector]);

  const handleJoystickUp = useCallback((event) => {
    setJoystickState((prev) => {
      if (!prev.active || (event?.pointerId != null && prev.pointerId !== event.pointerId)) return prev;
      return {
        active: false,
        pointerId: null,
        baseX: 0,
        baseY: 0,
        knobX: 0,
        knobY: 0,
      };
    });
    resetMobileMove();
  }, [resetMobileMove]);

  // ── LIGHT ATTACK (3-hit combo) ──
  const handleAttack = useCallback((forcedEnemyId = null, isAuto = false) => {
    if (isDodging) return; // i-frames during dodge
    if (stamina < 8) { setQuestNotice('⚡ No stamina!'); return; }

    const target = forcedEnemyId
      ? enemies.find((e) => e.id === forcedEnemyId && !e.dead)
      : lockedTarget
        ? enemies.find((e) => e.id === lockedTarget && !e.dead)
        : highlightedEnemyId
          ? enemies.find((e) => e.id === highlightedEnemyId && !e.dead)
          : getClosestLiveEnemy(enemies, heroPosition.current.x, heroPosition.current.z, heroStats.attackRange);

    const now = Date.now();
    const timeSinceLast = now - lastComboAt.current;

    // 3-hit light combo: step resets if > 1.8s between hits
    const nextStep = timeSinceLast < 1800 ? (comboStep + 1) % 3 : 0;
    setComboStep(nextStep);
    lastComboAt.current = now;
    const newCombo = timeSinceLast < 1800 ? comboCount + 1 : 1;
    setComboCount(newCombo);

    // Stamina cost + animation always fires regardless of target
    setStamina((s) => Math.max(0, s - 10));
    lastStaminaUse.current = now;
    setAttackFx({ at: now, enemyId: target?.id ?? null, damage: 0, step: nextStep });

    if (!target) return; // swing in air — animation plays, no damage

    const stepMult = [1.0, 1.15, 1.5][nextStep];
    const isCrit = Math.random() < 0.12 + (newCombo > 5 ? 0.18 : 0);
    const base = heroStats.damage + Math.floor(Math.random() * 6);
    const dmg = Math.round(base * stepMult * (isCrit ? 2.2 : 1));

    let next = knockbackEnemy(enemies, target.id, heroPosition.current.x, heroPosition.current.z, 5 + nextStep * 3);
    const res = damageEnemy(next, target.id, dmg, now);
    next = res.enemies;
    setEnemies(next);
    setAttackFx({ at: now, enemyId: target.id, damage: dmg, step: nextStep });

    const label = isCrit ? `💥CRIT ${dmg}` : nextStep === 2 ? `⚡ ${dmg}` : newCombo >= 3 ? `🔥×${newCombo} ${dmg}` : `-${dmg}`;
    setDamagePopups((p) => [...p, { id: `${now}-${target.id}`, text: label, crit: isCrit || nextStep === 2 }]);

    if (isCrit || nextStep === 2) {
      setScreenShake(true); setTimeout(() => setScreenShake(false), 180);
      triggerHitStop(isCrit ? 70 : 45);
      if (isCrit) sfxCrit(); else sfxHit();
    } else {
      sfxHit();
    }

    // Combo XP bonus every 3rd hit
    if (newCombo > 0 && newCombo % 3 === 0) {
      const comboXp = newCombo * 2;
      setCombatXp((xp) => xp + comboXp);
    }

    if (res.killed) {
      setKillFlash(true); setSlowMo(true);
      setTimeout(() => { setKillFlash(false); setSlowMo(false); }, 600);
      const isBoss = res.enemy.type === 'captain' || res.enemy.type === 'warlord' || res.enemy.type === 'sorcerer';
      triggerHitStop(isBoss ? 160 : 100);
      sfxKill();
      setStory((prev) => {
        const r = { ...prev, player: { ...prev.player, gold: prev.player.gold + res.enemy.goldDrop } };
        return isBoss ? recordMiniBossDefeat(r) : recordRaiderKill(r);
      });
      maybeSpawnDrop(res.enemy.x, res.enemy.z);
      // Kill XP + combo finish bonus
      const killXp = res.enemy.xp + (newCombo >= 3 ? Math.floor(newCombo * 1.5) : 0);
      setCombatXp((xp) => xp + killXp);
      setComboCount(0); setComboStep(0);
      setLockedTarget(null); setHighlightedEnemyId(null);
      setQuestNotice(`☠️ ${res.enemy.label} defeated! +${res.enemy.goldDrop}g +${killXp}xp`);
    }
  }, [enemies, highlightedEnemyId, lockedTarget, heroStats, comboCount, comboStep, isDodging, stamina]);

  // ── CHARGED HEAVY ATTACK ──
  const handleChargeStart = useCallback(() => {
    if (isDodging || stamina < 20) return;
    chargeStartRef.current = Date.now();
    setIsCharging(true);
  }, [isDodging, stamina]);

  const handleChargeRelease = useCallback(() => {
    if (!isCharging) return;
    setIsCharging(false);
    setChargeLevel(0);
    const held = Math.min((Date.now() - chargeStartRef.current) / 1200, 1);
    if (held < 0.2) return; // too short = nothing

    const target = lockedTarget
      ? enemies.find((e) => e.id === lockedTarget && !e.dead)
      : getClosestLiveEnemy(enemies, heroPosition.current.x, heroPosition.current.z, heroStats.attackRange * 1.4);
    if (!target) return;

    const now = Date.now();
    const dmg = Math.round(heroStats.damage * (1.8 + held * 2.5));
    const isCrit = held > 0.8;

    setStamina((s) => Math.max(0, s - 28));
    lastStaminaUse.current = now;

    let next = knockbackEnemy(enemies, target.id, heroPosition.current.x, heroPosition.current.z, 12 + held * 8);
    const res = damageEnemy(next, target.id, dmg, now);
    setEnemies(res.enemies);
    setAttackFx({ at: now, enemyId: target.id, damage: dmg, heavy: true, chargeLevel: held });
    setDamagePopups((p) => [...p, { id: `${now}-heavy`, text: `⚡HEAVY ${dmg}`, crit: true }]);
    setScreenShake(true); setTimeout(() => setScreenShake(false), 300);
    triggerHitStop(70 + Math.round(held * 50)); // longer freeze when fully charged

    if (res.killed) {
      setKillFlash(true); setSlowMo(true);
      setTimeout(() => { setKillFlash(false); setSlowMo(false); }, 700);
      const isBoss = res.enemy.type === 'captain' || res.enemy.type === 'warlord' || res.enemy.type === 'sorcerer';
      triggerHitStop(isBoss ? 180 : 110);
      sfxKill();
      setStory((prev) => {
        const r = { ...prev, player: { ...prev.player, gold: prev.player.gold + res.enemy.goldDrop } };
        return isBoss ? recordMiniBossDefeat(r) : recordRaiderKill(r);
      });
      maybeSpawnDrop(res.enemy.x, res.enemy.z);
      setCombatXp((xp) => xp + res.enemy.xp);
      setLockedTarget(null);
      setQuestNotice(`☠️ ${res.enemy.label} slain! +${res.enemy.goldDrop}g`);
    } else {
      // Heavy hit but enemy survived
      sfxCrit();
    }
  }, [isCharging, enemies, lockedTarget, heroStats, isDodging, maybeSpawnDrop]);

  // ── DODGE ROLL ──
  const handleDodge = useCallback(() => {
    if (stamina < 18) { setQuestNotice('⚡ No stamina to dodge!'); return; }
    const now = Date.now();
    if (now < dodgeUntilRef.current + 600) return; // dodge cooldown
    dodgeUntilRef.current = now;
    setIsDodging(true);
    setStamina((s) => Math.max(0, s - 20));
    lastStaminaUse.current = now;
    setTimeout(() => setIsDodging(false), 500); // 500ms i-frames
    setAttackFx((prev) => ({ ...prev, dodge: now })); // signal Scene
  }, [stamina]);

  // ── LOCK-ON ──
  const handleLockOn = useCallback(() => {
    if (lockedTarget) { setLockedTarget(null); return; }
    const nearest = getClosestLiveEnemy(enemies, heroPosition.current.x, heroPosition.current.z, 50);
    if (nearest) { setLockedTarget(nearest.id); setQuestNotice(`🎯 Locked: ${nearest.label}`); }
  }, [enemies, lockedTarget]);

  const handleSuperMove = useCallback((superId) => {
    const now = Date.now();
    const move = SUPER_MOVES.find((m) => m.id === superId);
    if (!move) return;
    const readyAt = superCooldowns[superId] || 0;
    if (readyAt > now) {
      const sec = Math.ceil((readyAt - now) / 1000);
      setQuestNotice(`${move.label} — cooldown: ${sec}s`);
      return;
    }

    setSuperCooldowns((prev) => ({ ...prev, [superId]: now + move.cooldownMs }));
    setSuperFx({ at: now, type: superId });

    if (superId === 'dragon') {
      // Pierce: heavy single-target
      const target = getClosestLiveEnemy(enemies, heroPosition.current.x, heroPosition.current.z, 40);
      if (!target) { setQuestNotice('No enemy in range for Dragon Strike!'); return; }
      const dmg = 55 + Math.floor(Math.random() * 15);
      const { enemies: next, killed, enemy } = damageEnemy(enemies, target.id, dmg, now);
      setEnemies(next);
      setAttackFx({ at: now, enemyId: target.id, damage: dmg });
      setDamagePopups((prev) => [...prev, { id: `super-${now}`, text: `🐉 -${dmg}`, crit: true }]);
      setQuestNotice(`Dragon Strike! Hit ${enemy?.label} for ${dmg}!`);
      if (killed) {
        setStory((prev) => recordRaiderKill(prev));
        setCombatXp((xp) => xp + (enemy?.xp || 30));
        if (enemy) maybeSpawnDrop(enemy.x, enemy.z);
        triggerHitStop(140);
        sfxKill();
      } else {
        triggerHitStop(80);
        sfxCrit();
      }
    }

    if (superId === 'storm') {
      sfxCrit();
      // Single freeze at kickoff — multi-hit shouldn't stutter
      triggerHitStop(90);
      // AoE sweep all nearby
      let totalDmg = 0;
      let hitCount = 0;
      let nextEnemies = enemies;
      const liveTargets = enemies.filter((e) => !e.dead && Math.hypot(e.x - heroPosition.current.x, e.z - heroPosition.current.z) < 36);
      liveTargets.forEach((e) => {
        const dmg = 28 + Math.floor(Math.random() * 16);
        const result = damageEnemy(nextEnemies, e.id, dmg, now);
        nextEnemies = result.enemies;
        totalDmg += dmg;
        hitCount += 1;
        setAttackFx({ at: now + hitCount * 60, enemyId: e.id, damage: dmg });
        if (result.killed) {
          setStory((prev) => recordRaiderKill(prev));
          setCombatXp((xp) => xp + (result.enemy?.xp || 20));
          if (result.enemy) maybeSpawnDrop(result.enemy.x, result.enemy.z);
        }
      });
      setEnemies(nextEnemies);
      setDamagePopups((prev) => [...prev, { id: `super-${now}`, text: `⚡ ${hitCount} hit${hitCount !== 1 ? 's' : ''}!`, crit: true }]);
      setQuestNotice(hitCount > 0 ? `Storm Sweep hit ${hitCount} enemies for ${totalDmg} total!` : 'Storm Sweep — no enemies in range!');
    }

    if (superId === 'shadow') {
      // Crit blink — teleport + massive damage
      const target = getClosestLiveEnemy(enemies, heroPosition.current.x, heroPosition.current.z, 60);
      if (!target) { setQuestNotice('No enemy in range for Shadow Blink!'); return; }
      const dmg = 75 + Math.floor(Math.random() * 20);
      const { enemies: next, killed, enemy } = damageEnemy(enemies, target.id, dmg, now);
      setEnemies(next);
      setAttackFx({ at: now, enemyId: target.id, damage: dmg });
      setDamagePopups((prev) => [...prev, { id: `super-${now}`, text: `🌑 CRIT -${dmg}`, crit: true }]);
      setQuestNotice(`Shadow Blink! Backstab ${enemy?.label} for ${dmg} crit!`);
      if (killed) {
        setStory((prev) => recordRaiderKill(prev));
        setCombatXp((xp) => xp + (enemy?.xp || 40));
        if (enemy) maybeSpawnDrop(enemy.x, enemy.z);
        triggerHitStop(180); // shadow crit-blink lands hardest
        sfxKill();
      } else {
        triggerHitStop(110);
        sfxCrit();
      }
    }
  }, [enemies, superCooldowns, maybeSpawnDrop]);

  const handleInteractPointer = useCallback((event) => {
    event.preventDefault();
    if (dialog) {
      dismissDialog();
      return;
    }
    if (highlightedNpcId) {
      attemptInteraction();
      return;
    }
    if (highlightedEnemyId) {
      handleAttack();
      return;
    }
    attemptInteraction();
  }, [attemptInteraction, dialog, dismissDialog, handleAttack, highlightedEnemyId, highlightedNpcId]);

  const handleNpcTap = useCallback((npcId) => {
    if (dialog) {
      dismissDialog();
      return;
    }
    setHighlightedNpcId(npcId);
    interactWithNpc(npcId);
  }, [dialog, dismissDialog, interactWithNpc]);

  const handleEnemyTap = useCallback((enemyId) => {
    setHighlightedEnemyId(enemyId);
    handleAttack(enemyId);
  }, [handleAttack]);

  const handleHeroMove = useCallback((pos) => {
    heroPosition.current = pos;
    const { npc, distance } = npcWorld.reduce((closest, candidate) => {
      const dx = candidate.world.x - pos.x;
      const dz = candidate.world.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (!closest || dist < closest.distance) {
        return { npc: candidate, distance: dist };
      }
      return closest;
    }, null) || {};

    if (npc && distance < interactRadius) {
      setHighlightedNpcId(npc.id);
    } else {
      setHighlightedNpcId(null);
    }

    const nearestEnemy = getClosestLiveEnemy(enemies, pos.x, pos.z, 16);
    setHighlightedEnemyId(nearestEnemy?.id || null);
  }, [enemies, interactRadius]);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setWebglSupported(Boolean(gl));
    } catch {
      setWebglSupported(false);
    }
  }, []);

  useEffect(() => {
    saveQuestProgress(questProgress);
  }, [questProgress]);

  useEffect(() => {
    if (!questNotice) return;
    const timer = window.setTimeout(() => setQuestNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [questNotice]);

  useEffect(() => {
    if (!damagePopups.length) return;
    const timer = window.setTimeout(() => {
      setDamagePopups((prev) => prev.slice(1));
    }, 420);
    return () => window.clearTimeout(timer);
  }, [damagePopups]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (nowMs) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      const nowSec = nowMs * 0.001;

      // Hit-stop: skip simulation while the freeze window is active
      if (Date.now() < (window.__hitStopUntil || 0)) {
        raf = window.requestAnimationFrame(tick);
        return;
      }

      setEnemies((prev) => {
        const moved = stepEnemies(prev, heroPosition.current, nowSec, dt, Date.now());
        return respawnEnemies(moved, Date.now());
      });

      // Auto-attack: strike nearest enemy in range every 900ms
      autoAttackTimer.current -= dt * 1000;
      if (autoAttackTimer.current <= 0) {
        autoAttackTimer.current = 900;
        const nearest = getClosestLiveEnemy(
          // use current enemies from ref — we call handleAttack which reads state
          [], heroPosition.current.x, heroPosition.current.z, 0
        );
        // trigger via event so it can read current state
        window.dispatchEvent(new CustomEvent('game:autoattack'));
      }

      // ── Companion follow + HP regen / downed state ──
      setCompanions((prev) => {
        if (prev.length === 0) return prev;
        const hero = heroPosition.current;
        const now = Date.now();
        return prev.map((c, i) => {
          // Position target — fanned slot behind hero
          const angle = (i / Math.max(1, prev.length)) * Math.PI * 1.4 - Math.PI * 0.7;
          const radius = 4.5;
          const targetX = hero.x + Math.sin(angle) * radius;
          const targetZ = hero.z + radius * 0.7 + Math.cos(angle) * 1.5;
          const dx = targetX - c.x, dz = targetZ - c.z;
          const dist = Math.hypot(dx, dz);
          let nx = c.x, nz = c.z;
          if (dist > 60) { nx = targetX; nz = targetZ; }
          else { nx += dx * Math.min(1, dt * 4); nz += dz * Math.min(1, dt * 4); }

          // HP / downed state
          let hp = c.hp;
          let downedUntil = c.downedUntil || 0;
          const maxHp = c.maxHp || 100;
          if (downedUntil > 0 && now >= downedUntil) {
            // Recover from downed at half HP
            hp = Math.floor(maxHp * 0.5);
            downedUntil = 0;
          } else if (now < downedUntil) {
            // Stay knocked out — no HP change
          } else {
            // Check proximity to any live enemy
            let inDanger = false;
            for (const e of enemies) {
              if (e.dead) continue;
              if (Math.hypot(e.x - nx, e.z - nz) < 4.2) { inDanger = true; break; }
            }
            if (inDanger) {
              hp = Math.max(0, hp - 4.5 * dt);
              if (hp <= 0) downedUntil = now + 5000;
            } else if (hp < maxHp) {
              hp = Math.min(maxHp, hp + 7 * dt);
            }
          }
          return { ...c, x: nx, z: nz, hp, downedUntil };
        });
      });

      // Companion combat: fire event every 150ms; per-companion cooldown gates actual attacks
      companionAttackTimer.current -= dt * 1000;
      if (companionAttackTimer.current <= 0) {
        companionAttackTimer.current = 150;
        if (companions.length > 0) {
          window.dispatchEvent(new CustomEvent('game:companionattack'));
        }
      }

      // ── Item pickup: hero walks over a drop → consume it ──
      setItems((prev) => {
        if (prev.length === 0) return prev;
        const hero = heroPosition.current;
        const now = Date.now();
        const next = [];
        for (const it of prev) {
          const d = Math.hypot(it.x - hero.x, it.z - hero.z);
          if (d < 2.6) {
            // Consume — schedule effect in microtask so we don't nest setState
            queueMicrotask(() => {
              sfxPickup(it.type);
              if (it.type === 'heal') {
                setStory((s) => ({ ...s, player: { ...s.player, hp: Math.min(s.player.hpMax || 100, s.player.hp + 25) } }));
                setQuestNotice('💊 Healing pellet +25 HP');
              } else if (it.type === 'gold') {
                setStory((s) => ({ ...s, player: { ...s.player, gold: s.player.gold + 25 } }));
                setQuestNotice('🪙 Gold pouch +25');
              } else if (it.type === 'energy') {
                setStamina((st) => Math.min(100, st + 35));
                setQuestNotice('⚡ Stamina draught +35');
              } else if (it.type === 'scroll') {
                setCombatXp((xp) => xp + 30);
                setQuestNotice('📜 Training scroll +30 xp');
              }
            });
            continue; // remove from list
          }
          // Despawn after 25 seconds
          if (now - it.spawnedAt < 25000) next.push(it);
        }
        return next;
      });

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  // ── Sorcerer-down detection: opens the branching ending choice ──
  useEffect(() => {
    if (sorcererDown || endingChoice) return;
    const sorcerer = enemies.find((e) => e.type === 'sorcerer');
    if (sorcerer && sorcerer.dead) {
      setSorcererDown(true);
      setQuestNotice('🌑 The sorcerer falls — but his thread coils on. Make your choice.');
    }
  }, [enemies, sorcererDown, endingChoice]);

  // ── Companion auto-attack: per-hero range/damage/cooldown + specials ──
  // Specials:
  //   heal     — restore HP to player when below 60%
  //   knockback — attack also shoves enemy backward
  //   gold     — kills give +50% extra gold
  //   rally    — player kills give a small XP echo to all companions (handled here as +xp bonus)
  useEffect(() => {
    const handler = () => {
      if (companions.length === 0) return;
      let updated = enemies;
      let anyHit = false;
      let touchedCompanions = false;
      const now = Date.now();
      const newCompanions = companions.map((c) => ({ ...c }));

      for (const c of newCompanions) {
        // Skip downed companions — they can't attack while incapacitated
        if (c.downedUntil && now < c.downedUntil) continue;
        const trait = heroTrait(c.id);
        // Per-companion cooldown
        if (now - (c.lastAttackAt || 0) < trait.cooldown) continue;

        // Healer: heal player instead of attacking
        if (trait.special === 'heal') {
          const hp = story.player.hp;
          const maxHp = heroStats.maxHp;
          if (hp < maxHp * 0.6) {
            const heal = 10 + Math.floor(Math.random() * 8);
            setStory((prev) => ({ ...prev, player: { ...prev.player, hp: Math.min(maxHp, prev.player.hp + heal) } }));
            setQuestNotice(`✚ ${c.id === 'andaoquan' ? 'An Daoquan' : 'Healer'} mends you (+${heal} HP)`);
            c.lastAttackAt = now;
            touchedCompanions = true;
          }
          continue;
        }

        const target = getClosestLiveEnemy(updated, c.x, c.z, trait.range);
        if (!target) continue;
        const dmgMin = trait.dmg[0], dmgMax = trait.dmg[1];
        const dmg = dmgMin + Math.floor(Math.random() * (dmgMax - dmgMin + 1));
        // Knockback if the trait calls for it
        if (trait.special === 'knockback') {
          updated = knockbackEnemy(updated, target.id, c.x, c.z, 9);
        }
        const res = damageEnemy(updated, target.id, dmg, now);
        updated = res.enemies;
        anyHit = true;
        c.lastAttackAt = now;
        touchedCompanions = true;
        setDamagePopups((p) => [...p, { id: `comp-${c.id}-${now}`, text: `-${dmg}`, crit: false }]);

        if (res.killed) {
          const goldMul = trait.special === 'gold' ? 1.5 : 0.5;
          const xpMul = trait.special === 'rally' ? 0.75 : 0.5;
          const baseGold = Math.floor((res.enemy.goldDrop || 0) * goldMul);
          setStory((prev) => {
            const r = { ...prev, player: { ...prev.player, gold: prev.player.gold + baseGold } };
            return (res.enemy.type === 'captain' || res.enemy.type === 'warlord') ? recordMiniBossDefeat(r) : recordRaiderKill(r);
          });
          setCombatXp((xp) => xp + Math.floor((res.enemy.xp || 10) * xpMul));
          maybeSpawnDrop(res.enemy.x, res.enemy.z);
          // Lighter freeze for companion kills — half the player-kill duration
          const isBoss = res.enemy.type === 'captain' || res.enemy.type === 'warlord' || res.enemy.type === 'sorcerer';
          triggerHitStop(isBoss ? 80 : 55);
          if (isBoss) sfxKill(); else sfxHit();
        }
      }
      if (anyHit) setEnemies(updated);
      if (touchedCompanions) setCompanions(newCompanions);
    };
    window.addEventListener('game:companionattack', handler);
    return () => window.removeEventListener('game:companionattack', handler);
  }, [companions, enemies, maybeSpawnDrop, story.player.hp, heroStats.maxHp]);

  // Auto-attack listener — disabled, player controls combat now
  // (kept for super move area hits)

  // Combo timeout
  useEffect(() => {
    if (comboCount === 0) return;
    const t = setTimeout(() => { setComboCount(0); setComboStep(0); }, 2000);
    return () => clearTimeout(t);
  }, [comboCount]);

  // Stamina regen (regen after 1.2s of no use)
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      if (now - lastStaminaUse.current > 1200) {
        setStamina((s) => Math.min(100, s + 3));
      }
    }, 80);
    return () => clearInterval(id);
  }, []);

  // Charge level update
  useEffect(() => {
    if (!isCharging) { setChargeLevel(0); return; }
    const id = setInterval(() => {
      setChargeLevel(Math.min((Date.now() - chargeStartRef.current) / 1200, 1));
    }, 40);
    return () => clearInterval(id);
  }, [isCharging]);

  // Sprint + dodge + lock-on + charge keys
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setIsSprinting(true);
      if (e.code === 'Space' && !e.repeat) handleDodge();
      if (e.code === 'Tab') { e.preventDefault(); handleLockOn(); }
      if (e.code === 'KeyJ' && !e.repeat) handleChargeStart();
    };
    const onUp = (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setIsSprinting(false);
      if (e.code === 'KeyJ') handleChargeRelease();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [handleDodge, handleLockOn, handleChargeStart, handleChargeRelease]);

  useEffect(() => {
    const nearestEnemy = getClosestLiveEnemy(enemies, heroPosition.current.x, heroPosition.current.z, 22);
    setHighlightedEnemyId(nearestEnemy?.id || null);

    if (!nearestEnemy) return;
    const now = Date.now();
    if (now - lastEnemyHitAt < 1200) return;

    const dist = Math.hypot(nearestEnemy.x - heroPosition.current.x, nearestEnemy.z - heroPosition.current.z);
    if (dist < 3.1) {
      const hit = Math.max(2, Math.floor(nearestEnemy.damage * 0.45));
      setStory((prev) => ({
        ...prev,
        player: { ...prev.player, hp: Math.max(0, prev.player.hp - hit) },
      }));
      setLastEnemyHitAt(now);
      setQuestNotice(`You were hit by ${nearestEnemy.label} (-${hit} HP)`);
    }
  }, [enemies, lastEnemyHitAt]);

  useEffect(() => {
    if (story.player.hp > 0) return;
    const timer = window.setTimeout(() => {
      setStory((prev) => ({
        ...prev,
        player: { ...prev.player, hp: prev.player.hpMax || 100 },
      }));
      setQuestNotice('You were defeated. Respawned at camp.');
      heroPosition.current = { x: 0, y: 0, z: 12 };
      setEnemies(createEnemies());
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [story.player.hp]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'KeyE') {
        if (showTavernScene) {
          closeTavernScene();
          return;
        }
        if (dialog) {
          dismissDialog();
        } else {
          attemptInteraction();
        }
      } else if (event.code === 'KeyF' || event.code === 'KeyZ') {
        handleAttack();
      } else if (event.code === 'Digit1') {
        handleSuperMove('dragon');
      } else if (event.code === 'Digit2') {
        handleSuperMove('storm');
      } else if (event.code === 'Digit3') {
        handleSuperMove('shadow');
      } else if (event.code === 'Space' || event.code === 'Escape') {
        if (showTavernScene) {
          closeTavernScene();
          return;
        }
        if (dialog) {
          dismissDialog();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attemptInteraction, closeTavernScene, dialog, dismissDialog, handleAttack, handleSuperMove, showTavernScene, handleDodge, handleLockOn]);

  return (
    <div className={`hud-shell ${dialog ? 'dialog-open' : ''}`}>
      {showOpening && (
        <OpeningCinematic onComplete={() => {
          sessionStorage.setItem('cine_seen', '1');
          setShowOpening(false);
        }} />
      )}
      <div className="hud-frame">
        {webglSupported ? (
          <GameCanvas onHeroMove={handleHeroMove} highlightedNpcId={highlightedNpcId} highlightedEnemyId={highlightedEnemyId} heroSkin={heroSkin} moveInput={mobileMove} onNpcTap={handleNpcTap} onEnemyTap={handleEnemyTap} enemies={enemies} attackFx={attackFx} superFx={superFx} isSprinting={isSprinting} screenShake={screenShake} isDodging={isDodging} isCharging={isCharging} chargeLevel={chargeLevel} lockedTarget={lockedTarget} killFlash={killFlash} slowMo={slowMo} isMounted={isMounted} horsePos={horsePos} chapter={story.chapterState.chapter} companions={companions} recruited={recruited} items={items} hiddenNpcs={hiddenNpcs} />
        ) : (
          <div className="webgl-fallback">
            <div className="webgl-fallback-title">3D engine failed to start</div>
            <div className="webgl-fallback-body">Your browser/device blocked WebGL. Try Chrome/Edge, disable battery saver, or update GPU drivers.</div>
          </div>
        )}
        {highlightedNpcId && !dialog && (
          <div className="interact-prompt">{INTERACT_PROMPT}</div>
        )}
      </div>

      <div className="hud-top">
        <div className="stat-block">
          <div className="stat-label"><span className="icon heart" /> HP</div>
          <div className="bar">
            <div className="fill" style={{ width: `${Math.round((hud.hp / hud.maxHp) * 100)}%` }} />
          </div>
          <div className="stat-value">{hud.hp}/{hud.maxHp}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label"><span className="icon bolt" /> Energy</div>
          <div className="bar energy">
            <div className="fill" style={{ width: `${Math.min(100, Math.round((hud.hp / hud.maxHp) * 100) + 10)}%` }} />
          </div>
          <div className="stat-value">{Math.min(100, Math.round((hud.hp / hud.maxHp) * 100) + 10)}%</div>
        </div>
        <div className="stat-block mini">
          <div className="stat-label"><span className="icon bag" /></div>
          <div className="stat-value">{hud.gold}</div>
        </div>
      </div>

      <div className="hud-objective" aria-live="polite">
        {hud.objective}
        {/* Quick action hint based on stage */}
        {(() => {
          const s = story.chapterState.stage;
          const ch = story.chapterState.chapter;
          const hints = {
            chapter0_intro:   '💬 Find Wu Yong (yellow ring) and talk to him',
            chapter0_recruit: '💬 Talk to Lin Chong + Tonkey (yellow rings)',
            chapter0_ready:   '💬 Talk to Song Jiang to begin Chapter 1',
            talk_villager:    '💬 Find Village Elder Liu and talk to him',
            clear_raiders:    `⚔️ Kill enemies — ${story.chapterState.raidersDefeated}/${story.chapterState.raidersTarget} ${ch === 2 ? 'guards' : 'raiders'} down`,
            clear_guards:     `⚔️ Kill guards — ${story.chapterState.raidersDefeated}/${story.chapterState.raidersTarget} down`,
            defeat_miniboss:  ch === 2 ? '⚔️ Destroy Warlord Gao — he is massive and armored!' : '⚔️ Defeat the Captain (large red ring on ground)!',
            return_songjiang: '💬 Return to Song Jiang — or just keep fighting!',
            complete:         ch === 2 ? '✅ Chapter 2 complete! The Magistrate falls.' : '✅ Chapter 1 complete!',
          };
          const hint = hints[s];
          return hint ? <div className="objective-hint">{hint}</div> : null;
        })()}
      </div>

      <div className="quest-panel" aria-live="polite">
        <div className="quest-header">Quest Log</div>
        {activeQuest ? (
          <>
            <div className="quest-title">{activeQuest.title}</div>
            <div className="quest-state">{activeQuest.state.toUpperCase()}</div>
            <div className="quest-text">
              {activeQuest.state === 'active'
                ? activeQuest.activeStepText
                : activeQuest.state === 'completed'
                  ? 'Quest complete. Claim your reward.'
                  : activeQuest.summary}
            </div>
            <div className="quest-progress">{activeQuest.stepIndex}/{activeQuest.stepCount} steps</div>
            {activeQuest.canClaim && (
              <button className="quest-claim" onClick={() => handleClaimReward(activeQuest.id)}>
                Claim Reward (+{activeQuest.reward?.gold || 0} gold)
              </button>
            )}
          </>
        ) : (
          <div className="quest-text">No quest data yet.</div>
        )}
      </div>

      <div className="hud-top-right">
        {/* Level + XP bar */}
        <div className="prog-block" title={`${combatXp} total XP · ${xpForNext} XP to Level ${playerLevel + 1}`}>
          <div className="prog-label">
            Lv <span className="prog-lvnum">{playerLevel}</span>
            <span className="prog-xp">{combatXp} / {combatXp + xpForNext} XP</span>
          </div>
          <div className="prog-bar">
            <div className="prog-fill" style={{ width: `${Math.round(xpProgress * 100)}%` }} />
          </div>
          <div className="prog-next">
            {xpForNext > 0 ? `${xpForNext} XP to Lv ${playerLevel + 1}` : '✨ MAX LEVEL'}
          </div>
        </div>
        <div className="mini-pill"><span className="icon coin" /> {hud.gold}g</div>
        <div className="mini-pill"><span className="icon tribe" /> {hud.heroes}/108</div>
        {highlightedEnemyId && (() => {
          const enemy = enemies.find((entry) => entry.id === highlightedEnemyId && !entry.dead);
          if (!enemy) return null;
          const pct = Math.round((enemy.hp / enemy.maxHp) * 100);
          return (
            <div className="enemy-hud-pill">
              <div className="enemy-hud-name">{enemy.label}</div>
              <div className="enemy-hud-bar"><div className="enemy-hud-fill" style={{ width: `${pct}%`, background: pct > 50 ? '#44dd66' : pct > 25 ? '#ddcc22' : '#ee3333' }} /></div>
              <div className="enemy-hud-hp">{enemy.hp}/{enemy.maxHp}</div>
            </div>
          );
        })()}
        <button className="shop-btn" onClick={() => setShopOpen(true)}>🛒 Shop</button>
      </div>

      {/* Combo counter */}
      {comboCount >= 2 && (
        <div className="combo-counter" key={comboCount}>
          <span className="combo-num">{comboCount}x</span>
          <span className="combo-label">{comboCount >= 5 ? ' ULTRA!' : comboCount >= 3 ? ' CHAIN!' : ' COMBO'}</span>
        </div>
      )}

      <div className="skin-selector">
        <span className="skin-name">Skin: {heroSkin.name}</span>
        <button onClick={cycleHeroSkin}>Switch</button>
      </div>

      <button className="cutscene-trigger" onClick={openTavernScene}>
        Play Tavern Scene
      </button>

      <div className="hud-joystick">
        <div className="ring outer">
          <div className="ring inner" />
        </div>
      </div>

      {/* ── SUPER MOVES BAR ── */}
      <div className="super-bar">
        {SUPER_MOVES.map((move) => {
          const now = Date.now();
          const cooldownMs = Math.max(0, (superCooldowns[move.id] || 0) - now);
          const cooling = cooldownMs > 0;
          const pct = cooling ? Math.round((cooldownMs / move.cooldownMs) * 100) : 0;
          const unlocked = move.id === 'dragon' ? heroStats.dragonUnlocked
            : move.id === 'storm' ? heroStats.stormUnlocked
            : heroStats.shadowUnlocked;
          const lockLevel = move.id === 'dragon' ? 2 : move.id === 'storm' ? 4 : 6;
          return (
            <button
              key={move.id}
              className={`super-btn ${!unlocked ? 'locked' : cooling ? 'cooling' : 'ready'}`}
              style={{ '--super-color': move.color, '--cd-pct': `${pct}%` }}
              onClick={() => unlocked && handleSuperMove(move.id)}
              disabled={cooling || !unlocked}
              title={unlocked ? move.desc : `Unlocks at Level ${lockLevel}`}
            >
              <span className="super-icon">{unlocked ? move.label.split(' ')[0] : '🔒'}</span>
              <span className="super-name">{unlocked ? move.label.slice(move.label.indexOf(' ') + 1) : `Lv ${lockLevel}`}</span>
              {unlocked && cooling && <span className="super-cd">{Math.ceil(cooldownMs / 1000)}s</span>}
              {unlocked && !cooling && <span className="super-ready-glow" />}
            </button>
          );
        })}
      </div>

      <div className="hud-bottom">
        {ACTION_SLOTS.map((slot) => {
          const cooldownMs = Math.max(0, (slotCooldowns[slot.id] || 0) - Date.now());
          const cooling = cooldownMs > 0;
          const secLeft = Math.ceil(cooldownMs / 1000);
          return (
            <button
              key={slot.id}
              className={`slot ${cooling ? 'cooling' : ''}`}
              onClick={() => handleActionSlot(slot.id)}
              disabled={cooling}
              title={slot.label}
            >
              <span className={`icon ${slot.id}`} />
              {cooling && <span className="slot-cd">{secLeft}s</span>}
            </button>
          );
        })}
      </div>

      {/* Stamina bar */}
      <div className="stamina-bar-wrap">
        <div className="stamina-bar" style={{ width: `${stamina}%`, background: stamina < 25 ? '#ff4444' : stamina < 50 ? '#ffaa22' : '#44ddff' }} />
      </div>

      {/* Charge indicator */}
      {isCharging && (
        <div className="charge-indicator">
          <div className="charge-fill" style={{ width: `${chargeLevel * 100}%` }} />
          <span className="charge-label">{chargeLevel > 0.8 ? '⚡ RELEASE!' : '⚡ Charging...'}</span>
        </div>
      )}

      {/* Lock-on marker */}
      {lockedTarget && (() => {
        const e = enemies.find((en) => en.id === lockedTarget && !en.dead);
        if (!e) return null;
        return <div className="lockon-hud">🎯 {e.label} — {e.hp}/{e.maxHp} HP</div>;
      })()}

      {/* Boss HP bar (captain) */}
      {(() => {
        const boss = enemies.find((e) => e.type === 'captain' && !e.dead);
        if (!boss) return null;
        const pct = Math.round((boss.hp / boss.maxHp) * 100);
        return (
          <div className="boss-bar-wrap">
            <div className="boss-bar-label">⚔️ {boss.label}</div>
            <div className="boss-bar-track">
              <div className="boss-bar-fill" style={{ width: `${pct}%`, background: pct > 50 ? '#dd3322' : pct > 25 ? '#dd7700' : '#ffcc00' }} />
            </div>
            <div className="boss-bar-hp">{boss.hp} / {boss.maxHp}</div>
          </div>
        );
      })()}

      {/* Chapter advance button — gated by story briefings */}
      {story.chapterState.stage === 'complete' && !showVictoryBanquet && (() => {
        const ch = story.chapterState.chapter;
        // Gate Ch.2 entry behind Lin Chong's briefing; gate Ch.3 behind Wu Yong's reveal
        const needsLinchong = ch === 1 && !linchongBriefed;
        const needsSorcererReveal = ch === 2 && !sorcererRevealed;
        if (needsLinchong || needsSorcererReveal) {
          return (
            <button className="chapter-advance-btn" style={{ opacity: 0.65, cursor: 'help' }}
              onClick={() => setQuestNotice(needsLinchong
                ? '📜 Find Lin Chong — he must brief the rescue before you press on'
                : '🌑 Find Wu Yong — he has read something in the warlord\'s seal')}>
              <span className="chap-btn-icon">📜</span>
              <span className="chap-btn-text">
                {needsLinchong ? 'Speak to Lin Chong' : 'Speak to Wu Yong'}
                <small>{needsLinchong ? 'He has a plan for the wall' : 'He sees a third hand'}</small>
              </span>
              <span className="chap-btn-arrow">…</span>
            </button>
          );
        }
        return (
          <button
            className="chapter-advance-btn"
            onClick={() => {
              if (ch === 1) {
                setStory((prev) => advanceToChapter2(prev));
                setEnemies(createChapter2Enemies());
                setCombatXp((xp) => xp + 80);
                setQuestNotice('📖 Chapter 2 begins — The Magistrate\'s Wrath!');
                setChapterBanner({ title: '第二章 — The Magistrate\'s Wrath', subtitle: 'Storm the wall. Bring her home.' });
                sfxBanner();
              } else if (ch === 2) {
                // Enter Chapter 3 — sorcerer's hunt
                setStory((prev) => ({
                  ...prev,
                  chapterState: {
                    chapter: 3,
                    stage: 'hunt_sorcerer',
                    objective: 'Track the sorcerer — defeat him to seal the thread, or hear him out.',
                    completed: false,
                    raidersDefeated: 0,
                    raidersTarget: 3,
                    minibossSpawned: false,
                    minibossDefeated: false,
                  },
                }));
                // Spawn sorcerer-themed encounter: a few cult guards plus the sorcerer himself
                setEnemies(createChapter3Enemies ? createChapter3Enemies() : createChapter2Enemies());
                setCombatXp((xp) => xp + 120);
                setQuestNotice('🌑 Chapter 3 begins — Sorcerer\'s Thread!');
                setChapterBanner({ title: '第三章 — The Sorcerer\'s Thread', subtitle: 'Cut the binding — or take it.' });
                sfxBanner();
              } else {
                setQuestNotice('🏆 Final chapter — the choice is yours.');
              }
            }}
          >
            <span className="chap-btn-icon">⚔️</span>
            <span className="chap-btn-text">
              Enter Chapter {story.chapterState.chapter + 1}
              <small>{ch === 1 ? 'Storm the magistrate\'s wall' : ch === 2 ? 'Hunt the sorcerer behind it all' : 'You can keep roaming first'}</small>
            </span>
            <span className="chap-btn-arrow">→</span>
          </button>
        );
      })()}

      {/* Kill flash overlay */}
      {killFlash && <div className="kill-flash" />}

      {/* Level-up flash */}
      {levelUpFlash && (
        <div className="levelup-flash">
          <div className="levelup-text">LEVEL {playerLevel}</div>
          <div className="levelup-sub">+HP · +Damage · +Speed</div>
          {playerLevel === 2 && <div className="levelup-unlock">🐉 Dragon Strike unlocked!</div>}
          {playerLevel === 4 && <div className="levelup-unlock">⚡ Storm Sweep unlocked!</div>}
          {playerLevel === 6 && <div className="levelup-unlock">🌑 Shadow Blink unlocked!</div>}
        </div>
      )}

      {/* Chapter-title banner — flashes briefly when advancing to a new chapter */}
      {chapterBanner && (
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          pointerEvents: 'none', zIndex: 500,
          animation: 'chapter-banner-fade 3.5s ease-in-out forwards',
        }}>
          <div style={{
            padding: '36px 56px',
            background: 'linear-gradient(180deg, rgba(20,16,12,0.86), rgba(20,16,12,0.66))',
            border: '2px solid #b89048',
            borderRadius: 4,
            color: '#f4ecd8',
            fontFamily: 'serif',
            textAlign: 'center',
            boxShadow: '0 12px 60px rgba(0,0,0,0.55)',
          }}>
            <div style={{ fontSize: 36, letterSpacing: 4, color: '#ffd060', textShadow: '0 2px 8px #000' }}>
              {chapterBanner.title}
            </div>
            {chapterBanner.subtitle && (
              <div style={{ marginTop: 14, fontSize: 16, color: '#e0d4b0', letterSpacing: 1.5, opacity: 0.9 }}>
                {chapterBanner.subtitle}
              </div>
            )}
          </div>
          <style>{`@keyframes chapter-banner-fade {
            0%   { opacity: 0; transform: scale(0.92); }
            12%  { opacity: 1; transform: scale(1); }
            82%  { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.04); }
          }`}</style>
        </div>
      )}

      {/* ── MOBILE CONTROLS (clean minimal layout) ── */}
      <div className="hud-mobile-controls">
        {/* Left: joystick */}
        <div
          className="touchpad"
          onPointerDown={handleJoystickDown}
          onPointerMove={handleJoystickMove}
          onPointerUp={handleJoystickUp}
          onPointerCancel={handleJoystickUp}
        >
          <div className="touch-base" />
          <div className="touch-knob" style={{ transform: `translate(${joystickState.knobX}px, ${joystickState.knobY}px)` }} />
        </div>

        {/* Right: 3 core buttons */}
        <div className="mobile-btns">
          <button
            className={`mobile-action attack-btn ${lockedTarget || highlightedEnemyId ? 'enemy-near' : ''}`}
            onPointerDown={(e) => { e.preventDefault(); handleAttack(); }}
            onPointerUp={(e) => e.preventDefault()}
          >⚔️</button>
          <button
            className={`mobile-action heavy-btn ${isCharging ? 'charging' : ''}`}
            onPointerDown={(e) => { e.preventDefault(); handleChargeStart(); }}
            onPointerUp={(e) => { e.preventDefault(); handleChargeRelease(); }}
          >💢</button>
          <button
            className="mobile-action interact-btn"
            onPointerDown={handleInteractPointer}
            onPointerUp={(e) => e.preventDefault()}
          >{highlightedNpcId ? '💬' : isDodging ? '💨' : 'E'}</button>
        </div>
      </div>

      {/* ── MOBILE MINI BAR (dodge + lock-on + menu) ── */}
      <div className="mobile-mini-bar">
        <button className={`mini-bar-btn ${isDodging ? 'active' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); handleDodge(); }}>💨</button>
        <button className={`mini-bar-btn ${lockedTarget ? 'active-lock' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); handleLockOn(); }}>🎯</button>
        {/* Super buttons inline */}
        {SUPER_MOVES.map((move) => {
          const now = Date.now();
          const cdMs = Math.max(0, (superCooldowns[move.id] || 0) - now);
          const locked = move.id === 'dragon' ? !heroStats.dragonUnlocked : move.id === 'storm' ? !heroStats.stormUnlocked : !heroStats.shadowUnlocked;
          const cool = cdMs > 0;
          return (
            <button key={move.id}
              className={`mini-bar-btn super-mini ${locked ? 'super-locked' : cool ? 'super-cool' : 'super-ready'}`}
              style={{ '--sc': move.color }}
              onPointerDown={(e) => { e.preventDefault(); if (!locked) handleSuperMove(move.id); }}
              disabled={cool || locked}>
              {locked ? '🔒' : cool ? `${Math.ceil(cdMs/1000)}s` : move.label.split(' ')[0]}
            </button>
          );
        })}
        <button className={`mini-bar-btn ${isMounted ? 'active' : ''}`}
          onPointerDown={(e) => { e.preventDefault(); attemptInteraction(); }}>🐴</button>
        <button className="mini-bar-btn" onPointerDown={(e) => { e.preventDefault(); setShopOpen(true); }}>🛒</button>
      </div>

      {/* ── MOBILE STAMINA (slim bar above controls) ── */}
      <div className="mobile-stamina">
        <div className="mobile-stamina-fill" style={{ width: `${stamina}%`, background: stamina < 25 ? '#ff4444' : stamina < 50 ? '#ffaa22' : '#44ddff' }} />
      </div>

      {/* Boss bar on mobile */}
      {(() => {
        const boss = enemies.find((e) => e.type === 'captain' || e.type === 'warlord' && !e.dead);
        if (!boss) return null;
        const pct = Math.round((boss.hp / boss.maxHp) * 100);
        return (
          <div className="mobile-boss-bar">
            <div className="mobile-boss-label">{boss.label}</div>
            <div className="mobile-boss-track">
              <div className="mobile-boss-fill" style={{ width: `${pct}%`, background: pct > 50 ? '#dd3322' : pct > 25 ? '#dd7700' : '#ffcc00' }} />
            </div>
          </div>
        );
      })()}

      <div className="hud-right">
        <button className="circle-btn big" onClick={handleAttack} disabled={Boolean(dialog)}><span className="icon slash" /></button>
        <button className="circle-btn"><span className="icon jump" /></button>
        <button className="circle-btn"><span className="icon block" /></button>
      </div>

      {questNotice && <div className="quest-toast">{questNotice}</div>}

      {Date.now() - attackFx.at < 180 && <div className="attack-flash">✦</div>}
      <div className="damage-layer" aria-hidden="true">
        {damagePopups.map((popup) => (
          <div key={popup.id} className={`damage-popup ${popup.crit ? 'crit' : ''}`}>{popup.text}</div>
        ))}
      </div>

      {dialog && (
        <div className="dialog-overlay">
          <div className="dialog-name">{dialog.npc.name} ({dialog.npc.role})</div>
          <div className="dialog-text">
            {dialog.text.slice(0, dialogReveal)}
            {dialogReveal < dialog.text.length && (
              <span style={{ opacity: 0.6, animation: 'none' }}>▌</span>
            )}
          </div>
          <div className="dialog-prompt">
            {dialogReveal < dialog.text.length
              ? 'Press E / Space to reveal'
              : 'Press E / Space to continue'}
          </div>
        </div>
      )}

      {/* ── SHOP MODAL ── */}
      {shopOpen && (
        <div className="shop-overlay" onClick={() => setShopOpen(false)}>
          <div className="shop-panel" onClick={(e) => e.stopPropagation()}>
            <div className="shop-header">⚔️ Liangshan Armory <span className="shop-gold">🪙 {hud.gold}g</span></div>
            <div className="shop-stats">
              <span>DMG {heroStats.damage}</span>
              <span>HP {heroStats.maxHp}</span>
              <span>SPD {heroStats.speed.toFixed(1)}</span>
              <span>RNG {heroStats.attackRange.toFixed(1)}</span>
            </div>
            <div className="shop-items">
              {SHOP_UPGRADES.map((u) => (
                <button
                  key={u.id}
                  className={`shop-item ${story.player.gold < u.cost ? 'unaffordable' : ''}`}
                  onClick={() => handleShopBuy(u.id)}
                >
                  <span className="shop-item-label">{u.label}</span>
                  <span className="shop-item-cost">{u.cost}g</span>
                </button>
              ))}
            </div>
            <button className="shop-close" onClick={() => setShopOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {/* ── MAIN MENU BUTTON ── */}
      <button className="main-menu-btn" onClick={() => setShowMainMenu(true)}>☰</button>

      {/* ── MAIN MENU OVERLAY ── */}
      {showMainMenu && (
        <div className="main-menu-overlay">
          <div className="main-menu-panel">
            <div className="main-menu-title">夢</div>
            <div className="main-menu-subtitle">Dream of Water Margin</div>
            <div className="main-menu-divider" />
            <button className="main-menu-item" onClick={() => setShowMainMenu(false)}>
              ▶ Resume Game
            </button>
            <button className="main-menu-item" onClick={() => {
              setShowMainMenu(false);
              sessionStorage.removeItem('cine_seen');
              setShowOpening(true);
            }}>
              🎬 Watch Opening Again
            </button>
            <button className="main-menu-item danger" onClick={handleFullRestart}>
              🔄 Restart from Beginning
            </button>
            <div className="main-menu-note">Restart replays the cinematic and resets all progress</div>
          </div>
        </div>
      )}

      {showVictoryBanquet && (
        <VictoryBanquet
          chapter={story.chapterState.chapter}
          gold={hud.gold}
          heroes={hud.heroes}
          onClose={() => setShowVictoryBanquet(false)}
        />
      )}

      {/* ── Ending choice modal: shown when sorcerer falls, before a choice is made ── */}
      {sorcererDown && !endingChoice && (
        <div className="ending-choice-overlay" style={{
          position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at center, rgba(20,10,30,0.92), rgba(0,0,0,0.96))',
          display: 'grid', placeItems: 'center', zIndex: 1000, padding: '4vh',
        }}>
          <div style={{
            maxWidth: 720, color: '#f4ecd8', fontFamily: 'serif',
            textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            <div style={{ fontSize: 48, color: '#ff80c0' }}>🌑</div>
            <h2 style={{ margin: 0, color: '#ffd060', fontSize: 28, letterSpacing: 2 }}>The Sorcerer's Thread</h2>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#e8dcb8' }}>
              The sorcerer collapses, but his thread still pulses in the air — the same thread that pulled you from your world. Wu Yong&apos;s voice cuts the wind: &ldquo;The choice is yours, stranger.&rdquo;
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => setEndingChoice('defeat')}
                style={{
                  flex: '1 1 220px', minWidth: 220, padding: '16px 18px',
                  background: 'linear-gradient(135deg, #2a4868, #1a2a48)', color: '#f4ecd8',
                  border: '2px solid #6688cc', borderRadius: 8, fontSize: 14, fontFamily: 'serif',
                  cursor: 'pointer', textAlign: 'left', lineHeight: 1.4,
                }}>
                <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 6 }}>⚔️ Sever the thread</div>
                <div style={{ opacity: 0.85 }}>Cut the sorcerer&apos;s binding. The road home is lost — but Liangshan stands free.</div>
              </button>
              <button
                onClick={() => setEndingChoice('ally')}
                style={{
                  flex: '1 1 220px', minWidth: 220, padding: '16px 18px',
                  background: 'linear-gradient(135deg, #4a1858, #281030)', color: '#f4ecd8',
                  border: '2px solid #c060ff', borderRadius: 8, fontSize: 14, fontFamily: 'serif',
                  cursor: 'pointer', textAlign: 'left', lineHeight: 1.4,
                }}>
                <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 6 }}>🌑 Take the thread</div>
                <div style={{ opacity: 0.85 }}>Claim his power. You will return home — but a shadow walks at your heel.</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ending overlay: result of the choice ── */}
      {endingChoice && (
        <div className="ending-result-overlay" style={{
          position: 'fixed', inset: 0,
          background: endingChoice === 'defeat'
            ? 'radial-gradient(ellipse at center, rgba(30,40,60,0.95), rgba(0,0,0,0.98))'
            : 'radial-gradient(ellipse at center, rgba(60,20,80,0.95), rgba(0,0,0,0.98))',
          display: 'grid', placeItems: 'center', zIndex: 1001, padding: '5vh',
        }}>
          <div style={{
            maxWidth: 680, color: '#f4ecd8', fontFamily: 'serif',
            textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 22,
          }}>
            <div style={{ fontSize: 56 }}>{endingChoice === 'defeat' ? '⚔️' : '🌑'}</div>
            <h2 style={{ margin: 0, color: endingChoice === 'defeat' ? '#88c0ff' : '#ff80c0', fontSize: 32, letterSpacing: 2 }}>
              {endingChoice === 'defeat' ? 'Ending I — The Severed Road' : 'Ending II — The Coiled Thread'}
            </h2>
            <p style={{ margin: 0, lineHeight: 1.7, color: '#e8dcb8', fontSize: 16 }}>
              {endingChoice === 'defeat'
                ? 'You drive your spear through the binding. The thread snaps with a sound like winter ice. The modern world, your exam, the room with the desk lamp — gone. You will not see them again. But the magistrate&apos;s shadow lifts from the valleys. Lin Chong holds his wife by the gate. Wu Yong nods. Song Jiang raises a cup. The road you walk is the only road now, and it is yours.'
                : 'You close your hand around the sorcerer&apos;s thread. It is warm. It is hungry. You feel a tug — the desk, the lamp, the half-finished page — and you know you can walk back through. But the thread will follow. The shadow at your heel will sit at your desk, breathing where you breathe. Liangshan watches you turn away. Wu Yong does not speak. The cup in Song Jiang&apos;s hand does not rise.'}
            </p>
            <button
              onClick={handleFullRestart}
              style={{
                alignSelf: 'center', marginTop: 8, padding: '12px 32px',
                background: '#3a2818', color: '#ffd060', border: '2px solid #b89048',
                borderRadius: 6, fontSize: 16, fontFamily: 'serif', cursor: 'pointer',
              }}>
              🔄 Begin again
            </button>
          </div>
        </div>
      )}

      {showTavernScene && (
        <div className="tavern-overlay">
          <div className="tavern-panel">
            <div className="tavern-header">
              <span className="tavern-title">Liangshan Tavern • Midnight Briefing</span>
              <span className="tavern-sub">Captured after the academy cram session</span>
            </div>
            <div className="tavern-cards">
              {TAVERN_CREW.map((member) => (
                <div key={member.id} className="tavern-card" style={{ background: member.color }}>
                  <div className="tavern-name">{member.name}</div>
                  <div className="tavern-role">{member.title}</div>
                  <p className="tavern-line">{member.line}</p>
                </div>
              ))}
            </div>
            <div className="tavern-footer">Press Space / E or tap close</div>
            <button className="tavern-close" onClick={closeTavernScene}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
