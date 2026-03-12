import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { GameCanvas } from './three/Scene';
import { NPCS } from './core/story/config';
import { tileToWorldPosition } from './core/story/coordinates';
import { createStoryProgress, handleNpcDialog } from './core/story/stateMachine';
import { HERO_SKINS } from './core/hero/skins';

const npcWorld = NPCS.map((npc) => ({ ...npc, world: tileToWorldPosition(npc) }));

const DIALOG_HINTS = {
  wuyong: '[Chapter 0] You are a modern student lost in Song dynasty chaos. Recruit Lin Chong and Tonkey to survive.',
  songjiang_ready: '[Chapter 0] Your escort is ready. Report in and walk the Liangshan path to find your road home.',
  villager: '[Main Mission] Defeat the three named raiders near the roads.',
  songjiang_return: '[Main Mission] You returned victorious. Report and claim your reward.',
  tonkey: '[Press E to ask Tonkey to follow you.]',
};

const INTERACT_PROMPT = 'Press E to interact';

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
  const [webglSupported, setWebglSupported] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [highlightedNpcId, setHighlightedNpcId] = useState(null);
  const [heroSkinIndex, setHeroSkinIndex] = useState(0);
  const [showTavernScene, setShowTavernScene] = useState(false);
  const [mobileMove, setMobileMove] = useState({ forward: false, backward: false, left: false, right: false });
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

  const updateStory = useCallback((next) => {
    setStory(next);
  }, []);

  const dismissDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const attemptInteraction = useCallback(() => {
    if (!highlightedNpcId) return;
    const npc = npcWorld.find((entry) => entry.id === highlightedNpcId);
    if (!npc) return;

    const composed = composeDialogText(npc, story);
    setDialog({ npc, text: composed });

    const { progress } = handleNpcDialog(story, npc.id);
    updateStory(progress);
  }, [highlightedNpcId, story, updateStory]);

  const cycleHeroSkin = useCallback(() => {
    setHeroSkinIndex((prev) => (prev + 1) % HERO_SKINS.length);
  }, []);

  const setMoveKey = useCallback((key, value) => {
    setMobileMove((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleDirectionPointer = useCallback((key, value) => (event) => {
    event.preventDefault();
    setMobileMove((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleInteractPointer = useCallback((event) => {
    event.preventDefault();
    if (dialog) dismissDialog();
    else attemptInteraction();
  }, [dialog, dismissDialog, attemptInteraction]);

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

    if (npc && distance < 6) {
      setHighlightedNpcId(npc.id);
    } else {
      setHighlightedNpcId(null);
    }
  }, []);

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
  }, [attemptInteraction, dialog, dismissDialog, showTavernScene, closeTavernScene]);

  return (
    <div className="hud-shell">
      <div className="hud-frame">
        {webglSupported ? (
          <GameCanvas onHeroMove={handleHeroMove} highlightedNpcId={highlightedNpcId} heroSkin={heroSkin} moveInput={mobileMove} />
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

      <div className="hud-top-right">
        <div className="mini-pill">
          <span className="icon tribe" /> {hud.heroes}
        </div>
        <div className="mini-pill">
          <span className="icon coin" /> {hud.gold}
        </div>
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
        {['gourd', 'staff', 'axe', 'glove', 'camp'].map((slot, idx) => (
          <div key={slot} className={`slot ${idx === 2 ? 'active' : ''}`}>
            <span className={`icon ${slot}`} />
          </div>
        ))}
      </div>

      <div className="hud-mobile-controls">
        <div className="dpad">
          <button
            className="dpad-btn up"
            onPointerDown={handleDirectionPointer('forward', true)}
            onPointerUp={handleDirectionPointer('forward', false)}
            onPointerLeave={handleDirectionPointer('forward', false)}
          >↑</button>
          <button
            className="dpad-btn left"
            onPointerDown={handleDirectionPointer('left', true)}
            onPointerUp={handleDirectionPointer('left', false)}
            onPointerLeave={handleDirectionPointer('left', false)}
          >←</button>
          <button
            className="dpad-btn right"
            onPointerDown={handleDirectionPointer('right', true)}
            onPointerUp={handleDirectionPointer('right', false)}
            onPointerLeave={handleDirectionPointer('right', false)}
          >→</button>
          <button
            className="dpad-btn down"
            onPointerDown={handleDirectionPointer('backward', true)}
            onPointerUp={handleDirectionPointer('backward', false)}
            onPointerLeave={handleDirectionPointer('backward', false)}
          >↓</button>
        </div>
        <button
          className="mobile-action"
          onPointerDown={handleInteractPointer}
          onPointerUp={(event) => event.preventDefault()}
        >
          Interact
        </button>
      </div>

      <div className="hud-right">
        <button className="circle-btn big"><span className="icon slash" /></button>
        <button className="circle-btn"><span className="icon jump" /></button>
        <button className="circle-btn"><span className="icon block" /></button>
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
