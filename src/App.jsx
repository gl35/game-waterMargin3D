import { useEffect, useRef } from 'react';
import './App.css';
import { startGame } from './game/Game';

const dispatchGameKey = (type, key) => {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
};

const holdHandlers = (key) => ({
  onMouseDown: (e) => { e.preventDefault(); dispatchGameKey('keydown', key); },
  onMouseUp: (e) => { e.preventDefault(); dispatchGameKey('keyup', key); },
  onMouseLeave: () => dispatchGameKey('keyup', key),
  onTouchStart: (e) => { e.preventDefault(); dispatchGameKey('keydown', key); },
  onTouchEnd: (e) => { e.preventDefault(); dispatchGameKey('keyup', key); },
  onTouchCancel: () => dispatchGameKey('keyup', key),
});

const tapHandler = (key) => ({
  onClick: (e) => { e.preventDefault(); dispatchGameKey('keydown', key); dispatchGameKey('keyup', key); },
  onTouchStart: (e) => { e.preventDefault(); dispatchGameKey('keydown', key); dispatchGameKey('keyup', key); },
});

export default function App() {
  const mountRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current || !mountRef.current) return;
    gameRef.current = startGame(mountRef.current);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="zelda-shell">
      <div className="zelda-title">Dream of Water Margin — Chapter 1: Oath at Liangshan</div>
      <div className="zelda-frame" ref={mountRef} />

      <div className="hud-controls" aria-label="Game controls">
        <div className="dpad">
          <button {...holdHandlers('ArrowUp')}>▲</button>
          <button {...holdHandlers('ArrowLeft')}>◀</button>
          <button {...holdHandlers('ArrowDown')}>▼</button>
          <button {...holdHandlers('ArrowRight')}>▶</button>
        </div>

        <div className="actions">
          <button className="atk" {...tapHandler(' ')}>ATK</button>
          <button className="use" {...tapHandler('e')}>USE</button>
          <button className="sw" {...tapHandler('q')}>SW</button>
        </div>
      </div>
    </div>
  );
}
