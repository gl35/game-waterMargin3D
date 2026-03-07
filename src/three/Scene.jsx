import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { NPCS } from '../core/story/config';
import { tileToWorldPosition } from '../core/story/coordinates';

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(220, 220, 140, 140);
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
      <planeGeometry args={[34, 140]} />
      <meshStandardMaterial color="#f7d39f" roughness={0.7} metalness={0} />
    </mesh>
  );
}

function MountainBackdrop() {
  const geometry = useMemo(() => new THREE.PlaneGeometry(400, 140, 40, 10), []);
  return (
    <group position={[0, 35, -90]}>
      {[0, 1, -1].map((offset, idx) => (
        <mesh key={`mountain-${idx}`} geometry={geometry} position={[offset * 14, idx * 10, idx * -6]}>
          <meshBasicMaterial color={idx === 0 ? '#cfe9ff' : '#a7cfe8'} transparent opacity={0.8 - idx * 0.15} />
        </mesh>
      ))}
    </group>
  );
}

function TreeField() {
  const treeCount = 250;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!mesh.current) return;
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const radius = 25 + Math.random() * 60;
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

function NpcField({ highlightedNpcId }) {
  return (
    <group>
      {NPCS.map((npc) => {
        const { x, z } = tileToWorldPosition(npc);
        const glow = npc.id === highlightedNpcId;
        return (
          <group key={npc.id} position={[x, -2.4, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.85, 0.95, 3.4, 10]} />
              <meshStandardMaterial color={glow ? '#ffe28a' : '#4f4a63'} />
            </mesh>
            <mesh position={[0, 2.1, 0]}>
              <sphereGeometry args={[0.9, 16, 16]} />
              <meshStandardMaterial color={glow ? '#fff1cf' : '#f2cfa6'} />
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

function HeroAvatar({ heroRef, onMove }) {
  const group = heroRef || useRef();
  const controls = useMovementControls();
  const velocity = useRef(new THREE.Vector3());
  const moveCallback = useRef(onMove);
  useEffect(() => {
    moveCallback.current = onMove;
  }, [onMove]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const dir = new THREE.Vector3(
      (controls.current.left ? -1 : 0) + (controls.current.right ? 1 : 0),
      0,
      (controls.current.forward ? -1 : 0) + (controls.current.backward ? 1 : 0),
    );
    if (dir.lengthSq() > 0) {
      dir.normalize();
      velocity.current.lerp(dir.multiplyScalar(18), 0.2);
      group.current.rotation.y = Math.atan2(dir.x, -dir.z);
    } else {
      velocity.current.lerp(new THREE.Vector3(), 0.15);
    }

    group.current.position.addScaledVector(velocity.current, delta);
    group.current.position.x = THREE.MathUtils.clamp(group.current.position.x, -28, 28);
    group.current.position.z = THREE.MathUtils.clamp(group.current.position.z, -12, 35);

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
        <meshStandardMaterial color="#33233a" />
      </mesh>

      {/* Cloak */}
      <mesh castShadow position={[0, 2.5, -0.1]}>
        <planeGeometry args={[7, 9, 16, 16]} />
        <meshStandardMaterial color="#f5f4ff" roughness={0.9} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 4.4, 0]} castShadow>
        <sphereGeometry args={[1.05, 16, 16]} />
        <meshStandardMaterial color="#f2c9a7" />
      </mesh>

      {/* Hat brim */}
      <mesh position={[0, 5, -0.3]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[2.8, 2.8, 0.35, 32]} />
        <meshStandardMaterial color="#8b6240" />
      </mesh>

      {/* Hat crown */}
      <mesh position={[0, 5.8, -0.3]} rotation={[0.1, 0, 0]}>
        <coneGeometry args={[1.9, 2.6, 24]} />
        <meshStandardMaterial color="#9f7c55" />
      </mesh>

      {/* Sash */}
      <mesh position={[0, 2.2, 0]}>
        <torusGeometry args={[1.6, 0.25, 12, 32]} />
        <meshStandardMaterial color="#6f3bb5" />
      </mesh>

      {/* Spear */}
      <mesh position={[0.4, 4.2, -0.8]} rotation={[Math.PI / 10, -Math.PI / 4, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 16, 12]} />
        <meshStandardMaterial color="#d8d0c0" />
      </mesh>
      <mesh position={[7.4, 7.4, -3.4]} rotation={[Math.PI / 10, -Math.PI / 4, Math.PI / 2]}>
        <coneGeometry args={[0.45, 1.8, 8]} />
        <meshStandardMaterial color="#f7d99a" />
      </mesh>

      {/* Tassel */}
      <mesh position={[-6.6, 6.1, 1]}>
        <sphereGeometry args={[0.7, 12, 12]} />
        <meshStandardMaterial color="#df8f3c" emissive="#d86a28" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-5.4, 6.5, 1]}>
        <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
        <meshStandardMaterial color="#f04573" />
      </mesh>
      <mesh position={[-4.2, 7.5, 1]}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshStandardMaterial color="#f4c13f" />
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
      <sphereGeometry args={[260, 32, 32]} />
      <meshBasicMaterial side={THREE.BackSide} map={texture} />
    </mesh>
  );
}

function CameraRig({ target }) {
  const { camera } = useThree();
  const offset = useMemo(() => new THREE.Vector3(0, 12, 26), []);
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

function SceneContent({ onHeroMove, highlightedNpcId }) {
  const heroRef = useRef();
  return (
    <>
      <primitive attach="fog" object={new THREE.Fog(0xb8e4ff, 40, 200)} />
      <SkyDome />
      <Lights />
      <MountainBackdrop />
      <Terrain />
      <PathRibbon />
      <TreeField />
      <NpcField highlightedNpcId={highlightedNpcId} />
      <HeroAvatar heroRef={heroRef} onMove={onHeroMove} />
      <FloatingRune />
      <CameraRig target={heroRef} />
    </>
  );
}

export function GameCanvas({ onHeroMove, highlightedNpcId }) {
  return (
    <Canvas camera={{ position: [0, 12, 32], fov: 48 }} shadows>
      <SceneContent onHeroMove={onHeroMove} highlightedNpcId={highlightedNpcId} />
    </Canvas>
  );
}
