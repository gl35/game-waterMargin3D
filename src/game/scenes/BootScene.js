const STYLE_DEFS = {
  retro: {
    id: 'retro',
    name: 'Summit Valley',
    grassA: '#b6f1a9',
    grassB: '#69c08a',
    waterA: '#8ce7ff',
    waterB: '#4fb2ea',
    pathA: '#f7d7a1',
    pathB: '#e0a966',
    wallA: '#d7d0c2',
    wallB: '#b5a38a',
    uiPanel: '#1f2f4b',
    uiAccent: '#f7ffba',
    uiText: '#f4f4f4',
    hero: '#d83f3f',
    enemy: '#2e7f3f',
  },
  ink: {
    id: 'ink',
    name: 'Ink-wash / 水墨',
    grassA: '#cce9c0',
    grassB: '#75b78c',
    waterA: '#a8dcff',
    waterB: '#6ea9d5',
    pathA: '#f6ddc0',
    pathB: '#dba86e',
    wallA: '#d1c5b2',
    wallB: '#b39c7c',
    uiPanel: '#efe6d2',
    uiAccent: '#4a4337',
    uiText: '#1f1b17',
    hero: '#43464e',
    enemy: '#595246',
  },
  wuxia: {
    id: 'wuxia',
    name: 'Azure Highlands',
    grassA: '#b8f0c2',
    grassB: '#5cb27a',
    waterA: '#9de7ff',
    waterB: '#5ab8ea',
    pathA: '#f6d8a8',
    pathB: '#e0a86a',
    wallA: '#d8c7a8',
    wallB: '#b09373',
    uiPanel: '#120b16',
    uiAccent: '#d9b36b',
    uiText: '#eee5d5',
    hero: '#7f1f1f',
    enemy: '#7a1f1f',
  },
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();
    progressBox.fillStyle(0x0f0a10, 0.9);
    progressBox.fillRect(width / 2 - 180, height / 2 - 26, 360, 52);
    progressBox.lineStyle(2, 0xd9b36b, 0.8);
    progressBox.strokeRect(width / 2 - 180, height / 2 - 26, 360, 52);

    const loadingText = this.add.text(width / 2, height / 2 - 62, '夢 Dream of Water Margin', {
      fontSize: '22px',
      fill: '#d9b36b',
      fontFamily: 'serif',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const subText = this.add.text(width / 2, height / 2 + 44, 'Forged by oath, steel, and storm', {
      fontSize: '12px',
      fill: '#d2c6e4',
      fontFamily: 'serif',
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xd9b36b, 1);
      progressBar.fillRect(width / 2 - 168, height / 2 - 14, 336 * value, 28);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      subText.destroy();
    });

    this.generateAssets();
  }

  makeCanvasTexture(key, width, height, drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);
    this.textures.addCanvas(key, canvas);
  }

  generateBackdrop(style) {
    this.makeCanvasTexture(`${style.id}_chapterBackdrop`, 512, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#c6f4ff');
      g.addColorStop(0.45, '#94d8ff');
      g.addColorStop(0.8, '#79bff0');
      g.addColorStop(1, '#9dc6f2');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      const sun = ctx.createRadialGradient(w * 0.75, 90, 10, w * 0.75, 90, 140);
      sun.addColorStop(0, 'rgba(255,255,255,0.8)');
      sun.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(w * 0.75, 90, 160, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#b9dbf8' : '#a2c9eb';
        const baseY = 240 + i * 32;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 48) {
          const wave = Math.sin((x + i * 50) * 0.025) * (14 + i * 3);
          ctx.lineTo(x, baseY - wave);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  generateScenery(style) {
    this.makeCanvasTexture(`${style.id}_mountains`, 512, 220, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);

      const layers = [
        { colorA: '#d2f2ff', colorB: '#a7d9f5', height: 70, wave: 20 },
        { colorA: '#b9e1f5', colorB: '#8bbfda', height: 110, wave: 32 },
        { colorA: '#8db1cf', colorB: '#6d95b8', height: 150, wave: 38 },
      ];

      layers.forEach((layer, idx) => {
        ctx.globalAlpha = 0.9 - idx * 0.2;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, layer.colorA);
        grad.addColorStop(1, layer.colorB);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 36) {
          const y = layer.height + Math.sin((x + idx * 20) * 0.02) * layer.wave + Math.cos(x * 0.015) * 14;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_clouds`, 256, 96, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const drawCloud = (x, y, s = 1) => {
        const gradient = ctx.createLinearGradient(x - 20 * s, y - 5 * s, x + 20 * s, y + 5 * s);
        gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
        gradient.addColorStop(1, 'rgba(255,255,255,0.55)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, 26 * s, 14 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 20 * s, y - 4 * s, 18 * s, 12 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x - 22 * s, y - 2 * s, 17 * s, 10 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      };

      drawCloud(50, 36, 1.2);
      drawCloud(130, 46, 1.05);
      drawCloud(206, 34, 1.3);
    });
  }

  generateStyleAssets(style) {
    const tileSize = 32;

    this.generateBackdrop(style);
    this.generateScenery(style);

    this.makeCanvasTexture(`${style.id}_grass`, tileSize, tileSize, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, tileSize);
      g.addColorStop(0, style.grassA);
      g.addColorStop(1, style.grassB);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = i % 2 ? style.grassA : style.grassB;
        ctx.fillRect(Math.random() * tileSize, Math.random() * tileSize, 1, 1);
      }
    });

    this.makeCanvasTexture(`${style.id}_water`, tileSize, tileSize, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, tileSize);
      g.addColorStop(0, style.waterA);
      g.addColorStop(1, style.waterB);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);
      ctx.strokeStyle = '#9ec6ff';
      ctx.globalAlpha = style.id === 'ink' ? 0.25 : 0.45;
      for (let y = 5; y < tileSize; y += 8) {
        ctx.beginPath();
        ctx.moveTo(2, y);
        ctx.quadraticCurveTo(10, y - 3, 16, y);
        ctx.quadraticCurveTo(24, y + 3, 30, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_path`, tileSize, tileSize, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, tileSize);
      g.addColorStop(0, style.pathA);
      g.addColorStop(1, style.pathB);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = i % 2 ? '#d4b88e' : '#6b5132';
        ctx.fillRect(Math.random() * tileSize, Math.random() * tileSize, 2, 2);
      }
    });

    this.makeCanvasTexture(`${style.id}_wall`, tileSize, tileSize, (ctx) => {
      ctx.fillStyle = style.wallA;
      ctx.fillRect(0, 0, tileSize, tileSize);
      ctx.strokeStyle = style.wallB;
      for (let y = 0; y < tileSize; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(tileSize, y + 0.5);
        ctx.stroke();
      }
    });

    this.makeCanvasTexture(`${style.id}_player`, 32, 32, (ctx) => {
      // Inspired by your reference: white-robed spear wielder silhouette.
      const robeBase = style.id === 'ink' ? '#f2efe8' : '#f6f4ff';
      const robeShade = style.id === 'ink' ? '#d9d3c8' : '#d9d4ef';

      // Spear / staff
      ctx.strokeStyle = '#d7d7dd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 22);
      ctx.lineTo(28, 6);
      ctx.stroke();

      // Flowing robe (main silhouette)
      ctx.fillStyle = robeBase;
      ctx.beginPath();
      ctx.moveTo(11, 10);
      ctx.lineTo(7, 16);
      ctx.lineTo(6, 24);
      ctx.lineTo(10, 31);
      ctx.lineTo(20, 31);
      ctx.lineTo(23, 22);
      ctx.lineTo(22, 14);
      ctx.lineTo(17, 10);
      ctx.closePath();
      ctx.fill();

      // Robe folds
      ctx.fillStyle = robeShade;
      ctx.fillRect(10, 16, 2, 12);
      ctx.fillRect(13, 14, 2, 15);
      ctx.fillRect(16, 15, 2, 13);

      // Head + hair
      ctx.fillStyle = '#efcb8f';
      ctx.fillRect(13, 7, 4, 4);
      ctx.fillStyle = '#0f1022';
      ctx.fillRect(11, 5, 7, 4);
      ctx.fillRect(10, 8, 3, 3);

      // Sash accent (purple ribbon feel)
      ctx.fillStyle = '#6b58b5';
      ctx.fillRect(9, 17, 10, 1);

      // Foot hint
      ctx.fillStyle = '#3a3166';
      ctx.fillRect(14, 30, 3, 2);
    });

    this.makeCanvasTexture(`${style.id}_npc`, 32, 32, (ctx) => {
      ctx.fillStyle = '#27305d';
      ctx.fillRect(9, 13, 14, 13);
      ctx.fillStyle = '#d8c2a0';
      ctx.fillRect(12, 6, 8, 6);
      ctx.fillStyle = '#1a1e2e';
      ctx.fillRect(10, 3, 12, 3);
      ctx.fillStyle = '#1c274f';
      ctx.fillRect(10, 26, 4, 6);
      ctx.fillRect(18, 26, 4, 6);
    });

    this.makeCanvasTexture(`${style.id}_linchong`, 32, 32, (ctx) => {
      // Lin Chong inspired silhouette: pale hat, long spear, dark flowing cloak.
      ctx.strokeStyle = '#c7c7ce';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, 30);
      ctx.lineTo(12, 4);
      ctx.stroke();

      ctx.fillStyle = '#e8dcc6'; // hat
      ctx.fillRect(11, 3, 12, 3);
      ctx.fillRect(13, 2, 8, 2);
      ctx.fillStyle = '#8d2a2a'; // plume
      ctx.fillRect(21, 2, 5, 2);

      ctx.fillStyle = '#d8c2a0'; // face
      ctx.fillRect(14, 6, 6, 5);
      ctx.fillStyle = '#2a2433'; // armor torso
      ctx.fillRect(11, 12, 11, 10);
      ctx.fillStyle = '#4a3b55';
      ctx.fillRect(12, 14, 9, 6);

      ctx.fillStyle = '#1d1f2e'; // cloak
      ctx.fillRect(22, 11, 7, 7);
      ctx.fillRect(24, 14, 7, 4);
      ctx.fillRect(26, 16, 5, 3);

      ctx.fillStyle = '#6f2a2a'; // robe
      ctx.fillRect(12, 22, 9, 7);
      ctx.fillStyle = '#31263a'; // boots
      ctx.fillRect(12, 29, 3, 3);
      ctx.fillRect(18, 29, 3, 3);
    });

    this.makeCanvasTexture(`${style.id}_tonkey`, 32, 32, (ctx) => {
      // Tonkey portrait-style sprite inspired by provided photo (suit + mint tie).
      ctx.fillStyle = '#101216';
      ctx.fillRect(9, 4, 13, 4);
      ctx.fillRect(10, 3, 10, 2);
      ctx.fillStyle = '#e4bf9f';
      ctx.fillRect(11, 7, 10, 8);
      ctx.fillStyle = '#1e222c';
      ctx.fillRect(9, 15, 14, 12);
      ctx.fillStyle = '#0f1218';
      ctx.fillRect(8, 16, 4, 11);
      ctx.fillRect(20, 16, 4, 11);
      ctx.fillStyle = '#f2f4f8';
      ctx.fillRect(13, 16, 6, 6);
      ctx.fillStyle = '#a4e3d0';
      ctx.fillRect(15, 18, 2, 7);
      ctx.fillStyle = '#c78f74';
      ctx.fillRect(14, 13, 4, 1);
      ctx.fillStyle = '#12151c';
      ctx.fillRect(11, 27, 4, 5);
      ctx.fillRect(17, 27, 4, 5);
    });

    this.makeCanvasTexture(`${style.id}_songjiang`, 32, 32, (ctx) => {
      // Song Jiang inspired sprite: black soft hat + dark red robe + gold medallion.
      ctx.fillStyle = '#151516';
      ctx.fillRect(9, 3, 14, 4);
      ctx.fillRect(11, 2, 9, 2);
      ctx.fillRect(21, 4, 3, 3); // side fold of hat

      ctx.fillStyle = '#d8b292';
      ctx.fillRect(13, 7, 7, 6); // face

      ctx.fillStyle = '#4a2d1c'; // beard
      ctx.fillRect(15, 12, 3, 4);

      ctx.fillStyle = '#7f1f26'; // robe
      ctx.fillRect(10, 14, 12, 16);

      ctx.strokeStyle = '#d7d0cf'; // white collar ring
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(16, 14, 5.2, Math.PI, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#b99655'; // gold chest emblem
      ctx.beginPath();
      ctx.arc(16, 21, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8f6e36';
      ctx.fillRect(14, 19, 4, 4);

      ctx.fillStyle = '#5e1a20';
      ctx.fillRect(10, 30, 4, 2);
      ctx.fillRect(18, 30, 4, 2);
    });

    this.makeCanvasTexture(`${style.id}_enemy`, 32, 32, (ctx) => {
      ctx.fillStyle = '#2b1b1b';
      ctx.fillRect(10, 13, 12, 13);
      ctx.fillStyle = style.enemy;
      ctx.fillRect(11, 15, 10, 10);
      ctx.fillStyle = '#ddb08f';
      ctx.fillRect(12, 6, 8, 6);
      ctx.fillStyle = '#111';
      ctx.fillRect(10, 3, 12, 3);
      ctx.fillStyle = '#bcbcbc';
      ctx.fillRect(25, 10, 2, 14);
    });

    this.makeCanvasTexture(`${style.id}_tree`, 36, 46, (ctx) => {
      ctx.fillStyle = '#8f6a40';
      ctx.fillRect(15, 31, 6, 13);

      const pineA = '#d4ffd2';
      const pineB = '#7dd9a0';
      ctx.fillStyle = pineA;
      ctx.beginPath();
      ctx.moveTo(18, 4);
      ctx.lineTo(4, 24);
      ctx.lineTo(32, 24);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = pineB;
      ctx.beginPath();
      ctx.moveTo(18, 10);
      ctx.lineTo(3, 30);
      ctx.lineTo(33, 30);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillRect(13, 11, 3, 3);
      ctx.fillRect(21, 16, 3, 3);
    });

    this.makeCanvasTexture(`${style.id}_rock`, 42, 28, (ctx) => {
      const rockA = style.id === 'ink' ? '#9ea9b1' : '#aab8c2';
      const rockB = style.id === 'ink' ? '#7e8a92' : '#8090a0';
      ctx.fillStyle = rockA;
      ctx.beginPath();
      ctx.moveTo(4, 20);
      ctx.lineTo(10, 9);
      ctx.lineTo(20, 4);
      ctx.lineTo(32, 6);
      ctx.lineTo(38, 15);
      ctx.lineTo(35, 24);
      ctx.lineTo(16, 26);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = rockB;
      ctx.beginPath();
      ctx.moveTo(19, 5);
      ctx.lineTo(31, 7);
      ctx.lineTo(34, 13);
      ctx.lineTo(25, 14);
      ctx.closePath();
      ctx.fill();
    });

    this.makeCanvasTexture(`${style.id}_building`, 64, 64, (ctx) => {
      ctx.fillStyle = '#b58556';
      ctx.fillRect(0, 20, 64, 44);
      ctx.fillStyle = '#6f3a2f';
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(32, 0);
      ctx.lineTo(64, 22);
      ctx.fill();
      ctx.fillStyle = '#4c2f14';
      ctx.fillRect(24, 38, 16, 26);
      ctx.fillStyle = '#9cc7db';
      ctx.fillRect(8, 29, 12, 10);
      ctx.fillRect(44, 29, 12, 10);
    });
  }

  generateAssets() {
    Object.values(STYLE_DEFS).forEach((style) => this.generateStyleAssets(style));
  }

  create() {
    this.scene.start('WorldScene');
  }
}
