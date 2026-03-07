import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, GradientTexture, OrbitControls, SoftShadows } from '@react-three/drei';
import * as THREE from 'three';

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(220, 220, 140, 140);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const height =
        Math.sin(x * 0.08) * 2.4 +
        Math.cos(y * 0.05) * 1.4 +
        Math.cos((x + y) * 0.03) * 0.8;
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
    <mesh rotation-x={-Math.PI / 2} position={[0, -3.3, 0]}>
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
        <mesh key={`mountain-${idx}`} geometry={geometry} position={[offset * 14, idx * 10, idx * -6]} rotation={[0, 0, 0]}>
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

  useMemo(() => {
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
      mesh.current?.setMatrixAt(i, dummy.matrix);
    }
    if (mesh.current) {
      mesh.current.instanceMatrix.needsUpdate = true;
    }
  }, [dummy, treeCount]);

  return (
    <instancedMesh ref={mesh} args={[null, null, treeCount]} castShadow receiveShadow>
      <coneGeometry args={[2.8, 8, 6]} />
      <meshStandardMaterial color="#3e8554" flatShading />
    </instancedMesh>
  );
}

function HeroAvatar() {
  const group = useRef();
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    group.current.position.y = Math.sin(t * 2) * 0.3;
    group.current.rotation.y = Math.sin(t * 0.5) * 0.15;
  });

  return (
    <group ref={group} position={[0, -1, 12]}>
      <mesh castShadow>
        <capsuleGeometry args={[1.2, 3.4, 6, 12]} />
        <meshStandardMaterial color="#f5f4f0" flatShading />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <sphereGeometry args={[1.2, 16, 12]} />
        <meshStandardMaterial color="#fdd5b6" />
      </mesh>
      <mesh position={[0, 3.6, 0]}>
        <torusGeometry args={[1.35, 0.25, 8, 24]} />
        <meshStandardMaterial color="#5b4a8b" />
      </mesh>
      <mesh position={[0, 1.6, 1.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 6, 8]} />
        <meshStandardMaterial color="#d8d0c0" />
      </mesh>
    </group>
  );
}

function FloatingRunes() {
  return (
    <Float speed={4} rotationIntensity={0.4} floatIntensity={0.3}>
      <mesh position={[-6, 6, -10]}>
        <octahedronGeometry args={[2.4, 0]} />
        <meshStandardMaterial color="#c6f5ff" emissive="#6dd9ff" emissiveIntensity={0.6} />
      </mesh>
    </Float>
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
  return (
    <mesh position={[0, -50, 0]}>
      <sphereGeometry args={[260, 32, 32]} />
      <meshBasicMaterial side={THREE.BackSide}>
        <GradientTexture stops={[0, 0.5, 1]} colors={['#fefcf2', '#b8e4ff', '#72aef0']} size={32} />
      </meshBasicMaterial>
    </mesh>
  );
}

function SceneContent() {
  return (
    <>
      <SoftShadows size={25} focus={0.4} />
      <fog attach="fog" args={[0xb8e4ff, 40, 200]} />
      <SkyDome />
      <Lights />
      <MountainBackdrop />
      <Terrain />
      <PathRibbon />
      <TreeField />
      <HeroAvatar />
      <FloatingRunes />
    </>
  );
}

export function GameCanvas() {
  return (
    <Canvas camera={{ position: [0, 12, 32], fov: 48 }} shadows>
      <SceneContent />
      <OrbitControls enablePan={false} minPolarAngle={0.4} maxPolarAngle={0.9} minDistance={25} maxDistance={60} />
    </Canvas>
  );
}
