export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Progress bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, '夢 Dream of Water Margin', {
      fontSize: '20px',
      fill: '#c8a96e',
      fontFamily: 'serif'
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xc8a96e, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder pixel art assets programmatically
    this.generateAssets();
  }

  generateAssets() {
    // We'll generate pixel art tiles via canvas
    const tileSize = 32;

    // Grass tile
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = tileSize;
    grassCanvas.height = tileSize;
    const gCtx = grassCanvas.getContext('2d');
    gCtx.fillStyle = '#4a7c40';
    gCtx.fillRect(0, 0, tileSize, tileSize);
    gCtx.fillStyle = '#5a9c50';
    for (let i = 0; i < 8; i++) {
      gCtx.fillRect(Math.random() * tileSize, Math.random() * tileSize, 3, 3);
    }
    this.textures.addCanvas('grass', grassCanvas);

    // Water tile
    const waterCanvas = document.createElement('canvas');
    waterCanvas.width = tileSize;
    waterCanvas.height = tileSize;
    const wCtx = waterCanvas.getContext('2d');
    wCtx.fillStyle = '#2a6ab0';
    wCtx.fillRect(0, 0, tileSize, tileSize);
    wCtx.fillStyle = '#3a8ad0';
    wCtx.fillRect(4, 8, 24, 4);
    wCtx.fillRect(8, 20, 16, 4);
    this.textures.addCanvas('water', waterCanvas);

    // Path tile
    const pathCanvas = document.createElement('canvas');
    pathCanvas.width = tileSize;
    pathCanvas.height = tileSize;
    const pCtx = pathCanvas.getContext('2d');
    pCtx.fillStyle = '#c8a96e';
    pCtx.fillRect(0, 0, tileSize, tileSize);
    pCtx.fillStyle = '#b8996e';
    pCtx.fillRect(2, 2, 4, 4);
    pCtx.fillRect(20, 18, 4, 4);
    this.textures.addCanvas('path', pathCanvas);

    // Wall tile
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = tileSize;
    wallCanvas.height = tileSize;
    const wallCtx = wallCanvas.getContext('2d');
    wallCtx.fillStyle = '#8B6914';
    wallCtx.fillRect(0, 0, tileSize, tileSize);
    wallCtx.fillStyle = '#6B4914';
    wallCtx.fillRect(0, 0, tileSize, 4);
    wallCtx.fillRect(0, 14, tileSize, 4);
    wallCtx.fillRect(0, 28, tileSize, 4);
    wallCtx.strokeStyle = '#5a3a0a';
    wallCtx.strokeRect(0, 0, tileSize, tileSize);
    this.textures.addCanvas('wall', wallCanvas);

    // Player sprite (hero silhouette - pixel art style)
    const playerCanvas = document.createElement('canvas');
    playerCanvas.width = 32;
    playerCanvas.height = 32;
    const plCtx = playerCanvas.getContext('2d');
    // Body
    plCtx.fillStyle = '#cc2222';
    plCtx.fillRect(10, 14, 12, 14); // torso
    // Head
    plCtx.fillStyle = '#f5c78a';
    plCtx.fillRect(11, 4, 10, 10); // head
    // Hat (Song dynasty style)
    plCtx.fillStyle = '#222244';
    plCtx.fillRect(9, 2, 14, 4);
    plCtx.fillRect(13, 0, 6, 3);
    // Legs
    plCtx.fillStyle = '#222244';
    plCtx.fillRect(10, 28, 5, 4);
    plCtx.fillRect(17, 28, 5, 4);
    // Arms
    plCtx.fillStyle = '#cc2222';
    plCtx.fillRect(6, 14, 4, 10);
    plCtx.fillRect(22, 14, 4, 10);
    this.textures.addCanvas('player', playerCanvas);

    // NPC sprite
    const npcCanvas = document.createElement('canvas');
    npcCanvas.width = 32;
    npcCanvas.height = 32;
    const nCtx = npcCanvas.getContext('2d');
    nCtx.fillStyle = '#2244cc';
    nCtx.fillRect(10, 14, 12, 14);
    nCtx.fillStyle = '#f5c78a';
    nCtx.fillRect(11, 4, 10, 10);
    nCtx.fillStyle = '#664400';
    nCtx.fillRect(9, 2, 14, 4);
    nCtx.fillStyle = '#112288';
    nCtx.fillRect(10, 28, 5, 4);
    nCtx.fillRect(17, 28, 5, 4);
    nCtx.fillStyle = '#2244cc';
    nCtx.fillRect(6, 14, 4, 10);
    nCtx.fillRect(22, 14, 4, 10);
    this.textures.addCanvas('npc', npcCanvas);

    // Building tile
    const buildCanvas = document.createElement('canvas');
    buildCanvas.width = 64;
    buildCanvas.height = 64;
    const bCtx = buildCanvas.getContext('2d');
    // Walls
    bCtx.fillStyle = '#d4a96e';
    bCtx.fillRect(0, 20, 64, 44);
    // Roof
    bCtx.fillStyle = '#8B0000';
    bCtx.beginPath();
    bCtx.moveTo(0, 22);
    bCtx.lineTo(32, 0);
    bCtx.lineTo(64, 22);
    bCtx.fill();
    // Door
    bCtx.fillStyle = '#5a3a0a';
    bCtx.fillRect(24, 40, 16, 24);
    // Window
    bCtx.fillStyle = '#aaddff';
    bCtx.fillRect(8, 30, 12, 10);
    bCtx.fillRect(44, 30, 12, 10);
    this.textures.addCanvas('building', buildCanvas);

    // Enemy sprite (corrupt official)
    const enemyCanvas = document.createElement('canvas');
    enemyCanvas.width = 32;
    enemyCanvas.height = 32;
    const eCtx = enemyCanvas.getContext('2d');
    eCtx.fillStyle = '#226622';
    eCtx.fillRect(10, 14, 12, 14);
    eCtx.fillStyle = '#f5c78a';
    eCtx.fillRect(11, 4, 10, 10);
    eCtx.fillStyle = '#004400';
    eCtx.fillRect(9, 2, 14, 4);
    eCtx.fillStyle = '#113311';
    eCtx.fillRect(10, 28, 5, 4);
    eCtx.fillRect(17, 28, 5, 4);
    eCtx.fillStyle = '#226622';
    eCtx.fillRect(6, 14, 4, 10);
    eCtx.fillRect(22, 14, 4, 10);
    // Sword
    eCtx.fillStyle = '#aaaaaa';
    eCtx.fillRect(24, 10, 2, 16);
    this.textures.addCanvas('enemy', enemyCanvas);
  }

  create() {
    this.scene.start('WorldScene');
  }
}
