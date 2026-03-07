import { useMemo } from 'react';
import './App.css';
import { GameCanvas } from './three/Scene';

export default function App() {
  const hud = useMemo(() => ({ hp: 128, maxHp: 160, gold: 320, heroes: 4, objective: 'Reach the summit beacon and repel the raiders.' }), []);
  const hpPct = Math.round((hud.hp / hud.maxHp) * 100);

  return (
    <div className="hud-shell">
      <div className="hud-frame">
        <GameCanvas />
      </div>

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
            <div className="fill" style={{ width: `${Math.min(100, hpPct + 10)}%` }} />
          </div>
          <div className="stat-value">{Math.min(100, hpPct + 10)}%</div>
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
    </div>
  );
}
