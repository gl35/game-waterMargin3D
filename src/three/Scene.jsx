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
  minX: -220,
  maxX: 220,
  minZ: -220,
  maxZ: 260,
};

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1200, 1200, 280, 280);
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
      <planeGeometry args={[80, 760]} />
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
  const treeCount = 860;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!mesh.current) return;
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const radius = 110 + Math.random() * 280;
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

  return (
    <instancedMesh ref={mesh} args={[null, null, treeCount]} castShadow receiveShadow>
      <coneGeometry args={[2.8, 8, 6]} />
      <meshStandardMaterial color="#3e8554" flatShading />
    </instancedMesh>
  );
}

function NpcField({ highlightedNpcId, onNpcTap }) {
  const handleNpcTap = (npcId) => (event) => {
    event.stopPropagation();
    onNpcTap?.(npcId);
  };

  return (
    <group>
      {NPCS.map((npc) => {
        const { x, z } = tileToWorldPosition(npc);
        const glow = npc.id === highlightedNpcId;
        return (
          <group key={npc.id} position={[x, -2.4, z]}>
            <mesh castShadow onPointerDown={handleNpcTap(npc.id)}>
              <cylinderGeometry args={[0.85, 0.95, 3.4, 10]} />
              <meshStandardMaterial color={glow ? '#ffe28a' : '#4f4a63'} />
            </mesh>
            <mesh position={[0, 2.1, 0]} onPointerDown={handleNpcTap(npc.id)}>
              <sphereGeometry args={[0.9, 16, 16]} />
              <meshStandardMaterial color={glow ? '#fff1cf' : '#f2cfa6'} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function EnemyField({ enemies = [], highlightedEnemyId, onEnemyTap }) {
  const handleEnemyTap = (enemyId) => (event) => {
    event.stopPropagation();
    onEnemyTap?.(enemyId);
  };

  return (
    <group>
      {enemies.filter((enemy) => !enemy.dead).map((enemy) => {
        const glow = enemy.id === highlightedEnemyId;
        return (
          <group key={enemy.id} position={[enemy.x, -2.3, enemy.z]}>
            <mesh castShadow onPointerDown={handleEnemyTap(enemy.id)}>
              <cylinderGeometry args={[0.95, 1.05, 3.6, 10]} />
              <meshStandardMaterial color={glow ? '#ff9f66' : '#7a1f1f'} emissive={glow ? '#ff8c52' : '#000'} emissiveIntensity={glow ? 0.5 : 0} />
            </mesh>
            <mesh position={[0, 2.1, 0]} onPointerDown={handleEnemyTap(enemy.id)}>
              <sphereGeometry args={[0.95, 16, 16]} />
              <meshStandardMaterial color={glow ? '#ffd3bf' : '#d26d54'} />
            </mesh>
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
      {/* Inner tunic */}
      <mesh castShadow position={[0, 1, 0]}>
        <cylinderGeometry args={[1.3, 1.1, 4.2, 12]} />
        <meshStandardMaterial color={palette.tunic} />
      </mesh>

      {/* Cloak / shirt */}
      <mesh castShadow position={[0, 2.5, -0.1]}>
        <planeGeometry args={[7, 9, 16, 16]} />
        <meshStandardMaterial color={palette.cloak} roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 4.4, 0]} castShadow>
        <sphereGeometry args={[1.05, 16, 16]} />
        <meshStandardMaterial color="#f2c9a7" />
      </mesh>

      {/* Hat brim */}
      <mesh position={[0, 5, -0.3]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[2.8, 2.8, 0.35, 32]} />
        <meshStandardMaterial color={palette.hatBrim} />
      </mesh>

      {/* Hat crown */}
      <mesh position={[0, 5.8, -0.3]} rotation={[0.1, 0, 0]}>
        <coneGeometry args={[1.9, 2.6, 24]} />
        <meshStandardMaterial color={palette.hatCrown} />
      </mesh>

      {/* Sash / headband */}
      <mesh position={[0, 2.2, 0]}>
        <torusGeometry args={[1.6, 0.25, 12, 32]} />
        <meshStandardMaterial color={palette.headband} />
      </mesh>

      {/* Spear */}
      <mesh position={[0.4, 4.2, -0.8]} rotation={[Math.PI / 10, -Math.PI / 4, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 16, 12]} />
        <meshStandardMaterial color="#d8d0c0" />
      </mesh>
      <mesh position={[7.4, 7.4, -3.4]} rotation={[Math.PI / 10, -Math.PI / 4, Math.PI / 2]}>
        <coneGeometry args={[0.45, 1.8, 8]} />
        <meshStandardMaterial color={palette.spearTip} />
      </mesh>

      {/* Tassel */}
      <mesh position={[-6.6, 6.1, 1]}>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshStandardMaterial color={palette.tasselTop} emissive={palette.tasselTop} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-5.4, 6.5, 1]}>
        <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
        <meshStandardMaterial color={palette.tasselCord} />
      </mesh>
      <mesh position={[-4.2, 7.5, 1]}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshStandardMaterial color={palette.tasselBottom} />
      </mesh>

      {accessories.lei && (
        <mesh position={[0, 3.3, 0]}>
          <torusGeometry args={[1.8, 0.35, 12, 24]} />
          <meshStandardMaterial color="#ff7eb9" emissive="#ff9bcf" emissiveIntensity={0.35} />
        </mesh>
      )}

      {accessories.sunglasses && (
        <>
          <mesh position={[0, 4.4, 0.9]}>
            <boxGeometry args={[2.4, 0.55, 0.25]} />
            <meshStandardMaterial color="#111" metalness={0.2} roughness={0.2} />
          </mesh>
          <mesh position={[0, 4.4, 0.9]}>
            <torusGeometry args={[1.5, 0.04, 8, 24]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </>
      )}

      {flowerOffsets.map((flower) => (
        <mesh key={flower.key} position={[flower.position[0], flower.position[1], flower.position[2]]}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color={flower.color} />
        </mesh>
      ))}
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

function Lights() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[40, 80, 20]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight args={[0xcff6ff, 0x89c09a, 0.6]} />
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

function SceneContent({ onHeroMove, highlightedNpcId, highlightedEnemyId, heroSkin, moveInput, onNpcTap, onEnemyTap, enemies }) {
  const heroRef = useRef();
  return (
    <>
      <primitive attach="fog" object={new THREE.Fog(0xb8e4ff, 90, 430)} />
      <SkyDome />
      <Lights />
      <MountainBackdrop />
      <Terrain />
      <PathRibbon />
      <TreeField />
      <NpcField highlightedNpcId={highlightedNpcId} onNpcTap={onNpcTap} />
      <EnemyField enemies={enemies} highlightedEnemyId={highlightedEnemyId} onEnemyTap={onEnemyTap} />
      <HeroAvatar heroRef={heroRef} onMove={onHeroMove} heroSkin={heroSkin} moveInput={moveInput} />
      <FloatingRune />
      <CameraRig target={heroRef} />
    </>
  );
}

export function GameCanvas({ onHeroMove, highlightedNpcId, highlightedEnemyId, heroSkin, moveInput, onNpcTap, onEnemyTap, enemies }) {
  return (
    <Canvas
      camera={{ position: [0, 18, 42], fov: 52, near: 0.1, far: 900 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      shadows
      onCreated={({ gl, scene }) => {
        gl.setClearColor('#7eb6e8', 1);
        scene.background = new THREE.Color('#7eb6e8');
      }}
    >
      <Suspense fallback={null}>
        <SceneContent onHeroMove={onHeroMove} highlightedNpcId={highlightedNpcId} highlightedEnemyId={highlightedEnemyId} heroSkin={heroSkin} moveInput={moveInput} onNpcTap={onNpcTap} onEnemyTap={onEnemyTap} enemies={enemies} />
      </Suspense>
    </Canvas>
  );
}
