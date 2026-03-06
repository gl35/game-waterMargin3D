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

    this.playerFacing = { x: 1, y: 0 };
    this.lastSafePlayerPos = { x: 0, y: 0 };
    this.isSwitchingArtStyle = false;
    this.lastArtSwitchAt = 0;

    this.specialties = [
      {
        id: 'vanguard',
        name: 'Vanguard Spear',
        color: 0xffc26b,
        description: 'Steady duelist. Bonus damage at close range.',
        minDamage: 10,
        maxDamage: 16,
        range: 52,
        splash: false,
      },
      {
        id: 'strategist',
        name: 'Strategist Fan',
        color: 0x7bc7ff,
        description: 'Wide strike. Hits all nearby enemies.',
        minDamage: 7,
        maxDamage: 11,
        range: 65,
        splash: true,
      },
      {
        id: 'shadow',
        name: 'Shadow Blades',
        color: 0xd89cff,
        description: 'Short reach. High crit chance.',
        minDamage: 8,
        maxDamage: 14,
        range: 42,
        splash: false,
        critChance: 0.3,
      },
    ];
    this.currentSpecialtyIndex = 0;

    this.chapterState = {
      chapter: 1,
      stage: 'talk_songjiang',
      objective: 'Talk to Song Jiang in Liangshan stronghold.',
      completed: false,
      raidersDefeated: 0,
      raidersTarget: 3,
      minibossSpawned: false,
      minibossDefeated: false,
    };
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
    this.showChapterToast(`Chapter 1 begins • Visual: ${this.currentArtStyle}`);
    this.updateMissionUI();

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
      .setAlpha(0.38)
      .setDepth(-20);

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

    this.add.image(6 * tileSize, 5 * tileSize, this.tx('building')).setOrigin(0).setScale(1.5);
    this.add.image(10 * tileSize, 5 * tileSize, this.tx('building')).setOrigin(0).setScale(1.2);

    this.physics.world.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize);
  }

  createPlayer() {
    this.player = this.physics.add.sprite(9 * 32 + 16, 16 * 32, this.tx('player'));
    this.player.setScale(1.45);
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

    this.lastSafePlayerPos = { x: this.player.x, y: this.player.y };
  }

  createNPCs() {
    const npcData = [
      {
        id: 'songjiang',
        x: 7,
        y: 8,
        name: '宋江',
        role: 'Song Jiang',
        dialog: 'Liangshan calls for unity. Prove your resolve and our banner is yours.',
        recruitable: true,
      },
      {
        id: 'wuyong',
        x: 11,
        y: 7,
        name: '吴用',
        role: 'Wu Yong',
        dialog: 'Read your battlefield. A sharp mind wins before steel is drawn.',
        recruitable: false,
      },
      {
        id: 'linchong',
        x: 9,
        y: 10,
        name: '林冲',
        role: 'Lin Chong',
        dialog: 'Strength is nothing without conviction. Hold your line.',
        recruitable: true,
      },
      {
        id: 'villager',
        x: 30,
        y: 10,
        name: '刘村民',
        role: 'Village Elder Liu',
        dialog: 'Magistrate raiders burned our granary! Their captain still stalks the road.',
        recruitable: false,
      },
      {
        id: 'tonkey',
        x: 12,
        y: 12,
        name: 'Tonkey',
        role: 'Wandering Fighter',
        dialog: 'Name\'s Tonkey. Say the word and I\'ll watch your back in every fight.',
        recruitable: false,
      },
    ];

    npcData.forEach((data) => {
      const npc = this.physics.add.sprite(data.x * 32 + 16, data.y * 32 + 16, this.tx('npc'));
      npc.setScale(1.3);
      npc.setImmovable(true);
      npc.setDepth(9);
      npc.npcData = data;

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
    enemy.setScale(1.3);
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

    enemy.hpBar = this.add.graphics().setDepth(13);
    enemy.nameTag = this.add.text(enemy.x, enemy.y - 32, data.name, {
      fontSize: enemy.isMiniBoss ? '11px' : '9px',
      fill: enemy.isMiniBoss ? '#ff8a8a' : '#ffdd88',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(13);

    if (enemy.isMiniBoss) {
      enemy.setScale(1.65);
      enemy.setTint(0xff9999);
      enemy.enraged = false;
      enemy.chargeState = 'idle';
      enemy.nextChargeAt = 0;
      enemy.chargeEndsAt = 0;
    }

    this.updateEnemyHPBar(enemy);
    this.enemies.push(enemy);
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
    const width = enemy.isMiniBoss ? 46 : 32;

    enemy.hpBar.fillStyle(0x000000);
    enemy.hpBar.fillRect(enemy.x - width / 2, enemy.y - 22, width, 5);
    enemy.hpBar.fillStyle(ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffff00 : 0xff0000);
    enemy.hpBar.fillRect(enemy.x - width / 2, enemy.y - 22, width * ratio, 5);

    if (enemy.nameTag) {
      enemy.nameTag.setPosition(enemy.x, enemy.y - (enemy.isMiniBoss ? 36 : 30));
    }
  }

  createUI() {
    this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

    const theme = this.stylePalette[this.currentArtStyle] || this.stylePalette.wuxia;

    const panel = this.add.graphics();
    panel.fillStyle(theme.panel, this.currentArtStyle === 'ink' ? 0.9 : 0.78);
    panel.fillRect(5, 5, 350, 96);
    panel.fillStyle(theme.panelTop, this.currentArtStyle === 'ink' ? 0.5 : 0.25);
    panel.fillRect(5, 5, 350, 30);
    panel.lineStyle(2, Phaser.Display.Color.HexStringToColor(theme.accent).color);
    panel.strokeRect(5, 5, 350, 96);

    const title = this.add.text(180, 15, '夢 Dream of Water Margin', {
      fontSize: '11px', fill: theme.accent, fontFamily: 'serif',
    }).setOrigin(0.5);

    this.hpText = this.add.text(15, 32, `HP: ${this.playerHP}/${this.playerMaxHP}`, {
      fontSize: '12px', fill: '#ff6666',
    });

    this.goldText = this.add.text(15, 50, `Gold: ${this.playerGold} 两`, {
      fontSize: '12px', fill: '#ffdd44',
    });

    this.heroText = this.add.text(15, 68, `Heroes: ${this.heroesRecruited}/108`, {
      fontSize: '12px', fill: '#88aaff',
    });

    this.specialtyText = this.add.text(140, 32, 'Style: -', {
      fontSize: '12px', fill: '#9fe7ff',
    });

    this.hintText = this.add.text(140, 50, 'Q/1-3: Specialties   T: Art style   Space: Attack', {
      fontSize: '9px', fill: theme.hint,
    });

    this.objectiveText = this.add.text(140, 68, '', {
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

    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;
    const boxX = 20;
    const boxWidth = gameWidth - 40;
    const boxHeight = 140;
    const boxY = gameHeight - boxHeight - 16;

    this.dialogBox = this.add.container(0, 0).setScrollFactor(0).setDepth(200).setVisible(false);
    const dialogBg = this.add.graphics();
    dialogBg.fillStyle(0x1a0a00, 0.95);
    dialogBg.fillRect(boxX, boxY, boxWidth, boxHeight);
    dialogBg.lineStyle(2, 0xc8a96e);
    dialogBg.strokeRect(boxX, boxY, boxWidth, boxHeight);

    this.dialogNameText = this.add.text(boxX + 15, boxY + 12, '', {
      fontSize: '14px', fill: '#c8a96e', fontFamily: 'serif', fontStyle: 'bold',
    });
    this.dialogText = this.add.text(boxX + 15, boxY + 36, '', {
      fontSize: '13px', fill: '#ffffff', wordWrap: { width: boxWidth - 30 },
    });
    this.dialogPrompt = this.add.text(boxX + boxWidth - 130, boxY + boxHeight - 18, '[SPACE to close]', {
      fontSize: '11px', fill: '#888888',
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
    this.cameras.main.setZoom(1.75);
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
      cycleArt: Phaser.Input.Keyboard.KeyCodes.T,
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
    this.input.addPointer(3);
    const { width, height } = this.scale;

    const uiScale = this.scale.width >= 1400 ? 2.1 : 1.3;

    const makeHoldButton = (x, y, label, onDown, onUp, radius = 30, fill = 0x000000) => {
      const btn = this.add.circle(x, y, radius * uiScale, fill, 0.45)
        .setStrokeStyle(2, 0xffffff, 0.28)
        .setScrollFactor(0)
        .setDepth(260)
        .setInteractive({ useHandCursor: false });

      this.add.text(x, y, label, {
        fontSize: `${Math.round((radius >= 40 ? 20 : 16) * uiScale)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(261);

      btn.on('pointerdown', () => {
        onDown?.();
        btn.setFillStyle(0xffffff, 0.32);
      });
      btn.on('pointerup', () => {
        onUp?.();
        btn.setFillStyle(fill, 0.35);
      });
      btn.on('pointerout', () => {
        onUp?.();
        btn.setFillStyle(fill, 0.35);
      });

      return btn;
    };

    makeHoldButton(120, height - 180, '▲', () => { this.touchState.up = true; }, () => { this.touchState.up = false; }, 40, 0x111111);
    makeHoldButton(120, height - 68, '▼', () => { this.touchState.down = true; }, () => { this.touchState.down = false; }, 40, 0x111111);
    makeHoldButton(36, height - 68, '◀', () => { this.touchState.left = true; }, () => { this.touchState.left = false; }, 40, 0x111111);
    makeHoldButton(204, height - 68, '▶', () => { this.touchState.right = true; }, () => { this.touchState.right = false; }, 40, 0x111111);

    makeHoldButton(width - 136, height - 96, 'ATK', () => { this.touchState.attackPressed = true; }, () => {}, 64, 0xb32424);
    makeHoldButton(width - 300, height - 96, 'USE', () => { this.touchState.interactPressed = true; }, () => {}, 52, 0x2b5d9a);
    makeHoldButton(width - 430, height - 96, 'SW', () => { this.touchState.switchPressed = true; }, () => {}, 44, 0x6c4bb5);
    makeHoldButton(width - 542, height - 96, 'ART', () => { this.touchState.stylePressed = true; }, () => {}, 44, 0x8a6b2e);

    this.add.text(width - 146, height - 182, 'Tap ATK', {
      fontSize: `${Math.round(18 * uiScale)}px`,
      color: '#ffd6d6',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(262);
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
        if (p.isDown && p.y > height * 0.5 && this.time.now - this.lastTouchAttack > 260) {
          this.lastTouchAttack = this.time.now;
          this.touchState.attackPressed = true;
        }
        if (p.isDown && p.y <= height * 0.5 && this.time.now - this.lastTouchInteract > 320) {
          this.lastTouchInteract = this.time.now;
          this.touchState.interactPressed = true;
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

    if (this.chapterState.stage === 'talk_songjiang' && npcId === 'songjiang') {
      this.chapterState.stage = 'talk_villager';
      this.chapterState.objective = 'Travel east and speak with Village Elder Liu.';
      this.updateMissionUI();
      this.showChapterToast('Mission Updated: Meet Village Elder Liu');
      this.saveCheckpoint();
    } else if (this.chapterState.stage === 'talk_villager' && npcId === 'villager') {
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

    if (npc.npcData.id === 'songjiang' && this.chapterState.stage === 'talk_songjiang') {
      text += '\n\n[Main Mission] Go to Elder Liu east of Liangshan and aid the village.';
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
    const txt = this.add.text(x, y - 20, `${amount}`, {
      fontSize: '16px', fill: color, stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
    }).setDepth(50);

    this.tweens.add({
      targets: txt,
      y: y - 60,
      alpha: 0,
      duration: 800,
      onComplete: () => txt.destroy(),
    });
  }

  playSlashFx(style) {
    const slash = this.add.graphics().setDepth(40);
    const fxRange = style.id === 'strategist' ? 72 : 56;
    const fxWidth = style.id === 'strategist' ? 44 : 28;

    const nx = this.playerFacing.x;
    const ny = this.playerFacing.y;
    const px = -ny;
    const py = nx;

    const startX = this.player.x + nx * 14;
    const startY = this.player.y + ny * 14;
    const endX = this.player.x + nx * fxRange;
    const endY = this.player.y + ny * fxRange;

    slash.fillStyle(style.color, 0.32);
    slash.beginPath();
    slash.moveTo(startX + px * (fxWidth * 0.35), startY + py * (fxWidth * 0.35));
    slash.lineTo(startX - px * (fxWidth * 0.35), startY - py * (fxWidth * 0.35));
    slash.lineTo(endX - px * (fxWidth * 0.7), endY - py * (fxWidth * 0.7));
    slash.lineTo(endX + px * (fxWidth * 0.7), endY + py * (fxWidth * 0.7));
    slash.closePath();
    slash.fillPath();

    slash.lineStyle(2, style.color, 0.95);
    slash.strokeLineShape(new Phaser.Geom.Line(startX, startY, endX, endY));

    this.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 180,
      onComplete: () => slash.destroy(),
    });
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

    if (enemy.nameTag) enemy.nameTag.destroy();
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
          this.saveCheckpoint();
          return;
        }

        if (nearNPC && Phaser.Math.Distance.Between(this.player.x, this.player.y, nearNPC.x, nearNPC.y) <= 96 && nearNPC?.npcData.recruitable && !nearNPC.npcData.recruited) {
          nearNPC.npcData.recruited = true;
          this.heroesRecruited += 1;
          this.heroText.setText(`Heroes: ${this.heroesRecruited}/108`);
          this.dialogText.setText(`${nearNPC.npcData.dialog}\n✓ Hero recruited! They have joined Liangshan!`);
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

    if (Phaser.Input.Keyboard.JustDown(this.wasd.cycleArt) || this.consumeTouchPress('stylePressed')) {
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

    this.updateTonkey(delta);
    this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
  }
}
