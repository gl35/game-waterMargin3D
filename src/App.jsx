import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import './App.css';

class ZeldaPhaseOne extends Phaser.Scene {
  constructor() {
    super('ZeldaPhaseOne');
    this.player = null;
    this.cursors = null;
    this.keys = null;
    this.enemies = null;
    this.attackHitbox = null;
    this.lastAttack = 0;
    this.hp = 6;
    this.hpText = null;
    this.objectiveText = null;
    this.dialogText = null;
    this.touch = { up: false, down: false, left: false, right: false, attack: false };
    this.questStage = 0;
    this.bridgeTask = { wood: false, rope: false };
  }

  preload() {
    const g = this.add.graphics();
    g.fillStyle(0x5e9e4a); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x6fb85a); for (let i = 0; i < 20; i++) g.fillRect(Math.random() * 32, Math.random() * 32, 2, 2);
    g.generateTexture('grass', 32, 32); g.clear();

    g.fillStyle(0xc8a46a); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xb9935f); for (let i = 0; i < 10; i++) g.fillRect(Math.random() * 32, Math.random() * 32, 3, 2);
    g.generateTexture('path', 32, 32); g.clear();

    g.fillStyle(0x2f74b5); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x4e94d8); g.fillRect(4, 8, 24, 4); g.fillRect(8, 20, 16, 4);
    g.generateTexture('water', 32, 32); g.clear();

    g.fillStyle(0x5a3a1b); g.fillRect(12, 20, 8, 12);
    g.fillStyle(0x2f7a3f); g.fillCircle(16, 14, 12);
    g.fillStyle(0x3a9a4f); g.fillCircle(13, 12, 5); g.fillCircle(19, 10, 4);
    g.generateTexture('tree', 32, 32); g.clear();

    g.fillStyle(0xf2c28b); g.fillRect(10, 3, 12, 10);
    g.fillStyle(0x2e7d32); g.fillRect(8, 13, 16, 12);
    g.fillStyle(0x1b5e20); g.fillRect(10, 25, 5, 7); g.fillRect(17, 25, 5, 7);
    g.fillStyle(0xffd54f); g.fillRect(22, 14, 8, 2);
    g.generateTexture('player', 32, 32); g.clear();

    g.fillStyle(0x8d6e63); g.fillRect(10, 3, 12, 10);
    g.fillStyle(0x6d4c41); g.fillRect(8, 13, 16, 12);
    g.fillStyle(0x4e342e); g.fillRect(10, 25, 5, 7); g.fillRect(17, 25, 5, 7);
    g.generateTexture('elder', 32, 32); g.clear();

    g.fillStyle(0xf9a825); g.fillEllipse(16, 20, 22, 14);
    g.fillStyle(0xffeb3b); g.fillEllipse(16, 16, 18, 10);
    g.fillStyle(0x5d4037); g.fillRect(10, 15, 2, 2); g.fillRect(20, 15, 2, 2);
    g.generateTexture('slime', 32, 32); g.clear();

    g.fillStyle(0xfff59d); g.fillRect(0, 0, 24, 10);
    g.generateTexture('slash', 24, 10); g.clear();

    g.fillStyle(0x8d6e63); g.fillRect(0, 0, 22, 16); g.generateTexture('wood', 22, 16); g.clear();
    g.fillStyle(0xd7ccc8); g.fillRect(0, 0, 22, 6); g.generateTexture('rope', 22, 6); g.clear();

    g.fillStyle(0x9e9e9e); g.fillRect(0, 0, 64, 26); g.generateTexture('mountainGate', 64, 26); g.destroy();
  }

  create() {
    const { width, height } = this.scale;

    for (let y = 0; y < 19; y++) for (let x = 0; x < 30; x++) this.add.image(x * 32 + 16, y * 32 + 16, 'grass');
    for (let x = 2; x < 28; x++) this.add.image(x * 32 + 16, 9 * 32 + 16, 'path');
    for (let y = 2; y < 17; y++) this.add.image(14 * 32 + 16, y * 32 + 16, 'path');

    this.blockers = this.physics.add.staticGroup();
    for (let y = 2; y < 7; y++) for (let x = 22; x < 27; x++) {
      this.add.image(x * 32 + 16, y * 32 + 16, 'water');
      this.blockers.create(x * 32 + 16, y * 32 + 16, 'water').setAlpha(0.001).refreshBody();
    }

    const treePos = [[4,4],[5,4],[6,4],[4,5],[5,5],[3,11],[4,11],[25,13],[24,13],[25,14],[7,15],[8,15]];
    treePos.forEach(([x,y]) => {
      this.add.image(x*32+16,y*32+16,'tree').setDepth(3);
      this.blockers.create(x*32+16,y*32+16,'tree').setAlpha(0.001).refreshBody();
    });

    // Elder NPC and mountain gate
    this.elder = this.physics.add.staticSprite(4 * 32, 9 * 32, 'elder').setDepth(5);
    this.mountainGate = this.physics.add.staticSprite(28 * 32, 9 * 32, 'mountainGate').setDepth(4);

    this.player = this.physics.add.sprite(5 * 32, 9 * 32, 'player').setDepth(5);
    this.player.body.setSize(16, 16).setOffset(8, 14);
    this.player.setCollideWorldBounds(true);

    this.physics.world.setBounds(0, 0, 960, 608);
    this.cameras.main.setBounds(0, 0, 960, 608);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.6);

    this.enemies = this.physics.add.group();
    [[18,9],[20,11],[9,13],[12,6],[24,9]].forEach(([x,y]) => this.spawnEnemy(x, y));

    this.attackHitbox = this.physics.add.sprite(0,0,'slash').setVisible(false).setActive(false);
    this.attackHitbox.body.setAllowGravity(false);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D', attack: 'SPACE', interact: 'E' });

    this.physics.add.collider(this.player, this.blockers);
    this.physics.add.collider(this.player, this.elder);
    this.physics.add.collider(this.enemies, this.blockers);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, null, this);
    this.physics.add.overlap(this.attackHitbox, this.enemies, this.onEnemyHit, null, this);

    this.hpText = this.add.text(12, 12, '❤❤❤', { fontSize: '20px', color: '#ff6b6b' }).setScrollFactor(0).setDepth(20);
    this.objectiveText = this.add.text(12, 40, '', {
      fontSize: '12px', color: '#fff', backgroundColor: '#00000088', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(20);
    this.dialogText = this.add.text(12, height - 56, '', {
      fontSize: '12px', color: '#f7e7c6', backgroundColor: '#000000aa', padding: { x: 8, y: 6 }, wordWrap: { width: width - 24 }
    }).setScrollFactor(0).setDepth(20).setVisible(false);

    this.setObjective('Talk to the Elder (press E near him).');
    this.showDialog('Elder: New recruit, if you seek Liangshan, prove your resolve.');

    // Mission objects
    this.wood = this.physics.add.staticSprite(10 * 32, 15 * 32, 'wood').setDepth(4).setVisible(false);
    this.rope = this.physics.add.staticSprite(22 * 32, 15 * 32, 'rope').setDepth(4).setVisible(false);

    this.createTouchControls();
  }

  spawnEnemy(x, y) {
    const e = this.enemies.create(x*32, y*32, 'slime').setDepth(5);
    e.hp = 2;
    e.body.setSize(18, 12).setOffset(7, 18);
    e.dirTimer = Phaser.Math.Between(200, 800);
    e.vx = Phaser.Math.Between(-50, 50);
    e.vy = Phaser.Math.Between(-50, 50);
  }

  setObjective(text) { this.objectiveText.setText(`Mission: ${text}`); }

  showDialog(text, ms = 2600) {
    this.dialogText.setText(text).setVisible(true);
    this.time.delayedCall(ms, () => this.dialogText.setVisible(false));
  }

  startQuestFromElder() {
    if (this.questStage !== 0) return;
    this.questStage = 1;
    this.showDialog('Elder: The bridge is broken. Find wood and rope. Then head to Liangshan Mountain.');
    this.setObjective('Find wood and rope for the broken bridge.');
    this.wood.setVisible(true);
    this.rope.setVisible(true);
  }

  checkQuestProgress() {
    if (this.questStage === 1 && this.bridgeTask.wood && this.bridgeTask.rope) {
      this.questStage = 2;
      this.showDialog('Bridge repaired! Defeat the ambush and reach the mountain gate.');
      this.setObjective('Defeat remaining monsters, then reach Liangshan Gate.');
      // Spawn ambush
      [[16,8],[17,10],[18,9]].forEach(([x,y]) => this.spawnEnemy(x,y));
    }

    if (this.questStage === 2 && this.enemies.countActive(true) === 0) {
      this.questStage = 3;
      this.showDialog('Path is clear. Proceed to the mountain gate.');
      this.setObjective('Reach Liangshan mountain gate.');
    }

    if (this.questStage >= 2) {
      const distGate = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mountainGate.x, this.mountainGate.y);
      if (distGate < 50 && this.questStage === 3) {
        this.questStage = 4;
        this.setObjective('Mission complete: You joined Liangshan.');
        this.showDialog('Scout: You have courage. Welcome to Liangshan. Chapter 1 complete.', 4000);
      }
    }
  }

  createTouchControls() {
    const { width, height } = this.scale;
    this.input.addPointer(3);

    const makeBtn = (x, y, label, onDown, onUp) => {
      const btn = this.add.circle(x, y, 30, 0x111111, 0.45)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setScrollFactor(0).setDepth(30).setInteractive({ useHandCursor: false });
      this.add.text(x - 10, y - 12, label, { fontSize: '20px', color: '#fff', fontStyle: 'bold' })
        .setScrollFactor(0).setDepth(31);
      btn.on('pointerdown', () => { onDown?.(); btn.setFillStyle(0xffffff, 0.25); });
      btn.on('pointerup', () => { onUp?.(); btn.setFillStyle(0x000000, 0.28); });
      btn.on('pointerout', () => { onUp?.(); btn.setFillStyle(0x000000, 0.28); });
      return btn;
    };

    makeBtn(90, height - 120, '▲', () => this.touch.up = true, () => this.touch.up = false);
    makeBtn(90, height - 40, '▼', () => this.touch.down = true, () => this.touch.down = false);
    makeBtn(30, height - 40, '◀', () => this.touch.left = true, () => this.touch.left = false);
    makeBtn(150, height - 40, '▶', () => this.touch.right = true, () => this.touch.right = false);

    const attackBtn = this.add.circle(width - 95, height - 65, 52, 0xffd54f, 0.45)
      .setStrokeStyle(3, 0xffffff, 0.25)
      .setScrollFactor(0).setDepth(30).setInteractive({ useHandCursor: false });
    this.add.text(width - 120, height - 76, 'ATK', { fontSize: '22px', color: '#000', fontStyle: 'bold' })
      .setScrollFactor(0).setDepth(31);
    attackBtn.on('pointerdown', () => { this.doAttack(); attackBtn.setFillStyle(0xffe082, 0.55); });
    attackBtn.on('pointerup', () => attackBtn.setFillStyle(0xffd54f, 0.35));
    attackBtn.on('pointerout', () => attackBtn.setFillStyle(0xffd54f, 0.35));

    const interactBtn = this.add.circle(width - 205, height - 65, 40, 0x90caf9, 0.45)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0).setDepth(30).setInteractive({ useHandCursor: false });
    this.add.text(width - 220, height - 73, 'USE', { fontSize: '16px', color: '#001', fontStyle: 'bold' })
      .setScrollFactor(0).setDepth(31);
    interactBtn.on('pointerdown', () => { this.tryInteract(); interactBtn.setFillStyle(0xbbdefb, 0.6); });
    interactBtn.on('pointerup', () => interactBtn.setFillStyle(0x90caf9, 0.45));
    interactBtn.on('pointerout', () => interactBtn.setFillStyle(0x90caf9, 0.45));
  }

  tryInteract() {
    const distElder = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.elder.x, this.elder.y);
    if (distElder < 48) {
      this.startQuestFromElder();
      return;
    }

    if (this.questStage >= 1 && this.wood.visible) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.wood.x, this.wood.y);
      if (d < 40) {
        this.bridgeTask.wood = true;
        this.wood.setVisible(false);
        this.showDialog('Collected wood.');
      }
    }

    if (this.questStage >= 1 && this.rope.visible) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.rope.x, this.rope.y);
      if (d < 40) {
        this.bridgeTask.rope = true;
        this.rope.setVisible(false);
        this.showDialog('Collected rope.');
      }
    }

    this.checkQuestProgress();
  }

  onPlayerHit() {
    if (this.player.invuln) return;
    this.player.invuln = true;
    this.hp -= 1;
    this.hpText.setText('❤'.repeat(Math.max(0, Math.ceil(this.hp / 2))));
    this.cameras.main.shake(120, 0.008);
    this.player.setTint(0xff8888);
    this.time.delayedCall(550, () => { this.player.clearTint(); this.player.invuln = false; });
    if (this.hp <= 0) this.scene.restart();
  }

  onEnemyHit(hitbox, enemy) {
    enemy.hp -= 1;
    enemy.setTint(0xfff59d);
    this.time.delayedCall(80, () => enemy.clearTint());
    if (enemy.hp <= 0) enemy.destroy();
    this.checkQuestProgress();
  }

  doAttack() {
    if (this.time.now - this.lastAttack < 280) return;
    this.lastAttack = this.time.now;
    const facing = this.player.flipX ? -1 : 1;
    this.attackHitbox.setPosition(this.player.x + facing * 18, this.player.y);
    this.attackHitbox.setActive(true).setVisible(true).setDepth(6).setFlipX(facing < 0);
    this.tweens.add({
      targets: this.attackHitbox,
      alpha: { from: 1, to: 0 },
      duration: 120,
      onComplete: () => this.attackHitbox.setVisible(false).setActive(false).setAlpha(1)
    });
  }

  update(_, dt) {
    const speed = 130;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown || this.keys.a.isDown || this.touch.left) vx = -speed;
    if (this.cursors.right.isDown || this.keys.d.isDown || this.touch.right) vx = speed;
    if (this.cursors.up.isDown || this.keys.w.isDown || this.touch.up) vy = -speed;
    if (this.cursors.down.isDown || this.keys.s.isDown || this.touch.down) vy = speed;

    this.player.setVelocity(vx, vy);
    if (vx < 0) this.player.setFlipX(true);
    if (vx > 0) this.player.setFlipX(false);

    if (Phaser.Input.Keyboard.JustDown(this.keys.attack)) this.doAttack();
    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) this.tryInteract();

    this.enemies.children.iterate((e) => {
      if (!e) return;
      e.dirTimer -= dt;
      if (e.dirTimer <= 0) {
        e.dirTimer = Phaser.Math.Between(400, 1100);
        const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
        e.vx = Math.cos(a) * Phaser.Math.Between(35, 60);
        e.vy = Math.sin(a) * Phaser.Math.Between(35, 60);
      }
      e.setVelocity(e.vx, e.vy);
    });

    // Auto-pick if standing right on objective (mobile convenience)
    if (this.questStage >= 1) this.tryInteract();
  }
}

export default function App() {
  const mountRef = useRef(null);
  const gameRef = useRef(null);

  useEffect(() => {
    if (gameRef.current) return;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mountRef.current,
      width: 960,
      height: 608,
      pixelArt: true,
      backgroundColor: '#1b3a1d',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 960, height: 608 },
      physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
      scene: [ZeldaPhaseOne]
    });
    return () => { gameRef.current?.destroy(true); gameRef.current = null; };
  }, []);

  return (
    <div className="zelda-shell">
      <div className="zelda-title">Dream of Water Margin — Chapter 1: Path to Liangshan</div>
      <div className="zelda-frame" ref={mountRef} />
    </div>
  );
}
