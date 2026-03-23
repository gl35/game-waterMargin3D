import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { NPCS } from '../core/story/config';
import { tileToWorldPosition } from '../core/story/coordinates';

const DEFAULT_COLORS = {
  tunic: '#33233a',
  cloak: '#f5f4ff',
  headband: '#6f3bb5',
  hatBrim: '#8b6240',
  hatCrown: '#9f7c55',
  spearTip: '#f7d99a',
  tasselTop: '#df8f3c',
  tasselCord: '#f04573',
  tasselBottom: '#f4c13f',
};

const WORLD_BOUNDS = {
  minX: -170,
  maxX: 170,
  minZ: -170,
  maxZ: 220,
};

function isMobile() {
  return typeof window !== 'undefined'
    && (window.innerWidth < 900 || navigator.maxTouchPoints > 0);
}

function Terrain() {
  const geometry = useMemo(() => {
    const mobile = isMobile();
    const geo = new THREE.PlaneGeometry(900, 900, mobile ? 110 : 180, mobile ? 110 : 180);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const height = Math.sin(x * 0.08) * 2.4 + Math.cos(y * 0.05) * 1.4 + Math.cos((x + y) * 0.03) * 0.8;
      pos.setZ(i, height);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} receiveShadow castShadow position={[0, -3.5, 0]}>
      <meshStandardMaterial color="#9edc9d" flatShading />
    </mesh>
  );
}

function PathRibbon() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -3.3, 0]} receiveShadow>
      <planeGeometry args={[70, 520]} />
      <meshStandardMaterial color="#f7d39f" roughness={0.7} metalness={0} />
    </mesh>
  );
}

function MountainBackdrop() {
  const geometry = useMemo(() => new THREE.PlaneGeometry(900, 220, 60, 16), []);
  return (
    <group position={[0, 55, -220]}>
      {[0, 1, -1].map((offset, idx) => (
        <mesh key={`mountain-${idx}`} geometry={geometry} position={[offset * 14, idx * 10, idx * -6]}>
          <meshBasicMaterial color={idx === 0 ? '#cfe9ff' : '#a7cfe8'} transparent opacity={0.8 - idx * 0.15} />
        </mesh>
      ))}
    </group>
  );
}

function TreeField() {
  const mobile = isMobile();
  const treeCount = mobile ? 160 : 420;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!mesh.current) return;
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const radius = 90 + Math.random() * 180;
      const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 10;
      const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 10;
      const scale = 0.8 + Math.random() * 0.9;
      dummy.position.set(x, -2.5, z);
      dummy.scale.set(scale, scale * 1.4, scale);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [dummy, treeCount]);

  useEffect(() => {
    if (!mesh.current) return;
    mesh.current.frustumCulled = false;
    mesh.current.geometry.computeBoundingSphere();
    mesh.current.geometry.boundingSphere.radius = 9999;
  }, []);

  return (
    <instancedMesh ref={mesh} args={[null, null, treeCount]} castShadow receiveShadow frustumCulled={false}>
      <coneGeometry args={[2.8, 8, 6]} />
      <meshStandardMaterial color="#3e8554" flatShading />
    </instancedMesh>
  );
}

// Generic human character: body + legs + arms + head
function HumanFigure({ bodyColor = '#4a4060', robeColor = '#3a3050', skinColor = '#f2c9a0', hatColor = null, highlight = false, onClick = null, children }) {
  const mat = (color, emissive = '#000', emissInt = 0) => (
    <meshStandardMaterial color={highlight ? '#ffe8a0' : color} emissive={highlight ? '#ffcc40' : emissive} emissiveIntensity={highlight ? 0.35 : emissInt} />
  );
  return (
    <group onClick={onClick}>
      {/* Lower robe / skirt */}
      <mesh castShadow position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.82, 1.05, 1.9, 14]} />
        {mat(robeColor)}
      </mesh>
      {/* Upper torso */}
      <mesh castShadow position={[0, 2.3, 0]}>
        <cylinderGeometry args={[0.72, 0.82, 1.8, 12]} />
        {mat(bodyColor)}
      </mesh>
      {/* Left arm */}
      <mesh castShadow position={[-1.0, 2.2, 0]} rotation={[0, 0, 0.38]}>
        <cylinderGeometry args={[0.22, 0.28, 1.7, 8]} />
        {mat(bodyColor)}
      </mesh>
      {/* Right arm */}
      <mesh castShadow position={[1.0, 2.2, 0]} rotation={[0, 0, -0.38]}>
        <cylinderGeometry args={[0.22, 0.28, 1.7, 8]} />
        {mat(bodyColor)}
      </mesh>
      {/* Neck */}
      <mesh castShadow position={[0, 3.3, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.45, 8]} />
        {mat(skinColor)}
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 3.95, 0]}>
        <sphereGeometry args={[0.72, 14, 14]} />
        {mat(skinColor)}
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.22, 4.02, 0.62]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#1a1020" />
      </mesh>
      <mesh position={[0.22, 4.02, 0.62]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#1a1020" />
      </mesh>
      {/* Sash / belt */}
      <mesh position={[0, 1.85, 0]}>
        <torusGeometry args={[0.85, 0.1, 6, 22]} />
        <meshStandardMaterial color="#c09040" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Hat (optional) */}
      {hatColor && <>
        <mesh position={[0, 4.55, -0.1]} rotation={[0.08, 0, 0]}>
          <cylinderGeometry args={[1.4, 1.4, 0.22, 28]} />
          <meshStandardMaterial color={hatColor} />
        </mesh>
        <mesh position={[0, 5.1, -0.1]} rotation={[0.08, 0, 0]}>
          <coneGeometry args={[0.95, 1.4, 18]} />
          <meshStandardMaterial color={hatColor} />
        </mesh>
      </>}
      {children}
    </group>
  );
}

function NpcField({ highlightedNpcId, onNpcTap }) {
  const NPC_STYLES = {
    songjiang: { body: '#5a1a20', robe: '#8a2830', hat: '#1a1010' },
    linchong:  { body: '#2a2840', robe: '#383060', hat: '#1e1c2e' },
    wuyong:    { body: '#1e3040', robe: '#2a4458', hat: '#162030' },
    tonkey:    { body: '#1c2230', robe: '#283248', hat: null      },
    villager:  { body: '#4a3820', robe: '#6a5030', hat: '#604020' },
  };

  return (
    <group>
      {NPCS.map((npc) => {
        const { x, z } = tileToWorldPosition(npc);
        const glow = npc.id === highlightedNpcId;
        const style = NPC_STYLES[npc.id] || NPC_STYLES.villager;
        return (
          <group key={npc.id} position={[x, -2.5, z]}>
            <HumanFigure
              bodyColor={style.body}
              robeColor={style.robe}
              hatColor={style.hat}
              highlight={glow}
              onClick={(e) => { e.stopPropagation(); onNpcTap?.(npc.id); }}
            />
            {/* Highlight ring on ground */}
            {glow && (
              <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.1, 1.5, 28]} />
                <meshBasicMaterial color="#ffe060" transparent opacity={0.55} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function EnemySoldier({ glow, hitFlash, onClick, enemyId, attackFx }) {
  const bodyRef = useRef();

  useFrame(() => {
    if (!bodyRef.current) return;
    const hitAge = attackFx?.enemyId === enemyId ? Date.now() - attackFx.at : 9999;
    const stagger = hitAge < 340 ? Math.sin((hitAge / 340) * Math.PI) * 0.65 : 0;
    bodyRef.current.position.z = stagger;
    if (hitAge < 140) {
      bodyRef.current.rotation.z = Math.sin(hitAge * 0.3) * 0.22;
    } else {
      bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, 0, 0.15);
    }
  });
  const armorColor  = hitFlash ? '#ffd8a8' : '#3a2020';
  const plateColor  = hitFlash ? '#ffe0b0' : '#5a3030';
  const skinColor   = hitFlash ? '#fff1cf' : '#c89070';
  const emissive    = hitFlash ? '#ffcf6a' : glow ? '#ff3010' : '#000';
  const emissInt    = hitFlash ? 1.1 : glow ? 0.4 : 0;

  const mat = (color) => (
    <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissInt} />
  );

  return (
    <group onClick={onClick}>
      <group ref={bodyRef}>
      {/* Legs */}
      <mesh castShadow position={[-0.35, 0.6, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 1.3, 8]} />
        {mat('#1e1212')}
      </mesh>
      <mesh castShadow position={[0.35, 0.6, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 1.3, 8]} />
        {mat('#1e1212')}
      </mesh>
      {/* Boots */}
      <mesh castShadow position={[-0.35, 0.05, 0.1]}>
        <boxGeometry args={[0.55, 0.3, 0.75]} />
        {mat('#100c0c')}
      </mesh>
      <mesh castShadow position={[0.35, 0.05, 0.1]}>
        <boxGeometry args={[0.55, 0.3, 0.75]} />
        {mat('#100c0c')}
      </mesh>
      {/* Torso armor */}
      <mesh castShadow position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.68, 0.72, 1.6, 12]} />
        {mat(armorColor)}
      </mesh>
      {/* Chest plate */}
      <mesh castShadow position={[0, 1.85, 0.5]}>
        <boxGeometry args={[1.1, 1.4, 0.18]} />
        {mat(plateColor)}
      </mesh>
      {/* Shoulder pauldrons */}
      <mesh castShadow position={[-0.95, 2.4, 0]}>
        <sphereGeometry args={[0.38, 10, 8]} />
        {mat(armorColor)}
      </mesh>
      <mesh castShadow position={[0.95, 2.4, 0]}>
        <sphereGeometry args={[0.38, 10, 8]} />
        {mat(armorColor)}
      </mesh>
      {/* Arms */}
      <mesh castShadow position={[-1.05, 1.8, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.25, 0.3, 1.5, 8]} />
        {mat(armorColor)}
      </mesh>
      <mesh castShadow position={[1.05, 1.8, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.25, 0.3, 1.5, 8]} />
        {mat(armorColor)}
      </mesh>
      {/* Neck */}
      <mesh castShadow position={[0, 2.9, 0]}>
        <cylinderGeometry args={[0.28, 0.3, 0.38, 8]} />
        {mat(skinColor)}
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.65, 12, 12]} />
        {mat(skinColor)}
      </mesh>
      {/* Helmet */}
      <mesh castShadow position={[0, 3.75, 0]}>
        <sphereGeometry args={[0.72, 12, 10]} />
        {mat('#1a1010')}
      </mesh>
      {/* Helmet brim */}
      <mesh position={[0, 3.4, 0]}>
        <cylinderGeometry args={[0.88, 0.88, 0.15, 20]} />
        {mat('#2a1818')}
      </mesh>
      {/* Helmet crest */}
      <mesh position={[0, 4.4, 0]}>
        <cylinderGeometry args={[0.08, 0.14, 0.6, 6]} />
        <meshStandardMaterial color="#901818" emissive="#601010" emissiveIntensity={0.4} />
      </mesh>
      {/* Red glowing eyes */}
      <mesh position={[-0.22, 3.52, 0.55]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#ff1818" emissive="#ff1818" emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[0.22, 3.52, 0.55]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial color="#ff1818" emissive="#ff1818" emissiveIntensity={1.8} />
      </mesh>
      {/* Halberd */}
      <mesh castShadow position={[1.3, 2.0, -0.4]} rotation={[0.15, 0, 0.1]}>
        <cylinderGeometry args={[0.07, 0.07, 5.5, 8]} />
        <meshStandardMaterial color="#888090" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[1.42, 4.6, -0.85]} rotation={[0.15, 0, 0.1]}>
        <coneGeometry args={[0.22, 1.0, 6]} />
        <meshStandardMaterial color="#c0c0d8" metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Ground glow ring when highlighted */}
      {glow && (
        <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.4, 24]} />
          <meshBasicMaterial color="#ff4010" transparent opacity={0.5} />
        </mesh>
      )}
      </group>{/* end bodyRef stagger group */}
    </group>
  );
}

function EnemyField({ enemies = [], highlightedEnemyId, onEnemyTap, attackFx }) {
  return (
    <group>
      {enemies.filter((enemy) => !enemy.dead).map((enemy) => {
        const glow = enemy.id === highlightedEnemyId;
        const hitAge = attackFx?.enemyId === enemy.id ? Date.now() - attackFx.at : 9999;
        const hitFlash = hitAge < 220;
        return (
          <group key={enemy.id} position={[enemy.x, -2.4, enemy.z]}>
            <EnemySoldier
              glow={glow}
              hitFlash={hitFlash}
              enemyId={enemy.id}
              attackFx={attackFx}
              onClick={(e) => { e.stopPropagation(); onEnemyTap?.(enemy.id); }}
            />
          </group>
        );
      })}
    </group>
  );
}

function useMovementControls() {
  const stateRef = useRef({ forward: false, backward: false, left: false, right: false });
  useEffect(() => {
    const handle = (pressed) => (event) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          stateRef.current.forward = pressed;
          break;
        case 'KeyS':
        case 'ArrowDown':
          stateRef.current.backward = pressed;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          stateRef.current.left = pressed;
          break;
        case 'KeyD':
        case 'ArrowRight':
          stateRef.current.right = pressed;
          break;
        default:
      }
    };
    const handleDown = handle(true);
    const handleUp = handle(false);
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);
  return stateRef;
}

function HeroAvatar({ heroRef, onMove, heroSkin, moveInput, attackFx, superFx, isSprinting, screenShake, isDodging, isCharging, chargeLevel }) {
  const group = heroRef || useRef();
  const controls = useMovementControls();
  const velocity = useRef(new THREE.Vector3());
  const moveCallback = useRef(onMove);
  const palette = heroSkin?.colors || DEFAULT_COLORS;
  const accessories = heroSkin?.accessories || {};

  // Bone refs for animation
  const leftLegRef  = useRef();
  const rightLegRef = useRef();
  const leftArmRef  = useRef();
  const rightArmRef = useRef();
  const torsoRef    = useRef();
  const spearRef    = useRef();
  const slashRef    = useRef();

  // Attack state
  const attackState = useRef({ active: false, t: 0, lastAt: 0 });

  const flowerOffsets = useMemo(() => (
    accessories.shirtPattern
      ? [
          { key: 'f1', position: [1.4, 2.2, 0.8], color: '#ff6b6b' },
          { key: 'f2', position: [-1.6, 2.5, 0.9], color: '#ffe66d' },
          { key: 'f3', position: [0.2, 1.6, 1.0], color: '#2ec4b6' },
          { key: 'f4', position: [1.1, 3.0, 0.5], color: '#ff9f1c' },
          { key: 'f5', position: [-0.8, 3.2, 0.4], color: '#ff6b6b' },
        ]
      : []
  ), [accessories.shirtPattern]);

  useEffect(() => { moveCallback.current = onMove; }, [onMove]);

  // Trigger attack anim when attackFx changes
  const lastAttackAt = useRef(0);
  useEffect(() => {
    if (!attackFx?.at || attackFx.at === lastAttackAt.current) return;
    lastAttackAt.current = attackFx.at;
    attackState.current = { active: true, t: 0, lastAt: attackFx.at };
  }, [attackFx]);

  // Dodge state
  const dodgeState = useRef({ active: false, t: 0, dir: new THREE.Vector3() });
  const lastDodge = useRef(0);

  // Charge glow ref
  const chargeGlowRef = useRef();

  // Super move state
  const superState = useRef({ active: false, type: null, t: 0 });
  const lastSuperAt = useRef(0);
  useEffect(() => {
    if (!superFx?.at || superFx.at === lastSuperAt.current) return;
    lastSuperAt.current = superFx.at;
    superState.current = { active: true, type: superFx.type, t: 0 };
    // Also trigger normal attack anim
    attackState.current = { active: true, t: 0, lastAt: superFx.at };
  }, [superFx]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const input = moveInput || {};
    const dir = new THREE.Vector3(
      (controls.current.left || input.left ? -1 : 0) + (controls.current.right || input.right ? 1 : 0),
      0,
      (controls.current.forward || input.forward ? -1 : 0) + (controls.current.backward || input.backward ? 1 : 0),
    );

    const isMoving = dir.lengthSq() > 0;
    if (isMoving) {
      dir.normalize();
      const spd = isSprinting ? 32 : 18;
      velocity.current.lerp(dir.multiplyScalar(spd), isSprinting ? 0.35 : 0.2);
      group.current.rotation.y = Math.atan2(dir.x, -dir.z);
    } else {
      velocity.current.lerp(new THREE.Vector3(), 0.15);
    }

    group.current.position.addScaledVector(velocity.current, delta);
    group.current.position.x = THREE.MathUtils.clamp(group.current.position.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
    group.current.position.z = THREE.MathUtils.clamp(group.current.position.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);

    const t = state.clock.getElapsedTime();

    // ── Dodge roll ──
    if (isDodging && !dodgeState.current.active) {
      dodgeState.current.active = true;
      dodgeState.current.t = 0;
      dodgeState.current.dir.copy(velocity.current.clone().normalize());
      if (dodgeState.current.dir.lengthSq() < 0.01) dodgeState.current.dir.set(0, 0, -1);
    }
    if (dodgeState.current.active) {
      dodgeState.current.t = Math.min(dodgeState.current.t + delta * 3.5, 1);
      const dp = Math.sin(dodgeState.current.t * Math.PI);
      // Forward lunge
      group.current.position.addScaledVector(dodgeState.current.dir, dp * delta * 22);
      // Full body rotation roll
      if (torsoRef.current) torsoRef.current.rotation.x = dp * Math.PI * 1.1;
      if (dodgeState.current.t >= 1) {
        dodgeState.current.active = false;
        if (torsoRef.current) torsoRef.current.rotation.x = 0;
      }
    }
    if (!isDodging && !dodgeState.current.active) {
      // fade torso back
    }

    // ── Charge glow ──
    if (chargeGlowRef.current) {
      chargeGlowRef.current.material.opacity = isCharging ? chargeLevel * 0.65 : 0;
      chargeGlowRef.current.scale.setScalar(1 + chargeLevel * 1.5);
    }

    // ── Walk bob ──
    if (isMoving) {
      group.current.position.y = -0.6 + Math.abs(Math.sin(t * 9)) * 0.18;
    } else {
      group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, -0.6 + Math.sin(t * 1.4) * 0.04, 0.08);
    }

    moveCallback.current?.({ x: group.current.position.x, y: group.current.position.y, z: group.current.position.z });

    // ── Attack animation ──
    const atk = attackState.current;
    if (atk.active) {
      atk.t = Math.min(atk.t + delta * 5.5, 1);

      // Thrust: lunge forward then snap back (sin curve peaks at t=0.4)
      const thrustCurve = Math.sin(atk.t * Math.PI);
      const lunge = thrustCurve * 1.2;

      // Body lean into strike
      if (torsoRef.current) {
        torsoRef.current.rotation.x = -thrustCurve * 0.55;
        torsoRef.current.rotation.z = thrustCurve * 0.15;
      }

      // Right arm thrusts spear forward hard
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -thrustCurve * 1.8;
        rightArmRef.current.rotation.z = -0.25 - thrustCurve * 0.3;
      }

      // Left arm swings back for balance
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = thrustCurve * 0.8;
      }

      // Spear lunges along z axis
      if (spearRef.current) {
        spearRef.current.position.z = -0.5 - lunge * 1.4;
        spearRef.current.rotation.x = -thrustCurve * 0.9;
      }

      // Slash arc: visible during first half
      if (slashRef.current) {
        const slashProgress = Math.min(atk.t * 2.2, 1);
        slashRef.current.scale.set(slashProgress * 2.2, slashProgress * 2.2, 1);
        slashRef.current.material.opacity = (1 - slashProgress) * 0.75;
        slashRef.current.rotation.z = -slashProgress * 1.4;
      }

      if (atk.t >= 1) {
        atk.active = false;
        // Reset all bones
        if (torsoRef.current)    { torsoRef.current.rotation.x = 0; torsoRef.current.rotation.z = 0; }
        if (rightArmRef.current) { rightArmRef.current.rotation.x = 0; rightArmRef.current.rotation.z = -0.25; }
        if (leftArmRef.current)  { leftArmRef.current.rotation.x = 0; }
        if (spearRef.current)    { spearRef.current.position.z = -0.5; spearRef.current.rotation.x = 0; }
        if (slashRef.current)    { slashRef.current.scale.set(0, 0, 1); slashRef.current.material.opacity = 0; }
      }
    }

    // ── Super move hero animation ──
    const sup = superState.current;
    if (sup.active) {
      sup.t = Math.min(sup.t + delta * 3, 1);
      const s = Math.sin(sup.t * Math.PI);

      if (sup.type === 'storm') {
        // Full body spin
        if (group.current) group.current.rotation.y += delta * 22 * s;
        if (torsoRef.current) { torsoRef.current.rotation.x = -s * 0.4; }
        if (leftArmRef.current)  leftArmRef.current.rotation.z =  0.32 + s * 1.2;
        if (rightArmRef.current) rightArmRef.current.rotation.z = -0.25 - s * 1.2;
      }
      if (sup.type === 'shadow') {
        // Crouch + explosive leap effect
        if (group.current) group.current.position.y += s * 1.8;
        if (torsoRef.current) torsoRef.current.rotation.x = -s * 0.7;
        if (rightArmRef.current) rightArmRef.current.rotation.x = -s * 2.2;
      }
      if (sup.t >= 1) {
        sup.active = false;
        if (torsoRef.current) { torsoRef.current.rotation.x = 0; }
        if (leftArmRef.current)  leftArmRef.current.rotation.z =  0.32;
        if (rightArmRef.current) rightArmRef.current.rotation.z = -0.25;
      }
    }

    // ── Walk leg swing ──
    if (isMoving) {
      const swing = Math.sin(t * 10) * 0.55;
      if (leftLegRef.current)  leftLegRef.current.rotation.x  =  swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (!atk.active) {
        if (leftArmRef.current)  leftArmRef.current.rotation.x  = -swing * 0.6;
        if (rightArmRef.current) rightArmRef.current.rotation.x  =  swing * 0.6;
      }
    } else if (!atk.active) {
      if (leftLegRef.current)  leftLegRef.current.rotation.x  = THREE.MathUtils.lerp(leftLegRef.current.rotation.x,  0, 0.12);
      if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, 0.12);
      if (leftArmRef.current)  leftArmRef.current.rotation.x  = THREE.MathUtils.lerp(leftArmRef.current.rotation.x,  0, 0.12);
      if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, 0.12);
    }

    // ── Idle breathe ──
    if (!isMoving && !atk.active && torsoRef.current) {
      torsoRef.current.position.y = 2.25 + Math.sin(t * 1.6) * 0.04;
    }
  });

  return (
    <group ref={group} position={[0, 0, 12]}>

      {/* ── LEGS (animated) ── */}
      <group ref={leftLegRef} position={[-0.38, 1.15, 0]}>
        <mesh castShadow position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.28, 0.33, 1.2, 10]} />
          <meshStandardMaterial color={palette.tunic} />
        </mesh>
        <mesh castShadow position={[0, -1.2, 0.08]}>
          <boxGeometry args={[0.5, 0.28, 0.72]} />
          <meshStandardMaterial color="#2a2040" />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.38, 1.15, 0]}>
        <mesh castShadow position={[0, -0.6, 0]}>
          <cylinderGeometry args={[0.28, 0.33, 1.2, 10]} />
          <meshStandardMaterial color={palette.tunic} />
        </mesh>
        <mesh castShadow position={[0, -1.2, 0.08]}>
          <boxGeometry args={[0.5, 0.28, 0.72]} />
          <meshStandardMaterial color="#2a2040" />
        </mesh>
      </group>

      {/* ── LOWER ROBE ── */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.72, 0.92, 1.3, 14]} />
        <meshStandardMaterial color={palette.cloak} roughness={0.85} />
      </mesh>

      {/* ── TORSO (animated) ── */}
      <group ref={torsoRef} position={[0, 2.25, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.60, 0.72, 1.65, 12]} />
          <meshStandardMaterial color={palette.cloak} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, 0.6, 0.45]}>
          <boxGeometry args={[0.9, 0.6, 0.12]} />
          <meshStandardMaterial color={palette.tunic} />
        </mesh>

        {/* ── SASH ── */}
        <mesh position={[0, -0.7, 0]}>
          <torusGeometry args={[0.78, 0.1, 8, 24]} />
          <meshStandardMaterial color={palette.headband} metalness={0.3} roughness={0.6} />
        </mesh>

        {/* ── LEFT ARM (pivot from shoulder) ── */}
        <group ref={leftArmRef} position={[-0.95, 0.1, 0]}>
          <mesh castShadow position={[0, -0.65, 0]} rotation={[0, 0, 0.32]}>
            <cylinderGeometry args={[0.21, 0.26, 1.55, 8]} />
            <meshStandardMaterial color={palette.cloak} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[-0.42, -1.25, 0]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color="#f2c9a0" />
          </mesh>
        </group>

        {/* ── RIGHT ARM (pivot from shoulder, holds spear) ── */}
        <group ref={rightArmRef} position={[0.92, 0.15, -0.2]} rotation={[0, 0, -0.25]}>
          <mesh castShadow position={[0, -0.65, 0]}>
            <cylinderGeometry args={[0.21, 0.26, 1.55, 8]} />
            <meshStandardMaterial color={palette.cloak} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0.15, -1.25, -0.3]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color="#f2c9a0" />
          </mesh>
        </group>

        {/* ── NECK + HEAD ── */}
        <mesh castShadow position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.26, 0.3, 0.42, 8]} />
          <meshStandardMaterial color="#f2c9a0" />
        </mesh>
        <mesh castShadow position={[0, 1.72, 0]}>
          <sphereGeometry args={[0.72, 14, 14]} />
          <meshStandardMaterial color="#f2c9a0" />
        </mesh>
        <mesh position={[-0.24, 1.78, 0.62]}>
          <sphereGeometry args={[0.1, 6, 6]} />
          <meshStandardMaterial color="#1a1030" />
        </mesh>
        <mesh position={[0.24, 1.78, 0.62]}>
          <sphereGeometry args={[0.1, 6, 6]} />
          <meshStandardMaterial color="#1a1030" />
        </mesh>

        {/* ── HAT ── */}
        <mesh castShadow position={[0, 2.32, -0.18]} rotation={[0.1, 0, 0]}>
          <cylinderGeometry args={[1.55, 1.55, 0.18, 28]} />
          <meshStandardMaterial color={palette.hatBrim} />
        </mesh>
        <mesh castShadow position={[0, 3.04, -0.18]} rotation={[0.1, 0, 0]}>
          <coneGeometry args={[1.05, 1.85, 20]} />
          <meshStandardMaterial color={palette.hatCrown} />
        </mesh>
      </group>

      {/* ── SPEAR (animated separately) ── */}
      <group ref={spearRef} position={[0.6, 3.0, -0.5]}>
        <mesh castShadow rotation={[-0.48, 0.18, 0.12]}>
          <cylinderGeometry args={[0.07, 0.07, 7.5, 8]} />
          <meshStandardMaterial color="#c8c0a8" metalness={0.15} roughness={0.7} />
        </mesh>
        <mesh position={[0.15, 3.6, -2.05]} rotation={[-0.48, 0.18, 0.12]}>
          <coneGeometry args={[0.2, 0.9, 6]} />
          <meshStandardMaterial color={palette.spearTip} metalness={0.6} roughness={0.2} />
        </mesh>
        {/* Spear tip glow on attack */}
        <mesh position={[0.15, 3.6, -2.05]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color={palette.spearTip} emissive={palette.spearTip} emissiveIntensity={0.6} transparent opacity={0.3} />
        </mesh>
      </group>

      {/* ── TASSEL ── */}
      <mesh position={[0.45, 1.5, 0.3]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color={palette.tasselTop} emissive={palette.tasselTop} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.45, 1.1, 0.3]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
        <meshStandardMaterial color={palette.tasselCord} />
      </mesh>
      <mesh position={[0.45, 0.7, 0.3]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color={palette.tasselBottom} />
      </mesh>

      {/* ── SLASH ARC VFX ── (starts invisible, animated on attack) */}
      <mesh ref={slashRef} position={[0, 2.8, -1.2]} rotation={[Math.PI / 2, 0, 0]} scale={[0, 0, 1]}>
        <torusGeometry args={[1.8, 0.25, 8, 24, Math.PI * 1.1]} />
        <meshBasicMaterial color="#b8e8ff" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {accessories.lei && (
        <mesh position={[0, 2.6, 0]}>
          <torusGeometry args={[1.1, 0.22, 10, 22]} />
          <meshStandardMaterial color="#ff7eb9" emissive="#ff9bcf" emissiveIntensity={0.35} />
        </mesh>
      )}
      {accessories.sunglasses && (
        <mesh position={[0, 3.88, 0.68]}>
          <boxGeometry args={[1.3, 0.35, 0.12]} />
          <meshStandardMaterial color="#111" metalness={0.4} roughness={0.2} />
        </mesh>
      )}
      {flowerOffsets.map((flower) => (
        <mesh key={flower.key} position={[flower.position[0] * 0.55, flower.position[1] * 0.55, flower.position[2]]}>
          <sphereGeometry args={[0.14, 6, 6]} />
          <meshStandardMaterial color={flower.color} />
        </mesh>
      ))}

      {/* Charge glow aura */}
      <mesh ref={chargeGlowRef} position={[0, 2.5, 0]}>
        <sphereGeometry args={[2.2, 10, 8]} />
        <meshBasicMaterial color="#ffcc20" transparent opacity={0} />
      </mesh>

      {/* Ground shadow */}
      <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function FloatingRune() {
  const meshRef = useRef();
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.position.y = 6.5 + Math.sin(t * 1.2) * 0.4;
    meshRef.current.rotation.y += 0.01;
  });
  return (
    <mesh ref={meshRef} position={[-6, 6, -10]}>
      <octahedronGeometry args={[2.4, 0]} />
      <meshStandardMaterial color="#c6f5ff" emissive="#6dd9ff" emissiveIntensity={0.6} />
    </mesh>
  );
}

function Lights({ mobile = false }) {
  return (
    <>
      <ambientLight intensity={mobile ? 0.75 : 0.65} />
      <directionalLight
        position={[40, 80, 20]}
        intensity={mobile ? 1.1 : 1.5}
        castShadow={!mobile}
        shadow-mapSize-width={mobile ? 512 : 1024}
        shadow-mapSize-height={mobile ? 512 : 1024}
      />
      <hemisphereLight args={[0xcff6ff, 0x89c09a, mobile ? 0.72 : 0.6]} />
    </>
  );
}

function SkyDome() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 2);
      gradient.addColorStop(0, '#fefcf2');
      gradient.addColorStop(0.5, '#b8e4ff');
      gradient.addColorStop(1, '#72aef0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <mesh position={[0, -50, 0]}>
      <sphereGeometry args={[520, 32, 32]} />
      <meshBasicMaterial side={THREE.BackSide} map={texture} />
    </mesh>
  );
}

function CameraRig({ target, screenShake, slowMo, lockedTarget, enemies }) {
  const { camera } = useThree();
  const offset = useMemo(() => new THREE.Vector3(0, 16, 34), []);
  const shakeRef = useRef(0);
  useEffect(() => { if (screenShake) shakeRef.current = 0.35; }, [screenShake]);
  useFrame((state, delta) => {
    if (!target.current) return;
    // Lock-on: orbit around target
    let followOffset = offset;
    if (lockedTarget) {
      const enemy = enemies.find((e) => e.id === lockedTarget && !e.dead);
      if (enemy) {
        const toEnemy = new THREE.Vector3(enemy.x - target.current.position.x, 0, enemy.z - target.current.position.z).normalize();
        followOffset = new THREE.Vector3(-toEnemy.x * 10, 16, -toEnemy.z * 10 + 28);
      }
    }
    const desired = target.current.position.clone().add(followOffset);
    camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    const lookAt = target.current.position.clone();
    lookAt.y += 3;
    camera.lookAt(lookAt);

    // Slow-mo FOV squeeze
    const targetFov = slowMo ? 38 : 52;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.12);
    camera.updateProjectionMatrix();

    // Screenshake
    if (shakeRef.current > 0) {
      camera.position.x += (Math.random() - 0.5) * shakeRef.current;
      camera.position.y += (Math.random() - 0.5) * shakeRef.current;
      shakeRef.current = Math.max(0, shakeRef.current - delta * 4);
    }
  });
  return null;
}

// ── WORLD-ALIVE SYSTEMS ─────────────────────────────────────────

// Day/night cycle
function DayNightCycle() {
  const { scene } = useThree();
  const ambientRef = useRef();
  const sunRef = useRef();
  const fog = useMemo(() => new THREE.Fog(0x7ab8e8, 180, 500), []);
  const skyDay   = useMemo(() => new THREE.Color('#7ab8e8'), []);
  const skyDusk  = useMemo(() => new THREE.Color('#e07840'), []);
  const skyNight = useMemo(() => new THREE.Color('#0a0e1a'), []);
  const tmpCol   = useMemo(() => new THREE.Color(), []);

  useEffect(() => { scene.fog = fog; }, [scene, fog]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const sunAngle = (t % 120) / 120 * Math.PI * 2 - Math.PI / 2;
    const sun = Math.sin(sunAngle);
    const day = THREE.MathUtils.smoothstep(sun, -0.15, 0.35);
    const isDusk = Math.abs(sun) < 0.28;

    tmpCol.copy(day > 0.5 ? skyDay : skyNight);
    if (isDusk) tmpCol.lerp(skyDusk, 1 - Math.abs(sun) / 0.28);
    if (scene.background instanceof THREE.Color) scene.background.copy(tmpCol);
    fog.color.copy(tmpCol);
    fog.near = 180;
    fog.far = 420 + day * 80;

    if (ambientRef.current) ambientRef.current.intensity = 0.2 + day * 0.55;
    if (sunRef.current) {
      sunRef.current.intensity = 0.5 + day * 1.0;
      sunRef.current.position.set(Math.cos(sunAngle) * 280, Math.sin(sunAngle) * 280, 60);
      sunRef.current.color.set(isDusk ? '#ffaa60' : day > 0.5 ? '#fff8e8' : '#4060a0');
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.65} />
      <directionalLight ref={sunRef} castShadow intensity={1.5} position={[40, 80, 20]}
        shadow-mapSize-width={512} shadow-mapSize-height={512} />
    </>
  );
}

// Clouds — instanced mesh for performance
function Clouds() {
  const COUNT = isMobile() ? 6 : 12;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({
    x: (Math.random() - 0.5) * 500,
    y: 60 + Math.random() * 40,
    z: -80 - Math.random() * 150,
    sx: 1.2 + Math.random() * 1.4,
    sy: 0.5 + Math.random() * 0.4,
    sz: 1.0 + Math.random() * 0.8,
    speed: 2 + Math.random() * 3,
  })), [COUNT]);

  useEffect(() => {
    if (!mesh.current) return;
    data.forEach((c, i) => {
      dummy.position.set(c.x, c.y, c.z);
      dummy.scale.set(c.sx, c.sy, c.sz);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [data, dummy]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    data.forEach((c, i) => {
      c.x += c.speed * delta;
      if (c.x > 300) c.x = -300;
      dummy.position.set(c.x, c.y, c.z);
      dummy.scale.set(c.sx, c.sy, c.sz);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, COUNT]}>
      <sphereGeometry args={[14, 6, 4]} />
      <meshStandardMaterial color="#ffffff" transparent opacity={0.72} roughness={1} />
    </instancedMesh>
  );
}

// Birds — single instanced mesh for bodies, wings animated via group
function Birds() {
  const groupRef = useRef();
  const wingLRefs = useRef([]);
  const wingRRefs = useRef([]);
  const BIRD_COUNT = 8;
  const offsets = useMemo(() => Array.from({ length: BIRD_COUNT }, (_, i) => [
    (i - 4) * 6 + Math.random() * 3,
    Math.random() * 4,
    i * 3,
  ]), []);
  const phases = useMemo(() => Array.from({ length: BIRD_COUNT }, () => Math.random() * Math.PI * 2), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(t * 0.08) * 180;
      groupRef.current.position.z = -80 + Math.sin(t * 0.05) * 60;
      groupRef.current.position.y = 45 + Math.sin(t * 0.12) * 8;
      groupRef.current.rotation.y = Math.atan2(Math.cos(t * 0.08) * 14.4, 1);
    }
    for (let i = 0; i < BIRD_COUNT; i++) {
      const flap = Math.sin(t * 4 + phases[i]) * 0.6;
      if (wingLRefs.current[i]) wingLRefs.current[i].rotation.z =  0.3 + flap;
      if (wingRRefs.current[i]) wingRRefs.current[i].rotation.z = -0.3 - flap;
    }
  });

  return (
    <group ref={groupRef} position={[0, 45, -80]}>
      {offsets.map((off, i) => (
        <group key={i} position={off}>
          <mesh>
            <sphereGeometry args={[0.4, 5, 4]} />
            <meshStandardMaterial color="#1a1010" />
          </mesh>
          <group ref={(el) => { wingLRefs.current[i] = el; }} position={[-0.8, 0, 0]}>
            <mesh><boxGeometry args={[1.4, 0.1, 0.5]} /><meshStandardMaterial color="#1a1010" /></mesh>
          </group>
          <group ref={(el) => { wingRRefs.current[i] = el; }} position={[0.8, 0, 0]}>
            <mesh><boxGeometry args={[1.4, 0.1, 0.5]} /><meshStandardMaterial color="#1a1010" /></mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// Campfire — stable refs, no inline ref in map
function Campfire({ position }) {
  const flameRef = useRef();
  const lightRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (flameRef.current) {
      flameRef.current.scale.y = 1 + Math.sin(t * 7 + position[0]) * 0.28;
      flameRef.current.scale.x = 1 + Math.sin(t * 5 + 1) * 0.12;
      flameRef.current.position.y = 1.1 + Math.sin(t * 9) * 0.06;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.2 + Math.sin(t * 6 + position[2]) * 1.0 + Math.sin(t * 13) * 0.35;
    }
  });

  return (
    <group position={position}>
      <mesh rotation={[0, 0.6, Math.PI / 2]} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 1.6, 6]} />
        <meshStandardMaterial color="#5a3010" roughness={1} />
      </mesh>
      <mesh rotation={[0, -0.6, Math.PI / 2]} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 1.6, 6]} />
        <meshStandardMaterial color="#4a2808" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.6, 0.9, 10]} />
        <meshStandardMaterial color="#606060" roughness={0.9} />
      </mesh>
      <mesh ref={flameRef} position={[0, 1.1, 0]}>
        <coneGeometry args={[0.35, 1.1, 8]} />
        <meshStandardMaterial color="#ff6010" emissive="#ff4400" emissiveIntensity={1.4} transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <coneGeometry args={[0.18, 0.7, 6]} />
        <meshStandardMaterial color="#ffdd40" emissive="#ffaa00" emissiveIntensity={2} transparent opacity={0.7} />
      </mesh>
      <pointLight ref={lightRef} color="#ff6010" intensity={2.5} distance={22} decay={2} />
    </group>
  );
}

// Swaying grass — instanced mesh, animated via shader offset trick
function SwayingGrass() {
  const COUNT = isMobile() ? 60 : 140;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => Array.from({ length: COUNT }, () => ({
    x: (Math.random() - 0.5) * 200,
    z: (Math.random() - 0.5) * 200,
    phase: Math.random() * Math.PI * 2,
    h: 0.6 + Math.random() * 0.6,
  })), [COUNT]);

  useEffect(() => {
    if (!mesh.current) return;
    data.forEach((b, i) => {
      dummy.position.set(b.x, -3.1 + b.h / 2, b.z);
      dummy.scale.set(1, b.h, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [data, dummy]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.getElapsedTime();
    data.forEach((b, i) => {
      const sway = Math.sin(t * 1.2 + b.phase) * 0.18;
      dummy.position.set(b.x, -3.1 + b.h / 2, b.z);
      dummy.scale.set(1, b.h, 1);
      dummy.rotation.set(0, 0, sway);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, COUNT]}>
      <boxGeometry args={[0.08, 1, 0.08]} />
      <meshStandardMaterial color="#5aaa40" roughness={1} />
    </instancedMesh>
  );
}

// Wandering villagers — instanced mesh
function AmbientVillagers() {
  const COUNT = 5;
  const bodyMesh = useRef();
  const headMesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const vdata = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({
    ox: -60 + i * 28,
    oz: 30 + (i % 2) * 20,
    speed: 0.28 + Math.random() * 0.22,
    phase: (i / COUNT) * Math.PI * 2,
    radius: 10 + Math.random() * 8,
  })), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    [bodyMesh, headMesh].forEach((ref, part) => {
      if (!ref.current) return;
      vdata.forEach((v, i) => {
        const angle = t * v.speed + v.phase;
        const x = v.ox + Math.cos(angle) * v.radius;
        const z = v.oz + Math.sin(angle) * v.radius;
        const y = -2.5 + (part === 0 ? 0.8 : 1.9);
        dummy.position.set(x, y, z);
        dummy.rotation.y = angle + Math.PI / 2;
        dummy.updateMatrix();
        ref.current.setMatrixAt(i, dummy.matrix);
      });
      ref.current.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <>
      <instancedMesh ref={bodyMesh} args={[null, null, COUNT]}>
        <cylinderGeometry args={[0.35, 0.5, 1.8, 8]} />
        <meshStandardMaterial color="#4a3828" />
      </instancedMesh>
      <instancedMesh ref={headMesh} args={[null, null, COUNT]}>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#e8c890" />
      </instancedMesh>
    </>
  );
}

// Falling leaves — instanced mesh
function FallingLeaves() {
  const COUNT = isMobile() ? 20 : 40;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ldata = useMemo(() => Array.from({ length: COUNT }, () => ({
    x: (Math.random() - 0.5) * 200,
    y: 5 + Math.random() * 25,
    z: (Math.random() - 0.5) * 200,
    vy: -(0.3 + Math.random() * 0.5),
    vx: (Math.random() - 0.5) * 0.3,
    phase: Math.random() * Math.PI * 2,
    rx: 0, rz: 0,
  })), [COUNT]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    ldata.forEach((l, i) => {
      l.phase += delta * 2;
      l.y += l.vy * delta * 8;
      l.x += l.vx * delta * 8 + Math.sin(l.phase) * delta * 0.8;
      l.rx += delta * 1.5;
      l.rz += delta * 1.2;
      if (l.y < -4) {
        l.y = 20 + Math.random() * 15;
        l.x = (Math.random() - 0.5) * 200;
        l.z = (Math.random() - 0.5) * 200;
      }
      dummy.position.set(l.x, l.y, l.z);
      dummy.rotation.set(l.rx, 0, l.rz);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, COUNT]}>
      <planeGeometry args={[0.4, 0.3]} />
      <meshStandardMaterial color="#c8a020" side={THREE.DoubleSide} transparent opacity={0.85} />
    </instancedMesh>
  );
}

// ── LIANGSHAN FORTRESS ──────────────────────────────────────────

function FortressBanner({ position, color = '#cc1818' }) {
  const poleRef = useRef();
  useFrame(({ clock }) => {
    if (!poleRef.current) return;
    const t = clock.getElapsedTime();
    poleRef.current.rotation.z = Math.sin(t * 1.8 + position[0] * 0.1) * 0.08;
  });
  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 8, 6]} />
        <meshStandardMaterial color="#9a7040" />
      </mesh>
      {/* Banner cloth */}
      <group ref={poleRef} position={[0, 7.5, 0]}>
        <mesh position={[0.9, 0, 0]}>
          <boxGeometry args={[1.8, 3.2, 0.08]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* 梁 character hint — dark stripe */}
        <mesh position={[0.9, 0.2, 0.05]}>
          <boxGeometry args={[0.3, 2.0, 0.05]} />
          <meshStandardMaterial color="#ffd060" />
        </mesh>
      </group>
    </group>
  );
}

function WallTower({ position, height = 14 }) {
  return (
    <group position={position}>
      {/* Tower base */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[5, height, 5]} />
        <meshStandardMaterial color="#8a7a60" roughness={0.9} />
      </mesh>
      {/* Battlement top */}
      {[-1.5, 0, 1.5].map((ox, i) => (
        <mesh key={i} position={[ox, height + 1.2, 0]}>
          <boxGeometry args={[1, 2.4, 5.2]} />
          <meshStandardMaterial color="#7a6a50" roughness={0.9} />
        </mesh>
      ))}
      {[-1.5, 0, 1.5].map((oz, i) => (
        <mesh key={`z${i}`} position={[0, height + 1.2, oz]}>
          <boxGeometry args={[5.2, 2.4, 1]} />
          <meshStandardMaterial color="#7a6a50" roughness={0.9} />
        </mesh>
      ))}
      {/* Roof */}
      <mesh position={[0, height + 3.4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[4.2, 3.5, 4]} />
        <meshStandardMaterial color="#5a2a1a" roughness={0.8} />
      </mesh>
      {/* Torch on tower */}
      <Campfire position={[0, height + 0.5, 2]} />
    </group>
  );
}

function FortressWall({ from, to, height = 10, thickness = 3 }) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const len = Math.sqrt(dx * dx + dz * dz);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[2] + to[2]) / 2;
  const angle = Math.atan2(dx, dz);
  return (
    <group position={[cx, from[1] + height / 2, cz]} rotation={[0, angle, 0]}>
      <mesh>
        <boxGeometry args={[thickness, height, len]} />
        <meshStandardMaterial color="#8a7a60" roughness={0.9} />
      </mesh>
      {/* Battlements */}
      {Array.from({ length: Math.floor(len / 4) }, (_, i) => {
        const z = -len / 2 + i * 4 + 2;
        return (
          <mesh key={i} position={[0, height / 2 + 1.2, z]}>
            <boxGeometry args={[thickness + 0.4, 2.4, 1.8]} />
            <meshStandardMaterial color="#7a6a50" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

function LiangshanFortress() {
  // Mountain sits at position (-60, 0, -80) in world space
  const MX = -60, MY = 0, MZ = -80;

  return (
    <group position={[MX, MY, MZ]}>

      {/* ── MOUNTAIN MOUND ── */}
      <mesh position={[0, 8, 0]}>
        <cylinderGeometry args={[18, 32, 22, 12]} />
        <meshStandardMaterial color="#6a7a50" roughness={1} flatShading />
      </mesh>
      {/* Rocky cap */}
      <mesh position={[0, 18, 0]}>
        <cylinderGeometry args={[10, 18, 8, 10]} />
        <meshStandardMaterial color="#7a7060" roughness={1} flatShading />
      </mesh>
      {/* Summit plateau */}
      <mesh position={[0, 22, 0]}>
        <cylinderGeometry args={[12, 12, 2, 12]} />
        <meshStandardMaterial color="#8a8070" roughness={1} />
      </mesh>
      {/* Mountain skirt trees */}
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const r = 20 + Math.sin(i * 1.7) * 5;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 5 + Math.sin(i * 0.9) * 2, Math.sin(a) * r]}>
            <coneGeometry args={[2.2, 7, 6]} />
            <meshStandardMaterial color="#3e8554" flatShading />
          </mesh>
        );
      })}

      {/* ── OUTER WALL (square perimeter on summit) ── */}
      <FortressWall from={[-10, 22, -10]} to={[10, 22, -10]} height={9} />
      <FortressWall from={[10, 22, -10]}  to={[10, 22, 10]}  height={9} />
      <FortressWall from={[10, 22, 10]}   to={[-10, 22, 10]} height={9} />
      <FortressWall from={[-10, 22, 10]}  to={[-10, 22, -10]} height={9} />

      {/* ── CORNER TOWERS ── */}
      <WallTower position={[-10, 22, -10]} height={12} />
      <WallTower position={[10,  22, -10]} height={12} />
      <WallTower position={[10,  22, 10]}  height={12} />
      <WallTower position={[-10, 22, 10]}  height={12} />

      {/* ── GATEHOUSE (south face, facing player spawn) ── */}
      {/* Gate arch pillars */}
      <mesh position={[-3, 26.5, 10]}>
        <boxGeometry args={[2.5, 9, 2.5]} />
        <meshStandardMaterial color="#7a6a50" roughness={0.9} />
      </mesh>
      <mesh position={[3, 26.5, 10]}>
        <boxGeometry args={[2.5, 9, 2.5]} />
        <meshStandardMaterial color="#7a6a50" roughness={0.9} />
      </mesh>
      {/* Gate lintel */}
      <mesh position={[0, 32, 10]}>
        <boxGeometry args={[8, 2.5, 3]} />
        <meshStandardMaterial color="#6a5a40" roughness={0.9} />
      </mesh>
      {/* Gate arch opening (dark) */}
      <mesh position={[0, 27.5, 10.1]}>
        <boxGeometry args={[5, 7, 0.5]} />
        <meshStandardMaterial color="#1a1208" />
      </mesh>
      {/* Gatehouse upper structure */}
      <mesh position={[0, 35, 10]}>
        <boxGeometry args={[10, 5, 5]} />
        <meshStandardMaterial color="#8a7a60" roughness={0.9} />
      </mesh>
      {/* Gatehouse roof */}
      <mesh position={[0, 39, 10]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[7, 4, 4]} />
        <meshStandardMaterial color="#5a2a1a" roughness={0.8} />
      </mesh>
      {/* Gate eave tips */}
      <mesh position={[-5, 37.5, 10]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.2, 0.3, 3, 5]} />
        <meshStandardMaterial color="#5a2a1a" />
      </mesh>
      <mesh position={[5, 37.5, 10]} rotation={[0, 0, 0.4]}>
        <cylinderGeometry args={[0.2, 0.3, 3, 5]} />
        <meshStandardMaterial color="#5a2a1a" />
      </mesh>

      {/* ── KEEP (central hall) ── */}
      {/* Foundation */}
      <mesh position={[0, 23, -2]}>
        <boxGeometry args={[14, 2, 10]} />
        <meshStandardMaterial color="#9a8a70" roughness={0.9} />
      </mesh>
      {/* Main hall body */}
      <mesh position={[0, 28, -2]}>
        <boxGeometry args={[12, 8, 8]} />
        <meshStandardMaterial color="#c09860" roughness={0.8} />
      </mesh>
      {/* Hall columns */}
      {[-4, 0, 4].map((x, i) => (
        <mesh key={i} position={[x, 26, 2]}>
          <cylinderGeometry args={[0.5, 0.6, 8, 8]} />
          <meshStandardMaterial color="#8a5a30" roughness={0.7} />
        </mesh>
      ))}
      {/* Hall roof lower eave */}
      <mesh position={[0, 33.5, -2]}>
        <boxGeometry args={[14, 1.5, 10]} />
        <meshStandardMaterial color="#5a2a1a" roughness={0.8} />
      </mesh>
      {/* Hall roof upper */}
      <mesh position={[0, 36.5, -2]}>
        <boxGeometry args={[11, 1.2, 7.5]} />
        <meshStandardMaterial color="#6a3a22" roughness={0.8} />
      </mesh>
      {/* Hall ridge roof */}
      <mesh position={[0, 38.5, -2]}>
        <coneGeometry args={[6.5, 4.5, 4]} />
        <meshStandardMaterial color="#4a1e10" roughness={0.8} />
      </mesh>
      {/* Ridge ornament */}
      <mesh position={[0, 41.5, -2]}>
        <sphereGeometry args={[0.8, 8, 8]} />
        <meshStandardMaterial color="#d9b36b" emissive="#c09020" emissiveIntensity={0.3} metalness={0.4} />
      </mesh>
      {/* Windows */}
      {[-3.5, 3.5].map((x, i) => (
        <mesh key={i} position={[x, 28, 2.1]}>
          <boxGeometry args={[2, 2.5, 0.3]} />
          <meshStandardMaterial color="#5a8aaa" transparent opacity={0.7} />
        </mesh>
      ))}
      {/* Hall door */}
      <mesh position={[0, 26.5, 2.1]}>
        <boxGeometry args={[2.8, 4.5, 0.3]} />
        <meshStandardMaterial color="#2a1408" />
      </mesh>

      {/* ── WATCHTOWER (tallest, back-center) ── */}
      <mesh position={[0, 23, -8]}>
        <boxGeometry args={[4, 18, 4]} />
        <meshStandardMaterial color="#7a6a50" roughness={0.9} />
      </mesh>
      {/* Watchtower platform */}
      <mesh position={[0, 41.5, -8]}>
        <boxGeometry args={[6, 1.2, 6]} />
        <meshStandardMaterial color="#6a5a40" />
      </mesh>
      {/* Watchtower battlements */}
      {[[-2,0],[ 2,0],[0,-2],[0, 2]].map(([ox,oz], i) => (
        <mesh key={i} position={[ox, 43, -8 + oz]}>
          <boxGeometry args={[1.5, 2, 1.5]} />
          <meshStandardMaterial color="#6a5a40" />
        </mesh>
      ))}
      {/* Watchtower roof */}
      <mesh position={[0, 45, -8]}>
        <coneGeometry args={[3.5, 5, 4]} />
        <meshStandardMaterial color="#3a1a0a" />
      </mesh>
      {/* Watchtower beacon fire */}
      <Campfire position={[0, 42, -8]} />

      {/* ── COURTYARD DETAILS ── */}
      {/* Stone floor */}
      <mesh position={[0, 22.8, 4]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[18, 8]} />
        <meshStandardMaterial color="#9a9080" roughness={1} />
      </mesh>
      {/* Well in courtyard */}
      <mesh position={[5, 23.5, 5]}>
        <cylinderGeometry args={[1.2, 1.4, 2, 10]} />
        <meshStandardMaterial color="#888070" roughness={1} />
      </mesh>
      <mesh position={[5, 24.8, 5]}>
        <cylinderGeometry args={[1.5, 1.5, 0.5, 10]} />
        <meshStandardMaterial color="#7a7060" roughness={1} />
      </mesh>
      {/* Courtyard tree */}
      <mesh position={[-5, 23, -1]}>
        <cylinderGeometry args={[0.4, 0.5, 4, 6]} />
        <meshStandardMaterial color="#6a4820" />
      </mesh>
      <mesh position={[-5, 27, -1]}>
        <sphereGeometry args={[3, 8, 7]} />
        <meshStandardMaterial color="#2a6838" flatShading />
      </mesh>

      {/* ── BANNERS ── */}
      <FortressBanner position={[-9, 22, 9]} color="#cc1818" />
      <FortressBanner position={[9, 22, 9]}  color="#cc1818" />
      <FortressBanner position={[-9, 22, -9]} color="#1840a0" />
      <FortressBanner position={[9, 22, -9]}  color="#1840a0" />
      <FortressBanner position={[0, 23, 10]}  color="#cc1818" />

      {/* ── PATH UP THE MOUNTAIN ── */}
      {Array.from({ length: 8 }, (_, i) => {
        const t = i / 7;
        return (
          <mesh key={i} position={[0, 2 + t * 20, 12 + t * (-22)]} rotation={[-Math.PI/2 + t * 0.4, 0, 0]}>
            <planeGeometry args={[5, 5]} />
            <meshStandardMaterial color="#c8a870" roughness={1} />
          </mesh>
        );
      })}

      {/* ── LANTERN POSTS FLANKING GATE ── */}
      {[-6, 6].map((x, i) => (
        <group key={i} position={[x, 23, 14]}>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.2, 0.25, 8, 6]} />
            <meshStandardMaterial color="#8a6030" />
          </mesh>
          <mesh position={[0, 8.5, 0]}>
            <cylinderGeometry args={[0.6, 0.6, 2.5, 8]} />
            <meshStandardMaterial color="#cc1818" emissive="#aa0808" emissiveIntensity={0.4} />
          </mesh>
          <pointLight position={[0, 8.5, 0]} color="#ff8020" intensity={1.5} distance={14} decay={2} />
        </group>
      ))}

    </group>
  );
}

// ── SUPER MOVE VFX ──────────────────────────────────────────────
function DragonStrikeVfx({ heroRef, active }) {
  const ring1 = useRef(); const ring2 = useRef(); const beam = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!active || !heroRef.current) return;
    t.current = Math.min(t.current + delta * 3, 1);
    const s = Math.sin(t.current * Math.PI);
    if (ring1.current) { ring1.current.scale.setScalar(1 + s * 5); ring1.current.material.opacity = s * 0.7; }
    if (ring2.current) { ring2.current.scale.setScalar(1 + s * 8); ring2.current.material.opacity = s * 0.4; }
    if (beam.current)  { beam.current.scale.z = s * 12; beam.current.material.opacity = s * 0.85; }
  });
  useEffect(() => { t.current = 0; }, [active]);
  if (!heroRef.current) return null;
  const p = heroRef.current.position;
  return (
    <group position={[p.x, p.y + 2, p.z]}>
      <mesh ref={ring1} rotation={[-Math.PI/2,0,0]} scale={[1,1,1]}>
        <torusGeometry args={[1.5, 0.25, 8, 32]} />
        <meshBasicMaterial color="#ff6820" transparent opacity={0} />
      </mesh>
      <mesh ref={ring2} rotation={[-Math.PI/2,0,0]} scale={[1,1,1]}>
        <torusGeometry args={[2.2, 0.12, 8, 32]} />
        <meshBasicMaterial color="#ffcc40" transparent opacity={0} />
      </mesh>
      <mesh ref={beam} position={[0,0,-1]} rotation={[Math.PI/2,0,0]} scale={[1,1,0]}>
        <cylinderGeometry args={[0.18, 0.05, 1, 8]} />
        <meshBasicMaterial color="#ff8830" transparent opacity={0} />
      </mesh>
    </group>
  );
}

function StormSweepVfx({ heroRef, active }) {
  const spiralRef = useRef(); const flashRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!active || !heroRef.current) return;
    t.current = Math.min(t.current + delta * 2.8, 1);
    const s = Math.sin(t.current * Math.PI);
    if (spiralRef.current) {
      spiralRef.current.rotation.y += delta * 18;
      spiralRef.current.scale.setScalar(1 + s * 3.5);
      spiralRef.current.material.opacity = s * 0.65;
    }
    if (flashRef.current) { flashRef.current.scale.setScalar(1 + s * 6); flashRef.current.material.opacity = s * 0.35; }
  });
  useEffect(() => { t.current = 0; }, [active]);
  if (!heroRef.current) return null;
  const p = heroRef.current.position;
  return (
    <group position={[p.x, p.y + 1.5, p.z]}>
      <mesh ref={spiralRef} rotation={[-Math.PI/2, 0, 0]}>
        <torusGeometry args={[2.5, 0.3, 6, 28, Math.PI * 1.5]} />
        <meshBasicMaterial color="#60c8ff" transparent opacity={0} />
      </mesh>
      <mesh ref={flashRef} rotation={[-Math.PI/2,0,0]}>
        <circleGeometry args={[1.5, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} />
      </mesh>
    </group>
  );
}

function ShadowBlinkVfx({ heroRef, active }) {
  const auraRef = useRef(); const trailRef = useRef();
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!active || !heroRef.current) return;
    t.current = Math.min(t.current + delta * 3.5, 1);
    const s = Math.sin(t.current * Math.PI);
    if (auraRef.current) {
      auraRef.current.scale.setScalar(0.5 + s * 4);
      auraRef.current.material.opacity = s * 0.8;
      auraRef.current.rotation.y += delta * 10;
    }
    if (trailRef.current) {
      trailRef.current.scale.y = s * 3;
      trailRef.current.material.opacity = s * 0.55;
    }
  });
  useEffect(() => { t.current = 0; }, [active]);
  if (!heroRef.current) return null;
  const p = heroRef.current.position;
  return (
    <group position={[p.x, p.y + 2, p.z]}>
      <mesh ref={auraRef}>
        <octahedronGeometry args={[1.2, 0]} />
        <meshBasicMaterial color="#a060ff" transparent opacity={0} wireframe />
      </mesh>
      <mesh ref={trailRef} position={[0, -1, 0]} scale={[1, 0, 1]}>
        <cylinderGeometry args={[0.05, 0.5, 1, 8]} />
        <meshBasicMaterial color="#d080ff" transparent opacity={0} />
      </mesh>
    </group>
  );
}

// Lock-on ring that orbits the targeted enemy
function LockOnRing({ enemies, lockedTarget }) {
  const ringRef = useRef();
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.y = clock.getElapsedTime() * 2.5;
    ringRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 1.5) * 0.3;
  });
  const target = enemies.find((e) => e.id === lockedTarget && !e.dead);
  if (!target) return null;
  return (
    <group position={[target.x, -1.5, target.z]}>
      <mesh ref={ringRef}>
        <torusGeometry args={[2.2, 0.12, 6, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[1.8, 2.0, 24]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function SceneContent({ onHeroMove, highlightedNpcId, highlightedEnemyId, heroSkin, moveInput, onNpcTap, onEnemyTap, enemies, attackFx, superFx, isSprinting, screenShake, isDodging, isCharging, chargeLevel, lockedTarget, killFlash, slowMo }) {
  const heroRef = useRef();
  const mobile = isMobile();
  const dragonActive = superFx?.type === 'dragon' && Date.now() - superFx.at < 1200;
  const stormActive  = superFx?.type === 'storm'  && Date.now() - superFx.at < 1400;
  const shadowActive = superFx?.type === 'shadow' && Date.now() - superFx.at < 1100;
  return (
    <>
      <SkyDome />
      <DayNightCycle />
      <hemisphereLight args={[0xcff6ff, 0x89c09a, 0.5]} />
      <MountainBackdrop />
      <Terrain />
      <PathRibbon />
      <TreeField />
      <SwayingGrass />
      <Clouds />
      <Birds />
      <FallingLeaves />
      {/* Campfires */}
      <Campfire position={[-18, -3.2, 10]} />
      <Campfire position={[22, -3.2, -8]} />
      <Campfire position={[-40, -3.2, -25]} />
      <Campfire position={[55, -3.2, 20]} />
      <LiangshanFortress />
      <AmbientVillagers />
      <NpcField highlightedNpcId={highlightedNpcId} onNpcTap={onNpcTap} />
      <EnemyField enemies={enemies} highlightedEnemyId={highlightedEnemyId} onEnemyTap={onEnemyTap} attackFx={attackFx} />
      <HeroAvatar heroRef={heroRef} onMove={onHeroMove} heroSkin={heroSkin} moveInput={moveInput} attackFx={attackFx} superFx={superFx} isSprinting={isSprinting} screenShake={screenShake} isDodging={isDodging} isCharging={isCharging} chargeLevel={chargeLevel} />
      {lockedTarget && <LockOnRing enemies={enemies} lockedTarget={lockedTarget} />}
      <DragonStrikeVfx heroRef={heroRef} active={dragonActive} />
      <StormSweepVfx  heroRef={heroRef} active={stormActive} />
      <ShadowBlinkVfx heroRef={heroRef} active={shadowActive} />
      <FloatingRune />
      <CameraRig target={heroRef} screenShake={screenShake} slowMo={slowMo} lockedTarget={lockedTarget} enemies={enemies} />
    </>
  );
}

export function GameCanvas({ onHeroMove, highlightedNpcId, highlightedEnemyId, heroSkin, moveInput, onNpcTap, onEnemyTap, enemies, attackFx, superFx, isSprinting, screenShake, isDodging, isCharging, chargeLevel, lockedTarget, killFlash, slowMo }) {
  const mobile = isMobile();
  return (
    <Canvas
      fallback={<div style={{width:'100%',height:'100%',background:'#0a1520',display:'flex',alignItems:'center',justifyContent:'center',color:'#d9b36b',fontFamily:'serif',fontSize:'18px'}}>Loading...</div>}
      camera={{ position: [0, 18, 42], fov: 52, near: 0.1, far: 900 }}
      gl={{ antialias: !mobile, alpha: false, powerPreference: 'high-performance' }}
      dpr={mobile ? [1, 1] : [1, 1.5]}
      shadows={false}
      onCreated={({ gl, scene }) => {
        gl.setClearColor('#7ab8e8', 1);
        scene.background = new THREE.Color('#7ab8e8');
        // Hide the HTML loading screen
        setTimeout(() => window.__hideLoading?.(), 800);
      }}
    >
      <Suspense fallback={null}>
        <SceneContent onHeroMove={onHeroMove} highlightedNpcId={highlightedNpcId} highlightedEnemyId={highlightedEnemyId} heroSkin={heroSkin} moveInput={moveInput} onNpcTap={onNpcTap} onEnemyTap={onEnemyTap} enemies={enemies} attackFx={attackFx} superFx={superFx} isSprinting={isSprinting} screenShake={screenShake} isDodging={isDodging} isCharging={isCharging} chargeLevel={chargeLevel} lockedTarget={lockedTarget} killFlash={killFlash} slowMo={slowMo} />
      </Suspense>
    </Canvas>
  );
}
