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

function HeroAvatar({ heroRef, onMove, heroSkin, moveInput, attackFx, superFx, isSprinting, screenShake }) {
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

function CameraRig({ target, screenShake }) {
  const { camera } = useThree();
  const offset = useMemo(() => new THREE.Vector3(0, 16, 34), []);
  const shakeRef = useRef(0);
  useEffect(() => { if (screenShake) shakeRef.current = 0.35; }, [screenShake]);
  useFrame((state, delta) => {
    if (!target.current) return;
    const desired = target.current.position.clone().add(offset);
    camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    const lookAt = target.current.position.clone();
    lookAt.y += 3;
    camera.lookAt(lookAt);
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

// Day/night cycle — drives sky colour, fog, ambient + sun intensity
function DayNightCycle() {
  const { scene } = useThree();
  const ambientRef  = useRef();
  const sunRef      = useRef();
  const fogRef      = useRef(new THREE.Fog(0xb8e4ff, 90, 430));

  useEffect(() => { scene.fog = fogRef.current; }, [scene]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // 120-second full day cycle
    const cycle = (t % 120) / 120;              // 0-1
    const sunAngle = cycle * Math.PI * 2 - Math.PI / 2;
    const sun = Math.sin(sunAngle);             // -1=midnight, 1=noon
    const day = THREE.MathUtils.smoothstep(sun, -0.15, 0.35);  // 0=night, 1=day

    // Sky/fog colour
    const skyDay   = new THREE.Color('#7ab8e8');
    const skyDusk  = new THREE.Color('#e08050');
    const skyNight = new THREE.Color('#0a0e1a');
    const isDusk   = Math.abs(sun) < 0.3;
    const skyCol   = isDusk
      ? skyDusk.lerp(day > 0.5 ? skyDay : skyNight, Math.abs(sun) / 0.3)
      : (day > 0.5 ? skyDay : skyNight);
    if (scene.background) scene.background.set(skyCol);
    if (fogRef.current) {
      fogRef.current.color.set(skyCol);
      fogRef.current.far = 300 + day * 130;
    }

    if (ambientRef.current) ambientRef.current.intensity = 0.2 + day * 0.55;
    if (sunRef.current) {
      sunRef.current.intensity = 0.4 + day * 1.1;
      // Sun arc
      const r = 280;
      sunRef.current.position.set(Math.cos(sunAngle) * r, Math.sin(sunAngle) * r, 60);
      // Warm at sunrise/sunset, white at noon, blue at night
      const c = isDusk ? new THREE.Color('#ffaa60') : day > 0.5 ? new THREE.Color('#fff8e8') : new THREE.Color('#4060a0');
      sunRef.current.color.set(c);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.65} />
      <directionalLight ref={sunRef} castShadow intensity={1.5} shadow-mapSize-width={1024} shadow-mapSize-height={1024} position={[40, 80, 20]} />
    </>
  );
}

// Animated clouds drifting across the sky
function Clouds() {
  const clouds = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 500,
    y: 60 + Math.random() * 40,
    z: -80 - Math.random() * 160,
    sx: 1.2 + Math.random() * 1.4,
    sy: 0.5 + Math.random() * 0.5,
    sz: 1.0 + Math.random() * 0.8,
    speed: 2 + Math.random() * 3,
    rot: Math.random() * Math.PI,
  })), []);

  const refs = useRef(clouds.map(() => ({ current: null })));

  useFrame((_, delta) => {
    refs.current.forEach((r, i) => {
      if (!r.current) return;
      r.current.position.x += clouds[i].speed * delta;
      if (r.current.position.x > 300) r.current.position.x = -300;
    });
  });

  return (
    <group>
      {clouds.map((c, i) => (
        <mesh
          key={c.id}
          ref={(el) => { refs.current[i] = { current: el }; }}
          position={[c.x, c.y, c.z]}
          rotation={[0, c.rot, 0]}
          scale={[c.sx, c.sy, c.sz]}
        >
          <sphereGeometry args={[14, 7, 5]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.72} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

// Birds flying in formation
function Birds() {
  const flock = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    id: i,
    offset: new THREE.Vector3((i - 4) * 6 + Math.random() * 3, Math.random() * 4, i * 3),
    phase: Math.random() * Math.PI * 2,
  })), []);

  const groupRef = useRef();
  const wingRefs = useRef(flock.map(() => ({ l: null, r: null })));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(t * 0.08) * 180;
      groupRef.current.position.z = -80 + Math.sin(t * 0.05) * 60;
      groupRef.current.position.y = 45 + Math.sin(t * 0.12) * 8;
      groupRef.current.rotation.y = Math.atan2(Math.cos(t * 0.08) * 180 * 0.08, 1);
    }
    wingRefs.current.forEach((w, i) => {
      const flap = Math.sin(t * 4 + flock[i].phase) * 0.6;
      if (w.l) w.l.rotation.z =  0.3 + flap;
      if (w.r) w.r.rotation.z = -0.3 - flap;
    });
  });

  return (
    <group ref={groupRef} position={[0, 45, -80]}>
      {flock.map((bird, i) => (
        <group key={bird.id} position={[bird.offset.x, bird.offset.y, bird.offset.z]}>
          {/* Body */}
          <mesh>
            <sphereGeometry args={[0.4, 6, 4]} />
            <meshStandardMaterial color="#1a1010" />
          </mesh>
          {/* Left wing */}
          <mesh ref={(el) => { wingRefs.current[i].l = el; }} position={[-0.8, 0, 0]}>
            <boxGeometry args={[1.4, 0.1, 0.5]} />
            <meshStandardMaterial color="#1a1010" />
          </mesh>
          {/* Right wing */}
          <mesh ref={(el) => { wingRefs.current[i].r = el; }} position={[0.8, 0, 0]}>
            <boxGeometry args={[1.4, 0.1, 0.5]} />
            <meshStandardMaterial color="#1a1010" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Campfire with flickering pointlight + animated flame cone
function Campfire({ position }) {
  const flameRef  = useRef();
  const lightRef  = useRef();
  const emberRefs = useRef(Array.from({ length: 6 }, () => null));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (flameRef.current) {
      flameRef.current.scale.y = 1 + Math.sin(t * 7 + position[0]) * 0.25;
      flameRef.current.scale.x = 1 + Math.sin(t * 5 + 1) * 0.12;
      flameRef.current.position.y = 1.1 + Math.sin(t * 9) * 0.06;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.5 + Math.sin(t * 6 + position[2]) * 1.2 + Math.sin(t * 13) * 0.4;
    }
    emberRefs.current.forEach((e, i) => {
      if (!e) return;
      const et = t * (0.8 + i * 0.15) + i * 1.1;
      e.position.x = Math.sin(et * 2.2) * 0.4;
      e.position.y = 1.5 + (et % 2) * 1.2;
      e.position.z = Math.cos(et * 1.8) * 0.4;
      e.material.opacity = Math.max(0, 1 - (et % 2) * 0.6);
    });
  });

  return (
    <group position={position}>
      {/* Logs */}
      <mesh rotation={[0, 0.6, Math.PI / 2]} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 1.6, 6]} />
        <meshStandardMaterial color="#5a3010" roughness={1} />
      </mesh>
      <mesh rotation={[0, -0.6, Math.PI / 2]} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 1.6, 6]} />
        <meshStandardMaterial color="#4a2808" roughness={1} />
      </mesh>
      {/* Stone ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.6, 0.9, 10]} />
        <meshStandardMaterial color="#606060" roughness={0.9} />
      </mesh>
      {/* Flame */}
      <mesh ref={flameRef} position={[0, 1.1, 0]}>
        <coneGeometry args={[0.35, 1.1, 8]} />
        <meshStandardMaterial color="#ff6010" emissive="#ff4400" emissiveIntensity={1.4} transparent opacity={0.82} />
      </mesh>
      {/* Inner flame */}
      <mesh position={[0, 1.0, 0]}>
        <coneGeometry args={[0.18, 0.7, 6]} />
        <meshStandardMaterial color="#ffdd40" emissive="#ffaa00" emissiveIntensity={2} transparent opacity={0.7} />
      </mesh>
      {/* Embers */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(el) => { emberRefs.current[i] = el; }} position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.06, 4, 4]} />
          <meshStandardMaterial color="#ff8800" emissive="#ff4400" emissiveIntensity={2} transparent opacity={0.9} />
        </mesh>
      ))}
      {/* Point light */}
      <pointLight ref={lightRef} color="#ff6010" intensity={2.5} distance={22} decay={2} />
    </group>
  );
}

// Swaying grass patch
function SwayingGrass() {
  const blades = useMemo(() => Array.from({ length: 120 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    z: (Math.random() - 0.5) * 200,
    h: 0.6 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
  })), []);

  const refs = useRef(blades.map(() => null));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((r, i) => {
      if (!r) return;
      r.rotation.z = Math.sin(t * 1.2 + blades[i].phase) * 0.18;
    });
  });

  return (
    <group>
      {blades.map((b, i) => (
        <mesh
          key={b.id}
          ref={(el) => { refs.current[i] = el; }}
          position={[b.x, -3.1, b.z]}
        >
          <boxGeometry args={[0.08, b.h, 0.08]} />
          <meshStandardMaterial color="#5aaa40" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// Wandering ambient villagers (non-interactive)
function AmbientVillagers() {
  const villagers = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    id: i,
    x: -60 + i * 28,
    z: 30 + (i % 2) * 20,
    speed: 1.5 + Math.random() * 1.5,
    phase: (i / 5) * Math.PI * 2,
    radius: 10 + Math.random() * 8,
    color: ['#4a3828', '#382820', '#503830', '#3a2818', '#483020'][i],
  })), []);

  const refs = useRef(villagers.map(() => null));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((r, i) => {
      if (!r) return;
      const v = villagers[i];
      const angle = t * v.speed * 0.2 + v.phase;
      r.position.x = v.x + Math.cos(angle) * v.radius;
      r.position.z = v.z + Math.sin(angle) * v.radius;
      r.rotation.y = angle + Math.PI / 2;
    });
  });

  return (
    <group>
      {villagers.map((v, i) => (
        <group key={v.id} ref={(el) => { refs.current[i] = el; }} position={[v.x, -2.5, v.z]}>
          {/* Simple robed figure */}
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.35, 0.5, 1.8, 8]} />
            <meshStandardMaterial color={v.color} />
          </mesh>
          <mesh position={[0, 1.9, 0]}>
            <sphereGeometry args={[0.42, 8, 8]} />
            <meshStandardMaterial color="#e8c890" />
          </mesh>
          <mesh position={[0, 2.22, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.1, 14]} />
            <meshStandardMaterial color="#6a4820" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Falling leaves particle system
function FallingLeaves() {
  const COUNT = 40;
  const leaves = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    y: 5 + Math.random() * 25,
    z: (Math.random() - 0.5) * 200,
    vy: -(0.3 + Math.random() * 0.5),
    vx: (Math.random() - 0.5) * 0.3,
    phase: Math.random() * Math.PI * 2,
    color: ['#c8a020', '#d06018', '#e87020', '#90b830', '#b84818'][Math.floor(Math.random() * 5)],
  })), []);

  const refs = useRef(leaves.map(() => null));

  useFrame((_, delta) => {
    refs.current.forEach((r, i) => {
      if (!r) return;
      const l = leaves[i];
      l.phase += delta * 2;
      r.position.y += l.vy * delta * 8;
      r.position.x += l.vx * delta * 8 + Math.sin(l.phase) * delta * 0.8;
      r.rotation.x += delta * 1.5;
      r.rotation.z += delta * 1.2;
      if (r.position.y < -4) {
        r.position.y = 20 + Math.random() * 15;
        r.position.x = (Math.random() - 0.5) * 200;
        r.position.z = (Math.random() - 0.5) * 200;
      }
    });
  });

  return (
    <group>
      {leaves.map((l, i) => (
        <mesh key={l.id} ref={(el) => { refs.current[i] = el; }} position={[l.x, l.y, l.z]}>
          <planeGeometry args={[0.4, 0.3]} />
          <meshStandardMaterial color={l.color} side={THREE.DoubleSide} transparent opacity={0.85} />
        </mesh>
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

function SceneContent({ onHeroMove, highlightedNpcId, highlightedEnemyId, heroSkin, moveInput, onNpcTap, onEnemyTap, enemies, attackFx, superFx, isSprinting, screenShake }) {
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
      <AmbientVillagers />
      <NpcField highlightedNpcId={highlightedNpcId} onNpcTap={onNpcTap} />
      <EnemyField enemies={enemies} highlightedEnemyId={highlightedEnemyId} onEnemyTap={onEnemyTap} attackFx={attackFx} />
      <HeroAvatar heroRef={heroRef} onMove={onHeroMove} heroSkin={heroSkin} moveInput={moveInput} attackFx={attackFx} superFx={superFx} isSprinting={isSprinting} screenShake={screenShake} />
      <DragonStrikeVfx heroRef={heroRef} active={dragonActive} />
      <StormSweepVfx  heroRef={heroRef} active={stormActive} />
      <ShadowBlinkVfx heroRef={heroRef} active={shadowActive} />
      <FloatingRune />
      <CameraRig target={heroRef} screenShake={screenShake} />
    </>
  );
}

export function GameCanvas({ onHeroMove, highlightedNpcId, highlightedEnemyId, heroSkin, moveInput, onNpcTap, onEnemyTap, enemies, attackFx, superFx, isSprinting, screenShake }) {
  const mobile = isMobile();
  return (
    <Canvas
      camera={{ position: [0, 18, 42], fov: 52, near: 0.1, far: 900 }}
      gl={{ antialias: !mobile, alpha: false, powerPreference: 'high-performance' }}
      dpr={mobile ? [1, 1.25] : [1, 1.75]}
      shadows={!mobile}
      onCreated={({ gl, scene }) => {
        gl.setClearColor('#7eb6e8', 1);
        scene.background = new THREE.Color('#7eb6e8');
      }}
    >
      <Suspense fallback={null}>
        <SceneContent onHeroMove={onHeroMove} highlightedNpcId={highlightedNpcId} highlightedEnemyId={highlightedEnemyId} heroSkin={heroSkin} moveInput={moveInput} onNpcTap={onNpcTap} onEnemyTap={onEnemyTap} enemies={enemies} attackFx={attackFx} superFx={superFx} isSprinting={isSprinting} screenShake={screenShake} />
      </Suspense>
    </Canvas>
  );
}
