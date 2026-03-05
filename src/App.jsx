import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';

function Player({ keys }) {
  const ref = useRef();
  const velocity = useRef(new THREE.Vector3());

  useFrame((state, dt) => {
    if (!ref.current) return;

    const speed = 6;
    const dir = new THREE.Vector3(
      (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
      0,
      (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
    );

    if (dir.lengthSq() > 0) {
      dir.normalize();
      velocity.current.x = dir.x * speed;
      velocity.current.z = dir.z * speed;

      // Face movement direction
      const targetRot = Math.atan2(dir.x, dir.z);
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, targetRot, 0.2);
    } else {
      velocity.current.x *= 0.82;
      velocity.current.z *= 0.82;
    }

    ref.current.position.x += velocity.current.x * dt;
    ref.current.position.z += velocity.current.z * dt;

    // World bounds
    ref.current.position.x = THREE.MathUtils.clamp(ref.current.position.x, -35, 35);
    ref.current.position.z = THREE.MathUtils.clamp(ref.current.position.z, -35, 35);

    // Camera follow (smooth)
    const camTarget = new THREE.Vector3(
      ref.current.position.x + 9,
      9,
      ref.current.position.z + 9
    );
    state.camera.position.lerp(camTarget, 0.06);
    state.camera.lookAt(ref.current.position.x, 1.4, ref.current.position.z);
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* Body */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.5, 1.8, 16]} />
        <meshStandardMaterial color="#9b1b1b" roughness={0.75} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial color="#f3c58e" roughness={0.8} />
      </mesh>
      {/* Hat */}
      <mesh position={[0, 2.45, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.18, 24]} />
        <meshStandardMaterial color="#151a2f" roughness={0.65} />
      </mesh>
    </group>
  );
}

function Building({ position = [0, 0, 0], scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 2.2, 3]} />
        <meshStandardMaterial color="#d9b27a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.65, 0]} castShadow>
        <coneGeometry args={[2.2, 1.2, 4]} />
        <meshStandardMaterial color="#6d0f0f" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.5, 1.53]} castShadow>
        <boxGeometry args={[0.8, 1.2, 0.15]} />
        <meshStandardMaterial color="#5d3b1f" />
      </mesh>
    </group>
  );
}

function Tree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 2.4, 8]} />
        <meshStandardMaterial color="#5a3a1b" />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow>
        <sphereGeometry args={[1.1, 16, 16]} />
        <meshStandardMaterial color="#2f6d3d" roughness={0.95} />
      </mesh>
    </group>
  );
}

function World() {
  const trees = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * 78;
      const z = (Math.random() - 0.5) * 78;
      // Keep central path clearer
      if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;
      arr.push([x, 0, z]);
    }
    return arr;
  }, []);

  return (
    <>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80, 1, 1]} />
        <meshStandardMaterial color="#5f874f" roughness={1} />
      </mesh>

      {/* Water (Liangshan marsh) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[14, 0.02, 12]} receiveShadow>
        <circleGeometry args={[10, 48]} />
        <meshStandardMaterial color="#2e6da7" metalness={0.05} roughness={0.2} />
      </mesh>

      {/* Main roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[78, 4]} />
        <meshStandardMaterial color="#c8a06f" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[4, 78]} />
        <meshStandardMaterial color="#c8a06f" roughness={1} />
      </mesh>

      {/* Stronghold walls */}
      {[-14, -8, -2, 4, 10].map((x) => (
        <mesh key={`wt-${x}`} position={[x, 1, -18]} castShadow receiveShadow>
          <boxGeometry args={[3.5, 2, 1.2]} />
          <meshStandardMaterial color="#7a5b36" roughness={0.9} />
        </mesh>
      ))}
      {[-14, -8, -2, 4, 10].map((x) => (
        <mesh key={`wb-${x}`} position={[x, 1, -6]} castShadow receiveShadow>
          <boxGeometry args={[3.5, 2, 1.2]} />
          <meshStandardMaterial color="#7a5b36" roughness={0.9} />
        </mesh>
      ))}
      {[-16, -12, -8].map((z) => (
        <mesh key={`wl-${z}`} position={[-16, 1, z]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 2, 3.5]} />
          <meshStandardMaterial color="#7a5b36" roughness={0.9} />
        </mesh>
      ))}
      {[-16, -12, -8].map((z) => (
        <mesh key={`wr-${z}`} position={[12, 1, z]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 2, 3.5]} />
          <meshStandardMaterial color="#7a5b36" roughness={0.9} />
        </mesh>
      ))}

      <Building position={[-10, 0, -12]} scale={1.1} />
      <Building position={[-3, 0, -12]} scale={1.05} />
      <Building position={[5, 0, -12]} scale={1.15} />
      <Building position={[24, 0, -15]} scale={1.2} />
      <Building position={[30, 0, -8]} scale={0.9} />

      {trees.map((p, i) => (
        <Tree key={i} position={p} />
      ))}
    </>
  );
}

function DreamScene() {
  const [keys, setKeys] = useState({ up: false, down: false, left: false, right: false });

  useEffect(() => {
    const onDown = (e) => {
      if (e.key === 'w' || e.key === 'ArrowUp') setKeys((k) => ({ ...k, up: true }));
      if (e.key === 's' || e.key === 'ArrowDown') setKeys((k) => ({ ...k, down: true }));
      if (e.key === 'a' || e.key === 'ArrowLeft') setKeys((k) => ({ ...k, left: true }));
      if (e.key === 'd' || e.key === 'ArrowRight') setKeys((k) => ({ ...k, right: true }));
    };
    const onUp = (e) => {
      if (e.key === 'w' || e.key === 'ArrowUp') setKeys((k) => ({ ...k, up: false }));
      if (e.key === 's' || e.key === 'ArrowDown') setKeys((k) => ({ ...k, down: false }));
      if (e.key === 'a' || e.key === 'ArrowLeft') setKeys((k) => ({ ...k, left: false }));
      if (e.key === 'd' || e.key === 'ArrowRight') setKeys((k) => ({ ...k, right: false }));
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  return (
    <Canvas shadows camera={{ position: [12, 10, 12], fov: 52 }}>
      <color attach="background" args={['#9ec3ea']} />
      <fog attach="fog" args={['#9ec3ea', 45, 120]} />

      <ambientLight intensity={0.8} />
      <hemisphereLight intensity={0.35} color={'#dbeafe'} groundColor={'#365314'} />
      <directionalLight
        castShadow
        intensity={1.0}
        position={[20, 24, 12]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <World />
      <Player keys={keys} />

      <OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={1.2} minPolarAngle={0.7} />
    </Canvas>
  );
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function FallbackView() {
  return (
    <div className="fallback">
      <h2>3D is unsupported in this browser/session</h2>
      <p>Switch to Chrome/Edge desktop, or open this page directly (not embedded webview).</p>
      <p>I can also switch back to the enhanced 2D version if you want.</p>
    </div>
  );
}

export default function App() {
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    setWebglOk(supportsWebGL());
  }, []);

  return (
    <div className="app3d">
      <div className="title">夢 Dream of Water Margin — 3D Prototype</div>
      <div className="viewport">
        {webglOk ? <DreamScene /> : <FallbackView />}
      </div>
      <div className="hud">WASD / Arrow Keys to move • 3D mode</div>
    </div>
  );
}
