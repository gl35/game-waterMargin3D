import { useEffect, useRef, useState } from 'react';
import './App.css';
import { startGame } from './game/Game';

export default function App() {
  const mountRef = useRef(null);
  const gameRef = useRef(null);
  const [hud, setHud] = useState({ hp: 100, maxHp: 100, gold: 0, heroes: 0, objective: '' });

  useEffect(() => {
    if (gameRef.current || !mountRef.current) return;
    gameRef.current = startGame(mountRef.current);

    const onHud = (e) => {
      if (e?.detail) setHud(e.detail);
    };
    window.addEventListener('dowm:hud', onHud);

    return () => {
      window.removeEventListener('dowm:hud', onHud);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="zelda-shell">
      <div className="zelda-frame-wrap">
        <div className="hud-top-left" aria-live="polite">
          <div><span>💚</span> {hud.hp}/{hud.maxHp}</div>
          <div><span>⚡</span> {Math.max(40, Math.min(100, Math.round(hud.hp * 0.8)))}</div>
          <div><span>🪙</span> {hud.gold}</div>
        </div>

        <div className="hud-objective">{hud.objective}</div>

        <div className="hud-right-actions" aria-hidden="true">
          <button className="round-btn">🏃</button>
          <button className="round-btn">🗡️</button>
          <button className="round-btn">✊</button>
        </div>

        <div className="hud-bottom-bar" aria-hidden="true">
          <button className="joy-btn">◉</button>
          <div className="item-slot">🧪</div>
          <div className="item-slot">🪓</div>
          <div className="item-slot active">⛏️</div>
          <div className="item-slot">🌿</div>
          <div className="item-slot">⚒️</div>
        </div>

        <div className="zelda-frame" ref={mountRef} />
      </div>
    </div>
  );
}
