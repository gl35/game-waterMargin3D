import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { GameCanvas } from './three/Scene';
import { NPCS } from './core/story/config';
import { tileToWorldPosition } from './core/story/coordinates';
import { createStoryProgress, handleNpcDialog, recordMiniBossDefeat, recordRaiderKill, saveStoryProgress } from './core/story/stateMachine';
import {
  advanceQuestByNpc,
  claimQuestReward,
  getQuestLog,
  loadQuestProgress,
  saveQuestProgress,
  tryAcceptQuest,
} from './core/quests/questSystem';
import { HERO_SKINS } from './core/hero/skins';
import { createEnemies, damageEnemy, knockbackEnemy, getClosestLiveEnemy, respawnEnemies, stepEnemies } from './core/combat/enemies';
import { getLevel, getXpProgress, getXpForNext, getStats, SHOP_UPGRADES } from './core/hero/progression';

const npcWorld = NPCS.map((npc) => ({ ...npc, world: tileToWorldPosition(npc) }));

const DIALOG_HINTS = {
  wuyong: '[Chapter 0] You are a modern student lost in Song dynasty chaos. Recruit Lin Chong and Tonkey to survive.',
  songjiang_ready: '[Chapter 0] Your escort is ready. Report in and walk the Liangshan path to find your road home.',
  villager: '[Main Mission] Defeat the three named raiders near the roads.',
  songjiang_return: '[Main Mission] You returned victorious. Report and claim your reward.',
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
  const [story, setStory] = useState(() => createStoryProgress());
  const [questProgress, setQuestProgress] = useState(() => loadQuestProgress());
  const [questNotice, setQuestNotice] = useState(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [highlightedNpcId, setHighlightedNpcId] = useState(null);
  const [heroSkinIndex, setHeroSkinIndex] = useState(0);
  const [showTavernScene, setShowTavernScene] = useState(false);
  const [mobileMove, setMobileMove] = useState({ forward: false, backward: false, left: false, right: false });
  const [slotCooldowns, setSlotCooldowns] = useState({});
  const [interactRadius, setInteractRadius] = useState(6);
  const [enemies, setEnemies] = useState(() => createEnemies());
  const [highlightedEnemyId, setHighlightedEnemyId] = useState(null);
  const [combatXp, setCombatXp] = useState(0);
  const [lastEnemyHitAt, setLastEnemyHitAt] = useState(0);
  const [attackFx, setAttackFx] = useState({ at: 0, enemyId: null, damage: 0 });
  const [superFx, setSuperFx] = useState({ at: 0, type: null });
  const [superCooldowns, setSuperCooldowns] = useState({});
  const [damagePopups, setDamagePopups] = useState([]);
  const [comboCount, setComboCount] = useState(0);
  const [screenShake, setScreenShake] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [statBonuses, setStatBonuses] = useState({ maxHp: 0, damage: 0, speed: 0, range: 0 });
  const heroPosition = useRef({ x: 0, y: 0, z: 12 });
  const lastComboAt = useRef(0);
  const autoAttackTimer = useRef(0);

  const heroSkin = HERO_SKINS[heroSkinIndex];

  const openTavernScene = useCallback(() => setShowTavernScene(true), []);
  const closeTavernScene = useCallback(() => setShowTavernScene(false), []);

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

  const playerLevel = useMemo(() => getLevel(combatXp), [combatXp]);
  const xpProgress  = useMemo(() => getXpProgress(combatXp), [combatXp]);
  const xpForNext   = useMemo(() => getXpForNext(combatXp), [combatXp]);
  const heroStats   = useMemo(() => {
    const base = getStats(playerLevel);
    return {
      ...base,
      maxHp:  base.maxHp  + statBonuses.maxHp,
      damage: base.damage + statBonuses.damage,
      speed:  base.speed  + statBonuses.speed,
      attackRange: base.attackRange + statBonuses.range,
    };
  }, [playerLevel, statBonuses]);

  const questLog = useMemo(() => getQuestLog(questProgress), [questProgress]);
  const activeQuest = useMemo(
    () => questLog.find((quest) => quest.state === 'active') || questLog.find((quest) => quest.canClaim) || questLog[0],
    [questLog],
  );

  const updateStory = useCallback((next) => {
    setStory(next);
  }, []);

  const dismissDialog = useCallback(() => {
    setDialog(null);
  }, []);

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

    if (questEvents.some((event) => event.type === 'quest_completed')) {
      const completedQuest = getQuestLog(nextQuestProgress).find((quest) => quest.state === 'completed');
      if (completedQuest) {
        questLines.push(`Quest complete: ${completedQuest.title}`);
        questLines.push('Claim your reward from the quest panel.');
        setQuestNotice(`Quest complete: ${completedQuest.title}`);
      }
    }

    const composed = composeDialogText(npc, storyProgress);
    setDialog({
      npc,
      text: questLines.length ? `${composed}\n\n${questLines.join('\n')}` : composed,
    });

    setQuestProgress(nextQuestProgress);
    updateStory(storyProgress);
  }, [questProgress, story, updateStory]);

  const attemptInteraction = useCallback(() => {
    if (!highlightedNpcId) return;
    interactWithNpc(highlightedNpcId);
  }, [highlightedNpcId, interactWithNpc]);

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

  const handleAttack = useCallback((forcedEnemyId = null, isAuto = false) => {
    const target = forcedEnemyId
      ? enemies.find((enemy) => enemy.id === forcedEnemyId && !enemy.dead)
      : highlightedEnemyId
        ? enemies.find((enemy) => enemy.id === highlightedEnemyId && !enemy.dead)
        : getClosestLiveEnemy(enemies, heroPosition.current.x, heroPosition.current.z, heroStats.attackRange);

    if (!target) {
      if (!isAuto) setQuestNotice('No enemy in range.');
      return;
    }

    const now = Date.now();

    // Combo multiplier: hits within 2s chain
    const timeSinceLast = now - lastComboAt.current;
    const newCombo = timeSinceLast < 2000 ? comboCount + 1 : 1;
    setComboCount(newCombo);
    lastComboAt.current = now;

    const comboMult = 1 + Math.min(newCombo - 1, 5) * 0.18;
    const isCrit = Math.random() < 0.15 + (newCombo > 4 ? 0.15 : 0);
    const baseDamage = Math.round((heroStats.damage + Math.floor(Math.random() * 8)) * comboMult * (isCrit ? 2.0 : 1.0));

    let nextEnemies = enemies;
    const dmgResult = damageEnemy(nextEnemies, target.id, baseDamage, now);
    nextEnemies = dmgResult.enemies;
    // Knockback
    nextEnemies = knockbackEnemy(nextEnemies, target.id, heroPosition.current.x, heroPosition.current.z, 8 + newCombo);
    setEnemies(nextEnemies);

    setAttackFx({ at: now, enemyId: target.id, damage: baseDamage });
    const popText = isCrit ? `💥 CRIT ${baseDamage}` : newCombo >= 3 ? `🔥x${newCombo} ${baseDamage}` : `-${baseDamage}`;
    setDamagePopups((prev) => [...prev, { id: `${now}-${target.id}`, text: popText, crit: isCrit || newCombo >= 3 }]);

    // Screenshake on big hits
    if (isCrit || baseDamage > 30) {
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 200);
    }

    const { killed, enemy } = dmgResult;
    if (!enemy) return;

    if (killed) {
      setStory((prev) => {
        const rewardStory = { ...prev, player: { ...prev.player, gold: prev.player.gold + enemy.goldDrop } };
        return enemy.type === 'captain' ? recordMiniBossDefeat(rewardStory) : recordRaiderKill(rewardStory);
      });
      setCombatXp((xp) => xp + enemy.xp);
      setComboCount(0);
      setQuestNotice(`☠️ ${enemy.label} defeated! +${enemy.goldDrop}g +${enemy.xp}xp`);
      setHighlightedEnemyId(null);
    }
  }, [enemies, highlightedEnemyId, heroStats, comboCount]);

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
      }
    }

    if (superId === 'storm') {
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
      }
    }
  }, [enemies, superCooldowns]);

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

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  // Auto-attack listener
  useEffect(() => {
    const onAutoAttack = () => handleAttack(null, true);
    window.addEventListener('game:autoattack', onAutoAttack);
    return () => window.removeEventListener('game:autoattack', onAutoAttack);
  }, [handleAttack]);

  // Combo timeout
  useEffect(() => {
    if (comboCount === 0) return;
    const t = setTimeout(() => setComboCount(0), 2200);
    return () => clearTimeout(t);
  }, [comboCount]);

  // Sprint key
  useEffect(() => {
    const onDown = (e) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setIsSprinting(true); };
    const onUp   = (e) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setIsSprinting(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

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
      } else if (event.code === 'KeyF') {
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
  }, [attemptInteraction, closeTavernScene, dialog, dismissDialog, handleAttack, handleSuperMove, showTavernScene]);

  return (
    <div className={`hud-shell ${dialog ? 'dialog-open' : ''}`}>
      <div className="hud-frame">
        {webglSupported ? (
          <GameCanvas onHeroMove={handleHeroMove} highlightedNpcId={highlightedNpcId} highlightedEnemyId={highlightedEnemyId} heroSkin={heroSkin} moveInput={mobileMove} onNpcTap={handleNpcTap} onEnemyTap={handleEnemyTap} enemies={enemies} attackFx={attackFx} superFx={superFx} isSprinting={isSprinting} screenShake={screenShake} />
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
        <div className="prog-block">
          <div className="prog-label">Lv {playerLevel} <span className="prog-xp">{Math.round(xpProgress * 100)}%</span></div>
          <div className="prog-bar"><div className="prog-fill" style={{ width: `${Math.round(xpProgress * 100)}%` }} /></div>
          <div className="prog-next">{xpForNext} xp to next</div>
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

      <div className="hud-mobile-controls">
        <div
          className="touchpad"
          onPointerDown={handleJoystickDown}
          onPointerMove={handleJoystickMove}
          onPointerUp={handleJoystickUp}
          onPointerCancel={handleJoystickUp}
        >
          <div className="touch-base" />
          <div
            className="touch-knob"
            style={{ transform: `translate(${joystickState.knobX}px, ${joystickState.knobY}px)` }}
          />
        </div>
        <div className="mobile-btns">
          <button
            className={`mobile-action attack-btn ${highlightedEnemyId ? 'enemy-near' : ''}`}
            onPointerDown={(e) => { e.preventDefault(); handleAttack(); }}
            onPointerUp={(e) => e.preventDefault()}
          >
            ⚔️
          </button>
          <button
            className="mobile-action interact-btn"
            onPointerDown={handleInteractPointer}
            onPointerUp={(e) => e.preventDefault()}
          >
            {highlightedNpcId ? 'Talk' : 'E'}
          </button>
        </div>
      </div>

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
          <div className="dialog-text">{dialog.text}</div>
          <div className="dialog-prompt">Press E / Space to continue</div>
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
