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
      const targetRot = Math.atan2(dir.x, dir.z);
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, targetRot, 0.18);
    } else {
      velocity.current.x *= 0.84;
      velocity.current.z *= 0.84;
    }

    ref.current.position.x += velocity.current.x * dt;
    ref.current.position.z += velocity.current.z * dt;
    ref.current.position.x = THREE.MathUtils.clamp(ref.current.position.x, -35, 35);
    ref.current.position.z = THREE.MathUtils.clamp(ref.current.position.z, -35, 35);

    const camTarget = new THREE.Vector3(ref.current.position.x + 9, 9, ref.current.position.z + 9);
    state.camera.position.lerp(camTarget, 0.06);
    state.camera.lookAt(ref.current.position.x, 1.5, ref.current.position.z);
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.5, 1.8, 16]} />
        <meshToonMaterial color="#a21d1d" />
      </mesh>
      <mesh position={[0, 2.15, 0]} castShadow>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshToonMaterial color="#f4c995" />
      </mesh>
      <mesh position={[0, 2.45, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.18, 24]} />
        <meshToonMaterial color="#1b2440" />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.7, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

function Building({ position = [0, 0, 0], scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 2.2, 3.4]} />
        <meshToonMaterial color="#d8b27d" />
      </mesh>
      <mesh position={[0, 2.75, 0]} castShadow>
        <coneGeometry args={[2.45, 1.25, 4]} />
        <meshToonMaterial color="#751313" />
      </mesh>
      <mesh position={[0, 0.55, 1.72]} castShadow>
        <boxGeometry args={[0.9, 1.1, 0.16]} />
        <meshToonMaterial color="#5f3f20" />
      </mesh>
      <mesh position={[-0.85, 1.2, 1.72]} castShadow>
        <boxGeometry args={[0.55, 0.45, 0.1]} />
        <meshToonMaterial color="#9ad5ff" />
      </mesh>
      <mesh position={[0.85, 1.2, 1.72]} castShadow>
        <boxGeometry args={[0.55, 0.45, 0.1]} />
        <meshToonMaterial color="#9ad5ff" />
      </mesh>
    </group>
  );
}

function Lantern({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 2.3, 8]} />
        <meshToonMaterial color="#3f2b1b" />
      </mesh>
      <mesh position={[0, 2.45, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshToonMaterial color="#ffcd6a" />
      </mesh>
      <pointLight position={[0, 2.45, 0]} intensity={0.65} distance={8} color={'#ffcc77'} />
    </group>
  );
}

function Tree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.27, 2.5, 8]} />
        <meshToonMaterial color="#5a3a1b" />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <sphereGeometry args={[1.15, 16, 16]} />
        <meshToonMaterial color="#2f6f3d" />
      </mesh>
    </group>
  );
}

function Mountains() {
  const mountains = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 48 + Math.sin(i) * 4;
      arr.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        h: 8 + ((i * 7) % 6),
        w: 4 + ((i * 5) % 3),
      });
    }
    return arr;
  }, []);

  return mountains.map((m, i) => (
    <mesh key={i} position={[m.x, m.h / 2, m.z]} castShadow>
      <coneGeometry args={[m.w, m.h, 6]} />
      <meshToonMaterial color="#4f6a5a" />
    </mesh>
  ));
}

function Water({ timeRef }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.y = 0.025 + Math.sin(t * 1.7) * 0.01;
    ref.current.rotation.z = Math.sin(t * 0.15) * 0.03;
    ref.current.material.opacity = 0.82 + Math.sin(t * 2.2) * 0.05;
    if (timeRef) timeRef.current = t;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[14, 0.02, 12]} receiveShadow>
      <circleGeometry args={[10.5, 60]} />
      <meshToonMaterial color="#2f76b5" transparent opacity={0.86} />
    </mesh>
  );
}

function Fireflies() {
  const pointsRef = useRef();
  const particles = useMemo(() => {
    const arr = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 70;
      arr[i * 3 + 1] = 1 + Math.random() * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = clock.getElapsedTime() * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={particles} count={particles.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#ffd97a" size={0.12} transparent opacity={0.55} />
    </points>
  );
}

function World() {
  const trees = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 70; i++) {
      const x = (Math.random() - 0.5) * 78;
      const z = (Math.random() - 0.5) * 78;
      if (Math.abs(x) < 7 || Math.abs(z) < 7) continue;
      arr.push([x, 0, z]);
    }
    return arr;
  }, []);

  const timeRef = useRef(0);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[82, 82, 1, 1]} />
        <meshToonMaterial color="#628d51" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[78, 4]} />
        <meshToonMaterial color="#c79f70" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[4, 78]} />
        <meshToonMaterial color="#c79f70" />
      </mesh>

      <Water timeRef={timeRef} />
      <Mountains />

      {[-14, -8, -2, 4, 10].map((x) => (
        <mesh key={`wt-${x}`} position={[x, 1, -18]} castShadow receiveShadow>
          <boxGeometry args={[3.5, 2, 1.2]} />
          <meshToonMaterial color="#7a5b36" />
        </mesh>
      ))}
      {[-14, -8, -2, 4, 10].map((x) => (
        <mesh key={`wb-${x}`} position={[x, 1, -6]} castShadow receiveShadow>
          <boxGeometry args={[3.5, 2, 1.2]} />
          <meshToonMaterial color="#7a5b36" />
        </mesh>
      ))}
      {[-16, -12, -8].map((z) => (
        <mesh key={`wl-${z}`} position={[-16, 1, z]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 2, 3.5]} />
          <meshToonMaterial color="#7a5b36" />
        </mesh>
      ))}
      {[-16, -12, -8].map((z) => (
        <mesh key={`wr-${z}`} position={[12, 1, z]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 2, 3.5]} />
          <meshToonMaterial color="#7a5b36" />
        </mesh>
      ))}

      <Building position={[-10, 0, -12]} scale={1.1} />
      <Building position={[-3, 0, -12]} scale={1.05} />
      <Building position={[5, 0, -12]} scale={1.15} />
      <Building position={[24, 0, -15]} scale={1.2} />
      <Building position={[30, 0, -8]} scale={0.95} />

      <Lantern position={[-6, 0, 0]} />
      <Lantern position={[6, 0, 0]} />
      <Lantern position={[0, 0, 10]} />
      <Lantern position={[0, 0, -10]} />

      {trees.map((p, i) => (
        <Tree key={i} position={p} />
      ))}

      <Fireflies />
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
      <color attach="background" args={['#a5c7ef']} />
      <fog attach="fog" args={['#a5c7ef', 42, 110]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight intensity={0.45} color={'#e8f2ff'} groundColor={'#2f4f2f'} />
      <directionalLight castShadow intensity={1.05} position={[22, 24, 8]} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />

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
      <h2>3D isn’t available in this browser view</h2>
      <p>Use Chrome/Edge desktop (normal tab) and open localhost:5173 directly.</p>
      <p>If you want, I’ll switch this to a polished HD-2D mode instead.</p>
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
      <div className="title">夢 Dream of Water Margin — Beautiful 3D Draft</div>
      <div className="viewport">{webglOk ? <DreamScene /> : <FallbackView />}</div>
      <div className="hud">WASD / Arrow Keys • Soft toon style • animated water • lantern lights</div>
    </div>
  );
}
