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

  const hpPct = Math.max(0, Math.min(100, Math.round((hud.hp / (hud.maxHp || 100)) * 100)));

  return (
    <div className="hud-shell">
      <div className="hud-frame" ref={mountRef} />

      <div className="hud-top">
        <div className="stat-block">
          <div className="stat-label"><span className="icon heart" /> HP</div>
          <div className="bar">
            <div className="fill" style={{ width: `${hpPct}%` }} />
          </div>
          <div className="stat-value">{hud.hp}/{hud.maxHp}</div>
        </div>
        <div className="stat-block">
          <div className="stat-label"><span className="icon bolt" /> Energy</div>
          <div className="bar energy">
            <div className="fill" style={{ width: `${Math.min(100, Math.max(0, hpPct + 8))}%` }} />
          </div>
          <div className="stat-value">{Math.max(40, Math.min(100, hpPct + 8))}%</div>
        </div>
        <div className="stat-block mini">
          <div className="stat-label"><span className="icon bag" /></div>
          <div className="stat-value">{hud.gold}</div>
        </div>
      </div>

      <div className="hud-objective" aria-live="polite">
        {hud.objective || 'Explore the summit ridge.'}
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
    </div>
  );
}
