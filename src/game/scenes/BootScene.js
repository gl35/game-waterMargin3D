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
      // Rich sky gradient
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.65);
      g.addColorStop(0, '#7ab8e8');
      g.addColorStop(0.25, '#9acef4');
      g.addColorStop(0.6, '#bce0ff');
      g.addColorStop(1, '#d8f0ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Ground tone
      const groundG = ctx.createLinearGradient(0, h * 0.6, 0, h);
      groundG.addColorStop(0, '#a8d898');
      groundG.addColorStop(1, '#80b870');
      ctx.fillStyle = groundG;
      ctx.fillRect(0, Math.round(h * 0.6), w, Math.round(h * 0.4));

      // Sun glow
      ctx.save();
      const sun = ctx.createRadialGradient(w * 0.72, 80, 10, w * 0.72, 80, 180);
      sun.addColorStop(0, 'rgba(255,255,220,0.85)');
      sun.addColorStop(0.25, 'rgba(255,240,180,0.45)');
      sun.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, 280);
      ctx.restore();

      // Horizon atmospheric haze
      const haze = ctx.createLinearGradient(0, h * 0.52, 0, h * 0.68);
      haze.addColorStop(0, 'rgba(200,230,255,0)');
      haze.addColorStop(0.5, 'rgba(200,230,255,0.28)');
      haze.addColorStop(1, 'rgba(200,230,255,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);

      // Wave layers near horizon
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#a8c8e8' : '#88b0d0';
        const baseY = 270 + i * 26;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 40) {
          const wave = Math.sin((x + i * 60) * 0.022) * (12 + i * 2);
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

      // Far peaks - mist-blue
      const farPeaks = [
        [0,180],[60,90],[120,115],[190,75],[260,100],[340,68],[420,95],[512,180],[512,220],[0,220]
      ];
      const farG = ctx.createLinearGradient(0, 68, 0, h);
      farG.addColorStop(0, '#c4dff5');
      farG.addColorStop(1, '#98bedd');
      ctx.fillStyle = farG;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      farPeaks.forEach(([x,y], i) => i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
      ctx.closePath();
      ctx.fill();

      // Snow caps on far peaks
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#e8f4ff';
      [[60,90,16],[190,75,18],[340,68,22],[420,95,14]].forEach(([px,py,r]) => {
        ctx.beginPath();
        ctx.ellipse(px, py+6, r, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Mid peaks - green-blue
      const midPeaks = [
        [0,200],[80,125],[150,145],[230,108],[310,130],[390,105],[470,130],[512,200],[512,220],[0,220]
      ];
      const midG = ctx.createLinearGradient(0, 105, 0, h);
      midG.addColorStop(0, '#8fb8d8');
      midG.addColorStop(0.6, '#6a98b8');
      midG.addColorStop(1, '#5580a0');
      ctx.fillStyle = midG;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      midPeaks.forEach(([x,y], i) => i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
      ctx.closePath();
      ctx.fill();

      // Near foothills - forested green
      const nearPeaks = [
        [0,220],[0,185],[70,162],[140,172],[220,150],[300,168],[380,155],[450,165],[512,185],[512,220]
      ];
      const nearG = ctx.createLinearGradient(0, 148, 0, h);
      nearG.addColorStop(0, '#5c9a70');
      nearG.addColorStop(1, '#4a7a58');
      ctx.fillStyle = nearG;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      nearPeaks.forEach(([x,y], i) => i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
      ctx.closePath();
      ctx.fill();

      // Tree silhouettes on foothills
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#3a6848';
      for (let i = 0; i < 18; i++) {
        const tx = 20 + i * 28;
        const baseY = 185 + Math.sin(i * 0.7) * 10;
        const th = 18 + Math.sin(i * 1.3) * 6;
        ctx.beginPath();
        ctx.moveTo(tx, baseY - th);
        ctx.lineTo(tx - 7, baseY + 2);
        ctx.lineTo(tx + 7, baseY + 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_clouds`, 256, 96, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const drawCloud = (x, y, s = 1) => {
        // Soft shadow layer
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#90b8d0';
        ctx.beginPath();
        ctx.ellipse(x + 4, y + 6, 30 * s, 13 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main cloud body
        const gradient = ctx.createRadialGradient(x - 6 * s, y - 4 * s, 4, x, y, 30 * s);
        gradient.addColorStop(0, 'rgba(255,255,255,0.98)');
        gradient.addColorStop(0.5, 'rgba(240,248,255,0.85)');
        gradient.addColorStop(1, 'rgba(220,235,250,0.55)');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.ellipse(x, y, 30 * s, 14 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 22 * s, y - 3 * s, 20 * s, 12 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - 24 * s, y - 1 * s, 18 * s, 10 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - 4 * s, y - 10 * s, 18 * s, 10 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      };

      drawCloud(54, 38, 1.2);
      drawCloud(138, 28, 0.9);
      drawCloud(210, 42, 1.1);
    });
  }

  generateStyleAssets(style) {
    const tileSize = 32;

    this.generateBackdrop(style);
    this.generateScenery(style);

    this.makeCanvasTexture(`${style.id}_grass`, tileSize, tileSize, (ctx) => {
      // Base gradient
      const g = ctx.createLinearGradient(0, 0, tileSize, tileSize);
      g.addColorStop(0, style.grassA);
      g.addColorStop(0.5, style.grassB);
      g.addColorStop(1, style.grassA);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);

      // Subtle soil patches
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#8b6940';
      for (let i = 0; i < 6; i++) {
        const px = (i * 7 + 3) % tileSize;
        const py = (i * 11 + 5) % tileSize;
        ctx.beginPath();
        ctx.ellipse(px, py, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Grass blade clusters
      const bladeColors = [style.grassA, style.grassB, '#a8d890', '#88c070'];
      ctx.globalAlpha = 0.7;
      const bladePositions = [[4,28],[8,20],[14,27],[19,22],[24,26],[29,19],[6,12],[16,8],[27,14],[10,4],[22,6]];
      bladePositions.forEach(([bx, by]) => {
        ctx.strokeStyle = bladeColors[(bx + by) % bladeColors.length];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, by + 4);
        ctx.quadraticCurveTo(bx + 1, by + 1, bx + 2, by - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + 3, by + 4);
        ctx.quadraticCurveTo(bx + 2, by + 1, bx, by - 2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_water`, tileSize, tileSize, (ctx) => {
      // Deep water base
      const g = ctx.createLinearGradient(0, 0, 0, tileSize);
      g.addColorStop(0, style.waterA);
      g.addColorStop(0.5, style.waterB);
      g.addColorStop(1, style.waterA);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);

      // Sub-surface depth darkening in corners
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#004488';
      ctx.fillRect(0, 0, 6, tileSize);
      ctx.fillRect(tileSize - 6, 0, 6, tileSize);

      // Wave lines
      ctx.globalAlpha = style.id === 'ink' ? 0.22 : 0.48;
      ctx.lineWidth = 1.2;
      for (let row = 0; row < 4; row++) {
        const wy = 5 + row * 8;
        const offsetX = (row % 2) * 8;
        ctx.strokeStyle = row % 2 === 0 ? '#b8e8ff' : '#d0f0ff';
        ctx.beginPath();
        ctx.moveTo(0 + offsetX, wy);
        ctx.quadraticCurveTo(6 + offsetX, wy - 2.5, 12 + offsetX, wy);
        ctx.quadraticCurveTo(18 + offsetX, wy + 2.5, 24 + offsetX, wy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(16 + offsetX, wy + 1);
        ctx.quadraticCurveTo(22 + offsetX, wy - 1.5, 28 + offsetX, wy + 1);
        ctx.stroke();
      }

      // Sparkle highlights
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = '#ffffff';
      [[5, 4], [18, 12], [9, 22], [26, 7], [22, 25], [13, 17]].forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 1.5, 0.7, 0.8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_path`, tileSize, tileSize, (ctx) => {
      // Cobblestone base
      const g = ctx.createLinearGradient(0, 0, 0, tileSize);
      g.addColorStop(0, style.pathA);
      g.addColorStop(1, style.pathB);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tileSize, tileSize);

      // Stone blocks with mortar lines
      ctx.globalAlpha = 0.55;
      const stones = [
        [1,1,14,10], [16,1,15,10],
        [1,12,9,10], [11,12,11,10], [23,12,8,10],
        [1,23,14,8], [16,23,15,8],
      ];
      stones.forEach(([sx, sy, sw, sh]) => {
        const stoneG = ctx.createLinearGradient(sx, sy, sx, sy + sh);
        stoneG.addColorStop(0, style.pathA);
        stoneG.addColorStop(1, style.pathB);
        ctx.fillStyle = stoneG;
        ctx.fillRect(sx, sy, sw, sh);

        // Stone edge highlight
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx + 1, sy + sh - 1);
        ctx.lineTo(sx + 1, sy + 1);
        ctx.lineTo(sx + sw - 1, sy + 1);
        ctx.stroke();

        // Stone edge shadow
        ctx.strokeStyle = '#00000044';
        ctx.beginPath();
        ctx.moveTo(sx + sw - 1, sy + 1);
        ctx.lineTo(sx + sw - 1, sy + sh - 1);
        ctx.lineTo(sx + 1, sy + sh - 1);
        ctx.stroke();
        ctx.globalAlpha = 0.55;
      });
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_wall`, tileSize, tileSize, (ctx) => {
      // Base masonry fill
      ctx.fillStyle = style.wallA;
      ctx.fillRect(0, 0, tileSize, tileSize);

      // Brick pattern
      ctx.lineWidth = 1;
      for (let row = 0; row < 4; row++) {
        const y0 = row * 8;
        // mortar line
        ctx.strokeStyle = style.wallB;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(0, y0 + 7.5);
        ctx.lineTo(tileSize, y0 + 7.5);
        ctx.stroke();

        // vertical joints (offset every other row)
        const offset = (row % 2) * 8;
        for (let col = 0; col < 5; col++) {
          const vx = (col * 8 + offset) % tileSize;
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.moveTo(vx + 0.5, y0);
          ctx.lineTo(vx + 0.5, y0 + 7);
          ctx.stroke();
        }

        // Top highlight per brick
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.5;
        for (let col = 0; col < 4; col++) {
          const bx = (col * 8 + offset + 1) % tileSize;
          ctx.beginPath();
          ctx.moveTo(bx, y0 + 1);
          ctx.lineTo(bx + 6, y0 + 1);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_player`, 32, 32, (ctx) => {
      const robeBase = style.id === 'ink' ? '#f0ece2' : '#f4f2ff';
      const robeShade = style.id === 'ink' ? '#cdc7b8' : '#cac4e8';
      const robeDark = style.id === 'ink' ? '#a09888' : '#9890c8';

      // Spear shaft
      ctx.strokeStyle = '#c8c4b0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(6, 30);
      ctx.lineTo(29, 3);
      ctx.stroke();

      // Spear tip
      ctx.fillStyle = '#d4d8e8';
      ctx.beginPath();
      ctx.moveTo(29, 3);
      ctx.lineTo(26, 6);
      ctx.lineTo(31, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(29, 3);
      ctx.lineTo(30, 4);
      ctx.lineTo(27.5, 5);
      ctx.closePath();
      ctx.fill();

      // Flowing robe body - layered for depth
      ctx.fillStyle = robeShade;
      ctx.beginPath();
      ctx.moveTo(10, 12);
      ctx.lineTo(6, 18);
      ctx.lineTo(5, 27);
      ctx.lineTo(9, 32);
      ctx.lineTo(14, 32);
      ctx.lineTo(15, 22);
      ctx.lineTo(13, 12);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = robeBase;
      ctx.beginPath();
      ctx.moveTo(13, 11);
      ctx.lineTo(9, 17);
      ctx.lineTo(9, 27);
      ctx.lineTo(13, 32);
      ctx.lineTo(21, 32);
      ctx.lineTo(24, 24);
      ctx.lineTo(23, 14);
      ctx.lineTo(18, 11);
      ctx.closePath();
      ctx.fill();

      // Robe fold lines (painted strokes)
      ctx.strokeStyle = robeShade;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      [[11,15,10,30],[14,13,13,32],[17,12,16,31],[20,14,20,30]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(x1 - 1, (y1+y2)/2, x2, y2);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Inner robe / collar contrast
      ctx.fillStyle = robeDark;
      ctx.beginPath();
      ctx.moveTo(14, 11);
      ctx.lineTo(12, 16);
      ctx.lineTo(16, 14);
      ctx.closePath();
      ctx.fill();

      // Sash
      ctx.fillStyle = '#6040a8';
      ctx.fillRect(10, 18, 11, 2);
      ctx.fillStyle = '#8060c8';
      ctx.fillRect(11, 18, 4, 1);

      // Arms
      ctx.strokeStyle = robeBase;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, 14);
      ctx.quadraticCurveTo(6, 17, 8, 21);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(22, 13);
      ctx.quadraticCurveTo(27, 16, 25, 20);
      ctx.stroke();

      // Neck
      ctx.fillStyle = '#e8c888';
      ctx.fillRect(14, 8, 4, 4);

      // Head
      ctx.fillStyle = '#e8c888';
      ctx.beginPath();
      ctx.ellipse(16, 6, 4, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair bun / topknot
      ctx.fillStyle = '#1a1228';
      ctx.beginPath();
      ctx.ellipse(16, 2, 3.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1e38';
      ctx.beginPath();
      ctx.ellipse(16, 4, 4.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hair pin
      ctx.strokeStyle = '#d8c070';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(19, 1);
      ctx.lineTo(17, 5);
      ctx.stroke();

      // Shoes/boots
      ctx.fillStyle = '#2a2040';
      ctx.fillRect(10, 30, 4, 3);
      ctx.fillRect(17, 30, 4, 3);
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
      // Dark armor torso with rivets
      const armorBase = '#2a1f1f';
      const armorHighlight = '#443030';

      // Body shadow
      ctx.fillStyle = '#180f0f';
      ctx.beginPath();
      ctx.ellipse(17, 24, 8, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.fillStyle = '#1e1414';
      ctx.fillRect(11, 22, 4, 10);
      ctx.fillRect(17, 22, 4, 10);
      ctx.fillStyle = '#100c0c';
      ctx.fillRect(11, 30, 5, 3);
      ctx.fillRect(16, 30, 5, 3);

      // Torso armor
      ctx.fillStyle = armorBase;
      ctx.fillRect(9, 12, 14, 12);
      ctx.fillStyle = armorHighlight;
      ctx.fillRect(10, 12, 12, 3);

      // Armor plate lines
      ctx.strokeStyle = '#3d2a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 12); ctx.lineTo(16, 24);
      ctx.moveTo(9, 17); ctx.lineTo(23, 17);
      ctx.moveTo(9, 21); ctx.lineTo(23, 21);
      ctx.stroke();

      // Rivet dots
      ctx.fillStyle = '#5a4040';
      [[10,13],[14,13],[18,13],[22,13],[10,20],[22,20]].forEach(([rx,ry]) => {
        ctx.beginPath(); ctx.arc(rx, ry, 0.8, 0, Math.PI*2); ctx.fill();
      });

      // Weapon (halberd) - behind body
      ctx.strokeStyle = '#888090';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(24, 32); ctx.lineTo(26, 4);
      ctx.stroke();
      // Blade
      ctx.fillStyle = '#aaa8b8';
      ctx.beginPath();
      ctx.moveTo(26, 4);
      ctx.lineTo(22, 8);
      ctx.lineTo(27, 10);
      ctx.lineTo(29, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d0d0e0';
      ctx.beginPath();
      ctx.moveTo(26, 4);
      ctx.lineTo(27, 5);
      ctx.lineTo(25, 8);
      ctx.closePath();
      ctx.fill();

      // Arms
      ctx.strokeStyle = armorBase;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(9, 14); ctx.lineTo(5, 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(23, 14); ctx.lineTo(27, 19);
      ctx.stroke();

      // Neck
      ctx.fillStyle = '#c09070';
      ctx.fillRect(13, 8, 6, 4);

      // Head
      ctx.fillStyle = '#c09070';
      ctx.beginPath();
      ctx.ellipse(16, 6, 5, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Helmet
      ctx.fillStyle = '#1e1414';
      ctx.beginPath();
      ctx.ellipse(16, 4, 5.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e2020';
      ctx.fillRect(10, 6, 12, 3);
      // Helmet crest
      ctx.fillStyle = '#8a1818';
      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.lineTo(16, -1);
      ctx.lineTo(18, 2);
      ctx.lineTo(16, 4);
      ctx.closePath();
      ctx.fill();

      // Glowing red eyes
      ctx.fillStyle = '#ff2020';
      ctx.beginPath(); ctx.ellipse(13, 7, 1.4, 1, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(19, 7, 1.4, 1, 0, 0, Math.PI*2); ctx.fill();
      // Eye glow
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ff6060';
      ctx.beginPath(); ctx.ellipse(13, 7, 2.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(19, 7, 2.5, 1.8, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_tree`, 36, 46, (ctx) => {
      // Trunk
      const trunkG = ctx.createLinearGradient(15, 30, 21, 46);
      trunkG.addColorStop(0, '#a07848');
      trunkG.addColorStop(1, '#6b4e28');
      ctx.fillStyle = trunkG;
      ctx.beginPath();
      ctx.moveTo(14, 46);
      ctx.lineTo(13, 32);
      ctx.lineTo(16, 30);
      ctx.lineTo(20, 30);
      ctx.lineTo(23, 32);
      ctx.lineTo(22, 46);
      ctx.closePath();
      ctx.fill();
      // Bark lines
      ctx.strokeStyle = '#6b4e28';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(16, 31); ctx.lineTo(15, 45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, 31); ctx.lineTo(21, 45); ctx.stroke();
      ctx.globalAlpha = 1;

      // Back foliage layer (darker)
      ctx.fillStyle = '#4a9060';
      ctx.beginPath();
      ctx.moveTo(18, 2);
      ctx.lineTo(2, 28);
      ctx.lineTo(34, 28);
      ctx.closePath();
      ctx.fill();

      // Mid foliage
      const foliageG = ctx.createLinearGradient(18, 6, 18, 34);
      foliageG.addColorStop(0, '#68c888');
      foliageG.addColorStop(0.5, '#50a870');
      foliageG.addColorStop(1, '#3d8855');
      ctx.fillStyle = foliageG;
      ctx.beginPath();
      ctx.moveTo(18, 6);
      ctx.lineTo(4, 30);
      ctx.lineTo(32, 30);
      ctx.closePath();
      ctx.fill();

      // Top sprig
      ctx.fillStyle = '#78d898';
      ctx.beginPath();
      ctx.moveTo(18, 3);
      ctx.lineTo(10, 18);
      ctx.lineTo(26, 18);
      ctx.closePath();
      ctx.fill();

      // Light highlight
      ctx.fillStyle = 'rgba(200,255,220,0.55)';
      ctx.beginPath();
      ctx.ellipse(14, 14, 4, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Branch hints
      ctx.strokeStyle = '#4a7040';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(18, 22); ctx.lineTo(8, 28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(18, 22); ctx.lineTo(28, 27); ctx.stroke();
      ctx.globalAlpha = 1;
    });

    this.makeCanvasTexture(`${style.id}_rock`, 42, 28, (ctx) => {
      const rockA = style.id === 'ink' ? '#9ea9b1' : '#aab8c2';
      const rockB = style.id === 'ink' ? '#7e8a92' : '#8090a0';
      const rockDark = style.id === 'ink' ? '#606870' : '#6070800';

      // Rock shadow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(22, 26, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Main rock body
      const rockG = ctx.createLinearGradient(4, 4, 38, 26);
      rockG.addColorStop(0, rockA);
      rockG.addColorStop(0.6, rockB);
      rockG.addColorStop(1, '#607080');
      ctx.fillStyle = rockG;
      ctx.beginPath();
      ctx.moveTo(6, 22);
      ctx.lineTo(9, 10);
      ctx.lineTo(18, 4);
      ctx.lineTo(30, 5);
      ctx.lineTo(38, 13);
      ctx.lineTo(37, 23);
      ctx.lineTo(20, 27);
      ctx.closePath();
      ctx.fill();

      // Top face highlight
      ctx.fillStyle = rockA;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(17, 5);
      ctx.lineTo(29, 6);
      ctx.lineTo(33, 12);
      ctx.lineTo(24, 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Crack detail
      ctx.strokeStyle = '#607080';
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(19, 6);
      ctx.lineTo(22, 14);
      ctx.lineTo(25, 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(12, 14);
      ctx.lineTo(17, 18);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Edge highlight
      ctx.strokeStyle = 'rgba(220,235,245,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, 12);
      ctx.lineTo(14, 5);
      ctx.lineTo(24, 3);
      ctx.stroke();
    });

    this.makeCanvasTexture(`${style.id}_building`, 64, 64, (ctx) => {
      // Foundation platform
      const foundG = ctx.createLinearGradient(0, 54, 0, 64);
      foundG.addColorStop(0, '#c09878');
      foundG.addColorStop(1, '#907050');
      ctx.fillStyle = foundG;
      ctx.fillRect(2, 52, 60, 12);
      // Foundation edge
      ctx.strokeStyle = '#705030';
      ctx.lineWidth = 1;
      ctx.strokeRect(2, 52, 60, 12);

      // Wall body
      const wallG = ctx.createLinearGradient(0, 20, 0, 54);
      wallG.addColorStop(0, '#d4a870');
      wallG.addColorStop(1, '#b08050');
      ctx.fillStyle = wallG;
      ctx.fillRect(4, 20, 56, 34);

      // Wall panel lines
      ctx.strokeStyle = '#a07040';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.4;
      for (let lx = 10; lx < 56; lx += 10) {
        ctx.beginPath(); ctx.moveTo(lx + 4, 20); ctx.lineTo(lx + 4, 54); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Roof - double-eave Chinese style
      // Lower eave
      ctx.fillStyle = '#4a2820';
      ctx.beginPath();
      ctx.moveTo(-4, 26);
      ctx.lineTo(32, 8);
      ctx.lineTo(68, 26);
      ctx.lineTo(64, 30);
      ctx.lineTo(32, 14);
      ctx.lineTo(0, 30);
      ctx.closePath();
      ctx.fill();
      // Roof highlight
      ctx.fillStyle = '#6a3828';
      ctx.beginPath();
      ctx.moveTo(0, 28);
      ctx.lineTo(32, 11);
      ctx.lineTo(64, 28);
      ctx.lineTo(64, 26);
      ctx.lineTo(32, 8);
      ctx.lineTo(0, 26);
      ctx.closePath();
      ctx.fill();

      // Curved eave tips
      ctx.fillStyle = '#3a1e14';
      ctx.beginPath();
      ctx.moveTo(-4, 24);
      ctx.quadraticCurveTo(-6, 30, 0, 32);
      ctx.lineTo(2, 28);
      ctx.quadraticCurveTo(-1, 27, -2, 23);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(68, 24);
      ctx.quadraticCurveTo(70, 30, 64, 32);
      ctx.lineTo(62, 28);
      ctx.quadraticCurveTo(65, 27, 66, 23);
      ctx.closePath();
      ctx.fill();

      // Roof tiles pattern
      ctx.strokeStyle = '#3a1e14';
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 8; i++) {
        const rtx = 4 + i * 8;
        ctx.beginPath();
        ctx.moveTo(rtx, 30);
        ctx.lineTo(rtx + 4, 12 + i * 0.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Ridge ornament
      ctx.fillStyle = '#d9b36b';
      ctx.beginPath();
      ctx.arc(32, 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd080';
      ctx.beginPath();
      ctx.arc(32, 8, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Door
      const doorG = ctx.createLinearGradient(24, 38, 40, 54);
      doorG.addColorStop(0, '#3a200e');
      doorG.addColorStop(1, '#1e0e08');
      ctx.fillStyle = doorG;
      ctx.fillRect(24, 38, 16, 16);
      // Door arch
      ctx.fillStyle = '#2a1408';
      ctx.beginPath();
      ctx.arc(32, 38, 8, Math.PI, 0);
      ctx.fill();
      // Door knocker
      ctx.fillStyle = '#c8a040';
      ctx.beginPath();
      ctx.arc(32, 44, 2, 0, Math.PI * 2);
      ctx.fill();

      // Windows
      ctx.fillStyle = '#5a9aaa';
      ctx.fillRect(6, 30, 12, 10);
      ctx.fillRect(46, 30, 12, 10);
      // Window grille
      ctx.strokeStyle = '#2a1408';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(12, 30); ctx.lineTo(12, 40);
      ctx.moveTo(6, 35); ctx.lineTo(18, 35);
      ctx.moveTo(52, 30); ctx.lineTo(52, 40);
      ctx.moveTo(46, 35); ctx.lineTo(58, 35);
      ctx.stroke();

      // Lanterns
      ctx.fillStyle = '#dd2020';
      ctx.beginPath(); ctx.ellipse(10, 27, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6030';
      ctx.beginPath(); ctx.ellipse(10, 27, 1.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(10, 22); ctx.lineTo(10, 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, 30); ctx.lineTo(10, 32); ctx.stroke();
      // Tassel
      ctx.strokeStyle = '#ffcc00';
      ctx.beginPath(); ctx.moveTo(10, 32); ctx.lineTo(8, 36); ctx.moveTo(10, 32); ctx.lineTo(10, 36); ctx.moveTo(10, 32); ctx.lineTo(12, 36); ctx.stroke();

      ctx.fillStyle = '#dd2020';
      ctx.beginPath(); ctx.ellipse(54, 27, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6030';
      ctx.beginPath(); ctx.ellipse(54, 27, 1.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(54, 22); ctx.lineTo(54, 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(54, 30); ctx.lineTo(54, 32); ctx.stroke();
      ctx.strokeStyle = '#ffcc00';
      ctx.beginPath(); ctx.moveTo(54, 32); ctx.lineTo(52, 36); ctx.moveTo(54, 32); ctx.lineTo(54, 36); ctx.moveTo(54, 32); ctx.lineTo(56, 36); ctx.stroke();
    });
  }

  generateProps() {
    // --- Bamboo stalk (20×52) ---
    this.makeCanvasTexture('prop_bamboo', 20, 52, (ctx, w, h) => {
      const segH = 10;
      const colors = ['#5daf68', '#4a9a55', '#3d8848', '#56a862'];
      for (let s = 0; s < 5; s++) {
        const sy = h - (s + 1) * segH;
        const g = ctx.createLinearGradient(2, sy, w - 2, sy + segH);
        g.addColorStop(0, colors[s % colors.length]);
        g.addColorStop(1, '#2d6838');
        ctx.fillStyle = g;
        ctx.fillRect(7, sy, 6, segH - 1);
        // Node ring
        ctx.fillStyle = '#8eda90';
        ctx.fillRect(6, sy + segH - 2, 8, 2);
      }
      // Leaves
      const drawLeaf = (lx, ly, angle) => {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(angle);
        ctx.fillStyle = '#6acc78';
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3d8848';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
        ctx.restore();
      };
      drawLeaf(5, 5, -0.5);
      drawLeaf(14, 8, 0.6);
      drawLeaf(3, 16, -0.7);
      drawLeaf(16, 20, 0.4);
    });

    // --- Fence post (12×24) ---
    this.makeCanvasTexture('prop_fence', 12, 24, (ctx, w, h) => {
      // Post
      const pg = ctx.createLinearGradient(1, 0, w - 1, 0);
      pg.addColorStop(0, '#c8a870');
      pg.addColorStop(0.5, '#e8c888');
      pg.addColorStop(1, '#a88850');
      ctx.fillStyle = pg;
      ctx.fillRect(4, 4, 4, h - 4);
      // Cap
      ctx.fillStyle = '#ead898';
      ctx.beginPath();
      ctx.moveTo(3, 4); ctx.lineTo(6, 0); ctx.lineTo(9, 4);
      ctx.closePath(); ctx.fill();
      // Rail holes (horizontal beam stubs)
      ctx.strokeStyle = '#a88850';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(12, 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(12, 17); ctx.stroke();
      // Wood grain
      ctx.strokeStyle = 'rgba(120,80,30,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(5, 5); ctx.lineTo(5, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(7, 5); ctx.lineTo(7, h); ctx.stroke();
    });

    // --- Flower patch (24×16) ---
    this.makeCanvasTexture('prop_flower', 24, 16, (ctx, w, h) => {
      const drawFlower = (fx, fy, petalColor, centerColor) => {
        ctx.fillStyle = '#5a9a50';
        ctx.fillRect(fx, fy + 6, 2, 6);
        const petals = 5;
        for (let i = 0; i < petals; i++) {
          const a = (Math.PI * 2 * i) / petals;
          ctx.fillStyle = petalColor;
          ctx.globalAlpha = 0.88;
          ctx.beginPath();
          ctx.ellipse(fx + 1 + Math.cos(a) * 3.5, fy + 3 + Math.sin(a) * 3.5, 2.5, 1.8, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = centerColor;
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(fx + 1, fy + 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffcc';
        ctx.beginPath(); ctx.arc(fx + 1, fy + 3, 1, 0, Math.PI * 2); ctx.fill();
      };
      drawFlower(3, 2, '#ff88aa', '#dd2244');
      drawFlower(12, 0, '#ffcc44', '#cc8800');
      drawFlower(19, 3, '#cc88ff', '#8844cc');
    });

    // --- Well (32×36) ---
    this.makeCanvasTexture('prop_well', 32, 36, (ctx, w, h) => {
      // Stone base
      const baseG = ctx.createLinearGradient(0, 20, 0, h);
      baseG.addColorStop(0, '#b0a898');
      baseG.addColorStop(1, '#807870');
      ctx.fillStyle = baseG;
      ctx.beginPath();
      ctx.ellipse(16, 32, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(2, 20, 28, 14);
      // Stone rings
      ctx.strokeStyle = '#908878';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (let ry = 22; ry < 34; ry += 4) {
        ctx.beginPath(); ctx.moveTo(2, ry); ctx.lineTo(30, ry); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Water inside
      ctx.fillStyle = '#4ab8d8';
      ctx.beginPath(); ctx.ellipse(16, 21, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#80d8f0';
      ctx.beginPath(); ctx.ellipse(14, 20, 5, 2, -0.3, 0, Math.PI * 2); ctx.fill();
      // Posts
      ctx.fillStyle = '#9a7040';
      ctx.fillRect(4, 4, 4, 20);
      ctx.fillRect(24, 4, 4, 20);
      // Crossbeam
      ctx.fillStyle = '#b88050';
      ctx.fillRect(4, 4, 24, 4);
      // Rope
      ctx.strokeStyle = '#c8a858';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(16, 7); ctx.lineTo(16, 18); ctx.stroke();
      // Bucket
      ctx.fillStyle = '#8a5030';
      ctx.fillRect(13, 14, 6, 5);
      ctx.strokeStyle = '#c8a858'; ctx.lineWidth = 0.8;
      ctx.strokeRect(13, 14, 6, 5);
    });

    // --- Lantern post (16×48) ---
    this.makeCanvasTexture('prop_lanternpost', 16, 48, (ctx, w, h) => {
      // Post
      const pg = ctx.createLinearGradient(5, 0, 11, 0);
      pg.addColorStop(0, '#806040');
      pg.addColorStop(0.5, '#b08860');
      pg.addColorStop(1, '#705030');
      ctx.fillStyle = pg;
      ctx.fillRect(6, 12, 4, h - 12);
      // Arm
      ctx.strokeStyle = '#a07050';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, 14); ctx.lineTo(12, 10); ctx.stroke();
      // Lantern body
      ctx.fillStyle = '#cc1818';
      ctx.beginPath(); ctx.ellipse(12, 6, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
      // Lantern glow inner
      ctx.fillStyle = '#ff8840';
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.ellipse(12, 6, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Glow corona
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ffcc60';
      ctx.beginPath(); ctx.ellipse(12, 6, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // Tassel
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(12, 11); ctx.lineTo(10, 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 11); ctx.lineTo(12, 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 11); ctx.lineTo(14, 16); ctx.stroke();
    });

    // --- Ground patch: moss (24×16) ---
    this.makeCanvasTexture('prop_moss', 24, 16, (ctx, w, h) => {
      ctx.fillStyle = '#4a8840';
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.ellipse(12, 8, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#60aa58';
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.ellipse(10, 7, 7, 5, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#88cc70';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(4 + i * 2.5, 6 + Math.sin(i) * 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    // --- Ground patch: dry dirt (28×18) ---
    this.makeCanvasTexture('prop_dirt', 28, 18, (ctx, w, h) => {
      ctx.fillStyle = '#c8a870';
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.ellipse(14, 9, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0c090';
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.ellipse(12, 8, 8, 5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#b09060';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(2 + (i * 3) % 24, 3 + (i * 2) % 12, 2, 1);
      }
      ctx.globalAlpha = 1;
    });
  }

  generateAssets() {
    Object.values(STYLE_DEFS).forEach((style) => this.generateStyleAssets(style));
    this.generateProps();
  }

  create() {
    this.scene.start('WorldScene');
  }
}
