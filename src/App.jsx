import { useEffect, useRef } from 'react';
import './App.css';
import { startGame } from './game/Game';

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
    </div>
  );
}
