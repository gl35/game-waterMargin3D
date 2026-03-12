const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export const ENEMY_DEFS = [
  { type: 'raider', label: '土匪 Raider', hp: 40,  maxHp: 40,  damage: 8,  xp: 20, gold: 12, color: '#c2341e' },
  { type: 'scout',  label: '斥候 Scout',  hp: 25,  maxHp: 25,  damage: 5,  xp: 12, gold: 8,  color: '#b05020' },
  { type: 'captain',label: '队长 Captain',hp: 90,  maxHp: 90,  damage: 18, xp: 60, gold: 40, color: '#7a1230' },
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
      dead: false,
    };
  });
}

export function damageEnemy(enemies, enemyId, amount) {
  const next = clone(enemies);
  const enemy = next.find((e) => e.id === enemyId);
  if (!enemy || enemy.dead) return { enemies: next, killed: false, enemy: null };
  enemy.hp = Math.max(0, enemy.hp - amount);
  if (enemy.hp === 0) enemy.dead = true;
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
