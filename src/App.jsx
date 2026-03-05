import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import './App.css';

class MetalSlugInspiredScene extends Phaser.Scene {
  constructor() {
    super('MetalSlugInspiredScene');
    this.player = null;
    this.cursors = null;
    this.keys = null;
    this.bullets = null;
    this.enemies = null;
    this.lastShot = 0;
    this.score = 0;
    this.scoreText = null;
  }

  preload() {
    // Pixel textures generated at runtime (no external assets)
    const g = this.add.graphics();

    // Player
    g.fillStyle(0xd94841, 1); g.fillRect(0, 0, 20, 26);
    g.fillStyle(0xf1c27d, 1); g.fillRect(4, 2, 12, 8);
    g.fillStyle(0x1f2937, 1); g.fillRect(2, 10, 16, 12);
    g.fillStyle(0x111827, 1); g.fillRect(17, 12, 8, 3);
    g.generateTexture('player', 28, 26); g.clear();

    // Enemy
    g.fillStyle(0x7a2d2d, 1); g.fillRect(0, 0, 20, 26);
    g.fillStyle(0xe8c39e, 1); g.fillRect(4, 2, 12, 8);
    g.fillStyle(0x334155, 1); g.fillRect(2, 10, 16, 12);
    g.fillStyle(0x111827, 1); g.fillRect(-4, 12, 8, 3);
    g.generateTexture('enemy', 24, 26); g.clear();

    // Bullet
    g.fillStyle(0xfff176, 1); g.fillRect(0, 0, 10, 3);
    g.generateTexture('bullet', 10, 3); g.clear();

    // Ground tile
    g.fillStyle(0x8b5a2b, 1); g.fillRect(0, 0, 64, 32);
    g.fillStyle(0x6b4423, 1); g.fillRect(0, 24, 64, 8);
    g.generateTexture('ground', 64, 32); g.clear();

    // Explosion
    g.fillStyle(0xffa726, 1); g.fillCircle(12, 12, 12);
    g.fillStyle(0xfff176, 1); g.fillCircle(12, 12, 6);
    g.generateTexture('boom', 24, 24); g.destroy();
  }

  create() {
    const { width, height } = this.scale;

    // Layered background (Metal Slug vibe)
    this.add.rectangle(width / 2, height / 2, width, height, 0x87ceeb);
    this.add.rectangle(width / 2, height - 140, width, 180, 0x99b980);
    this.add.rectangle(width / 2, height - 95, width, 90, 0x6b8e23);

    // Decorative silhouettes
    for (let i = 0; i < 7; i++) {
      this.add.rectangle(120 + i * 130, height - 165, 70, 80, 0x4b5563).setAlpha(0.35);
    }

    // Ground
    this.platforms = this.physics.add.staticGroup();
    for (let x = 0; x < width + 64; x += 64) {
      this.platforms.create(x, height - 16, 'ground').setOrigin(0, 0);
    }

    // Player
    this.player = this.physics.add.sprite(120, height - 72, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(18, 24).setOffset(4, 2);
    this.player.setDepth(5);

    // Groups
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.enemies = this.physics.add.group();

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      shoot: Phaser.Input.Keyboard.KeyCodes.J
    });

    // Collisions
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, null, this);

    // Spawn enemies loop
    this.time.addEvent({ delay: 900, callback: this.spawnEnemy, callbackScope: this, loop: true });

    // UI
    this.add.text(20, 16, 'DREAM OF WATER MARGIN // RUN & GUN MODE', {
      fontFamily: 'monospace', fontSize: '16px', color: '#1f2937', fontStyle: 'bold'
    }).setDepth(20).setScrollFactor(0);

    this.scoreText = this.add.text(20, 40, 'SCORE: 000000', {
      fontFamily: 'monospace', fontSize: '18px', color: '#7f1d1d', fontStyle: 'bold'
    }).setDepth(20).setScrollFactor(0);

    this.add.text(width - 260, 18, 'MOVE: WASD/ARROWS  FIRE: J', {
      fontFamily: 'monospace', fontSize: '14px', color: '#111827'
    }).setDepth(20);
  }

  spawnEnemy() {
    const { width, height } = this.scale;
    const enemy = this.enemies.create(width + 30, height - 72, 'enemy');
    enemy.setVelocityX(-Phaser.Math.Between(80, 130));
    enemy.body.setSize(18, 24).setOffset(3, 2);
    enemy.setDepth(5);
  }

  shoot() {
    const now = this.time.now;
    if (now - this.lastShot < 120) return;
    this.lastShot = now;

    const bullet = this.bullets.create(this.player.x + 16, this.player.y - 2, 'bullet');
    bullet.setVelocityX(420);
    bullet.body.allowGravity = false;
    bullet.setDepth(6);

    this.time.delayedCall(1400, () => bullet?.destroy());
  }

  hitEnemy(bullet, enemy) {
    bullet.destroy();
    enemy.destroy();

    const boom = this.add.image(enemy.x, enemy.y, 'boom').setDepth(10);
    this.tweens.add({
      targets: boom,
      scale: 2,
      alpha: 0,
      duration: 220,
      onComplete: () => boom.destroy()
    });

    this.score += 100;
    this.scoreText.setText(`SCORE: ${String(this.score).padStart(6, '0')}`);
  }

  update() {
    const onGround = this.player.body.blocked.down;

    // Horizontal movement
    if (this.cursors.left.isDown || this.keys.a.isDown) {
      this.player.setVelocityX(-180);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown || this.keys.d.isDown) {
      this.player.setVelocityX(180);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // Jump
    if ((Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.w)) && onGround) {
      this.player.setVelocityY(-360);
    }

    // Shoot
    if (this.keys.shoot.isDown) this.shoot();

    // Cleanup enemies off-screen
    this.enemies.children.iterate((enemy) => {
      if (enemy && enemy.x < -40) enemy.destroy();
    });

    // Lose condition simple reset
    this.physics.overlap(this.player, this.enemies, () => {
      this.cameras.main.shake(120, 0.01);
      this.player.setTint(0xff6b6b);
      this.time.delayedCall(150, () => this.player.clearTint());
    });
  }
}

export default function App() {
  const gameRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (instanceRef.current) return;

    const config = {
      type: Phaser.AUTO,
      parent: gameRef.current,
      width: 960,
      height: 540,
      pixelArt: true,
      backgroundColor: '#87ceeb',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 960,
        height: 540
      },
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 760 }, debug: false }
      },
      scene: [MetalSlugInspiredScene]
    };

    instanceRef.current = new Phaser.Game(config);

    return () => {
      instanceRef.current?.destroy(true);
      instanceRef.current = null;
    };
  }, []);

  return (
    <div className="slug-shell">
      <div className="slug-title">METAL SLUG-INSPIRED THEME (ORIGINAL ASSETS)</div>
      <div className="slug-frame" ref={gameRef} />
    </div>
  );
}
