const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export const ENEMY_DEFS = [
  { type: 'raider',  label: '土匪 Raider',  hp: 40, maxHp: 40, damage: 8,  xp: 20, gold: 12, aggroRange: 18, chaseSpeed: 5  },
  { type: 'scout',   label: '斥候 Scout',   hp: 25, maxHp: 25, damage: 5,  xp: 12, gold: 8,  aggroRange: 24, chaseSpeed: 8  },
  { type: 'captain', label: '队长 Captain', hp: 90, maxHp: 90, damage: 18, xp: 60, gold: 40, aggroRange: 14, chaseSpeed: 3.5},
];

const SPAWN_POINTS = [
  { x: 20,  z: -30, type: 'raider'  },
  { x: -18, z: -22, type: 'scout'   },
  { x: 35,  z: 5,   type: 'raider'  },
  { x: -40, z: 15,  type: 'scout'   },
  { x: 50,  z: -40, type: 'raider'  },
  { x: -55, z: -10, type: 'raider'  },
  { x: 10,  z: -55, type: 'scout'   },
  { x: 60,  z: 30,  type: 'captain' },
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
      dead: false,
      respawnAt: null,
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
    enemy.respawnAt = now + 15000;
  }
  return { enemies: next, killed: enemy.dead, enemy };
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

export function stepEnemies(enemies, hero, nowSeconds, dt) {
  return enemies.map((enemy, idx) => {
    if (enemy.dead) return enemy;

    const dx = hero.x - enemy.x;
    const dz = hero.z - enemy.z;
    const dist = Math.hypot(dx, dz);

    if (dist < enemy.aggroRange && dist > 0.001) {
      const chaseStep = enemy.chaseSpeed * dt;
      const nx = enemy.x + (dx / dist) * Math.min(chaseStep, dist);
      const nz = enemy.z + (dz / dist) * Math.min(chaseStep, dist);
      return { ...enemy, x: nx, z: nz };
    }

    const radius = enemy.type === 'captain' ? 10 : enemy.type === 'raider' ? 7 : 5;
    const speed = enemy.type === 'captain' ? 0.35 : enemy.type === 'raider' ? 0.7 : 0.95;
    const angle = nowSeconds * speed + idx * 0.9;
    return {
      ...enemy,
      x: enemy.patrolOriginX + Math.cos(angle) * radius,
      z: enemy.patrolOriginZ + Math.sin(angle * 0.9) * radius,
    };
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
    };
  });
}
