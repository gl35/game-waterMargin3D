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
  }

  create() {
    this.createWorld();
    this.createPlayer();
    this.createNPCs();
    this.createEnemies();
    this.createUI();
    this.setupCamera();
    this.setupInput();
    this.setupCollisions();
  }

  createWorld() {
    const mapWidth = 50;
    const mapHeight = 50;
    const tileSize = 32;

    // Tile map layout (0=grass, 1=water, 2=path, 3=wall, 4=building)
    this.mapData = [];
    for (let y = 0; y < mapHeight; y++) {
      this.mapData[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        // Border water
        if (x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1) {
          this.mapData[y][x] = 1;
        }
        // Liangshan lake (center-ish)
        else if (x >= 20 && x <= 30 && y >= 20 && y <= 30) {
          this.mapData[y][x] = 1;
        }
        // Main path (horizontal)
        else if (y === 25 && x >= 5 && x <= 45) {
          this.mapData[y][x] = 2;
        }
        // Main path (vertical)
        else if (x === 25 && y >= 5 && y <= 45) {
          this.mapData[y][x] = 2;
        }
        else {
          this.mapData[y][x] = 0;
        }
      }
    }

    // Town walls (top-left area — Liangshan stronghold)
    for (let x = 3; x <= 15; x++) {
      this.mapData[3][x] = 3;
      this.mapData[14][x] = 3;
    }
    for (let y = 3; y <= 14; y++) {
      this.mapData[y][3] = 3;
      this.mapData[y][15] = 3;
    }
    // Gate
    this.mapData[14][9] = 2;
    this.mapData[14][10] = 2;

    // Render tiles
    this.groundLayer = this.add.group();
    this.wallObjects = this.physics.add.staticGroup();

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = this.mapData[y][x];
        const px = x * tileSize;
        const py = y * tileSize;

        if (tile === 0) {
          this.add.image(px, py, 'grass').setOrigin(0);
        } else if (tile === 1) {
          this.add.image(px, py, 'water').setOrigin(0);
          // Water is collidable
          const waterBlock = this.wallObjects.create(px + 16, py + 16, 'water');
          waterBlock.setAlpha(0); // invisible blocker
          waterBlock.refreshBody();
        } else if (tile === 2) {
          this.add.image(px, py, 'grass').setOrigin(0);
          this.add.image(px, py, 'path').setOrigin(0).setAlpha(0.8);
        } else if (tile === 3) {
          this.add.image(px, py, 'wall').setOrigin(0);
          const wallBlock = this.wallObjects.create(px + 16, py + 16, 'wall');
          wallBlock.setAlpha(0);
          wallBlock.refreshBody();
        }
      }
    }

    // Add buildings inside the stronghold
    this.add.image(6 * tileSize, 5 * tileSize, 'building').setOrigin(0).setScale(1.5);
    this.add.image(10 * tileSize, 5 * tileSize, 'building').setOrigin(0).setScale(1.2);

    // World bounds
    this.physics.world.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize);
  }

  createPlayer() {
    // Start player near the town entrance
    this.player = this.physics.add.sprite(9 * 32 + 16, 16 * 32, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    this.player.body.setSize(20, 20);
    this.player.body.setOffset(6, 10);

    // Player name
    this.playerNameTag = this.add.text(0, 0, '勇士', {
      fontSize: '10px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(11);
  }

  createNPCs() {
    const npcData = [
      { x: 7, y: 8, name: '宋江', role: 'Song Jiang', dialog: 'Welcome, brave warrior! Liangshan needs heroes like you. Join our cause against corruption!', recruitable: true },
      { x: 11, y: 7, name: '吴用', role: 'Wu Yong', dialog: 'Ah, a new face. I am Wu Yong, strategist of Liangshan. What brings you to our marsh?', recruitable: false },
      { x: 9, y: 10, name: '林冲', role: 'Lin Chong', dialog: 'I was once an instructor of the Imperial Guard. Betrayed by corrupt officials. Now I fight for justice.', recruitable: true },
      { x: 30, y: 10, name: '村民', role: 'Villager', dialog: 'The corrupt magistrate\'s soldiers have been terrorizing our village! Please help us!', recruitable: false },
    ];

    npcData.forEach(data => {
      const npc = this.physics.add.sprite(data.x * 32 + 16, data.y * 32 + 16, 'npc');
      npc.setImmovable(true);
      npc.setDepth(9);
      npc.npcData = data;

      // Name tag
      const tag = this.add.text(data.x * 32 + 16, data.y * 32 - 4, data.name, {
        fontSize: '9px',
        fill: '#ffff88',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(12);

      this.npcs.push(npc);
    });
  }

  createEnemies() {
    const enemyPositions = [
      { x: 32, y: 10 },
      { x: 35, y: 15 },
      { x: 38, y: 8 },
      { x: 40, y: 30 },
    ];

    enemyPositions.forEach(pos => {
      const enemy = this.physics.add.sprite(pos.x * 32, pos.y * 32, 'enemy');
      enemy.setDepth(9);
      enemy.hp = 30;
      enemy.maxHp = 30;
      enemy.patrolDir = 1;
      enemy.patrolTimer = 0;

      // HP bar
      enemy.hpBar = this.add.graphics().setDepth(13);
      this.updateEnemyHPBar(enemy);

      this.enemies.push(enemy);
    });
  }

  updateEnemyHPBar(enemy) {
    enemy.hpBar.clear();
    const ratio = enemy.hp / enemy.maxHp;
    enemy.hpBar.fillStyle(0x000000);
    enemy.hpBar.fillRect(enemy.x - 16, enemy.y - 22, 32, 5);
    enemy.hpBar.fillStyle(ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffff00 : 0xff0000);
    enemy.hpBar.fillRect(enemy.x - 16, enemy.y - 22, 32 * ratio, 5);
  }

  createUI() {
    // UI fixed to camera
    this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

    // Background panel
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.7);
    panel.fillRect(5, 5, 220, 70);
    panel.lineStyle(2, 0xc8a96e);
    panel.strokeRect(5, 5, 220, 70);

    // Title
    const title = this.add.text(115, 15, '夢 Dream of Water Margin', {
      fontSize: '11px', fill: '#c8a96e', fontFamily: 'serif'
    }).setOrigin(0.5);

    // HP
    this.hpText = this.add.text(15, 32, `HP: ${this.playerHP}/${this.playerMaxHP}`, {
      fontSize: '12px', fill: '#ff6666'
    });

    // Gold
    this.goldText = this.add.text(15, 50, `Gold: ${this.playerGold} 两`, {
      fontSize: '12px', fill: '#ffdd44'
    });

    // Heroes recruited
    this.heroText = this.add.text(120, 32, `Heroes: ${this.heroesRecruited}/108`, {
      fontSize: '12px', fill: '#88aaff'
    });

    // Controls hint
    this.hintText = this.add.text(120, 50, 'WASD/Arrows: Move  Space: Attack', {
      fontSize: '9px', fill: '#aaaaaa'
    });

    this.uiContainer.add([panel, title, this.hpText, this.goldText, this.heroText, this.hintText]);

    // Dialog box (hidden by default)
    this.dialogBox = this.add.container(0, 0).setScrollFactor(0).setDepth(200).setVisible(false);
    const dialogBg = this.add.graphics();
    dialogBg.fillStyle(0x1a0a00, 0.95);
    dialogBg.fillRect(20, 440, 760, 120);
    dialogBg.lineStyle(2, 0xc8a96e);
    dialogBg.strokeRect(20, 440, 760, 120);

    this.dialogNameText = this.add.text(35, 452, '', {
      fontSize: '14px', fill: '#c8a96e', fontFamily: 'serif', fontStyle: 'bold'
    });
    this.dialogText = this.add.text(35, 475, '', {
      fontSize: '13px', fill: '#ffffff', wordWrap: { width: 720 }
    });
    this.dialogPrompt = this.add.text(700, 545, '[SPACE to close]', {
      fontSize: '11px', fill: '#888888'
    });

    this.dialogBox.add([dialogBg, this.dialogNameText, this.dialogText, this.dialogPrompt]);

    // Floating damage text pool
    this.damageTexts = [];
  }

  setupCamera() {
    this.cameras.main.setBounds(0, 0, 50 * 32, 50 * 32);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      attack: Phaser.Input.Keyboard.KeyCodes.SPACE,
      interact: Phaser.Input.Keyboard.KeyCodes.E
    });
  }

  setupCollisions() {
    this.physics.add.collider(this.player, this.wallObjects);
    this.npcs.forEach(npc => {
      this.physics.add.collider(this.player, npc);
    });
    this.enemies.forEach(enemy => {
      this.physics.add.collider(this.player, this.wallObjects);
    });
  }

  showDialog(npc) {
    this.dialogActive = true;
    this.dialogBox.setVisible(true);
    this.dialogNameText.setText(`${npc.npcData.name} (${npc.npcData.role})`);

    let text = npc.npcData.dialog;
    if (npc.npcData.recruitable && !npc.npcData.recruited) {
      text += '\n[Press E to recruit this hero!]';
    }
    this.dialogText.setText(text);
    this.player.setVelocity(0, 0);
  }

  hideDialog() {
    this.dialogActive = false;
    this.dialogBox.setVisible(false);
  }

  showDamageText(x, y, amount, color = '#ff4444') {
    const txt = this.add.text(x, y - 20, `-${amount}`, {
      fontSize: '16px', fill: color, stroke: '#000', strokeThickness: 3, fontStyle: 'bold'
    }).setDepth(50);

    this.tweens.add({
      targets: txt,
      y: y - 60,
      alpha: 0,
      duration: 800,
      onComplete: () => txt.destroy()
    });
  }

  attackNearbyEnemies() {
    const attackRange = 48;
    this.enemies.forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < attackRange) {
        const damage = Phaser.Math.Between(8, 15);
        enemy.hp -= damage;
        this.showDamageText(enemy.x, enemy.y, damage, '#ff4444');
        this.updateEnemyHPBar(enemy);

        // Flash enemy
        this.tweens.add({
          targets: enemy,
          alpha: 0.2,
          yoyo: true,
          duration: 100,
          repeat: 2
        });

        if (enemy.hp <= 0) {
          this.playerGold += 10;
          this.goldText.setText(`Gold: ${this.playerGold} 两`);
          this.showDamageText(enemy.x, enemy.y - 20, '10 gold', '#ffdd44');
          enemy.hpBar.destroy();
          enemy.destroy();
          this.enemies = this.enemies.filter(e => e !== enemy);
        }
      }
    });
  }

  update(time, delta) {
    if (this.dialogActive) {
      if (Phaser.Input.Keyboard.JustDown(this.wasd.attack)) {
        // Check recruit
        const nearNPC = this.npcs.find(npc => {
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
          return dist < 60;
        });
        if (nearNPC?.npcData.recruitable && !nearNPC.npcData.recruited) {
          nearNPC.npcData.recruited = true;
          this.heroesRecruited++;
          this.heroText.setText(`Heroes: ${this.heroesRecruited}/108`);
          this.dialogText.setText(nearNPC.npcData.dialog + '\n✓ Hero recruited! They have joined Liangshan!');
        } else {
          this.hideDialog();
        }
      }
      return;
    }

    // Movement
    const speed = 120;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -speed;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
    else if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;

    this.player.setVelocity(vx, vy);

    // Update player name tag position
    this.playerNameTag.setPosition(this.player.x, this.player.y - 22);

    // Attack
    this.attackCooldown -= delta;
    if (Phaser.Input.Keyboard.JustDown(this.wasd.attack) && this.attackCooldown <= 0) {
      this.attackCooldown = 400;
      this.attackNearbyEnemies();

      // Attack flash
      this.tweens.add({
        targets: this.player,
        scaleX: 1.3,
        scaleY: 1.3,
        yoyo: true,
        duration: 100
      });
    }

    // Interact with NPCs
    if (Phaser.Input.Keyboard.JustDown(this.wasd.interact)) {
      this.npcs.forEach(npc => {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
        if (dist < 60) {
          this.showDialog(npc);
        }
      });
    }

    // Enemy patrol AI
    this.enemies.forEach(enemy => {
      if (!enemy.active) return;

      enemy.patrolTimer += delta;
      if (enemy.patrolTimer > 2000) {
        enemy.patrolDir *= -1;
        enemy.patrolTimer = 0;
      }

      // Chase player if close
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < 150) {
        // Move toward player
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        enemy.setVelocity(Math.cos(angle) * 60, Math.sin(angle) * 60);

        // Damage player on contact
        if (dist < 30) {
          if (!enemy.lastDamageTime || time - enemy.lastDamageTime > 1000) {
            enemy.lastDamageTime = time;
            this.playerHP = Math.max(0, this.playerHP - 5);
            this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
            this.showDamageText(this.player.x, this.player.y, 5, '#ff0000');

            // Screen flash
            this.cameras.main.flash(200, 255, 0, 0, false);
          }
        }
      } else {
        enemy.setVelocity(enemy.patrolDir * 30, 0);
      }

      // Update HP bar position
      this.updateEnemyHPBar(enemy);
    });

    // Update UI
    this.hpText.setText(`HP: ${this.playerHP}/${this.playerMaxHP}`);
  }
}
