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
import { createEnemies, damageEnemy, getClosestLiveEnemy, respawnEnemies, stepEnemies } from './core/combat/enemies';

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
  const [damagePopups, setDamagePopups] = useState([]);
  const heroPosition = useRef({ x: 0, y: 0, z: 12 });

  const heroSkin = HERO_SKINS[heroSkinIndex];

  const openTavernScene = useCallback(() => setShowTavernScene(true), []);
  const closeTavernScene = useCallback(() => setShowTavernScene(false), []);

  const hud = useMemo(() => ({
    hp: story.player.hp,
    maxHp: story.player.hpMax || 100,
    gold: story.player.gold,
    heroes: story.stats.heroesRecruited,
    objective: story.chapterState.objective,
  }), [story]);

  const playerLevel = useMemo(() => 1 + Math.floor(combatXp / 120), [combatXp]);
  const nextLevelXp = useMemo(() => playerLevel * 120, [playerLevel]);

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

  const handleAttack = useCallback((forcedEnemyId = null) => {
    const target = forcedEnemyId
      ? enemies.find((enemy) => enemy.id === forcedEnemyId && !enemy.dead)
      : highlightedEnemyId
        ? enemies.find((enemy) => enemy.id === highlightedEnemyId && !enemy.dead)
        : getClosestLiveEnemy(enemies, heroPosition.current.x, heroPosition.current.z, 24);

    if (!target) {
      setQuestNotice('No enemy in range.');
      return;
    }

    const baseDamage = 10 + playerLevel * 2 + Math.floor(Math.random() * 10);
    const hitAt = Date.now();
    const { enemies: nextEnemies, killed, enemy } = damageEnemy(enemies, target.id, baseDamage, hitAt);
    setEnemies(nextEnemies);
    setAttackFx({ at: hitAt, enemyId: target.id, damage: baseDamage });
    setDamagePopups((prev) => [...prev, { id: `${hitAt}-${target.id}`, text: `-${baseDamage}`, crit: baseDamage > 24 }]);

    if (!enemy) return;

    if (killed) {
      setStory((prev) => {
        const rewardStory = {
          ...prev,
          player: { ...prev.player, gold: prev.player.gold + enemy.goldDrop },
        };
        if (enemy.type === 'captain') {
          return recordMiniBossDefeat(rewardStory);
        }
        return recordRaiderKill(rewardStory);
      });
      setCombatXp((xp) => xp + enemy.xp);
      setQuestNotice(`Defeated ${enemy.label}: +${enemy.goldDrop} gold, +${enemy.xp} XP`);
      setHighlightedEnemyId(null);
    } else {
      setQuestNotice(`Hit ${enemy.label} for ${baseDamage} (${enemy.hp}/${enemy.maxHp} HP)`);
      const retaliate = Math.floor(3 + Math.random() * enemy.damage * 0.6);
      setStory((prev) => ({
        ...prev,
        player: { ...prev.player, hp: Math.max(0, prev.player.hp - retaliate) },
      }));
    }
  }, [enemies, highlightedEnemyId, playerLevel]);

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
        const moved = stepEnemies(prev, heroPosition.current, nowSec, dt);
        return respawnEnemies(moved, Date.now());
      });

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
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
  }, [attemptInteraction, closeTavernScene, dialog, dismissDialog, handleAttack, showTavernScene]);

  return (
    <div className={`hud-shell ${dialog ? 'dialog-open' : ''}`}>
      <div className="hud-frame">
        {webglSupported ? (
          <GameCanvas onHeroMove={handleHeroMove} highlightedNpcId={highlightedNpcId} highlightedEnemyId={highlightedEnemyId} heroSkin={heroSkin} moveInput={mobileMove} onNpcTap={handleNpcTap} onEnemyTap={handleEnemyTap} enemies={enemies} attackFx={attackFx} />
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
        <div className="mini-pill">
          <span className="icon tribe" /> {hud.heroes}
        </div>
        <div className="mini-pill">
          <span className="icon coin" /> {hud.gold}
        </div>
        <div className="mini-pill">
          <span className="icon bolt" /> Lv {playerLevel} • XP {combatXp}/{nextLevelXp}
        </div>
        {highlightedEnemyId && (() => {
          const enemy = enemies.find((entry) => entry.id === highlightedEnemyId && !entry.dead);
          if (!enemy) return null;
          return <div className="mini-pill enemy-pill">{enemy.label} {enemy.hp}/{enemy.maxHp}</div>;
        })()}
      </div>

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
        <button
          className="mobile-action"
          onPointerDown={handleInteractPointer}
          onPointerUp={(event) => event.preventDefault()}
        >
          {highlightedEnemyId && !highlightedNpcId ? 'Attack' : 'Interact'}
        </button>
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
