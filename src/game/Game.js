import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

const config = {
  type: Phaser.AUTO,
  width: 1600,
  height: 900,
  backgroundColor: '#1a1a1a',
  resolution: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1600,
    height: 900,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [BootScene, WorldScene]
};

export const startGame = (parent) => {
  return new Phaser.Game({ ...config, parent });
};
