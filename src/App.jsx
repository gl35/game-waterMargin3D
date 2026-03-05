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
    this.touch = { up: false, down: false, left: false, right: false, attack: false };
  }

  preload() {
    const g = this.add.graphics();

    // grass tile
    g.fillStyle(0x5e9e4a); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x6fb85a);
    for (let i = 0; i < 20; i++) g.fillRect(Math.random() * 32, Math.random() * 32, 2, 2);
    g.generateTexture('grass', 32, 32); g.clear();

    // path tile
    g.fillStyle(0xc8a46a); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xb9935f);
    for (let i = 0; i < 10; i++) g.fillRect(Math.random() * 32, Math.random() * 32, 3, 2);
    g.generateTexture('path', 32, 32); g.clear();

    // water tile
    g.fillStyle(0x2f74b5); g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x4e94d8); g.fillRect(4, 8, 24, 4); g.fillRect(8, 20, 16, 4);
    g.generateTexture('water', 32, 32); g.clear();

    // tree
    g.fillStyle(0x5a3a1b); g.fillRect(12, 20, 8, 12);
    g.fillStyle(0x2f7a3f); g.fillCircle(16, 14, 12);
    g.fillStyle(0x3a9a4f); g.fillCircle(13, 12, 5); g.fillCircle(19, 10, 4);
    g.generateTexture('tree', 32, 32); g.clear();

    // player (zelda-like)
    g.fillStyle(0xf2c28b); g.fillRect(10, 3, 12, 10);
    g.fillStyle(0x2e7d32); g.fillRect(8, 13, 16, 12);
    g.fillStyle(0x1b5e20); g.fillRect(10, 25, 5, 7); g.fillRect(17, 25, 5, 7);
    g.fillStyle(0xffd54f); g.fillRect(22, 14, 8, 2); // sword
    g.generateTexture('player', 32, 32); g.clear();

    // slime enemy
    g.fillStyle(0x7b1fa2); g.fillEllipse(16, 20, 22, 14);
    g.fillStyle(0xab47bc); g.fillEllipse(16, 16, 18, 10);
    g.fillStyle(0xffffff); g.fillRect(10, 15, 2, 2); g.fillRect(20, 15, 2, 2);
    g.generateTexture('slime', 32, 32); g.clear();

    // slash
    g.fillStyle(0xfff59d); g.fillRect(0, 0, 24, 10);
    g.generateTexture('slash', 24, 10); g.destroy();
  }

  create() {
    const { width, height } = this.scale;

    // Map
    for (let y = 0; y < 19; y++) {
      for (let x = 0; x < 30; x++) {
        this.add.image(x * 32 + 16, y * 32 + 16, 'grass');
      }
    }
    // paths
    for (let x = 2; x < 28; x++) this.add.image(x * 32 + 16, 9 * 32 + 16, 'path');
    for (let y = 2; y < 17; y++) this.add.image(14 * 32 + 16, y * 32 + 16, 'path');

    // water pond
    this.blockers = this.physics.add.staticGroup();
    for (let y = 2; y < 7; y++) {
      for (let x = 22; x < 27; x++) {
        this.add.image(x * 32 + 16, y * 32 + 16, 'water');
        this.blockers.create(x * 32 + 16, y * 32 + 16, 'water').setAlpha(0.001).refreshBody();
      }
    }

    // trees
    const treePos = [[4,4],[5,4],[6,4],[4,5],[5,5],[3,11],[4,11],[25,13],[24,13],[25,14],[7,15],[8,15]];
    treePos.forEach(([x,y]) => {
      this.add.image(x*32+16,y*32+16,'tree').setDepth(3);
      this.blockers.create(x*32+16,y*32+16,'tree').setAlpha(0.001).refreshBody();
    });

    // Player
    this.player = this.physics.add.sprite(5 * 32, 9 * 32, 'player').setDepth(5);
    this.player.body.setSize(16, 16).setOffset(8, 14);
    this.player.setCollideWorldBounds(true);

    this.physics.world.setBounds(0, 0, 960, 608);
    this.cameras.main.setBounds(0, 0, 960, 608);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.6);

    // Enemies
    this.enemies = this.physics.add.group();
    [[18,9],[20,11],[9,13],[12,6],[24,9]].forEach(([x,y]) => {
      const e = this.enemies.create(x*32, y*32, 'slime').setDepth(5);
      e.hp = 2;
      e.body.setSize(18, 12).setOffset(7, 18);
      e.dirTimer = Phaser.Math.Between(200, 800);
      e.vx = Phaser.Math.Between(-50, 50);
      e.vy = Phaser.Math.Between(-50, 50);
    });

    this.attackHitbox = this.physics.add.sprite(0,0,'slash').setVisible(false).setActive(false);
    this.attackHitbox.body.setAllowGravity(false);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D', attack: 'SPACE' });

    this.physics.add.collider(this.player, this.blockers);
    this.physics.add.collider(this.enemies, this.blockers);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, null, this);
    this.physics.add.overlap(this.attackHitbox, this.enemies, this.onEnemyHit, null, this);

    this.hpText = this.add.text(12, 12, '❤❤❤', { fontSize: '20px', color: '#ff6b6b' })
      .setScrollFactor(0)
      .setDepth(20);

    this.add.text(width - 250, 12, 'WASD/Arrows Move  SPACE Attack', {
      fontSize: '12px', color: '#f7e7c6', backgroundColor: '#00000066', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(20);

    this.createTouchControls();
  }

  createTouchControls() {
    const { width, height } = this.scale;

    // Virtual D-pad area (left bottom)
    const base = this.add.circle(92, height - 92, 62, 0x000000, 0.25)
      .setScrollFactor(0).setDepth(30).setInteractive();
    const stick = this.add.circle(92, height - 92, 26, 0xffffff, 0.25)
      .setScrollFactor(0).setDepth(31);

    const resetStick = () => {
      stick.x = 92;
      stick.y = height - 92;
      this.touch.left = this.touch.right = this.touch.up = this.touch.down = false;
    };

    const updateStick = (pointer) => {
      const dx = Phaser.Math.Clamp(pointer.x - 92, -36, 36);
      const dy = Phaser.Math.Clamp(pointer.y - (height - 92), -36, 36);
      stick.x = 92 + dx;
      stick.y = height - 92 + dy;

      this.touch.left = dx < -12;
      this.touch.right = dx > 12;
      this.touch.up = dy < -12;
      this.touch.down = dy > 12;
    };

    base.on('pointerdown', updateStick);
    this.input.on('pointermove', (p) => { if (p.isDown && p.x < width * 0.45) updateStick(p); });
    this.input.on('pointerup', resetStick);

    // Attack button (right bottom)
    const attackBtn = this.add.circle(width - 92, height - 92, 44, 0xffd54f, 0.35)
      .setScrollFactor(0).setDepth(30).setInteractive();
    this.add.text(width - 110, height - 104, 'ATTACK', { fontSize: '10px', color: '#000' })
      .setScrollFactor(0).setDepth(31);

    attackBtn.on('pointerdown', () => {
      this.touch.attack = true;
      this.doAttack();
      attackBtn.setFillStyle(0xffe082, 0.5);
    });
    attackBtn.on('pointerup', () => {
      this.touch.attack = false;
      attackBtn.setFillStyle(0xffd54f, 0.35);
    });
    attackBtn.on('pointerout', () => {
      this.touch.attack = false;
      attackBtn.setFillStyle(0xffd54f, 0.35);
    });
  }

  onPlayerHit() {
    if (this.player.invuln) return;
    this.player.invuln = true;
    this.hp -= 1;
    this.hpText.setText('❤'.repeat(Math.ceil(this.hp / 2)));
    this.cameras.main.shake(120, 0.008);
    this.player.setTint(0xff8888);
    this.time.delayedCall(550, () => {
      this.player.clearTint();
      this.player.invuln = false;
    });
    if (this.hp <= 0) {
      this.scene.restart();
    }
  }

  onEnemyHit(hitbox, enemy) {
    enemy.hp -= 1;
    enemy.setTint(0xfff59d);
    this.time.delayedCall(80, () => enemy.clearTint());
    if (enemy.hp <= 0) {
      enemy.destroy();
    }
  }

  doAttack() {
    if (this.time.now - this.lastAttack < 280) return;
    this.lastAttack = this.time.now;

    const facing = this.player.flipX ? -1 : 1;
    this.attackHitbox.setPosition(this.player.x + facing * 18, this.player.y);
    this.attackHitbox.setActive(true).setVisible(true);
    this.attackHitbox.setDepth(6);
    this.attackHitbox.setFlipX(facing < 0);

    this.tweens.add({
      targets: this.attackHitbox,
      alpha: { from: 1, to: 0 },
      duration: 120,
      onComplete: () => {
        this.attackHitbox.setVisible(false).setActive(false).setAlpha(1);
      }
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
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="zelda-shell">
      <div className="zelda-title">Dream of Water Margin — Phase 1 (Zelda-like)</div>
      <div className="zelda-frame" ref={mountRef} />
    </div>
  );
}
