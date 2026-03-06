const STYLE_DEFS = {
  retro: {
    id: 'retro',
    name: 'Retro Pixel',
    grassA: '#3f7f43',
    grassB: '#2f5f32',
    waterA: '#3a74c8',
    waterB: '#224a8b',
    pathA: '#b88a52',
    pathB: '#8e6738',
    wallA: '#927245',
    wallB: '#6d5331',
    uiPanel: '#171717',
    uiAccent: '#f2ca74',
    uiText: '#f4f4f4',
    hero: '#d83f3f',
    enemy: '#2e7f3f',
  },
  ink: {
    id: 'ink',
    name: 'Ink-wash / 水墨',
    grassA: '#6fa36a',
    grassB: '#4f7b4a',
    waterA: '#586879',
    waterB: '#3f4b58',
    pathA: '#b8a890',
    pathB: '#96866f',
    wallA: '#6e6559',
    wallB: '#4f483f',
    uiPanel: '#efe6d2',
    uiAccent: '#4a4337',
    uiText: '#1f1b17',
    hero: '#43464e',
    enemy: '#595246',
  },
  wuxia: {
    id: 'wuxia',
    name: 'Dark Wuxia',
    grassA: '#2c5937',
    grassB: '#1b3524',
    waterA: '#2d5d99',
    waterB: '#1f3f69',
    pathA: '#b18a56',
    pathB: '#7f5a35',
    wallA: '#70542d',
    wallB: '#523a1f',
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
      if (style.id === 'retro') {
        g.addColorStop(0, '#1d2d52');
        g.addColorStop(0.55, '#203a66');
        g.addColorStop(1, '#31261f');
      } else if (style.id === 'ink') {
        g.addColorStop(0, '#f1ebdd');
        g.addColorStop(0.55, '#d0c7b6');
        g.addColorStop(1, '#9f9587');
      } else {
        g.addColorStop(0, '#120d1c');
        g.addColorStop(0.45, '#2a203c');
        g.addColorStop(1, '#5a2e2e');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = style.id === 'ink' ? 0.25 : 0.35;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = style.id === 'ink' ? '#5a534a' : i % 2 === 0 ? '#1e1729' : '#2f1c29';
        const baseY = 220 + i * 24;
        ctx.beginPath();
        ctx.moveTo(0, baseY + 40);
        for (let x = 0; x <= w; x += 32) {
          const wave = Math.sin((x + i * 33) * 0.03) * (12 + i * 2);
          ctx.lineTo(x, baseY - wave);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  generateStyleAssets(style) {
    const tileSize = 32;

    this.generateBackdrop(style);

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
      // Hair
      ctx.fillStyle = '#101216';
      ctx.fillRect(9, 4, 13, 4);
      ctx.fillRect(10, 3, 10, 2);

      // Face
      ctx.fillStyle = '#e4bf9f';
      ctx.fillRect(11, 7, 10, 8);

      // Suit jacket
      ctx.fillStyle = '#1e222c';
      ctx.fillRect(9, 15, 14, 12);
      ctx.fillStyle = '#0f1218';
      ctx.fillRect(8, 16, 4, 11);
      ctx.fillRect(20, 16, 4, 11);

      // Shirt + tie
      ctx.fillStyle = '#f2f4f8';
      ctx.fillRect(13, 16, 6, 6);
      ctx.fillStyle = '#a4e3d0';
      ctx.fillRect(15, 18, 2, 7);

      // Subtle smile line
      ctx.fillStyle = '#c78f74';
      ctx.fillRect(14, 13, 4, 1);

      // Legs
      ctx.fillStyle = '#12151c';
      ctx.fillRect(11, 27, 4, 5);
      ctx.fillRect(17, 27, 4, 5);
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
