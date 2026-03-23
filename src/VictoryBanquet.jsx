import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './VictoryBanquet.css';

// ── Confetti particles ──────────────────────────────────────────
function Confetti() {
  const COUNT = 120;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({
    x: (Math.random() - 0.5) * 28,
    y: 6 + Math.random() * 8,
    z: (Math.random() - 0.5) * 16,
    vy: -(0.4 + Math.random() * 0.6),
    vx: (Math.random() - 0.5) * 0.2,
    rx: Math.random() * Math.PI * 2,
    rz: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
  })), []);
  const colors = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    const palette = [[1,.2,.2],[1,.85,.1],[.2,.8,.4],[.2,.5,1],[.9,.2,.9],[1,.5,.1]];
    for (let i = 0; i < COUNT; i++) {
      const c = palette[i % palette.length];
      arr[i*3]=c[0]; arr[i*3+1]=c[1]; arr[i*3+2]=c[2];
    }
    return arr;
  }, []);

  useEffect(() => {
    if (!mesh.current) return;
    const geo = mesh.current.geometry;
    geo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
  }, [colors]);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    data.forEach((p, i) => {
      p.phase += delta * 2;
      p.y += p.vy * delta * 6;
      p.x += p.vx * delta * 6 + Math.sin(p.phase) * delta * 0.5;
      p.rx += delta * 2.2;
      p.rz += delta * 1.8;
      if (p.y < -4) { p.y = 10 + Math.random() * 6; p.x = (Math.random() - 0.5) * 28; }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, 0, p.rz);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[null, null, COUNT]}>
      <planeGeometry args={[0.28, 0.18]} />
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// ── Dancing woman figure ────────────────────────────────────────
function DancingFigure({ position, color, phase, speed = 1 }) {
  const groupRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const robeRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + phase;
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.6;
      groupRef.current.position.y = position[1] + Math.abs(Math.sin(t * 1.8)) * 0.3;
    }
    if (leftArmRef.current)  leftArmRef.current.rotation.z  =  0.4 + Math.sin(t * 2.1) * 0.8;
    if (rightArmRef.current) rightArmRef.current.rotation.z = -0.4 - Math.sin(t * 2.1 + 1) * 0.8;
    if (leftLegRef.current)  leftLegRef.current.rotation.x  =  Math.sin(t * 2.2) * 0.35;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.sin(t * 2.2) * 0.35;
    if (robeRef.current)     robeRef.current.rotation.y     =  Math.sin(t * 1.6) * 0.2;
  });

  const accent = color;
  const skin = '#f2c8a0';
  const hairCol = '#1a1020';
  const robeDark = new THREE.Color(color).multiplyScalar(0.65).getStyle();

  return (
    <group ref={groupRef} position={position}>
      {/* Legs */}
      <group ref={leftLegRef} position={[-0.22, 0.7, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.14, 0.18, 0.75, 8]} />
          <meshStandardMaterial color={robeDark} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.22, 0.7, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.14, 0.18, 0.75, 8]} />
          <meshStandardMaterial color={robeDark} />
        </mesh>
      </group>

      {/* Flowing robe skirt */}
      <group ref={robeRef}>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.6, 0.85, 1.5, 14]} />
          <meshStandardMaterial color={accent} roughness={0.8} />
        </mesh>
      </group>

      {/* Torso */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.38, 0.5, 1.2, 10]} />
        <meshStandardMaterial color={accent} roughness={0.8} />
      </mesh>

      {/* Sash */}
      <mesh position={[0, 1.45, 0]}>
        <torusGeometry args={[0.52, 0.07, 6, 20]} />
        <meshStandardMaterial color="#d4a030" metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Sleeve left */}
      <group ref={leftArmRef} position={[-0.55, 1.9, 0]}>
        <mesh position={[0, -0.4, 0]} rotation={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.14, 0.18, 0.9, 8]} />
          <meshStandardMaterial color={accent} roughness={0.8} />
        </mesh>
        {/* Silk sleeve trailing */}
        <mesh position={[-0.2, -0.7, 0]} rotation={[0, 0, 0.5]}>
          <planeGeometry args={[0.6, 1.1]} />
          <meshStandardMaterial color={accent} side={THREE.DoubleSide} transparent opacity={0.7} roughness={1} />
        </mesh>
        {/* Hand */}
        <mesh position={[-0.35, -0.85, 0]}>
          <sphereGeometry args={[0.13, 6, 6]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>

      {/* Sleeve right */}
      <group ref={rightArmRef} position={[0.55, 1.9, 0]}>
        <mesh position={[0, -0.4, 0]} rotation={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.14, 0.18, 0.9, 8]} />
          <meshStandardMaterial color={accent} roughness={0.8} />
        </mesh>
        <mesh position={[0.2, -0.7, 0]} rotation={[0, 0, -0.5]}>
          <planeGeometry args={[0.6, 1.1]} />
          <meshStandardMaterial color={accent} side={THREE.DoubleSide} transparent opacity={0.7} roughness={1} />
        </mesh>
        <mesh position={[0.35, -0.85, 0]}>
          <sphereGeometry args={[0.13, 6, 6]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.35, 8]} />
        <meshStandardMaterial color={skin} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.85, 0]}>
        <sphereGeometry args={[0.42, 12, 12]} />
        <meshStandardMaterial color={skin} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.14, 2.9, 0.36]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#1a0820" />
      </mesh>
      <mesh position={[0.14, 2.9, 0.36]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#1a0820" />
      </mesh>

      {/* Hair up-do */}
      <mesh position={[0, 3.22, 0]}>
        <sphereGeometry args={[0.44, 10, 8]} />
        <meshStandardMaterial color={hairCol} />
      </mesh>
      <mesh position={[0, 3.52, 0]}>
        <cylinderGeometry args={[0.16, 0.28, 0.55, 8]} />
        <meshStandardMaterial color={hairCol} />
      </mesh>
      {/* Hairpin */}
      <mesh position={[0.28, 3.55, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.03, 0.03, 0.55, 5]} />
        <meshStandardMaterial color="#d9b36b" metalness={0.5} />
      </mesh>
      {/* Hairpin jewel */}
      <mesh position={[0.5, 3.7, 0]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#ff4488" emissive="#ff2266" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// ── Banquet hall interior ───────────────────────────────────────
function BanquetHall({ cameraPhase }) {
  // Slowly pan camera across the room
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.12) * 6;
    camera.position.y = 4.5 + Math.sin(t * 0.08) * 0.8;
    camera.position.z = 18 + Math.sin(t * 0.07) * 3;
    camera.lookAt(Math.sin(t * 0.1) * 2, 3, 0);
  });

  const DANCER_DATA = [
    { pos: [-6,  0,  1], color: '#e83060', phase: 0,    speed: 1.1 },
    { pos: [-3,  0, -1], color: '#e04090', phase: 1.2,  speed: 0.9 },
    { pos: [ 0,  0,  2], color: '#cc2080', phase: 2.4,  speed: 1.2 },
    { pos: [ 3,  0, -1], color: '#d03888', phase: 0.8,  speed: 1.0 },
    { pos: [ 6,  0,  1], color: '#e85080', phase: 1.8,  speed: 1.15 },
    { pos: [-5,  0, -3], color: '#ff60a0', phase: 3.1,  speed: 0.85 },
    { pos: [ 5,  0, -3], color: '#d84070', phase: 2.0,  speed: 0.95 },
    { pos: [-8,  0, -1], color: '#f06090', phase: 0.4,  speed: 1.05 },
    { pos: [ 8,  0, -1], color: '#e04888', phase: 1.6,  speed: 1.3  },
  ];

  return (
    <>
      {/* Ambient warm light */}
      <ambientLight intensity={0.35} color="#ffddaa" />
      <pointLight position={[0, 10, 0]} color="#ffcc80" intensity={3} distance={30} decay={1.5} />
      <pointLight position={[-8, 6, -4]} color="#ff8844" intensity={2} distance={20} decay={2} />
      <pointLight position={[ 8, 6, -4]} color="#ff8844" intensity={2} distance={20} decay={2} />
      <pointLight position={[0, 6, 6]}   color="#ffaa60" intensity={1.5} distance={18} decay={2} />

      {/* Floor */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[28, 22]} />
        <meshStandardMaterial color="#8a5830" roughness={0.8} />
      </mesh>
      {/* Floor planks overlay */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI/2, 0, 0]} position={[(i - 4.5) * 2.8, 0.01, 0]}>
          <planeGeometry args={[2.6, 22]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#7a4e28' : '#8a5c30'} roughness={0.9} />
        </mesh>
      ))}

      {/* Back wall */}
      <mesh position={[0, 6, -11]}>
        <boxGeometry args={[28, 14, 0.5]} />
        <meshStandardMaterial color="#7a3a18" roughness={0.9} />
      </mesh>
      {/* Side walls */}
      <mesh position={[-14, 6, 0]}>
        <boxGeometry args={[0.5, 14, 22]} />
        <meshStandardMaterial color="#6a3010" roughness={0.9} />
      </mesh>
      <mesh position={[14, 6, 0]}>
        <boxGeometry args={[0.5, 14, 22]} />
        <meshStandardMaterial color="#6a3010" roughness={0.9} />
      </mesh>
      {/* Ceiling beams */}
      {[-6, 0, 6].map((x, i) => (
        <mesh key={i} position={[x, 11.5, 0]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.35, 0.35, 28, 8]} />
          <meshStandardMaterial color="#5a2a10" roughness={1} />
        </mesh>
      ))}

      {/* Red lanterns hanging from ceiling */}
      {[[-8,10,-4],[-4,10,2],[0,10,-6],[4,10,2],[8,10,-4],[-6,10,5],[6,10,5],[0,10,4],[-10,10,0],[10,10,0]].map(([lx,ly,lz], i) => (
        <group key={i} position={[lx, ly, lz]}>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.7, 5]} />
            <meshStandardMaterial color="#2a1008" />
          </mesh>
          <mesh position={[0, -1.1, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 1.6, 10]} />
            <meshStandardMaterial color="#cc1818" emissive="#991010" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, -1.1, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 1.2, 8]} />
            <meshStandardMaterial color="#ff8040" emissive="#ff6020" emissiveIntensity={1.2} transparent opacity={0.7} />
          </mesh>
          {/* Tassel */}
          {[-0.15, 0, 0.15].map((tx, ti) => (
            <mesh key={ti} position={[tx, -2.1, 0]}>
              <cylinderGeometry args={[0.03, 0.01, 0.6, 4]} />
              <meshStandardMaterial color="#ffcc00" />
            </mesh>
          ))}
          <pointLight position={[0, -1.1, 0]} color="#ff8030" intensity={1.2} distance={8} decay={2} />
        </group>
      ))}

      {/* Long banquet tables */}
      {[-4, 4].map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          {/* Table top */}
          <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[18, 0.25, 2.2]} />
            <meshStandardMaterial color="#6a3a18" roughness={0.7} />
          </mesh>
          {/* Legs */}
          {[[-7.5, 0.5],[7.5, 0.5],[0, 0.5]].map(([lx, _ly], li) => (
            <mesh key={li} position={[lx, 0.5, 0]}>
              <boxGeometry args={[0.3, 1.0, 2.0]} />
              <meshStandardMaterial color="#5a2e12" roughness={0.9} />
            </mesh>
          ))}
          {/* Dishes + cups on table */}
          {Array.from({ length: 7 }, (_, di) => (
            <group key={di} position={[(di - 3) * 2.5, 1.15, 0]}>
              <mesh>
                <cylinderGeometry args={[0.4, 0.35, 0.1, 10]} />
                <meshStandardMaterial color="#e8d8c0" roughness={0.6} />
              </mesh>
              <mesh position={[0.6, 0.1, 0]}>
                <cylinderGeometry args={[0.12, 0.1, 0.22, 8]} />
                <meshStandardMaterial color="#c8a060" metalness={0.3} roughness={0.5} />
              </mesh>
              <mesh position={[-0.5, 0.06, 0.2]}>
                <sphereGeometry args={[0.13, 6, 5]} />
                <meshStandardMaterial color={['#ff4040','#40cc40','#e8d050','#ff8020'][di%4]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Song Jiang — standing at head of table, raising cup */}
      <group position={[0, 0, -8.5]}>
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.5, 0.65, 1.9, 10]} />
          <meshStandardMaterial color="#7f1f26" roughness={0.8} />
        </mesh>
        <mesh position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.42, 0.5, 1.4, 10]} />
          <meshStandardMaterial color="#7f1f26" roughness={0.8} />
        </mesh>
        {/* Right arm raised with cup */}
        <mesh position={[0.8, 2.6, 0.3]} rotation={[-0.9, 0, -0.3]}>
          <cylinderGeometry args={[0.18, 0.22, 1.2, 8]} />
          <meshStandardMaterial color="#7f1f26" roughness={0.8} />
        </mesh>
        <mesh position={[1.3, 3.2, 0.6]}>
          <cylinderGeometry args={[0.14, 0.12, 0.28, 8]} />
          <meshStandardMaterial color="#c8a060" metalness={0.4} roughness={0.4} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 3.5, 0]}>
          <sphereGeometry args={[0.52, 10, 10]} />
          <meshStandardMaterial color="#d8a870" />
        </mesh>
        {/* Black hat */}
        <mesh position={[0, 3.9, 0]}>
          <cylinderGeometry args={[0.58, 0.58, 0.15, 16]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
        <mesh position={[0, 4.15, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.5, 12]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
        {/* Gold chest emblem */}
        <mesh position={[0, 2.3, 0.45]}>
          <cylinderGeometry args={[0.28, 0.28, 0.08, 10]} />
          <meshStandardMaterial color="#d9b36b" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* Dancers */}
      {DANCER_DATA.map((d, i) => (
        <DancingFigure key={i} position={d.pos} color={d.color} phase={d.phase} speed={d.speed} />
      ))}

      {/* Confetti */}
      <Confetti />

      {/* Decorative wall banners */}
      {[-10, -5, 0, 5, 10].map((x, i) => (
        <mesh key={i} position={[x, 7, -10.6]}>
          <boxGeometry args={[2.2, 5, 0.1]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#cc1818' : '#1840a0'} />
        </mesh>
      ))}
    </>
  );
}

// ── Main exported component ─────────────────────────────────────
export default function VictoryBanquet({ onClose, gold, heroes, chapter = 1 }) {
  const [phase, setPhase] = useState('cinematic'); // cinematic → revealed
  const [captionIndex, setCaptionIndex] = useState(0);

  const CAPTIONS = chapter === 2 ? [
    '⚔️  Chapter 2 Complete — The Magistrate Falls',
    `🏆  Guards defeated. Warlord Gao slain.`,
    `🪙  Reward: +200 gold  •  Heroes: ${heroes}/108`,
    '🏮  The people cheer as Liangshan\'s might spreads...',
    '"The road home grows shorter. Keep fighting."',
  ] : [
    '⚔️  Chapter 1 Complete — Oath at Liangshan',
    `🏆  Raiders defeated. Captain Zhao slain.`,
    `🪙  Reward: +100 gold  •  Heroes recruited: ${heroes}/108`,
    '🏮  Song Jiang raises his cup in your honour...',
    '"108 heroes. One oath. One mountain. Tonight — we feast."',
  ];

  useEffect(() => {
    if (captionIndex < CAPTIONS.length - 1) {
      const t = setTimeout(() => setCaptionIndex((c) => c + 1), 2200);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setPhase('revealed'), 600);
      return () => clearTimeout(t);
    }
  }, [captionIndex]);

  return (
    <div className="banquet-overlay">
      {/* 3D scene */}
      <div className="banquet-canvas">
        <Canvas camera={{ position: [0, 5, 18], fov: 55, near: 0.1, far: 200 }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          dpr={[1, 1]}
          onCreated={({ gl }) => gl.setClearColor('#1a0808', 1)}>
          <Suspense fallback={null}>
            <BanquetHall />
          </Suspense>
        </Canvas>
      </div>

      {/* Cinematic bars */}
      <div className="banquet-bars top" />
      <div className="banquet-bars bottom" />

      {/* Caption */}
      <div className="banquet-caption-wrap">
        <p className="banquet-caption" key={captionIndex}>{CAPTIONS[captionIndex]}</p>
      </div>

      {/* Title card */}
      <div className={`banquet-title-card ${phase === 'revealed' ? 'show' : ''}`}>
        <div className="banquet-title-chi">第一章完成</div>
        <div className="banquet-title-en">Chapter I — Complete</div>
        <div className="banquet-title-sub">Oath at Liangshan</div>
        <div className="banquet-stats">
          <span>🪙 {gold} gold</span>
          <span>👥 {heroes} / 108 heroes</span>
        </div>
        <button className="banquet-continue" onClick={onClose}>
          {chapter >= 2 ? '⚔️ Continue to Chapter 3 →' : '⚔️ Continue to Chapter 2 →'}
        </button>
      </div>
    </div>
  );
}
