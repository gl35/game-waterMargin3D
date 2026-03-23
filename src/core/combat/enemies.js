const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export const ENEMY_DEFS = [
  { type: 'raider',   label: '土匪 Raider',    hp: 50,  maxHp: 50,  damage: 8,  xp: 20, gold: 12, aggroRange: 22, chaseSpeed: 7,   attackRange: 3.2, attackInterval: 1200 },
  { type: 'scout',    label: '斥候 Scout',     hp: 30,  maxHp: 30,  damage: 5,  xp: 12, gold: 8,  aggroRange: 30, chaseSpeed: 11,  attackRange: 2.8, attackInterval: 900  },
  { type: 'captain',  label: '队长 Captain',   hp: 120, maxHp: 120, damage: 20, xp: 60, gold: 40, aggroRange: 18, chaseSpeed: 5,   attackRange: 4.0, attackInterval: 1800 },
  { type: 'berserker',label: '狂战士 Berserker',hp: 70, maxHp: 70,  damage: 14, xp: 35, gold: 22, aggroRange: 20, chaseSpeed: 9,   attackRange: 3.0, attackInterval: 800  },
];

const SPAWN_POINTS = [
  { x: 20,   z: -30,  type: 'raider'    },
  { x: -18,  z: -22,  type: 'scout'     },
  { x: 35,   z: 5,    type: 'raider'    },
  { x: -40,  z: 15,   type: 'scout'     },
  { x: 50,   z: -40,  type: 'raider'    },
  { x: -55,  z: -10,  type: 'raider'    },
  { x: 10,   z: -55,  type: 'scout'     },
  { x: 60,   z: 30,   type: 'captain'   },
  { x: -30,  z: 40,   type: 'berserker' },
  { x: 45,   z: -15,  type: 'berserker' },
];

export function createEnemies() {
  return SPAWN_POINTS.map((sp, idx) => {
    const def = ENEMY_DEFS.find((d) => d.type === sp.type);
    return {
      id: `enemy_${idx}`,
      type: sp.type,
      label: def.label,
      x: sp.x,
      z: sp.z,
      patrolOriginX: sp.x,
      patrolOriginZ: sp.z,
      hp: def.hp,
      maxHp: def.maxHp,
      damage: def.damage,
      xp: def.xp,
      goldDrop: def.gold,
      aggroRange: def.aggroRange,
      chaseSpeed: def.chaseSpeed,
      attackRange: def.attackRange,
      attackInterval: def.attackInterval,
      lastAttackAt: 0,
      // telegraph: flash warning before attack
      telegraphAt: null,
      dead: false,
      respawnAt: null,
      // knockback
      vx: 0,
      vz: 0,
    };
  });
}

export function damageEnemy(enemies, enemyId, amount, now = Date.now()) {
  const next = clone(enemies);
  const enemy = next.find((e) => e.id === enemyId);
  if (!enemy || enemy.dead) return { enemies: next, killed: false, enemy: null };
  enemy.hp = Math.max(0, enemy.hp - amount);
  if (enemy.hp === 0) {
    enemy.dead = true;
    enemy.respawnAt = now + 18000;
  }
  return { enemies: next, killed: enemy.dead, enemy };
}

export function knockbackEnemy(enemies, enemyId, fromX, fromZ, force = 6) {
  return enemies.map((e) => {
    if (e.id !== enemyId || e.dead) return e;
    const dx = e.x - fromX;
    const dz = e.z - fromZ;
    const dist = Math.hypot(dx, dz) || 1;
    return { ...e, vx: (dx / dist) * force, vz: (dz / dist) * force };
  });
}

export function getClosestLiveEnemy(enemies, px, pz, maxDist = 10) {
  let best = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (e.dead) continue;
    const dist = Math.hypot(e.x - px, e.z - pz);
    if (dist < maxDist && dist < bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  return best;
}

export function stepEnemies(enemies, hero, nowSeconds, dt, now = Date.now()) {
  return enemies.map((enemy, idx) => {
    if (enemy.dead) return enemy;

    // Apply knockback decay
    let { vx = 0, vz = 0 } = enemy;
    let nx = enemy.x + vx * dt;
    let nz = enemy.z + vz * dt;
    vx *= Math.pow(0.05, dt);
    vz *= Math.pow(0.05, dt);

    const dx = hero.x - nx;
    const dz = hero.z - nz;
    const dist = Math.hypot(dx, dz);

    let telegraphAt = enemy.telegraphAt;

    if (dist < enemy.aggroRange && dist > 0.001) {
      const chaseStep = enemy.chaseSpeed * dt;
      if (dist > enemy.attackRange) {
        nx += (dx / dist) * Math.min(chaseStep, dist - enemy.attackRange);
        nz += (dz / dist) * Math.min(chaseStep, dist - enemy.attackRange);
        telegraphAt = null;
      } else {
        // In attack range — telegraph before hitting
        if (!telegraphAt) telegraphAt = now + 400;
      }
    } else {
      // Patrol circle
      const radius = enemy.type === 'captain' ? 10 : enemy.type === 'berserker' ? 8 : enemy.type === 'raider' ? 7 : 5;
      const speed  = enemy.type === 'captain' ? 0.35 : enemy.type === 'berserker' ? 0.9 : enemy.type === 'raider' ? 0.7 : 0.95;
      const angle  = nowSeconds * speed + idx * 0.9;
      nx = enemy.patrolOriginX + Math.cos(angle) * radius;
      nz = enemy.patrolOriginZ + Math.sin(angle * 0.9) * radius;
      telegraphAt = null;
    }

    return { ...enemy, x: nx, z: nz, vx, vz, telegraphAt };
  });
}

export function respawnEnemies(enemies, now = Date.now()) {
  return enemies.map((enemy) => {
    if (!enemy.dead || !enemy.respawnAt || now < enemy.respawnAt) return enemy;
    return {
      ...enemy,
      dead: false,
      hp: enemy.maxHp,
      x: enemy.patrolOriginX,
      z: enemy.patrolOriginZ,
      respawnAt: null,
      vx: 0, vz: 0,
      telegraphAt: null,
    };
  });
}
