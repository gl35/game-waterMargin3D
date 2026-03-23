import { Suspense, useEffect, useMemo, useRef } from 'react';
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

function EnemySoldier({ glow, hitFlash, onClick }) {
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

function HeroAvatar({ heroRef, onMove, heroSkin, moveInput }) {
  const group = heroRef || useRef();
  const controls = useMovementControls();
  const velocity = useRef(new THREE.Vector3());
  const moveCallback = useRef(onMove);
  const palette = heroSkin?.colors || DEFAULT_COLORS;
  const accessories = heroSkin?.accessories || {};
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
  useEffect(() => {
    moveCallback.current = onMove;
  }, [onMove]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const input = moveInput || {};
    const dir = new THREE.Vector3(
      (controls.current.left || input.left ? -1 : 0) + (controls.current.right || input.right ? 1 : 0),
      0,
      (controls.current.forward || input.forward ? -1 : 0) + (controls.current.backward || input.backward ? 1 : 0),
    );
    if (dir.lengthSq() > 0) {
      dir.normalize();
      velocity.current.lerp(dir.multiplyScalar(18), 0.2);
      group.current.rotation.y = Math.atan2(dir.x, -dir.z);
    } else {
      velocity.current.lerp(new THREE.Vector3(), 0.15);
    }

    group.current.position.addScaledVector(velocity.current, delta);
    group.current.position.x = THREE.MathUtils.clamp(group.current.position.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
    group.current.position.z = THREE.MathUtils.clamp(group.current.position.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);

    group.current.position.y = -0.6 + Math.sin(state.clock.getElapsedTime() * 2 + group.current.position.x * 0.2) * 0.1;

    moveCallback.current?.({
      x: group.current.position.x,
      y: group.current.position.y,
      z: group.current.position.z,
    });
  });

  return (
    <group ref={group} position={[0, 0, 12]}>

      {/* ── LEGS ── */}
      <mesh castShadow position={[-0.38, 0.55, 0]}>
        <cylinderGeometry args={[0.28, 0.33, 1.2, 10]} />
        <meshStandardMaterial color={palette.tunic} />
      </mesh>
      <mesh castShadow position={[0.38, 0.55, 0]}>
        <cylinderGeometry args={[0.28, 0.33, 1.2, 10]} />
        <meshStandardMaterial color={palette.tunic} />
      </mesh>
      {/* Boots */}
      <mesh castShadow position={[-0.38, 0.0, 0.08]}>
        <boxGeometry args={[0.5, 0.28, 0.72]} />
        <meshStandardMaterial color="#2a2040" />
      </mesh>
      <mesh castShadow position={[0.38, 0.0, 0.08]}>
        <boxGeometry args={[0.5, 0.28, 0.72]} />
        <meshStandardMaterial color="#2a2040" />
      </mesh>

      {/* ── LOWER ROBE (flared) ── */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.72, 0.92, 1.3, 14]} />
        <meshStandardMaterial color={palette.cloak} roughness={0.85} />
      </mesh>

      {/* ── UPPER TORSO ── */}
      <mesh castShadow position={[0, 2.25, 0]}>
        <cylinderGeometry args={[0.60, 0.72, 1.65, 12]} />
        <meshStandardMaterial color={palette.cloak} roughness={0.85} />
      </mesh>

      {/* Chest collar detail */}
      <mesh castShadow position={[0, 2.85, 0.45]}>
        <boxGeometry args={[0.9, 0.6, 0.12]} />
        <meshStandardMaterial color={palette.tunic} />
      </mesh>

      {/* ── SASH / BELT ── */}
      <mesh position={[0, 1.55, 0]}>
        <torusGeometry args={[0.78, 0.1, 8, 24]} />
        <meshStandardMaterial color={palette.headband} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* ── ARMS ── */}
      {/* Left arm (holding spear side) */}
      <mesh castShadow position={[-0.95, 2.1, 0]} rotation={[0, 0, 0.32]}>
        <cylinderGeometry args={[0.21, 0.26, 1.55, 8]} />
        <meshStandardMaterial color={palette.cloak} roughness={0.85} />
      </mesh>
      {/* Left hand */}
      <mesh castShadow position={[-1.45, 1.35, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#f2c9a0" />
      </mesh>
      {/* Right arm (raised) */}
      <mesh castShadow position={[0.92, 2.3, -0.2]} rotation={[-0.5, 0, -0.25]}>
        <cylinderGeometry args={[0.21, 0.26, 1.55, 8]} />
        <meshStandardMaterial color={palette.cloak} roughness={0.85} />
      </mesh>
      {/* Right hand */}
      <mesh castShadow position={[1.1, 3.1, -0.85]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#f2c9a0" />
      </mesh>

      {/* ── NECK ── */}
      <mesh castShadow position={[0, 3.22, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.42, 8]} />
        <meshStandardMaterial color="#f2c9a0" />
      </mesh>

      {/* ── HEAD ── */}
      <mesh castShadow position={[0, 3.85, 0]}>
        <sphereGeometry args={[0.72, 14, 14]} />
        <meshStandardMaterial color="#f2c9a0" />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.24, 3.92, 0.62]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#1a1030" />
      </mesh>
      <mesh position={[0.24, 3.92, 0.62]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color="#1a1030" />
      </mesh>

      {/* ── HAT BRIM ── */}
      <mesh castShadow position={[0, 4.46, -0.18]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.18, 28]} />
        <meshStandardMaterial color={palette.hatBrim} />
      </mesh>
      {/* Hat crown (cone) */}
      <mesh castShadow position={[0, 5.18, -0.18]} rotation={[0.1, 0, 0]}>
        <coneGeometry args={[1.05, 1.85, 20]} />
        <meshStandardMaterial color={palette.hatCrown} />
      </mesh>

      {/* ── SPEAR SHAFT ── */}
      <mesh castShadow position={[0.6, 3.0, -0.5]} rotation={[-0.48, 0.18, 0.12]}>
        <cylinderGeometry args={[0.07, 0.07, 7.5, 8]} />
        <meshStandardMaterial color="#c8c0a8" metalness={0.15} roughness={0.7} />
      </mesh>
      {/* Spear tip */}
      <mesh position={[0.75, 6.6, -2.55]} rotation={[-0.48, 0.18, 0.12]}>
        <coneGeometry args={[0.2, 0.9, 6]} />
        <meshStandardMaterial color={palette.spearTip} metalness={0.6} roughness={0.2} />
      </mesh>
      {/* Tassel knot */}
      <mesh position={[0.45, 1.5, 0.3]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color={palette.tasselTop} emissive={palette.tasselTop} emissiveIntensity={0.3} />
      </mesh>
      {/* Tassel cord */}
      <mesh position={[0.45, 1.1, 0.3]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
        <meshStandardMaterial color={palette.tasselCord} />
      </mesh>
      {/* Tassel bottom */}
      <mesh position={[0.45, 0.7, 0.3]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color={palette.tasselBottom} />
      </mesh>

      {accessories.lei && (
        <mesh position={[0, 2.6, 0]}>
          <torusGeometry args={[1.1, 0.22, 10, 22]} />
          <meshStandardMaterial color="#ff7eb9" emissive="#ff9bcf" emissiveIntensity={0.35} />
        </mesh>
      )}

      {accessories.sunglasses && (
        <>
          <mesh position={[0, 3.88, 0.68]}>
            <boxGeometry args={[1.3, 0.35, 0.12]} />
            <meshStandardMaterial color="#111" metalness={0.4} roughness={0.2} />
          </mesh>
        </>
      )}

      {flowerOffsets.map((flower) => (
        <mesh key={flower.key} position={[flower.position[0] * 0.55, flower.position[1] * 0.55, flower.position[2]]}>
          <sphereGeometry args={[0.14, 6, 6]} />
          <meshStandardMaterial color={flower.color} />
        </mesh>
      ))}

      {/* Ground shadow disc */}
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

function CameraRig({ target }) {
  const { camera } = useThree();
  const offset = useMemo(() => new THREE.Vector3(0, 16, 34), []);
  useFrame((state, delta) => {
    if (!target.current) return;
    const desired = target.current.position.clone().add(offset);
    camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    const lookAt = target.current.position.clone();
    lookAt.y += 3;
    camera.lookAt(lookAt);
  });
  return null;
}

function SceneContent({ onHeroMove, highlightedNpcId, highlightedEnemyId, heroSkin, moveInput, onNpcTap, onEnemyTap, enemies, attackFx }) {
  const heroRef = useRef();
  const mobile = isMobile();
  return (
    <>
      <primitive attach="fog" object={new THREE.Fog(0xb8e4ff, mobile ? 70 : 90, mobile ? 320 : 430)} />
      <SkyDome />
      <Lights mobile={mobile} />
      <MountainBackdrop />
      <Terrain />
      <PathRibbon />
      <TreeField />
      <NpcField highlightedNpcId={highlightedNpcId} onNpcTap={onNpcTap} />
      <EnemyField enemies={enemies} highlightedEnemyId={highlightedEnemyId} onEnemyTap={onEnemyTap} attackFx={attackFx} />
      <HeroAvatar heroRef={heroRef} onMove={onHeroMove} heroSkin={heroSkin} moveInput={moveInput} />
      <FloatingRune />
      <CameraRig target={heroRef} />
    </>
  );
}

export function GameCanvas({ onHeroMove, highlightedNpcId, highlightedEnemyId, heroSkin, moveInput, onNpcTap, onEnemyTap, enemies, attackFx }) {
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
        <SceneContent onHeroMove={onHeroMove} highlightedNpcId={highlightedNpcId} highlightedEnemyId={highlightedEnemyId} heroSkin={heroSkin} moveInput={moveInput} onNpcTap={onNpcTap} onEnemyTap={onEnemyTap} enemies={enemies} attackFx={attackFx} />
      </Suspense>
    </Canvas>
  );
}
