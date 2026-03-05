import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import './App.css';

// ─── Pixel-art canvas texture builder ────────────────────────────────────────
function makePixelTexture(draw, w = 64, h = 64) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// ─── Hero sprite ─────────────────────────────────────────────────────────────
function Hero({ keys }) {
  const ref = useRef();
  const vel = useRef(new THREE.Vector3());
  const bobT = useRef(0);

  const tex = useMemo(() => makePixelTexture((ctx, w, h) => {
    // Body
    ctx.fillStyle = '#c0392b'; ctx.fillRect(12, 20, 18, 28);
    // Head
    ctx.fillStyle = '#f39c72'; ctx.fillRect(13, 6, 16, 15);
    // Hair/hat
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(10, 4, 22, 7);
    ctx.fillRect(16, 1, 10, 5);
    // Eyes
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(15, 11, 3, 3); ctx.fillRect(24, 11, 3, 3);
    // Belt
    ctx.fillStyle = '#7f4f24'; ctx.fillRect(12, 34, 18, 4);
    // Legs
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(12, 48, 7, 10); ctx.fillRect(23, 48, 7, 10);
    // Arms
    ctx.fillStyle = '#c0392b'; ctx.fillRect(5, 22, 7, 18); ctx.fillRect(30, 22, 7, 18);
    // Sword
    ctx.fillStyle = '#b8c0cc'; ctx.fillRect(35, 14, 3, 22);
    ctx.fillStyle = '#7f4f24'; ctx.fillRect(33, 22, 7, 4);
  }, 42, 58), []);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const speed = 5;
    const dir = new THREE.Vector3(
      (keys.right ? 1 : 0) - (keys.left ? 1 : 0), 0,
      (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
    );
    if (dir.lengthSq() > 0) {
      dir.normalize();
      vel.current.x = dir.x * speed;
      vel.current.z = dir.z * speed;
      bobT.current += dt * 8;
    } else {
      vel.current.multiplyScalar(0.85);
      bobT.current += dt * 1.5;
    }
    ref.current.position.x += vel.current.x * dt;
    ref.current.position.z += vel.current.z * dt;
    ref.current.position.x = THREE.MathUtils.clamp(ref.current.position.x, -28, 28);
    ref.current.position.z = THREE.MathUtils.clamp(ref.current.position.z, -28, 28);
    ref.current.position.y = 0.6 + Math.abs(Math.sin(bobT.current)) * 0.08;

    // Always face camera
    ref.current.rotation.y = Math.atan2(dir.x, dir.z) || ref.current.rotation.y;

    // Camera follow
    const cam = state.camera;
    const tx = ref.current.position.x * 0.6;
    const tz = ref.current.position.z * 0.6;
    cam.position.lerp(new THREE.Vector3(tx + 0, 14, tz + 14), 0.07);
    cam.lookAt(ref.current.position.x, 0, ref.current.position.z);
  });

  return (
    <group ref={ref} position={[0, 0.6, 0]}>
      <mesh>
        <planeGeometry args={[1.2, 1.65]} />
        <meshStandardMaterial map={tex} transparent alphaTest={0.1} emissive={'#3a0000'} emissiveIntensity={0.15} />
      </mesh>
      {/* Glow halo */}
      <pointLight intensity={0.6} distance={5} color={'#ff8866'} />
      {/* Shadow blob */}
      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color={'#000'} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

// ─── Building sprite ─────────────────────────────────────────────────────────
function Building({ position, scale = 1 }) {
  const tex = useMemo(() => makePixelTexture((ctx) => {
    // Wall
    ctx.fillStyle = '#c8a97e'; ctx.fillRect(4, 24, 56, 38);
    // Roof (curved eave)
    ctx.fillStyle = '#8b1a1a'; ctx.fillRect(0, 14, 64, 14);
    ctx.fillStyle = '#6b1212'; ctx.fillRect(0, 12, 64, 5);
    // Roof top
    ctx.fillStyle = '#a52020'; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(32, 2); ctx.lineTo(64, 14); ctx.fill();
    // Door
    ctx.fillStyle = '#4a2a0a'; ctx.fillRect(22, 44, 20, 18);
    ctx.fillStyle = '#d4a060'; ctx.fillRect(23, 45, 9, 16); ctx.fillRect(32, 45, 9, 16);
    // Windows
    ctx.fillStyle = '#9ad4ff'; ctx.fillRect(6, 32, 12, 10); ctx.fillRect(46, 32, 12, 10);
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(11, 32, 1, 10); ctx.fillRect(51, 32, 1, 10);
    // Lantern
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(30, 7, 4, 6);
  }, 64, 64), []);

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.8, 0]}>
        <planeGeometry args={[3.2, 3.2]} />
        <meshStandardMaterial map={tex} transparent alphaTest={0.05}
          emissive={'#ff9933'} emissiveIntensity={0.08} />
      </mesh>
      <pointLight position={[0, 1.2, 0.5]} intensity={0.9} distance={7} color={'#ffcc66'} />
    </group>
  );
}

// ─── Tree sprite ─────────────────────────────────────────────────────────────
function TreeSprite({ position }) {
  const tex = useMemo(() => makePixelTexture((ctx) => {
    ctx.fillStyle = '#3d2b1f'; ctx.fillRect(26, 36, 12, 28);
    ctx.fillStyle = '#256b3a'; ctx.beginPath(); ctx.ellipse(32, 28, 20, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e8449'; ctx.beginPath(); ctx.ellipse(32, 20, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.ellipse(32, 14, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
  }, 64, 64), []);

  return (
    <mesh position={[position[0], 1.4, position[2]]}>
      <planeGeometry args={[2.2, 2.2]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.1} />
    </mesh>
  );
}

// ─── Ground ──────────────────────────────────────────────────────────────────
function Ground() {
  const tex = useMemo(() => makePixelTexture((ctx, w, h) => {
    ctx.fillStyle = '#5a8042';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4e7038';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 4, 2);
    }
    ctx.fillStyle = '#6aaf50';
    for (let i = 0; i < 20; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 4);
    }
  }, 128, 128), []);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  );
}

// ─── Marshwater ──────────────────────────────────────────────────────────────
function Marsh() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.opacity = 0.78 + Math.sin(clock.getElapsedTime() * 2) * 0.05;
    ref.current.position.y = 0.04 + Math.sin(clock.getElapsedTime() * 0.9) * 0.015;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.04, 8]}>
      <circleGeometry args={[9, 48]} />
      <meshStandardMaterial color={'#1a6b9a'} transparent opacity={0.8} roughness={0.1} metalness={0.2} />
    </mesh>
  );
}

// ─── Particles (fireflies) ────────────────────────────────────────────────────
function Fireflies() {
  const ref = useRef();
  const geo = useMemo(() => {
    const pos = new Float32Array(200 * 3);
    for (let i = 0; i < 200; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = 0.5 + Math.random() * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.material.opacity = 0.4 + Math.sin(clock.getElapsedTime() * 3) * 0.3;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={geo} count={200} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={'#ffffaa'} size={0.09} transparent opacity={0.6} />
    </points>
  );
}

// ─── Sky gradient backdrop ────────────────────────────────────────────────────
function SkyBox() {
  return (
    <mesh position={[0, 0, -48]} rotation={[0, 0, 0]}>
      <planeGeometry args={[200, 80]} />
      <meshBasicMaterial color={'#fbc2a5'} />
    </mesh>
  );
}

// ─── World ────────────────────────────────────────────────────────────────────
function World() {
  const trees = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 50; i++) {
      const x = (Math.random() - 0.5) * 62;
      const z = (Math.random() - 0.5) * 62;
      if (Math.abs(x) < 7 && Math.abs(z) < 7) continue;
      arr.push([x, 0, z]);
    }
    return arr;
  }, []);

  return (
    <>
      <SkyBox />
      <Ground />
      <Marsh />
      {/* Paths */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[4, 80]} />
        <meshStandardMaterial color={'#c4943a'} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[80, 4]} />
        <meshStandardMaterial color={'#c4943a'} roughness={1} />
      </mesh>
      {/* Buildings */}
      <Building position={[-10, 0, -12]} scale={1.1} />
      <Building position={[-4, 0, -14]} scale={1.0} />
      <Building position={[4, 0, -13]} scale={1.15} />
      <Building position={[22, 0, -16]} scale={1.3} />
      <Building position={[28, 0, -10]} scale={0.95} />
      {/* Wall segments */}
      {[-14, -8, -2, 4, 10].map(x => (
        <mesh key={x} position={[x, 0.55, -17]} castShadow>
          <boxGeometry args={[3.6, 1.1, 0.8]} />
          <meshStandardMaterial color={'#7d5c38'} roughness={0.9} />
        </mesh>
      ))}
      {trees.map((p, i) => <TreeSprite key={i} position={p} />)}
      <Fireflies />
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({ keys }) {
  return (
    <Canvas shadows camera={{ position: [0, 14, 14], fov: 50 }}>
      <color attach="background" args={['#fbc2a5']} />
      <fog attach="fog" args={['#e8b896', 35, 85]} />
      <ambientLight intensity={1.0} />
      <hemisphereLight intensity={0.5} color={'#ffe4b5'} groundColor={'#2d5a27'} />
      <directionalLight castShadow intensity={1.1} position={[15, 22, 8]}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, 8, 0]} intensity={0.3} color={'#ffcc88'} />

      <World />
      <Hero keys={keys} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.35} luminanceSmoothing={0.7} intensity={0.9}
          blendFunction={BlendFunction.ADD} />
        <Vignette eskil={false} offset={0.2} darkness={0.65} />
        <ChromaticAberration offset={[0.0008, 0.0008]} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    </Canvas>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [keys, setKeys] = useState({ up: false, down: false, left: false, right: false });

  useEffect(() => {
    const dn = (e) => {
      if (e.key === 'w' || e.key === 'ArrowUp') setKeys(k => ({ ...k, up: true }));
      if (e.key === 's' || e.key === 'ArrowDown') setKeys(k => ({ ...k, down: true }));
      if (e.key === 'a' || e.key === 'ArrowLeft') setKeys(k => ({ ...k, left: true }));
      if (e.key === 'd' || e.key === 'ArrowRight') setKeys(k => ({ ...k, right: true }));
    };
    const up = (e) => {
      if (e.key === 'w' || e.key === 'ArrowUp') setKeys(k => ({ ...k, up: false }));
      if (e.key === 's' || e.key === 'ArrowDown') setKeys(k => ({ ...k, down: false }));
      if (e.key === 'a' || e.key === 'ArrowLeft') setKeys(k => ({ ...k, left: false }));
      if (e.key === 'd' || e.key === 'ArrowRight') setKeys(k => ({ ...k, right: false }));
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  return (
    <div className="hd2d-shell">
      <div className="hd2d-overlay">
        <span className="hd2d-title">夢 Dream of Water Margin</span>
        <span className="hd2d-hint">WASD / Arrow Keys to move</span>
      </div>
      <div className="hd2d-canvas">
        <Scene keys={keys} />
      </div>
    </div>
  );
}
