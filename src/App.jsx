import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { GameCanvas } from './three/Scene';
import { NPCS } from './core/story/config';
import { tileToWorldPosition } from './core/story/coordinates';
import { createStoryProgress, handleNpcDialog } from './core/story/stateMachine';

const npcWorld = NPCS.map((npc) => ({ ...npc, world: tileToWorldPosition(npc) }));

const DIALOG_HINTS = {
  wuyong: '[Chapter 0] You are a modern student lost in Song dynasty chaos. Recruit Lin Chong and Tonkey to survive.',
  songjiang_ready: '[Chapter 0] Your escort is ready. Report in and walk the Liangshan path to find your road home.',
  villager: '[Main Mission] Defeat the three named raiders near the roads.',
  songjiang_return: '[Main Mission] You returned victorious. Report and claim your reward.',
  tonkey: '[Press E to ask Tonkey to follow you.]',
};

const INTERACT_PROMPT = 'Press E to interact';

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
  const [dialog, setDialog] = useState(null);
  const [highlightedNpcId, setHighlightedNpcId] = useState(null);
  const heroPosition = useRef({ x: 0, y: 0, z: 12 });

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

  const attemptInteraction = useCallback(() => {
    if (!highlightedNpcId) return;
    const npc = npcWorld.find((entry) => entry.id === highlightedNpcId);
    if (!npc) return;

    const composed = composeDialogText(npc, story);
    setDialog({ npc, text: composed });

    const { progress } = handleNpcDialog(story, npc.id);
    updateStory(progress);
  }, [highlightedNpcId, story, updateStory]);

  const dismissDialog = useCallback(() => {
    setDialog(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'KeyE') {
        if (dialog) {
          dismissDialog();
        } else {
          attemptInteraction();
        }
      } else if ((event.code === 'Space' || event.code === 'Escape') && dialog) {
        dismissDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attemptInteraction, dialog, dismissDialog]);

  return (
    <div className="hud-shell">
      <div className="hud-frame">
        <GameCanvas onHeroMove={handleHeroMove} highlightedNpcId={highlightedNpcId} />
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
    </div>
  );
}
