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

  generateAssets() {
    const tileSize = 32;

    this.makeCanvasTexture('chapterBackdrop', 512, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#120d1c');
      g.addColorStop(0.45, '#2a203c');
      g.addColorStop(1, '#5a2e2e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#1e1729' : '#2f1c29';
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

      ctx.fillStyle = '#f2cb79';
      ctx.beginPath();
      ctx.arc(w - 84, 92, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#ffdca4';
      ctx.beginPath();
      ctx.arc(w - 84, 92, 66, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture('grass', tileSize, tileSize, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, tileSize);
      g.addColorStop(0, '#2c5937');
      g.addColorStop(1, '#1d3e28');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);

      for (let i = 0; i < 120; i++) {
        const x = Math.random() * tileSize;
        const y = Math.random() * tileSize;
        const c = Math.random() > 0.5 ? '#3b7645' : '#2f6a3d';
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }

      ctx.strokeStyle = '#457f4b';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(Math.random() * tileSize);
        const y = Math.floor(14 + Math.random() * 16);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 3, y - (4 + Math.random() * 6));
        ctx.stroke();
      }
    });

    this.makeCanvasTexture('water', tileSize, tileSize, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, tileSize);
      g.addColorStop(0, '#2d5d99');
      g.addColorStop(1, '#1f3f69');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);

      ctx.strokeStyle = '#6da8dd';
      ctx.lineWidth = 1.4;
      for (let y = 6; y < tileSize; y += 8) {
        ctx.beginPath();
        ctx.moveTo(2, y);
        for (let x = 2; x <= tileSize - 2; x += 6) {
          ctx.quadraticCurveTo(x + 2, y - 3, x + 5, y);
        }
        ctx.stroke();
      }
    });

    this.makeCanvasTexture('path', tileSize, tileSize, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, tileSize);
      g.addColorStop(0, '#b18a56');
      g.addColorStop(1, '#8f6b42');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);

      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#7a5937' : '#c39c68';
        ctx.fillRect(Math.random() * tileSize, Math.random() * tileSize, 2, 2);
      }
    });

    this.makeCanvasTexture('wall', tileSize, tileSize, (ctx) => {
      ctx.fillStyle = '#70542d';
      ctx.fillRect(0, 0, tileSize, tileSize);
      ctx.strokeStyle = '#57401f';
      for (let y = 0; y < tileSize; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(tileSize, y + 0.5);
        ctx.stroke();
      }
      for (let y = 0; y < tileSize; y += 8) {
        for (let x = (y / 8) % 2 === 0 ? 0 : 8; x < tileSize; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, y);
          ctx.lineTo(x + 0.5, y + 8);
          ctx.stroke();
        }
      }
    });

    this.makeCanvasTexture('player', 32, 32, (ctx) => {
      ctx.fillStyle = '#0d0d11';
      ctx.fillRect(12, 4, 8, 9);

      ctx.fillStyle = '#2b2552';
      ctx.fillRect(8, 10, 16, 4);

      ctx.fillStyle = '#7f1f1f';
      ctx.fillRect(10, 14, 12, 12);
      ctx.fillStyle = '#c73434';
      ctx.fillRect(12, 15, 8, 10);

      ctx.fillStyle = '#141f3d';
      ctx.fillRect(10, 26, 4, 6);
      ctx.fillRect(18, 26, 4, 6);

      ctx.fillStyle = '#b68a62';
      ctx.fillRect(7, 16, 3, 7);
      ctx.fillRect(22, 16, 3, 7);

      ctx.fillStyle = '#e6c79a';
      ctx.fillRect(12, 6, 8, 6);
    });

    this.makeCanvasTexture('npc', 32, 32, (ctx) => {
      ctx.fillStyle = '#27305d';
      ctx.fillRect(9, 13, 14, 13);
      ctx.fillStyle = '#3f4f9a';
      ctx.fillRect(11, 15, 10, 9);
      ctx.fillStyle = '#cdb18f';
      ctx.fillRect(12, 5, 8, 7);
      ctx.fillStyle = '#1a1e2e';
      ctx.fillRect(10, 3, 12, 3);
      ctx.fillStyle = '#1c274f';
      ctx.fillRect(10, 26, 4, 6);
      ctx.fillRect(18, 26, 4, 6);
      ctx.fillStyle = '#2e3f82';
      ctx.fillRect(6, 15, 3, 9);
      ctx.fillRect(23, 15, 3, 9);
    });

    this.makeCanvasTexture('enemy', 32, 32, (ctx) => {
      ctx.fillStyle = '#3a2a2a';
      ctx.fillRect(10, 13, 12, 13);
      ctx.fillStyle = '#7a1f1f';
      ctx.fillRect(11, 15, 10, 10);
      ctx.fillStyle = '#ddb08f';
      ctx.fillRect(12, 5, 8, 7);
      ctx.fillStyle = '#0b0b0f';
      ctx.fillRect(10, 3, 12, 3);
      ctx.fillStyle = '#2b1818';
      ctx.fillRect(10, 26, 4, 6);
      ctx.fillRect(18, 26, 4, 6);
      ctx.fillStyle = '#6d1b1b';
      ctx.fillRect(6, 15, 3, 9);
      ctx.fillRect(23, 15, 3, 9);

      ctx.fillStyle = '#bcbcbc';
      ctx.fillRect(25, 10, 2, 14);
      ctx.fillStyle = '#7d5e35';
      ctx.fillRect(24, 22, 4, 4);
    });

    this.makeCanvasTexture('building', 64, 64, (ctx) => {
      ctx.fillStyle = '#b58556';
      ctx.fillRect(0, 20, 64, 44);

      ctx.fillStyle = '#6f3a2f';
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(32, 0);
      ctx.lineTo(64, 22);
      ctx.fill();

      ctx.fillStyle = '#d4ba91';
      for (let y = 23; y < 62; y += 8) {
        ctx.fillRect(2, y, 60, 1);
      }

      ctx.fillStyle = '#4c2f14';
      ctx.fillRect(24, 38, 16, 26);
      ctx.fillStyle = '#8d6a3b';
      ctx.fillRect(30, 50, 2, 10);

      ctx.fillStyle = '#9cc7db';
      ctx.fillRect(8, 29, 12, 10);
      ctx.fillRect(44, 29, 12, 10);
    });
  }

  create() {
    const splashBg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'chapterBackdrop')
      .setDisplaySize(this.scale.width, this.scale.height)
      .setDepth(1);

    const title = this.add.text(this.scale.width / 2, this.scale.height / 2 - 16, 'Chapter 1\nOath at Liangshan', {
      fontSize: '30px',
      align: 'center',
      fill: '#f1d19a',
      stroke: '#000000',
      strokeThickness: 6,
      fontFamily: 'serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2);

    const subtitle = this.add.text(this.scale.width / 2, this.scale.height / 2 + 62, 'Rally heroes. Break the raiders. Face the chain captain.', {
      fontSize: '12px',
      fill: '#d8cde8',
      fontFamily: 'serif',
    }).setOrigin(0.5).setDepth(2);

    this.tweens.add({
      targets: [splashBg, title, subtitle],
      alpha: 0,
      delay: 750,
      duration: 450,
      onComplete: () => this.scene.start('WorldScene'),
    });
  }
}
