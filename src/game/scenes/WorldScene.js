import { INITIAL_CHAPTER_STATE, NPCS, SPECIALTIES } from '../../core/story/config';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldScene' });
    this.player = null;
    this.cursors = null;
    this.wasd = null;
    this.npcs = [];
    this.enemies = [];
    this.dialogActive = false;
    this.playerHP = 100;
    this.playerMaxHP = 100;
    this.playerGold = 50;
    this.heroesRecruited = 0;
    this.attackCooldown = 0;
    this.currentInteractingNpc = null;
    this.playerDown = false;
    this.victoryShown = false;
    this.saveKey = 'dowm.chapter1.save.v1';
    this.styleKey = 'dowm.artStyle.v1';
    this.styleOrder = ['retro', 'ink', 'wuxia'];
    this.stylePalette = {
      retro: { panel: 0x171717, panelTop: 0x2a2a2a, accent: '#f2ca74', objective: '#f4f4f4', hint: '#b9b9b9' },
      ink: { panel: 0xefe6d2, panelTop: 0xd7cbb2, accent: '#4a4337', objective: '#262018', hint: '#555049' },
      wuxia: { panel: 0x120b16, panelTop: 0x3a2230, accent: '#d9b36b', objective: '#cde6ff', hint: '#aaaaaa' },
    };
    this.currentArtStyle = localStorage.getItem(this.styleKey) || 'ink';

    this.touchState = {
      up: false,
      down: false,
      left: false,
      right: false,
      attackPressed: false,
      interactPressed: false,
      switchPressed: false,
      stylePressed: false,
    };
    this.touchAxis = { x: 0, y: 0 };
    this.lastTouchAttack = 0;
    this.lastTouchInteract = 0;

    this.tonkey = null;
    this.tonkeyUnlocked = false;
    this.tonkeyAttackCooldown = 0;

    this.enemyRespawnCooldown = 0;

    this.playerFacing = { x: 1, y: 0 };
    this.lastSafePlayerPos = { x: 0, y: 0 };
    this.isSwitchingArtStyle = false;
    this.lastArtSwitchAt = 0;

    this.specialties = SPECIALTIES.map((style) => ({ ...style }));
    this.currentSpecialtyIndex = 0;

    this.chapterState = { ...INITIAL_CHAPTER_STATE };
  }

  create() {
    this.createWorld();
    this.createPlayer();
    this.createNPCs();
    this.createEnemies();
    this.loadCheckpoint();
    this.createUI();
    this.setupCamera();
    this.setupInput();
    this.createTouchControls();
    this.setupCollisions();
    this.switchSpecialty(this.currentSpecialtyIndex, false);
    this.showChapterToast(`Chapter ${this.chapterState.chapter} begins • Visual: ${this.currentArtStyle}`);
    this.updateMissionUI();
    this.playChapter0Prologue();
    this.playChapter0IntroCinematic();

    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => this.saveCheckpoint(),
    });
  }

  tx(name) {
    return `${this.currentArtStyle}_${name}`;
  }

  createWorld() {
    const mapWidth = 50;
    const mapHeight = 50;
    const tileSize = 32;

    this.add.tileSprite(0, 0, mapWidth * tileSize, mapHeight * tileSize, this.tx('chapterBackdrop'))
      .setOrigin(0)
      .setAlpha(0.85)
      .setDepth(-32);

    this.add.tileSprite(0, 6, mapWidth * tileSize, 220, this.tx('mountains'))
      .setOrigin(0)
      .setAlpha(0.8)
      .setDepth(-30)
      .setScrollFactor(0.5);

    this.add.tileSprite(0, -12, mapWidth * tileSize, 96, this.tx('clouds'))
      .setOrigin(0)
      .setAlpha(0.6)
      .setDepth(-29)
      .setScrollFactor(0.4);

    const ridge = this.add.graphics().setDepth(-26).setScrollFactor(0.6);
    ridge.fillStyle(0xbbead3, 0.8);
    ridge.beginPath();
    ridge.moveTo(0, 210);
    ridge.lineTo(200, 150);
    ridge.lineTo(420, 180);
    ridge.lineTo(640, 120);
    ridge.lineTo(920, 175);
    ridge.lineTo(1200, 140);
    ridge.lineTo(mapWidth * tileSize, 210);
    ridge.lineTo(mapWidth * tileSize, 260);
    ridge.lineTo(0, 260);
    ridge.closePath();
    ridge.fillPath();

    const plateau = this.add.graphics().setDepth(-25).setScrollFactor(0.85);
    plateau.fillStyle(0xc9f4bf, 0.85);
    plateau.beginPath();
    plateau.moveTo(120, 280);
    plateau.lineTo(360, 260);
    plateau.lineTo(520, 320);
    plateau.lineTo(840, 280);
    plateau.lineTo(1100, 330);
    plateau.lineTo(mapWidth * tileSize, 360);
    plateau.lineTo(mapWidth * tileSize, 420);
    plateau.lineTo(0, 420);
    plateau.closePath();
    plateau.fillPath();

    this.mapData = [];
    for (let y = 0; y < mapHeight; y++) {
      this.mapData[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        if (x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1) {
          this.mapData[y][x] = 1;
        } else if (x >= 20 && x <= 30 && y >= 20 && y <= 30) {
          this.mapData[y][x] = 1;
        } else if (y === 25 && x >= 5 && x <= 45) {
          this.mapData[y][x] = 2;
        } else if (x === 25 && y >= 5 && y <= 45) {
          this.mapData[y][x] = 2;
        } else {
          this.mapData[y][x] = 0;
        }
      }
    }

    for (let x = 3; x <= 15; x++) {
      this.mapData[3][x] = 3;
      this.mapData[14][x] = 3;
    }
    for (let y = 3; y <= 14; y++) {
      this.mapData[y][3] = 3;
      this.mapData[y][15] = 3;
    }
    this.mapData[14][9] = 2;
    this.mapData[14][10] = 2;

    this.groundLayer = this.add.group();
    this.wallObjects = this.physics.add.staticGroup();

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = this.mapData[y][x];
        const px = x * tileSize;
        const py = y * tileSize;

        if (tile === 0) {
          this.add.image(px, py, this.tx('grass')).setOrigin(0);
        } else if (tile === 1) {
          this.add.image(px, py, this.tx('water')).setOrigin(0);
          const waterBlock = this.wallObjects.create(px + 16, py + 16, this.tx('water'));
          waterBlock.setAlpha(0);
          waterBlock.refreshBody();
        } else if (tile === 2) {
          this.add.image(px, py, this.tx('grass')).setOrigin(0);
          this.add.image(px, py, this.tx('path')).setOrigin(0).setAlpha(0.8);
        } else if (tile === 3) {
          this.add.image(px, py, this.tx('wall')).setOrigin(0);
          const wallBlock = this.wallObjects.create(px + 16, py + 16, this.tx('wall'));
          wallBlock.setAlpha(0);
          wallBlock.refreshBody();
        }
      }
    }

    for (let i = 0; i < 220; i++) {
      const x = Phaser.Math.Between(3, mapWidth - 4);
      const y = Phaser.Math.Between(4, mapHeight - 4);
      if (this.mapData[y][x] !== 0) continue;
      if ((x >= 5 && x <= 16 && y >= 3 && y <= 15) || (x > 18 && x < 32 && y > 18 && y < 32)) continue;
      if (Phaser.Math.Between(0, 100) < 70) {
        this.add.image(x * tileSize + 16, y * tileSize + 18, this.tx('tree')).setDepth(Phaser.Math.Between(5, 8)).setScale(Phaser.Math.FloatBetween(0.85, 1.25));
      } else {
        this.add.image(x * tileSize + 16, y * tileSize + 20, this.tx('rock')).setDepth(6).setScale(Phaser.Math.FloatBetween(0.7, 1.15));
      }
    }

    const clusters = [
      { x: 30, y: 32, count: 30 },
      { x: 20, y: 28, count: 18 },
      { x: 36, y: 24, count: 24 },
    ];
    clusters.forEach((cluster) => {
      for (let i = 0; i < cluster.count; i++) {
        const jitterX = Phaser.Math.Between(-3, 3);
        const jitterY = Phaser.Math.Between(-3, 3);
        this.add.image((cluster.x + jitterX) * tileSize + 16, (cluster.y + jitterY) * tileSize + 18, this.tx('tree'))
          .setDepth(7)
          .setScale(Phaser.Math.FloatBetween(0.9, 1.3));
      }
    });

    const haze = this.add.rectangle(mapWidth * tileSize * 0.5, 150, mapWidth * tileSize, 220, 0x9ad8ff, 0.25);
    haze.setDepth(-12);

    this.add.image(6 * tileSize, 5 * tileSize, this.tx('building')).setOrigin(0).setScale(2.0);
    this.add.image(10 * tileSize, 5 * tileSize, this.tx('building')).setOrigin(0).setScale(1.7);

    // --- Ground patches: moss + dirt scattered on grass tiles ---
    const groundPatches = [
      { key: 'prop_moss', positions: [[8,18],[14,22],[22,12],[32,8],[40,18],[28,36],[18,40],[44,26],[10,30]] },
      { key: 'prop_dirt', positions: [[6,20],[17,10],[38,14],[25,38],[42,22],[12,44],[33,28]] },
    ];
    groundPatches.forEach(({ key, positions }) => {
      positions.forEach(([gx, gy]) => {
        if (this.mapData[gy]?.[gx] !== 0) return;
        this.add.image(gx * tileSize + 14, gy * tileSize + 12, key)
          .setDepth(1)
          .setAlpha(Phaser.Math.FloatBetween(0.6, 0.9))
          .setScale(Phaser.Math.FloatBetween(0.8, 1.3));
      });
    });

    // --- Bamboo groves ---
    const bambooSpots = [
      [18,6],[19,6],[17,7],[20,7],[18,8],[42,10],[43,10],[42,11],[44,11],[43,9],
      [8,38],[9,38],[8,39],[10,39],[9,37],
    ];
    bambooSpots.forEach(([bx, by]) => {
      if (this.mapData[by]?.[bx] !== 0) return;
      this.add.image(bx * tileSize + Phaser.Math.Between(-4, 4), by * tileSize + Phaser.Math.Between(-4, 4), 'prop_bamboo')
        .setDepth(Phaser.Math.Between(6, 9))
        .setScale(Phaser.Math.FloatBetween(0.7, 1.1));
    });

    // --- Fence rows along some map edges (decorative) ---
    for (let fx = 4; fx <= 14; fx++) {
      if (this.mapData[2]?.[fx] === 0) {
        this.add.image(fx * tileSize + 16, 2 * tileSize + 8, 'prop_fence')
          .setDepth(5)
          .setScale(1.1);
      }
    }
    for (let fy = 4; fy <= 12; fy++) {
      if (this.mapData[fy]?.[4] === 0) {
        this.add.image(4 * tileSize + 8, fy * tileSize + 16, 'prop_fence')
          .setDepth(5)
          .setScale(1.0)
          .setRotation(Math.PI / 2);
      }
    }

    // --- Flower patches near the stronghold zone ---
    const flowerSpots = [
      [6,16],[7,17],[8,15],[9,16],[5,18],[10,17],
      [13,7],[14,8],[12,8],[15,7],
    ];
    flowerSpots.forEach(([flx, fly]) => {
      if (this.mapData[fly]?.[flx] !== 0) return;
      this.add.image(flx * tileSize + Phaser.Math.Between(0, 8), fly * tileSize + Phaser.Math.Between(4, 12), 'prop_flower')
        .setDepth(4)
        .setScale(Phaser.Math.FloatBetween(0.85, 1.2))
        .setAlpha(Phaser.Math.FloatBetween(0.8, 1.0));
    });

    // --- Well (one near the stronghold) ---
    this.add.image(11 * tileSize + 16, 8 * tileSize + 16, 'prop_well').setDepth(8).setScale(1.4);

    // --- Lantern posts flanking the main building ---
    this.add.image(5 * tileSize + 8, 7 * tileSize, 'prop_lanternpost').setDepth(9).setScale(1.5);
    this.add.image(14 * tileSize + 8, 7 * tileSize, 'prop_lanternpost').setDepth(9).setScale(1.5);
    this.add.image(9 * tileSize, 5 * tileSize + 8, 'prop_lanternpost').setDepth(9).setScale(1.3);

    // --- Torch glow halos near buildings (animated in createWorldAnimations) ---
    this.torchGlows = [];
    const torchPos = [
      [6 * tileSize + 20, 5 * tileSize + 50],
      [9 * tileSize + 90, 5 * tileSize + 50],
      [5 * tileSize + 8, 7 * tileSize + 10],
      [14 * tileSize + 20, 7 * tileSize + 10],
    ];
    torchPos.forEach(([tx, ty]) => {
      const glow = this.add.ellipse(tx, ty, 48, 32, 0xff8820, 0.12).setDepth(3);
      this.torchGlows.push(glow);
      this.tweens.add({
        targets: glow,
        scaleX: { from: 1, to: 1.18 },
        scaleY: { from: 1, to: 1.12 },
        alpha: { from: 0.12, to: 0.22 },
        duration: 700 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 600,
      });
    });

    // --- Ambient fireflies / dust motes ---
    this.fireflies = [];
    for (let i = 0; i < 24; i++) {
      const ffx = Phaser.Math.Between(3 * tileSize, 47 * tileSize);
      const ffy = Phaser.Math.Between(3 * tileSize, 47 * tileSize);
      const ff = this.add.ellipse(ffx, ffy, 3, 3, 0xccffaa, 0.0).setDepth(15);
      this.fireflies.push({ obj: ff, baseX: ffx, baseY: ffy, phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.5 });
      this.tweens.add({
        targets: ff,
        alpha: { from: 0, to: 0.7 },
        scaleX: { from: 0.5, to: 1.4 },
        scaleY: { from: 0.5, to: 1.4 },
        duration: 900 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 2000,
      });
    }

    this.physics.world.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize);
  }

  createPlayer() {
    this.player = this.physics.add.sprite(9 * 32 + 16, 16 * 32, this.tx('player'));
    this.player.setScale(1.8);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body.setSize(24, 24);
    this.player.body.setOffset(4, 8);

    this.playerNameTag = this.add.text(0, 0, '勇士', {
      fontSize: '10px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);

    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 16, 26, 10, 0x000000, 0.24).setDepth(8);

    this.lastSafePlayerPos = { x: this.player.x, y: this.player.y };
  }

  createNPCs() {
    const npcData = NPCS;

    npcData.forEach((data) => {
      const npcTexture = data.id === 'songjiang'
        ? this.tx('songjiang')
        : data.id === 'linchong'
          ? this.tx('linchong')
          : data.id === 'tonkey'
            ? this.tx('tonkey')
            : this.tx('npc');
      const npc = this.physics.add.sprite(data.x * 32 + 16, data.y * 32 + 16, npcTexture);
      npc.setScale(1.65);
      npc.setImmovable(true);
      npc.setDepth(9);
      npc.npcData = data;

      npc.shadow = this.add.ellipse(npc.x, npc.y + 14, 24, 9, 0x000000, 0.2).setDepth(8);

      if (data.id === 'tonkey') {
        npc.setTint(0xa8ffd2);
      }

      const tag = this.add.text(data.x * 32 + 16, data.y * 32 - 4, data.name, {
        fontSize: '9px',
        fill: data.id === 'tonkey' ? '#9fffc8' : '#ffff88',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(12);

      npc.nameTag = tag;
      this.npcs.push(npc);
    });

    this.tonkey = this.npcs.find((npc) => npc.npcData.id === 'tonkey') || null;
  }

  createEnemy(data) {
    const enemy = this.physics.add.sprite(data.x * 32, data.y * 32, this.tx('enemy'));
    enemy.setScale(1.65);
    enemy.setDepth(9);
    enemy.enemyId = data.id;
    enemy.displayName = data.name;
    enemy.hp = data.hp;
    enemy.maxHp = data.hp;
    enemy.moveSpeed = data.speed;
    enemy.damage = data.damage;
    enemy.gold = data.gold;
    enemy.isMiniBoss = !!data.isMiniBoss;
    enemy.patrolDir = 1;
    enemy.patrolTimer = 0;

    enemy.shadow = this.add.ellipse(enemy.x, enemy.y + 14, enemy.isMiniBoss ? 36 : 24, enemy.isMiniBoss ? 13 : 9, 0x000000, 0.22).setDepth(8);
    enemy.hpBar = this.add.graphics().setDepth(13);
    enemy.nameTag = this.add.text(enemy.x, enemy.y - 32, data.name, {
      fontSize: enemy.isMiniBoss ? '11px' : '9px',
      fill: enemy.isMiniBoss ? '#ff8a8a' : '#ffdd88',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(13);

    if (enemy.isMiniBoss) {
      enemy.setScale(2.1);
      enemy.setTint(0xff9999);
      enemy.enraged = false;
      enemy.chargeState = 'idle';
      enemy.nextChargeAt = 0;
      enemy.chargeEndsAt = 0;
    }

    this.updateEnemyHPBar(enemy);
    this.enemies.push(enemy);

    if (this.player && this.wallObjects) {
      this.physics.add.collider(this.player, enemy);
      this.physics.add.collider(enemy, this.wallObjects);
    }
  }

  createEnemies() {
    const raiders = [
      { id: 'raider-hei', name: 'Black-Fang Hei', x: 32, y: 10, hp: 36, speed: 62, damage: 6, gold: 14 },
      { id: 'raider-luo', name: 'Iron-Nail Luo', x: 35, y: 15, hp: 34, speed: 58, damage: 5, gold: 12 },
      { id: 'raider-yan', name: 'Mud-Wolf Yan', x: 38, y: 8, hp: 38, speed: 60, damage: 6, gold: 15 },
    ];

    raiders.forEach((raider) => this.createEnemy(raider));
  }

  saveCheckpoint() {
    try {
      const saveData = {
        player: {
          x: this.player?.x,
          y: this.player?.y,
          hp: this.playerHP,
          gold: this.playerGold,
          heroesRecruited: this.heroesRecruited,
          specialtyIndex: this.currentSpecialtyIndex,
        },
        chapterState: this.chapterState,
        tonkey: {
          unlocked: this.tonkeyUnlocked,
          x: this.tonkey?.x,
          y: this.tonkey?.y,
        },
        npcs: this.npcs.map((npc) => ({
          id: npc.npcData.id,
          recruited: !!npc.npcData.recruited,
        })),
        enemies: this.enemies.filter((e) => e.active).map((enemy) => ({
          id: enemy.enemyId,
          name: enemy.displayName,
          x: Math.round(enemy.x / 32),
          y: Math.round(enemy.y / 32),
          hp: Math.max(1, Math.round(enemy.hp)),
          speed: enemy.moveSpeed,
          damage: enemy.damage,
          gold: enemy.gold,
          isMiniBoss: !!enemy.isMiniBoss,
          enraged: !!enemy.enraged,
        })),
        timestamp: Date.now(),
      };

      localStorage.setItem(this.saveKey, JSON.stringify(saveData));
    } catch (err) {
      console.warn('Checkpoint save failed', err);
    }
  }

  loadCheckpoint() {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return;

      const saveData = JSON.parse(raw);
      if (!saveData?.player || !saveData?.chapterState) return;

      this.playerHP = Phaser.Math.Clamp(saveData.player.hp ?? this.playerHP, 0, 100);
      this.playerGold = saveData.player.gold ?? this.playerGold;
      this.heroesRecruited = saveData.player.heroesRecruited ?? this.heroesRecruited;
      this.currentSpecialtyIndex = saveData.player.specialtyIndex ?? this.currentSpecialtyIndex;

      this.chapterState = {
        ...this.chapterState,
        ...saveData.chapterState,
      };

      this.tonkeyUnlocked = !!saveData?.tonkey?.unlocked;

      if (typeof saveData.player.x === 'number' && typeof saveData.player.y === 'number') {
        this.player.setPosition(saveData.player.x, saveData.player.y);
      }

      if (this.tonkeyUnlocked && this.tonkey) {
        const tx = typeof saveData?.tonkey?.x === 'number' ? saveData.tonkey.x : this.player.x - 24;
        const ty = typeof saveData?.tonkey?.y === 'number' ? saveData.tonkey.y : this.player.y + 16;
        this.tonkey.setPosition(tx, ty);
        this.tonkey.npcData.recruited = true;
      }

      const recruitedMap = new Map((saveData.npcs || []).map((n) => [n.id, !!n.recruited]));
      this.npcs.forEach((npc) => {
        npc.npcData.recruited = recruitedMap.get(npc.npcData.id) || false;
      });

      this.enemies.forEach((enemy) => {
        if (enemy.nameTag) enemy.nameTag.destroy();
        if (enemy.hpBar) enemy.hpBar.destroy();
        enemy.destroy();
      });
      this.enemies = [];

      (saveData.enemies || []).forEach((enemyData) => {
        this.createEnemy({
          id: enemyData.id,
          name: enemyData.name,
          x: enemyData.x,
          y: enemyData.y,
          hp: enemyData.hp,
          speed: enemyData.speed,
          damage: enemyData.damage,
          gold: enemyData.gold,
          isMiniBoss: !!enemyData.isMiniBoss,
        });
      });

      this.chapterState.minibossSpawned = this.enemies.some((e) => e.isMiniBoss) || this.chapterState.minibossDefeated;
    } catch (err) {
      console.warn('Checkpoint load failed', err);
    }
  }

  clearCheckpoint() {
    try {
      localStorage.removeItem(this.saveKey);
    } catch (err) {
      console.warn('Checkpoint clear failed', err);
    }
  }

  spawnEnemyWave(count = 3) {
    const points = [
      { x: 32, y: 10 }, { x: 35, y: 15 }, { x: 38, y: 8 },
      { x: 40, y: 12 }, { x: 34, y: 20 }, { x: 28, y: 18 },
      { x: 42, y: 24 }, { x: 30, y: 28 },
    ];

    for (let i = 0; i < count; i++) {
      const p = points[Phaser.Math.Between(0, points.length - 1)];
      this.createEnemy({
        id: `raider-wave-${Date.now()}-${i}`,
        name: ['Night Pike Ren', 'Ash Saber Mo', 'River Fang Qiu'][Phaser.Math.Between(0, 2)],
        x: p.x,
        y: p.y,
        hp: Phaser.Math.Between(30, 42),
        speed: Phaser.Math.Between(58, 70),
        damage: Phaser.Math.Between(6, 9),
        gold: Phaser.Math.Between(10, 18),
      });
    }

    this.showChapterToast('New enemy wave sighted!');
  }

  spawnMiniBoss() {
    if (this.chapterState.minibossSpawned) return;

    this.chapterState.minibossSpawned = true;
    this.createEnemy({
      id: 'captain-zhao',
      name: 'Captain Zhao the Chain',
      x: 40,
      y: 30,
      hp: 120,
      speed: 72,
      damage: 10,
      gold: 80,
      isMiniBoss: true,
    });

    this.showChapterToast('Miniboss Appears: Captain Zhao the Chain!');
    this.chapterState.stage = 'defeat_miniboss';
    this.chapterState.objective = 'Defeat Captain Zhao the Chain.';
    this.updateMissionUI();
  }

  updateEnemyHPBar(enemy) {
    enemy.hpBar.clear();
    const ratio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
    const barW = enemy.isMiniBoss ? 50 : 34;
    const barH = enemy.isMiniBoss ? 7 : 5;
    const bx = Math.round(enemy.x - barW / 2);
    const by = Math.round(enemy.y - (enemy.isMiniBoss ? 26 : 22));

    // Background + border
    enemy.hpBar.fillStyle(0x000000, 0.75);
    enemy.hpBar.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    enemy.hpBar.fillStyle(0x220000, 1);
    enemy.hpBar.fillRect(bx, by, barW, barH);

    // Fill color: green → yellow → red
    const fillColor = ratio > 0.6 ? 0x22cc44 : ratio > 0.3 ? 0xddcc00 : 0xee2222;
    const fillW = Math.max(1, Math.round(barW * ratio));
    enemy.hpBar.fillStyle(fillColor, 1);
    enemy.hpBar.fillRect(bx, by, fillW, barH);

    // Shine strip on top
    enemy.hpBar.fillStyle(0xffffff, 0.22);
    enemy.hpBar.fillRect(bx, by, fillW, Math.max(1, Math.round(barH * 0.35)));

    // Boss gets a border glow
    if (enemy.isMiniBoss) {
      enemy.hpBar.lineStyle(1, 0xff9966, 0.7);
      enemy.hpBar.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);
    }

    if (enemy.nameTag) {
      enemy.nameTag.setPosition(enemy.x, enemy.y - (enemy.isMiniBoss ? 38 : 30));
    }
  }

  createUI() {
    this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(true);

    const theme = this.stylePalette[this.currentArtStyle] || this.stylePalette.wuxia;
    const safeTop = Math.max(10, Math.round(this.scale.height * 0.02));

    const panel = this.add.graphics();
    panel.fillStyle(theme.panel, this.currentArtStyle === 'ink' ? 0.92 : 0.82);
    panel.fillRect(8, safeTop, 350, 96);
    panel.fillStyle(theme.panelTop, this.currentArtStyle === 'ink' ? 0.5 : 0.25);
    panel.fillRect(8, safeTop, 350, 30);
    panel.lineStyle(2, Phaser.Display.Color.HexStringToColor(theme.accent).color);
    panel.strokeRect(8, safeTop, 350, 96);

    const title = this.add.text(182, safeTop + 10, '夢 Dream of Water Margin', {
      fontSize: '11px', fill: theme.accent, fontFamily: 'serif',
    }).setOrigin(0.5);

    this.hpText = this.add.text(18, safeTop + 27, `HP: ${this.playerHP}/${this.playerMaxHP}`, {
      fontSize: '12px', fill: '#ff6666',
    });

    this.goldText = this.add.text(18, safeTop + 45, `Gold: ${this.playerGold} 两`, {
      fontSize: '12px', fill: '#ffdd44',
    });

    this.heroText = this.add.text(18, safeTop + 63, `Heroes: ${this.heroesRecruited}/108`, {
      fontSize: '12px', fill: '#88aaff',
    });

    this.specialtyText = this.add.text(142, safeTop + 27, 'Style: -', {
      fontSize: '12px', fill: '#9fe7ff',
    });

    this.hintText = this.add.text(142, safeTop + 45, 'Q/1-3: Specialties   Space: Attack   E: Talk', {
      fontSize: '9px', fill: theme.hint,
    });

    this.objectiveText = this.add.text(142, safeTop + 63, '', {
      fontSize: '10px', fill: theme.objective, wordWrap: { width: 205 },
    });

    this.uiContainer.add([
      panel,
      title,
      this.hpText,
      this.goldText,
      this.heroText,
      this.specialtyText,
      this.hintText,
      this.objectiveText,
    ]);

    // We render HUD in React overlay for mobile/desktop consistency.
    this.uiContainer.setVisible(false);

    // Fallback mini-HUD (always-on) in case container styling fails on some browsers.
    this.hudFallback = this.add.text(14, 14, '', {
      fontSize: '12px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(520);

    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;
    const boxWidth = Math.min(gameWidth - 120, 620);
    const boxX = Math.round((gameWidth - boxWidth) / 2);
    const boxHeight = 196;
    const safeBottom = Math.max(8, Math.round(gameHeight * 0.06));
    const boxY = gameHeight - boxHeight - safeBottom;

    this.dialogBox = this.add.container(0, 0).setScrollFactor(0).setDepth(200).setVisible(false);
    const dialogBg = this.add.graphics();
    dialogBg.fillStyle(0x1a0a00, 0.95);
    dialogBg.fillRect(boxX, boxY, boxWidth, boxHeight);
    dialogBg.lineStyle(2, 0xc8a96e);
    dialogBg.strokeRect(boxX, boxY, boxWidth, boxHeight);

    this.dialogNameText = this.add.text(boxX + 16, boxY + 10, '', {
      fontSize: '12px', fill: '#c8a96e', fontFamily: 'serif', fontStyle: 'bold',
    });
    this.dialogText = this.add.text(boxX + 16, boxY + 32, '', {
      fontSize: '11px', fill: '#ffffff', wordWrap: { width: boxWidth - 32, useAdvancedWrap: true },
      lineSpacing: 3,
    });
    this.dialogPrompt = this.add.text(boxX + boxWidth - 122, boxY + boxHeight - 22, '[SPACE to close]', {
      fontSize: '10px', fill: '#aaaaaa',
    });

    this.dialogBox.add([dialogBg, this.dialogNameText, this.dialogText, this.dialogPrompt]);

    this.chapterToast = this.add.text(this.scale.width / 2, 110, '', {
      fontSize: '14px',
      fill: '#ffeab5',
      stroke: '#000',
      strokeThickness: 4,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(220).setScrollFactor(0).setVisible(false);

    const vignette = this.add.graphics().setScrollFactor(0).setDepth(190);
    vignette.fillStyle(0x000000, 0.18);
    vignette.fillRect(0, 0, this.scale.width, 20);
    vignette.fillRect(0, this.scale.height - 20, this.scale.width, 20);
    vignette.fillRect(0, 0, 20, this.scale.height);
    vignette.fillRect(this.scale.width - 20, 0, 20, this.scale.height);

    this.victoryOverlay = this.add.container(0, 0).setScrollFactor(0).setDepth(300).setVisible(false);
    const voBg = this.add.graphics();
    voBg.fillStyle(0x000000, 0.72);
    voBg.fillRect(0, 0, this.scale.width, this.scale.height);

    const voPanel = this.add.graphics();
    const pw = 520;
    const ph = 250;
    const px = (this.scale.width - pw) / 2;
    const py = (this.scale.height - ph) / 2;
    voPanel.fillStyle(0x1a0f1e, 0.95);
    voPanel.fillRect(px, py, pw, ph);
    voPanel.lineStyle(3, 0xd9b36b, 1);
    voPanel.strokeRect(px, py, pw, ph);

    this.victoryTitle = this.add.text(this.scale.width / 2, py + 56, 'Chapter Complete', {
      fontSize: '34px',
      fill: '#f2d59b',
      fontFamily: 'serif',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 5,
      align: 'center',
    }).setOrigin(0.5);

    this.victoryBody = this.add.text(this.scale.width / 2, py + 128, '', {
      fontSize: '15px',
      fill: '#eadff9',
      fontFamily: 'serif',
      align: 'center',
    }).setOrigin(0.5);

    this.victoryPrompt = this.add.text(this.scale.width / 2, py + 196, 'Press R to continue Chapter 1 roaming', {
      fontSize: '12px',
      fill: '#c9b998',
      fontFamily: 'serif',
      align: 'center',
    }).setOrigin(0.5);

    this.victoryOverlay.add([voBg, voPanel, this.victoryTitle, this.victoryBody, this.victoryPrompt]);
  }

  showVictoryScreen() {
    if (this.victoryShown) return;
    this.victoryShown = true;

    this.player.setVelocity(0, 0);
    this.victoryBody.setText(`Chapter 1: Oath at Liangshan\nReward: +100 gold\nHeroes Recruited: ${this.heroesRecruited}`);
    this.victoryOverlay.setVisible(true).setAlpha(0);

    this.tweens.add({
      targets: this.victoryOverlay,
      alpha: 1,
      duration: 350,
    });
  }

  hideVictoryScreen() {
    if (!this.victoryShown) return;
    this.victoryOverlay.setVisible(false);
  }

  updateMissionUI() {
    this.objectiveText.setText(`Chapter ${this.chapterState.chapter}: ${this.chapterState.objective}`);
  }

  playChapter0Prologue() {
    if (this.chapterState.stage !== 'chapter0_intro') return;

    this.showChapterToast('Chapter 0: History Class Fever Dream');
    this.time.delayedCall(900, () => {
      this.showChapterToast('A stressed high school student crams Song dynasty history for an exam...');
    });
    this.time.delayedCall(2400, () => {
      this.showChapterToast('He collapses with a fever, falls asleep, and wakes in this world.');
    });
    this.time.delayedCall(3900, () => {
      this.showChapterToast('Find Liangshan. If you rewrite fate here, you may return to modern time.');
    });
  }

  playChapter0IntroCinematic() {
    if (this.chapterState.stage !== 'chapter0_intro') return;

    const w = this.scale.width;
    const h = this.scale.height;
    const overlay = this.add.container(0, 0).setScrollFactor(0).setDepth(3000);

    const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.88).setOrigin(0);
    const title = this.add.text(w / 2, h * 0.22, 'Chapter 0\nFever Dream of Liangshan', {
      fontSize: '28px',
      align: 'center',
      fill: '#f3d8a0',
      fontFamily: 'serif',
      stroke: '#000000',
      strokeThickness: 6,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const lines = [
      'Night before the Song dynasty exam.',
      'A high school student studies until dawn, burning with fever.',
      'He collapses on his desk... and opens his eyes in Liangshan.',
      'To return to modern time, he must survive this era and reach the heroes.',
    ];

    const body = this.add.text(w / 2, h * 0.52, '', {
      fontSize: '16px',
      align: 'center',
      fill: '#e6e6f6',
      fontFamily: 'serif',
      wordWrap: { width: Math.min(760, w - 100), useAdvancedWrap: true },
      lineSpacing: 6,
    }).setOrigin(0.5);

    const skip = this.add.text(w / 2, h * 0.84, 'Tap / Press Space to skip', {
      fontSize: '13px',
      fill: '#bbbbbb',
      fontFamily: 'sans-serif',
    }).setOrigin(0.5);

    overlay.add([bg, title, body, skip]);

    let idx = 0;
    body.setText(lines[idx]);

    const nextLine = () => {
      idx += 1;
      if (idx >= lines.length) {
        this.tweens.add({
          targets: overlay,
          alpha: 0,
          duration: 380,
          onComplete: () => overlay.destroy(),
        });
        return;
      }
      this.tweens.add({
        targets: body,
        alpha: 0,
        duration: 180,
        onComplete: () => {
          body.setText(lines[idx]);
          this.tweens.add({ targets: body, alpha: 1, duration: 220 });
        },
      });
    };

    const lineTimer = this.time.addEvent({
      delay: 2100,
      loop: true,
      callback: nextLine,
    });

    const endNow = () => {
      lineTimer.remove(false);
      if (overlay.active) {
        this.tweens.add({
          targets: overlay,
          alpha: 0,
          duration: 220,
          onComplete: () => overlay.destroy(),
        });
      }
    };

    this.input.keyboard.once('keydown-SPACE', endNow);
    this.input.once('pointerdown', endNow);
  }

  syncStoryProgress() {
    const linchong = this.npcs.find((n) => n.npcData.id === 'linchong');
    const hasLinchong = !!linchong?.npcData?.recruited;
    const hasTonkey = !!this.tonkeyUnlocked;

    if (this.chapterState.stage === 'chapter0_recruit' && hasLinchong && hasTonkey) {
      this.chapterState.stage = 'chapter0_ready';
      this.chapterState.objective = 'Report to Song Jiang to begin Chapter 1.';
      this.updateMissionUI();
      this.showChapterToast('Chapter 0 Updated: Report to Song Jiang');
      this.saveCheckpoint();
    }

    if (this.chapterState.chapter === 1 && this.chapterState.stage === 'clear_raiders' && this.chapterState.raidersDefeated >= this.chapterState.raidersTarget && !this.chapterState.minibossSpawned) {
      this.spawnMiniBoss();
      this.saveCheckpoint();
    }
  }

  showChapterToast(text) {
    this.chapterToast.setText(text).setAlpha(1).setVisible(true);
    this.tweens.killTweensOf(this.chapterToast);
    this.tweens.add({
      targets: this.chapterToast,
      alpha: 0,
      duration: 2200,
      delay: 800,
      onComplete: () => this.chapterToast.setVisible(false),
    });
  }

  setupCamera() {
    this.cameras.main.setBounds(0, 0, 50 * 32, 50 * 32);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(0.8);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      attack: Phaser.Input.Keyboard.KeyCodes.SPACE,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      switchStyle: Phaser.Input.Keyboard.KeyCodes.Q,
      style1: Phaser.Input.Keyboard.KeyCodes.ONE,
      style2: Phaser.Input.Keyboard.KeyCodes.TWO,
      style3: Phaser.Input.Keyboard.KeyCodes.THREE,
      dismissVictory: Phaser.Input.Keyboard.KeyCodes.R,
    });

    // iPhone-safe fallback: tap directly on an NPC to talk.
    this.input.on('pointerdown', (pointer) => {
      if (this.dialogActive || this.playerDown) return;

      const tappedNpc = this.npcs.find((npc) => Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, npc.x, npc.y) <= 42);
      if (!tappedNpc) return;

      const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, tappedNpc.x, tappedNpc.y) <= 140;
      if (near) {
        this.showDialog(tappedNpc);
      }
    });
  }

  createTouchControls() {
    // Controls moved to HTML below the game frame for iPhone usability.
    this.input.addPointer(3);
  }

  consumeTouchPress(flag) {
    if (!this.touchState[flag]) return false;
    this.touchState[flag] = false;
    return true;
  }

  updateTouchFallback() {
    const { width, height } = this.scale;
    this.touchAxis.x = 0;
    this.touchAxis.y = 0;

    const pointers = this.input.manager.pointers || [];
    let bestMag = 0;

    for (const p of pointers) {
      if (!p.isDown) continue;

      if (p.x <= width * 0.58) {
        const cx = width * 0.2;
        const cy = height * 0.82;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const maxR = Math.max(40, width * 0.12);
        const nx = Phaser.Math.Clamp(dx / maxR, -1, 1);
        const ny = Phaser.Math.Clamp(dy / maxR, -1, 1);
        const mag = Math.sqrt(nx * nx + ny * ny);
        if (mag > bestMag) {
          bestMag = mag;
          this.touchAxis.x = nx;
          this.touchAxis.y = ny;
        }
      } else {
        // Right side touch = attack only. Interact is now tap-NPC (or keyboard E)
        // to avoid accidental dialog popups while steering on phone edges.
        if (p.isDown && this.time.now - this.lastTouchAttack > 260) {
          this.lastTouchAttack = this.time.now;
          this.touchState.attackPressed = true;
        }
      }
    }

    this.touchState.left = this.touchAxis.x < -0.22;
    this.touchState.right = this.touchAxis.x > 0.22;
    this.touchState.up = this.touchAxis.y < -0.22;
    this.touchState.down = this.touchAxis.y > 0.22;
  }

  keepPlayerOutOfBlockedTiles() {
    if (!this.player?.body) return;

    const overlappingBlocked = this.physics.overlap(this.player, this.wallObjects);
    if (!overlappingBlocked) {
      this.lastSafePlayerPos.x = this.player.x;
      this.lastSafePlayerPos.y = this.player.y;
      return;
    }

    this.player.setPosition(this.lastSafePlayerPos.x, this.lastSafePlayerPos.y);
    this.player.setVelocity(0, 0);
  }

  setupCollisions() {
    this.physics.add.collider(this.player, this.wallObjects);
    this.npcs.forEach((npc) => {
      if (npc.npcData.id !== 'tonkey') {
        this.physics.add.collider(this.player, npc);
      }
    });
    this.enemies.forEach((enemy) => {
      this.physics.add.collider(this.player, enemy);
      this.physics.add.collider(enemy, this.wallObjects);
    });

    if (this.tonkey) {
      this.physics.add.collider(this.tonkey, this.wallObjects);
    }
  }

  cycleArtStyle() {
    if (this.isSwitchingArtStyle) return;
    if (this.time.now - this.lastArtSwitchAt < 500) return;

    this.isSwitchingArtStyle = true;
    this.lastArtSwitchAt = this.time.now;

    const currentIndex = this.styleOrder.indexOf(this.currentArtStyle);
    this.currentArtStyle = this.styleOrder[(currentIndex + 1) % this.styleOrder.length];
    localStorage.setItem(this.styleKey, this.currentArtStyle);

    this.showChapterToast(`Visual style: ${this.currentArtStyle}`);
    this.time.delayedCall(120, () => {
      this.scene.restart();
    });
  }

  switchSpecialty(index, announce = true) {
    this.currentSpecialtyIndex = Phaser.Math.Wrap(index, 0, this.specialties.length);
    const style = this.specialties[this.currentSpecialtyIndex];
    this.specialtyText.setText(`Style: ${style.name}`);
    this.specialtyText.setColor(`#${style.color.toString(16).padStart(6, '0')}`);
    this.player.clearTint();

    if (announce) {
      this.showChapterToast(`Switched to ${style.name}`);
    }
  }

  applyMissionProgressFromDialog(npc) {
    const npcId = npc.npcData.id;

    if (this.chapterState.stage === 'chapter0_intro' && npcId === 'wuyong') {
      this.chapterState.stage = 'chapter0_recruit';
      this.chapterState.objective = 'Recruit Lin Chong and ask Tonkey to join your Liangshan escort.';
      this.updateMissionUI();
      this.showChapterToast('Wu Yong: Build a squad before you walk the road of fate.');
      this.saveCheckpoint();
      return;
    }

    if (this.chapterState.stage === 'chapter0_ready' && npcId === 'songjiang') {
      this.chapterState.chapter = 1;
      this.chapterState.stage = 'talk_villager';
      this.chapterState.objective = 'Travel east and speak with Village Elder Liu.';
      this.updateMissionUI();
      this.showChapterToast('Chapter 1 Begins: Reach Liangshan\'s first true trial.');
      this.saveCheckpoint();
      return;
    }

    if (this.chapterState.stage === 'talk_villager' && npcId === 'villager') {
      this.chapterState.stage = 'clear_raiders';
      this.chapterState.objective = `Defeat named raiders (${this.chapterState.raidersDefeated}/${this.chapterState.raidersTarget}).`;
      this.updateMissionUI();
      this.showChapterToast('Mission Updated: Clear the named raiders');
      this.saveCheckpoint();
    } else if (this.chapterState.stage === 'return_songjiang' && npcId === 'songjiang') {
      this.chapterState.stage = 'complete';
      this.chapterState.completed = true;
      this.chapterState.objective = 'Chapter complete. Await Chapter 2.';
      this.updateMissionUI();
      this.showChapterToast('Chapter 1 Complete: Oath at Liangshan');
      this.playerGold += 100;
      this.goldText.setText(`Gold: ${this.playerGold} 两`);
      this.showVictoryScreen();
      this.saveCheckpoint();
    }
  }

  showDialog(npc) {
    this.dialogActive = true;
    this.currentInteractingNpc = npc;
    this.dialogBox.setVisible(true);
    this.dialogNameText.setText(`${npc.npcData.name} (${npc.npcData.role})`);

    let text = npc.npcData.dialog;

    if (npc.npcData.id === 'wuyong' && this.chapterState.stage === 'chapter0_intro') {
      text += '\n\n[Chapter 0] You are a modern student lost in Song dynasty chaos. Recruit Lin Chong and Tonkey to survive.';
    }
    if (npc.npcData.id === 'songjiang' && this.chapterState.stage === 'chapter0_ready') {
      text += '\n\n[Chapter 0] Your escort is ready. Report in and walk the Liangshan path to find your road home.';
    }
    if (npc.npcData.id === 'villager' && this.chapterState.stage === 'talk_villager') {
      text += '\n\n[Main Mission] Defeat the three named raiders near the roads.';
    }
    if (npc.npcData.id === 'songjiang' && this.chapterState.stage === 'return_songjiang') {
      text += '\n\n[Main Mission] You returned victorious. Report and claim your reward.';
    }

    if (npc.npcData.id === 'tonkey' && !this.tonkeyUnlocked) {
      text += '\n[Press E/USE to ask Tonkey to join your party.]';
    }

    if (npc.npcData.recruitable && !npc.npcData.recruited) {
      text += '\n[Press E while this dialog is open to recruit this hero!]';
    }

    this.dialogText.setText(text);
    this.player.setVelocity(0, 0);
  }

  hideDialog() {
    if (this.currentInteractingNpc) {
      this.applyMissionProgressFromDialog(this.currentInteractingNpc);
      this.currentInteractingNpc = null;
    }
    this.dialogActive = false;
    this.dialogBox.setVisible(false);
  }

  showDamageText(x, y, amount, color = '#ff4444') {
    const isCrit = String(amount).includes('CRIT') || String(amount).includes('HEAVY');
    const fontSize = isCrit ? '18px' : '15px';

    const txt = this.add.text(x, y - 20, `${amount}`, {
      fontSize,
      fill: color,
      stroke: '#000',
      strokeThickness: isCrit ? 4 : 3,
      fontStyle: 'bold',
      shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true },
    }).setDepth(50);

    const floatY = isCrit ? y - 80 : y - 60;
    const startScale = isCrit ? 1.4 : 1.1;

    txt.setScale(startScale);
    this.tweens.add({
      targets: txt,
      y: floatY,
      alpha: 0,
      scaleX: 0.85,
      scaleY: 0.85,
      duration: isCrit ? 1000 : 750,
      ease: 'Quad.easeOut',
      onComplete: () => txt.destroy(),
    });
  }

  playHitSpark(x, y, color = 0xffcc66) {
    // Burst ring
    const ring = this.add.graphics().setDepth(44);
    ring.lineStyle(2, color, 0.85);
    ring.strokeCircle(x, y, 6);
    this.tweens.add({
      targets: ring,
      scaleX: 2.8, scaleY: 2.8,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Particle dots flying outward
    const spark = this.add.graphics().setDepth(46);
    const numParticles = 10;
    const positions = [];
    for (let i = 0; i < numParticles; i++) {
      const a = (Math.PI * 2 * i) / numParticles + Math.random() * 0.4;
      const r = 4 + Math.random() * 5;
      positions.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    spark.fillStyle(color, 1);
    positions.forEach(({ x: sx, y: sy }) => {
      spark.fillCircle(sx, sy, 1.5 + Math.random() * 1.5);
    });
    // Bright core flash
    spark.fillStyle(0xffffff, 0.9);
    spark.fillCircle(x, y, 4);

    this.tweens.add({
      targets: spark,
      scaleX: 2.0, scaleY: 2.0,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  playDeathBurst(x, y, color = 0xff4444) {
    // Big flash
    const flash = this.add.graphics().setDepth(48);
    flash.fillStyle(0xffffff, 0.75);
    flash.fillCircle(x, y, 20);
    this.tweens.add({
      targets: flash,
      scaleX: 2.5, scaleY: 2.5,
      alpha: 0,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Particle spray
    const debris = this.add.graphics().setDepth(47);
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
      const r = 8 + Math.random() * 18;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      debris.fillStyle(i % 3 === 0 ? 0xffffff : color, 0.9);
      debris.fillCircle(px, py, 1.5 + Math.random() * 2);
    }
    this.tweens.add({
      targets: debris,
      scaleX: 1.8, scaleY: 1.8,
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => debris.destroy(),
    });

    // Screen impact flash
    this.cameras.main.flash(120, 255, 200, 100, false);
  }

  playSlashFx(style) {
    const nx = this.playerFacing.x;
    const ny = this.playerFacing.y;
    const px = -ny;
    const py = nx;

    const fxRange = style.id === 'strategist' ? 76 : 60;
    const fxWidth = style.id === 'strategist' ? 46 : 30;

    const startX = this.player.x + nx * 12;
    const startY = this.player.y + ny * 12;
    const endX = this.player.x + nx * fxRange;
    const endY = this.player.y + ny * fxRange;

    // Outer glow layer (wide, soft)
    const glow = this.add.graphics().setDepth(38);
    glow.fillStyle(style.color, 0.15);
    glow.beginPath();
    glow.moveTo(startX + px * fxWidth * 0.55, startY + py * fxWidth * 0.55);
    glow.lineTo(startX - px * fxWidth * 0.55, startY - py * fxWidth * 0.55);
    glow.lineTo(endX - px * fxWidth * 1.1, endY - py * fxWidth * 1.1);
    glow.lineTo(endX + px * fxWidth * 1.1, endY + py * fxWidth * 1.1);
    glow.closePath();
    glow.fillPath();
    this.tweens.add({ targets: glow, alpha: 0, duration: 220, onComplete: () => glow.destroy() });

    // Mid slash body
    const slash = this.add.graphics().setDepth(40);
    slash.fillStyle(style.color, 0.42);
    slash.beginPath();
    slash.moveTo(startX + px * fxWidth * 0.36, startY + py * fxWidth * 0.36);
    slash.lineTo(startX - px * fxWidth * 0.36, startY - py * fxWidth * 0.36);
    slash.lineTo(endX - px * fxWidth * 0.72, endY - py * fxWidth * 0.72);
    slash.lineTo(endX + px * fxWidth * 0.72, endY + py * fxWidth * 0.72);
    slash.closePath();
    slash.fillPath();

    // Bright core line
    slash.lineStyle(2.5, 0xffffff, 0.85);
    slash.beginPath();
    slash.moveTo(startX + px * fxWidth * 0.1, startY + py * fxWidth * 0.1);
    slash.lineTo(endX - px * fxWidth * 0.15, endY - py * fxWidth * 0.15);
    slash.strokePath();

    // Colored edge line
    slash.lineStyle(1.5, style.color, 0.98);
    slash.strokeLineShape(new Phaser.Geom.Line(startX, startY, endX, endY));

    this.tweens.add({ targets: slash, alpha: 0, duration: 180, onComplete: () => slash.destroy() });

    // Tip spark at end of slash
    const tipSpark = this.add.graphics().setDepth(42);
    tipSpark.fillStyle(0xffffff, 0.95);
    tipSpark.fillCircle(endX, endY, 4);
    tipSpark.fillStyle(style.color, 0.9);
    tipSpark.fillCircle(endX, endY, 2.5);
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 + Math.random() * 0.6;
      tipSpark.fillStyle(style.color, 0.7);
      tipSpark.fillCircle(endX + Math.cos(a) * 5, endY + Math.sin(a) * 5, 1.5);
    }
    this.tweens.add({ targets: tipSpark, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 160, onComplete: () => tipSpark.destroy() });
  }

  damagePlayer(amount, source = 'hit') {
    if (this.playerDown) return;

    this.playerHP = Math.max(0, this.playerHP - amount);
    this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
    this.showDamageText(this.player.x, this.player.y, `-${amount}`, '#ff0000');

    if (source === 'heavy') {
      this.cameras.main.shake(180, 0.01);
      this.cameras.main.flash(180, 255, 120, 0, false);
    } else {
      this.cameras.main.flash(150, 255, 0, 0, false);
    }

    if (this.playerHP <= 0) {
      this.handlePlayerDefeat();
    }
  }

  handlePlayerDefeat() {
    if (this.playerDown) return;
    this.playerDown = true;

    this.player.setVelocity(0, 0);
    this.player.setAlpha(0.5);
    this.showChapterToast('You were defeated. Retreating to Liangshan...');

    this.time.delayedCall(1200, () => {
      this.playerHP = 100;
      this.player.setPosition(9 * 32 + 16, 16 * 32);
      this.player.setAlpha(1);
      this.playerDown = false;
      this.playerGold = Math.max(0, this.playerGold - 20);
      this.goldText.setText(`Gold: ${this.playerGold} 两`);
      this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
      this.showChapterToast('Recovered at Liangshan (-20 gold).');
      this.saveCheckpoint();
    });
  }

  updateMiniBossBehavior(enemy, time, dist) {
    if (!enemy.isMiniBoss) return false;

    if (!enemy.enraged && enemy.hp / enemy.maxHp <= 0.5) {
      enemy.enraged = true;
      enemy.moveSpeed += 20;
      enemy.damage += 3;
      enemy.setTint(0xff5555);
      this.showChapterToast('Captain Zhao is enraged!');
    }

    if (enemy.chargeState === 'idle' && time >= enemy.nextChargeAt && dist < 240) {
      enemy.chargeState = 'charging';
      enemy.chargeEndsAt = time + 700;
      enemy.nextChargeAt = time + 4200;
      enemy.setVelocity(0, 0);
      enemy.setTint(0xffee88);
      this.showDamageText(enemy.x, enemy.y - 18, 'HEAVY STRIKE!', '#ffd966');
      return true;
    }

    if (enemy.chargeState === 'charging') {
      enemy.setVelocity(0, 0);
      if (time >= enemy.chargeEndsAt) {
        enemy.chargeState = 'idle';
        enemy.setTint(enemy.enraged ? 0xff5555 : 0xff9999);

        const blastRange = 85;
        const blastDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (blastDist <= blastRange) {
          this.damagePlayer(18, 'heavy');
        }
      }
      return true;
    }

    return false;
  }

  onEnemyDefeated(enemy) {
    this.playerGold += enemy.gold;
    this.goldText.setText(`Gold: ${this.playerGold} 两`);
    this.showDamageText(enemy.x, enemy.y - 20, `+${enemy.gold} gold`, '#ffdd44');

    // Death burst VFX
    this.playDeathBurst(enemy.x, enemy.y, enemy.isMiniBoss ? 0xff6040 : 0xff4444);

    if (enemy.nameTag) enemy.nameTag.destroy();
    if (enemy.shadow) enemy.shadow.destroy();
    enemy.hpBar.destroy();
    enemy.destroy();
    this.enemies = this.enemies.filter((e) => e !== enemy);

    if (!enemy.isMiniBoss) {
      this.chapterState.raidersDefeated += 1;
      if (this.chapterState.stage === 'clear_raiders') {
        this.chapterState.objective = `Defeat named raiders (${this.chapterState.raidersDefeated}/${this.chapterState.raidersTarget}).`;
        this.updateMissionUI();
      }

      if (this.chapterState.raidersDefeated >= this.chapterState.raidersTarget) {
        this.spawnMiniBoss();
      }
    } else {
      this.chapterState.minibossDefeated = true;
      this.chapterState.stage = 'return_songjiang';
      this.chapterState.objective = 'Return to Song Jiang in Liangshan stronghold.';
      this.updateMissionUI();
      this.showChapterToast('Captain Zhao defeated! Return to Song Jiang.');
    }

    this.saveCheckpoint();
  }

  autoAimAtNearestEnemy(maxRange = 220) {
    const target = this.enemies
      .filter((e) => e.active)
      .sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y))[0];

    if (!target) return;
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    if (d > maxRange) return;

    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const mag = Math.sqrt(dx * dx + dy * dy) || 1;
    this.playerFacing.x = dx / mag;
    this.playerFacing.y = dy / mag;
  }

  attackNearbyEnemies() {
    const style = this.specialties[this.currentSpecialtyIndex];
    let hitCount = 0;

    this.enemies.forEach((enemy) => {
      if (!enemy.active) return;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > style.range) return;

      const dirX = dist > 0 ? dx / dist : 0;
      const dirY = dist > 0 ? dy / dist : 0;
      const facingDot = dirX * this.playerFacing.x + dirY * this.playerFacing.y;
      const inFront = style.splash ? facingDot > -0.05 : facingDot > 0.35;
      if (!inFront) return;

      if (!style.splash && hitCount > 0) return;

      let damage = Phaser.Math.Between(style.minDamage, style.maxDamage);
      if (style.id === 'vanguard' && dist < 36) {
        damage += 3;
      }
      if (style.id === 'shadow' && Math.random() < (style.critChance || 0)) {
        damage += 10;
        this.showDamageText(enemy.x, enemy.y - 15, 'CRIT!', '#ffa2ff');
      }

      enemy.hp -= damage;
      this.showDamageText(enemy.x, enemy.y, `-${damage}`, '#ff4444');
      this.playHitSpark(enemy.x, enemy.y, style.color);
      this.updateEnemyHPBar(enemy);
      hitCount += 1;

      this.tweens.add({
        targets: enemy,
        alpha: 0.25,
        yoyo: true,
        duration: 80,
        repeat: 2,
      });

      if (enemy.hp <= 0) {
        this.onEnemyDefeated(enemy);
      }
    });
  }

  tryInteractWithNPC() {
    const nearNPC = this.npcs
      .slice()
      .sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y))[0];

    if (!nearNPC) return false;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, nearNPC.x, nearNPC.y);
    if (dist > 96) return false;

    this.showDialog(nearNPC);
    return true;
  }

  updateTonkey(delta) {
    if (!this.tonkeyUnlocked || !this.tonkey) return;

    const targetX = this.player.x - 20;
    const targetY = this.player.y + 16;
    this.tonkey.x = Phaser.Math.Linear(this.tonkey.x, targetX, 0.12);
    this.tonkey.y = Phaser.Math.Linear(this.tonkey.y, targetY, 0.12);
    this.tonkey.setVelocity(0, 0);

    if (this.tonkey.nameTag) {
      this.tonkey.nameTag.setPosition(this.tonkey.x, this.tonkey.y - 24);
    }

    this.tonkeyAttackCooldown -= delta;
    if (this.tonkeyAttackCooldown > 0) return;

    const target = this.enemies
      .filter((e) => e.active)
      .sort((a, b) => Phaser.Math.Distance.Between(this.tonkey.x, this.tonkey.y, a.x, a.y) - Phaser.Math.Distance.Between(this.tonkey.x, this.tonkey.y, b.x, b.y))[0];

    if (!target) return;

    const d = Phaser.Math.Distance.Between(this.tonkey.x, this.tonkey.y, target.x, target.y);
    if (d <= 56) {
      const dmg = Phaser.Math.Between(6, 10);
      target.hp -= dmg;
      this.showDamageText(target.x, target.y - 12, `Tonkey -${dmg}`, '#9fffc8');
      this.playHitSpark(target.x, target.y, 0x9fffc8);
      this.updateEnemyHPBar(target);
      this.tonkeyAttackCooldown = 520;

      if (target.hp <= 0) {
        this.onEnemyDefeated(target);
      }
    }
  }

  update(time, delta) {
    this.playerMaxHP = 100;
    this.playerHP = Phaser.Math.Clamp(this.playerHP, 0, this.playerMaxHP);
    this.syncStoryProgress();
    this.updateTouchFallback();

    if (this.dialogActive) {
      if (Phaser.Input.Keyboard.JustDown(this.wasd.attack) || this.consumeTouchPress('attackPressed')) {
        this.hideDialog();
      }

      if (Phaser.Input.Keyboard.JustDown(this.wasd.interact) || this.consumeTouchPress('interactPressed')) {
        const nearNPC = this.npcs
          .slice()
          .sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y))[0];

        if (nearNPC && Phaser.Math.Distance.Between(this.player.x, this.player.y, nearNPC.x, nearNPC.y) <= 96 && nearNPC?.npcData.id === 'tonkey' && !this.tonkeyUnlocked) {
          this.tonkeyUnlocked = true;
          this.tonkey.npcData.recruited = true;
          this.tonkey.setPosition(this.player.x - 26, this.player.y + 18);
          this.dialogText.setText('Tonkey: I\'m in. Stay sharp — I\'ll cut down anyone who gets too close.\n✓ Tonkey now follows and fights for you.');
          this.showChapterToast('Companion Joined: Tonkey');

          const linchong = this.npcs.find((n) => n.npcData.id === 'linchong');
          if (this.chapterState.stage === 'chapter0_recruit' && linchong?.npcData.recruited) {
            this.chapterState.stage = 'chapter0_ready';
            this.chapterState.objective = 'Report to Song Jiang to begin Chapter 1.';
            this.updateMissionUI();
            this.showChapterToast('Chapter 0 Updated: Report to Song Jiang');
          }

          this.saveCheckpoint();
          return;
        }

        if (nearNPC && Phaser.Math.Distance.Between(this.player.x, this.player.y, nearNPC.x, nearNPC.y) <= 96 && nearNPC?.npcData.recruitable && !nearNPC.npcData.recruited) {
          nearNPC.npcData.recruited = true;
          this.heroesRecruited += 1;
          this.heroText.setText(`Heroes: ${this.heroesRecruited}/108`);
          this.dialogText.setText(`${nearNPC.npcData.dialog}\n✓ Hero recruited! They have joined Liangshan!`);

          if (this.chapterState.stage === 'chapter0_recruit' && nearNPC.npcData.id === 'linchong' && this.tonkeyUnlocked) {
            this.chapterState.stage = 'chapter0_ready';
            this.chapterState.objective = 'Report to Song Jiang to begin Chapter 1.';
            this.updateMissionUI();
            this.showChapterToast('Chapter 0 Updated: Report to Song Jiang');
          }

          this.saveCheckpoint();
        }
      }
      return;
    }

    if (this.victoryShown && this.victoryOverlay.visible) {
      this.player.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.wasd.dismissVictory) || this.consumeTouchPress('interactPressed')) {
        this.hideVictoryScreen();
      }
      return;
    }

    if (this.playerDown) {
      this.player.setVelocity(0, 0);
      return;
    }

    const speed = 120;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown || this.touchState.left) vx = -speed;
    else if (this.cursors.right.isDown || this.wasd.right.isDown || this.touchState.right) vx = speed;
    if (this.cursors.up.isDown || this.wasd.up.isDown || this.touchState.up) vy = -speed;
    else if (this.cursors.down.isDown || this.wasd.down.isDown || this.touchState.down) vy = speed;

    if (Math.abs(this.touchAxis.x) > 0.05 || Math.abs(this.touchAxis.y) > 0.05) {
      vx = speed * this.touchAxis.x;
      vy = speed * this.touchAxis.y;
    }

    if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
      const mag = Math.sqrt(vx * vx + vy * vy) || 1;
      this.playerFacing.x = vx / mag;
      this.playerFacing.y = vy / mag;
    }

    this.player.setVelocity(vx, vy);
    this.keepPlayerOutOfBlockedTiles();

    this.playerNameTag.setPosition(this.player.x, this.player.y - 22);

    if (this.consumeTouchPress('stylePressed')) {
      this.cycleArtStyle();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.wasd.switchStyle) || this.consumeTouchPress('switchPressed')) {
      this.switchSpecialty(this.currentSpecialtyIndex + 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.wasd.style1)) this.switchSpecialty(0);
    if (Phaser.Input.Keyboard.JustDown(this.wasd.style2)) this.switchSpecialty(1);
    if (Phaser.Input.Keyboard.JustDown(this.wasd.style3)) this.switchSpecialty(2);

    this.attackCooldown -= delta;
    if ((Phaser.Input.Keyboard.JustDown(this.wasd.attack) || this.consumeTouchPress('attackPressed')) && this.attackCooldown <= 0) {
      this.attackCooldown = 320;
      this.autoAimAtNearestEnemy();
      const style = this.specialties[this.currentSpecialtyIndex];
      this.playSlashFx(style);
      this.attackNearbyEnemies();

      this.tweens.add({
        targets: this.player,
        scaleX: 1.25,
        scaleY: 1.25,
        yoyo: true,
        duration: 90,
      });
    }

    if (Phaser.Input.Keyboard.JustDown(this.wasd.interact) || this.consumeTouchPress('interactPressed')) {
      this.tryInteractWithNPC();
    }

    this.enemies.forEach((enemy) => {
      if (!enemy.active) return;

      enemy.patrolTimer += delta;
      if (enemy.patrolTimer > 2000) {
        enemy.patrolDir *= -1;
        enemy.patrolTimer = 0;
      }

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      const bossBusy = this.updateMiniBossBehavior(enemy, time, dist);

      if (!bossBusy && dist < 170) {
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        enemy.setVelocity(Math.cos(angle) * enemy.moveSpeed, Math.sin(angle) * enemy.moveSpeed);

        const enemyMeleeRange = enemy.isMiniBoss ? 62 : 52;
        if (dist < enemyMeleeRange) {
          if (!enemy.lastDamageTime || time - enemy.lastDamageTime > 850) {
            enemy.lastDamageTime = time;
            this.damagePlayer(enemy.damage);
          }
        }
      } else if (!bossBusy) {
        enemy.setVelocity(enemy.patrolDir * (enemy.isMiniBoss ? 36 : 28), 0);
      }

      this.updateEnemyHPBar(enemy);
    });

    if (this.playerShadow) {
      this.playerShadow.setPosition(this.player.x, this.player.y + 18);
      this.playerShadow.setScale(1 + Math.sin(time * 0.01) * 0.03, 1);
    }

    // Player walk bob
    const isMoving = Math.abs(vx) > 1 || Math.abs(vy) > 1;
    if (isMoving && !this.playerDown) {
      const bobY = Math.sin(time * 0.016) * 1.4;
      const tiltX = 1 + Math.sin(time * 0.016) * 0.03;
      this.player.setY(this.player.y + bobY * 0.06);
      this.player.setScale(tiltX * 1.8, 1.8 - Math.abs(bobY) * 0.012);
    } else if (!this.playerDown) {
      this.player.setScale(1.8, 1.8);
    }

    // Firefly drift
    if (this.fireflies) {
      this.fireflies.forEach((ff) => {
        ff.phase += ff.speed * 0.012;
        ff.obj.setPosition(
          ff.baseX + Math.sin(ff.phase) * 18,
          ff.baseY + Math.cos(ff.phase * 0.7) * 12,
        );
      });
    }

    this.npcs.forEach((npc) => {
      if (npc.shadow) npc.shadow.setPosition(npc.x, npc.y + 14);
      if (npc.nameTag) npc.nameTag.setPosition(npc.x, npc.y - 24);
    });

    this.enemies.forEach((enemy) => {
      if (enemy.shadow) enemy.shadow.setPosition(enemy.x, enemy.y + (enemy.isMiniBoss ? 20 : 14));
    });

    this.enemyRespawnCooldown -= delta;
    const canRespawnFreeRoam = this.chapterState.stage === 'complete' || this.chapterState.stage === 'return_songjiang';
    if (canRespawnFreeRoam && this.enemies.filter((e) => e.active).length === 0 && this.enemyRespawnCooldown <= 0) {
      this.enemyRespawnCooldown = 5000;
      this.spawnEnemyWave(4);
    }

    this.updateTonkey(delta);
    this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);

    if (this.hudFallback) {
      this.hudFallback.setVisible(false);
    }

    window.dispatchEvent(new CustomEvent('dowm:hud', {
      detail: {
        hp: this.playerHP,
        maxHp: this.playerMaxHP,
        gold: this.playerGold,
        heroes: this.heroesRecruited,
        objective: `Chapter ${this.chapterState.chapter}: ${this.chapterState.objective}`,
      },
    }));
  }
}
