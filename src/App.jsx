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
      <div className="zelda-title">Dream of Water Margin — Chapter 1: Oath at Liangshan</div>

      <div className="zelda-frame-wrap">
        <div className="hud-overlay" aria-live="polite">
          <div>HP: {hud.hp}/{hud.maxHp}</div>
          <div>Gold: {hud.gold} 两</div>
          <div>Heroes: {hud.heroes}/108</div>
          <div className="objective">{hud.objective}</div>
        </div>
        <div className="zelda-frame" ref={mountRef} />
      </div>
    </div>
  );
}
