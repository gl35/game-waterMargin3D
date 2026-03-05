import { useEffect, useRef } from 'react';
import { startGame } from './game/Game';
import './App.css';

function App() {
  const gameRef = useRef(null);
  const gameInstance = useRef(null);

  useEffect(() => {
    if (!gameInstance.current) {
      gameInstance.current = startGame(gameRef.current);
    }
    return () => {
      if (gameInstance.current) {
        gameInstance.current.destroy(true);
        gameInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="app">
      <div ref={gameRef} id="game-container" />
      <div className="controls-hint">
        <span>WASD / Arrow Keys: Move</span>
        <span>Space: Attack</span>
        <span>E: Interact with NPCs</span>
      </div>
    </div>
  );
}

export default App;
