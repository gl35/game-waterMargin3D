import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './OpeningCinematic.css';

// ── Scene 1: Modern bedroom - student studying ──────────────────
function ModernRoomScene() {
  const lampRef = useRef();
  const deskRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (lampRef.current) lampRef.current.intensity = 1.8 + Math.sin(t * 0.8) * 0.15;
  });
  return (
    <>
      <ambientLight intensity={0.35} color="#203050" />
      <pointLight ref={lampRef} position={[1.5, 3, -1]} color="#ffcc88" intensity={3.5} distance={18} decay={1.5} />
      {/* Fill light from window */}
      <pointLight position={[3, 1.5, -2]} color="#4466ff" intensity={1.2} distance={10} decay={2} />
      {/* Rim light so character is visible */}
      <directionalLight position={[-4, 5, 4]} intensity={0.6} color="#ffddaa" />
      {/* Floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.8,0]}>
        <planeGeometry args={[14,10]} />
        <meshStandardMaterial color="#1a1a2e" roughness={1} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0,2,-5]}>
        <boxGeometry args={[14,8,0.3]} />
        <meshStandardMaterial color="#12121e" roughness={0.9} />
      </mesh>
      {/* Window with moonlight */}
      <mesh position={[3,1.5,-4.8]}>
        <boxGeometry args={[2.5,3,0.1]} />
        <meshStandardMaterial color="#1a3a5a" emissive="#2255aa" emissiveIntensity={0.4} />
      </mesh>
      <pointLight position={[3,1.5,-3.5]} color="#3366ff" intensity={0.5} distance={6} decay={2} />
      {/* Desk */}
      <mesh position={[0,-0.6,-2]}>
        <boxGeometry args={[4,0.15,2]} />
        <meshStandardMaterial color="#5a3820" roughness={0.7} />
      </mesh>
      {[[-1.6,-1.7,-2],[1.6,-1.7,-2],[-1.6,-1.7,-1],[1.6,-1.7,-1]].map(([x,y,z],i) => (
        <mesh key={i} position={[x,y,z]}><boxGeometry args={[0.12,2.3,0.12]} /><meshStandardMaterial color="#4a2e14" /></mesh>
      ))}
      {/* Books stacked on desk */}
      {[[-1.2,-0.45,-1.5],[-.6,-0.42,-1.4],[0,-0.44,-1.6],[.5,-0.43,-1.5]].map(([x,y,z],i) => (
        <mesh key={i} position={[x,y,z]} rotation={[0,(i-1.5)*0.15,0]}>
          <boxGeometry args={[0.5,0.06+i*0.01,0.7]} />
          <meshStandardMaterial color={['#8a1c1c','#1c4a8a','#2a7a2a','#7a5a1c'][i]} />
        </mesh>
      ))}
      {/* Laptop / notes glow */}
      <mesh position={[0.5,-0.5,-1.8]} rotation={[-0.3,0,0]}>
        <boxGeometry args={[1.4,0.04,1]} />
        <meshStandardMaterial color="#222" emissive="#3355ff" emissiveIntensity={1.2} />
      </mesh>
      <pointLight position={[0.5,-0.3,-1.8]} color="#4466ff" intensity={1.8} distance={6} decay={1.8} />
      {/* Student figure slumped */}
      <group position={[0,-0.2,-1.5]}>
        <mesh position={[0,0.1,0]}><sphereGeometry args={[0.35,8,8]} /><meshStandardMaterial color="#d8b07a" /></mesh>
        {/* Hair */}
        <mesh position={[0,0.2,0]}><sphereGeometry args={[0.38,8,7]} /><meshStandardMaterial color="#1a1010" /></mesh>
        {/* Body slumped on desk */}
        <mesh position={[0,-0.5,0.2]} rotation={[0.4,0,0]}><boxGeometry args={[0.7,0.8,0.4]} /><meshStandardMaterial color="#2a3a5a" /></mesh>
        {/* Arms on desk */}
        <mesh position={[-0.4,-0.3,-0.1]} rotation={[0.5,0.2,0.3]}><boxGeometry args={[0.18,0.6,0.18]} /><meshStandardMaterial color="#2a3a5a" /></mesh>
        <mesh position={[0.4,-0.3,-0.1]} rotation={[0.5,-0.2,-0.3]}><boxGeometry args={[0.18,0.6,0.18]} /><meshStandardMaterial color="#2a3a5a" /></mesh>
      </group>
      {/* Coffee mug */}
      <mesh position={[1.2,-0.5,-1.6]}>
        <cylinderGeometry args={[0.12,0.1,0.25,10]} />
        <meshStandardMaterial color="#cc4422" />
      </mesh>
      {/* Exam paper */}
      <mesh position={[-0.5,-0.52,-2.1]} rotation={[-Math.PI/2,0,0.2]}>
        <planeGeometry args={[0.7,1.0]} />
        <meshStandardMaterial color="#f0e8d0" roughness={1} />
      </mesh>
    </>
  );
}

// ── Scene 2: Fever dream transition - swirling vortex ──────────
function FeverDreamScene() {
  const vortexRef = useRef();
  const particleRefs = useRef([]);
  const COUNT = 80;
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pts = useMemo(() => Array.from({length:COUNT},(_,i) => ({
    angle: (i/COUNT)*Math.PI*2,
    r: 1+Math.random()*5,
    y: (Math.random()-0.5)*8,
    speed: 0.3+Math.random()*0.8,
    phase: Math.random()*Math.PI*2,
  })),[]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (vortexRef.current) {
      vortexRef.current.rotation.y = t * 0.4;
      vortexRef.current.rotation.x = Math.sin(t*0.3)*0.15;
    }
    if (!mesh.current) return;
    pts.forEach((p,i) => {
      p.angle += p.speed * 0.018;
      dummy.position.set(Math.cos(p.angle)*p.r, p.y + Math.sin(t*0.5+p.phase)*0.8, Math.sin(p.angle)*p.r);
      dummy.rotation.set(t,t*0.7,0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <ambientLight intensity={0.4} color="#441122" />
      <pointLight position={[0,0,0]} color="#ff4488" intensity={5} distance={25} decay={1.2} />
      <pointLight position={[4,2,-3]} color="#4422ff" intensity={3.5} distance={20} decay={1.5} />
      <pointLight position={[-4,-2,3]} color="#ff8800" intensity={3} distance={18} decay={1.5} />
      {/* Central swirl */}
      <group ref={vortexRef}>
        {[1.5,2.5,3.8,5].map((r,i) => (
          <mesh key={i} rotation={[0,i*0.4,i*0.2]}>
            <torusGeometry args={[r,0.04+i*0.02,4,80,Math.PI*1.6]} />
            <meshBasicMaterial color={['#ff4488','#aa22ff','#ff8800','#2244ff'][i]} transparent opacity={0.7-i*0.12} />
          </mesh>
        ))}
      </group>
      {/* Floating particles */}
      <instancedMesh ref={mesh} args={[null,null,COUNT]}>
        <boxGeometry args={[0.15,0.15,0.15]} />
        <meshBasicMaterial color="#ffaadd" transparent opacity={0.75} />
      </instancedMesh>
      {/* Chinese characters floating */}
      {['梁', '山', '英', '雄'].map((_, i) => null)}
    </>
  );
}

// ── Scene 3: Ancient Liangshan landscape ───────────────────────
function LiangshanScene() {
  const sunRef = useRef();
  const fogRef = useMemo(() => new THREE.Fog(0xc8d8f0, 40, 200), []);
  const { scene } = { scene: null }; // placeholder

  useFrame(({ clock, scene: sc }) => {
    const t = clock.getElapsedTime();
    if (sunRef.current) {
      sunRef.current.position.set(Math.cos(t*0.05)*60, 30+Math.sin(t*0.05)*20, -40);
    }
    if (sc) { sc.fog = fogRef; if (sc.background instanceof THREE.Color) sc.background.set('#b8ccf0'); }
  });

  return (
    <>
      <fog attach="fog" args={[0xb8ccf0, 60, 220]} />
      <ambientLight intensity={0.5} color="#d8e8ff" />
      <directionalLight ref={sunRef} color="#fff8d0" intensity={2.2} position={[40,30,-40]} />
      <hemisphereLight args={[0xc8d8ff, 0x4a7a30, 0.5]} />
      {/* Sky */}
      <mesh position={[0,0,-100]} rotation={[0,0,0]}>
        <planeGeometry args={[500,200]} />
        <meshBasicMaterial color="#b8ccf0" />
      </mesh>
      {/* Sun glow */}
      <mesh position={[40,30,-60]}>
        <sphereGeometry args={[4,12,10]} />
        <meshBasicMaterial color="#fffac0" />
      </mesh>
      <mesh position={[40,30,-62]}>
        <sphereGeometry args={[8,10,8]} />
        <meshBasicMaterial color="#ffee80" transparent opacity={0.25} />
      </mesh>
      {/* Rolling terrain */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-3,0]}>
        <planeGeometry args={[300,200,30,20]} />
        <meshStandardMaterial color="#5a8a40" roughness={1} />
      </mesh>
      {/* Mountain peaks */}
      {[[-30,0,-50],[30,0,-60],[0,0,-80],[-60,0,-70],[50,0,-90]].map(([x,y,z],i) => (
        <group key={i} position={[x,y,z]}>
          <mesh position={[0,12+i*3,0]}>
            <cylinderGeometry args={[0,8+i*2,28+i*6,8]} />
            <meshStandardMaterial color={`hsl(${200+i*5},${40+i*5}%,${50+i*5}%)`} flatShading />
          </mesh>
          {/* Snow cap */}
          <mesh position={[0,26+i*3,0]}>
            <coneGeometry args={[2.5,5,7]} />
            <meshStandardMaterial color="#e8eeff" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Pine trees */}
      {Array.from({length:30},(_,i) => {
        const a = (i/30)*Math.PI*2; const r = 12+Math.random()*25;
        return (
          <group key={i} position={[Math.cos(a)*r,-2.5,Math.sin(a)*r-10]}>
            <mesh position={[0,3,0]}><coneGeometry args={[1.5,6,6]} /><meshStandardMaterial color="#2a6a30" flatShading /></mesh>
            <mesh position={[0,0.5,0]}><cylinderGeometry args={[0.2,0.3,2,5]} /><meshStandardMaterial color="#5a3010" /></mesh>
          </group>
        );
      })}
      {/* Liangshan fortress silhouette in distance */}
      <group position={[0,-2,-55]}>
        <mesh position={[0,8,0]}><cylinderGeometry args={[8,14,18,10]} /><meshStandardMaterial color="#4a5a40" flatShading /></mesh>
        <mesh position={[0,16,0]}><boxGeometry args={[10,6,10]} /><meshStandardMaterial color="#7a6a50" /></mesh>
        <mesh position={[0,20,0]}><coneGeometry args={[6,5,4]} /><meshStandardMaterial color="#4a2010" /></mesh>
        <mesh position={[4,18,4]}><boxGeometry args={[3,8,3]} /><meshStandardMaterial color="#6a5a40" /></mesh>
        <mesh position={[-4,18,4]}><boxGeometry args={[3,8,3]} /><meshStandardMaterial color="#6a5a40" /></mesh>
      </group>
      {/* Birds */}
      {[[-8,15,-20],[-5,18,-22],[0,16,-18],[5,17,-21],[9,14,-19]].map(([x,y,z],i) => (
        <mesh key={i} position={[x,y,z]} rotation={[0,i*0.4,Math.sin(i)*0.3]}>
          <boxGeometry args={[0.8,0.08,0.35]} />
          <meshBasicMaterial color="#1a1010" />
        </mesh>
      ))}
    </>
  );
}

// ── Scene 4: Raiders attacking - fire and chaos ─────────────────
function RaiderScene() {
  const fire1 = useRef(); const fire2 = useRef(); const fire3 = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    [fire1,fire2,fire3].forEach((f,i) => {
      if (!f.current) return;
      f.current.scale.y = 1 + Math.sin(t*6+i*1.5)*0.3;
      f.current.scale.x = 1 + Math.sin(t*5+i)*0.15;
      f.current.material.emissiveIntensity = 1.2+Math.sin(t*7+i)*0.5;
    });
  });
  return (
    <>
      <ambientLight intensity={0.4} color="#331100" />
      <directionalLight position={[0, 8, 5]} intensity={1.0} color="#ff6622" />
      <pointLight position={[-3,3,2]} color="#ff6010" intensity={6} distance={25} decay={1.2} />
      <pointLight position={[4,4,-1]} color="#ff8020" intensity={4} distance={20} decay={1.5} />
      <pointLight position={[0,0,5]} color="#ff4400" intensity={3} distance={15} decay={1.5} />
      {/* Night sky */}
      <mesh position={[0,5,-20]}><planeGeometry args={[80,30]} /><meshBasicMaterial color="#0a0808" /></mesh>
      {/* Ground */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2.5,0]}><planeGeometry args={[50,30]} /><meshStandardMaterial color="#2a1a0a" roughness={1} /></mesh>
      {/* Burning buildings */}
      {[[-5,-1.5,-3],[3,-1.5,-4],[-1,-1.5,-5]].map(([x,y,z],i) => (
        <group key={i} position={[x,y,z]}>
          <mesh position={[0,1.5,0]}><boxGeometry args={[2.5,3,2.5]} /><meshStandardMaterial color="#3a2010" emissive="#ff2200" emissiveIntensity={0.3} /></mesh>
          <mesh position={[0,3.2,0]}><coneGeometry args={[1.8,1.8,4]} /><meshStandardMaterial color="#2a1008" emissive="#ff4400" emissiveIntensity={0.5} /></mesh>
        </group>
      ))}
      {/* Flames */}
      <mesh ref={fire1} position={[-5,0.5,-3]}>
        <coneGeometry args={[0.7,2.5,7]} />
        <meshStandardMaterial color="#ff6010" emissive="#ff4400" emissiveIntensity={2.5} transparent opacity={0.85} />
      </mesh>
      <mesh ref={fire2} position={[3,0.5,-4]}>
        <coneGeometry args={[0.9,3,8]} />
        <meshStandardMaterial color="#ff8020" emissive="#ff5500" emissiveIntensity={2.2} transparent opacity={0.8} />
      </mesh>
      <mesh ref={fire3} position={[-1,0.5,-5]}>
        <coneGeometry args={[0.6,2,6]} />
        <meshStandardMaterial color="#ffaa30" emissive="#ff6600" emissiveIntensity={2.0} transparent opacity={0.9} />
      </mesh>
      {/* Raider silhouette */}
      <group position={[2,-1,1]}>
        <mesh position={[0,1.4,0]}><cylinderGeometry args={[0.35,0.45,1.6,8]} /><meshStandardMaterial color="#1a0a08" /></mesh>
        <mesh position={[0,2.4,0]}><sphereGeometry args={[0.38,8,8]} /><meshStandardMaterial color="#1a0a08" /></mesh>
        <mesh position={[1.2,1.5,0]} rotation={[0,0,-0.4]}><cylinderGeometry args={[0.05,0.05,2.2,5]} /><meshStandardMaterial color="#888090" /></mesh>
      </group>
      {/* Fleeing villager silhouettes */}
      {[[-4,0,3],[-2,0,4],[-6,0,2]].map(([x,y,z],i) => (
        <group key={i} position={[x,y,z]}>
          <mesh position={[0,0.9,0]}><cylinderGeometry args={[0.25,0.35,1.4,6]} /><meshStandardMaterial color="#1a1010" /></mesh>
          <mesh position={[0,1.8,0]}><sphereGeometry args={[0.28,6,6]} /><meshStandardMaterial color="#1a1010" /></mesh>
        </group>
      ))}
    </>
  );
}

// ── Scene 5: Song Jiang and hero gathering ─────────────────────
function HeroGatherScene() {
  const groupRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(t*0.12)*0.08;
  });

  const HERO_COLORS = ['#7f1f26','#1f3a7f','#1f7f3a','#7f5a1f','#4a1f7f','#7f1f5a'];
  return (
    <>
      <ambientLight intensity={0.4} color="#ffeecc" />
      <pointLight position={[0,8,2]} color="#ffcc80" intensity={2.5} distance={25} decay={1.5} />
      <pointLight position={[-5,4,0]} color="#ff8040" intensity={1.5} distance={15} decay={2} />
      {/* Hall floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2.5,0]}><planeGeometry args={[30,20]} /><meshStandardMaterial color="#6a3a18" roughness={0.8} /></mesh>
      {/* Back wall with banner */}
      <mesh position={[0,3,-8]}><boxGeometry args={[20,12,0.3]} /><meshStandardMaterial color="#5a1a08" roughness={0.9} /></mesh>
      <mesh position={[0,4,-7.8]}><boxGeometry args={[4,8,0.1]} /><meshStandardMaterial color="#cc1818" /></mesh>
      {/* Lanterns */}
      {[-5,0,5].map((x,i) => (
        <group key={i} position={[x,6,-4]}>
          <mesh position={[0,-0.5,0]}><cylinderGeometry args={[0.45,0.45,1.4,10]} /><meshStandardMaterial color="#cc1818" emissive="#881010" emissiveIntensity={0.4} /></mesh>
          <pointLight position={[0,-0.5,0]} color="#ff8030" intensity={1.2} distance={8} decay={2} />
        </group>
      ))}
      {/* Song Jiang center */}
      <group ref={groupRef} position={[0,-2,0]}>
        <mesh position={[0,0.9,0]}><cylinderGeometry args={[0.55,0.7,1.9,10]} /><meshStandardMaterial color="#7f1f26" roughness={0.8} /></mesh>
        <mesh position={[0,2.1,0]}><cylinderGeometry args={[0.42,0.55,1.3,10]} /><meshStandardMaterial color="#7f1f26" roughness={0.8} /></mesh>
        <mesh position={[0,2.9,0]}><sphereGeometry args={[0.52,10,10]} /><meshStandardMaterial color="#d8a870" /></mesh>
        <mesh position={[0,3.3,0]}><cylinderGeometry args={[0.56,0.56,0.14,14]} /><meshStandardMaterial color="#101010" /></mesh>
        {/* Raised arm */}
        <mesh position={[0.8,2.5,0.3]} rotation={[-0.9,0,-0.3]}><cylinderGeometry args={[0.18,0.22,1.2,8]} /><meshStandardMaterial color="#7f1f26" /></mesh>
        <mesh position={[1.4,3.2,0.7]}><cylinderGeometry args={[0.14,0.12,0.28,8]} /><meshStandardMaterial color="#c8a060" metalness={0.4} /></mesh>
      </group>
      {/* Heroes flanking */}
      {[-6,-4,-2,2,4,6].map((x,i) => (
        <group key={i} position={[x,-2,1.5-(Math.abs(x)/6)*2]}>
          <mesh position={[0,0.9,0]}><cylinderGeometry args={[0.45,0.58,1.8,8]} /><meshStandardMaterial color={HERO_COLORS[i]} roughness={0.8} /></mesh>
          <mesh position={[0,2.0,0]}><cylinderGeometry args={[0.35,0.45,1.1,8]} /><meshStandardMaterial color={HERO_COLORS[i]} roughness={0.8} /></mesh>
          <mesh position={[0,2.7,0]}><sphereGeometry args={[0.42,8,8]} /><meshStandardMaterial color="#d8a870" /></mesh>
          {/* Weapons */}
          <mesh position={[0.6,1.5,0]} rotation={[0.1,0,0.1]}><cylinderGeometry args={[0.05,0.05,3,5]} /><meshStandardMaterial color="#a09888" /></mesh>
        </group>
      ))}
      {/* "You" — the stranger in front */}
      <group position={[0,-2,4]}>
        <mesh position={[0,0.9,0]}><cylinderGeometry args={[0.5,0.65,1.8,10]} /><meshStandardMaterial color="#f0ece0" emissive="#ffffff" emissiveIntensity={0.08} /></mesh>
        <mesh position={[0,2.1,0]}><cylinderGeometry args={[0.4,0.5,1.2,10]} /><meshStandardMaterial color="#f0ece0" /></mesh>
        <mesh position={[0,2.9,0]}><sphereGeometry args={[0.48,10,10]} /><meshStandardMaterial color="#e8c880" /></mesh>
        {/* White glow aura — the outsider */}
        <mesh position={[0,1.5,0]}><sphereGeometry args={[1.2,8,8]} /><meshBasicMaterial color="#aaddff" transparent opacity={0.08} /></mesh>
      </group>
    </>
  );
}

// ── Cinematic scene data ────────────────────────────────────────
const SCENES = [
  {
    id: 'student',
    duration: 5500,
    Scene: ModernRoomScene,
    bg: '#0a0818',
    camera: { position: [0, 1.2, 6], fov: 52 },
    lines: [
      { t: 0,    text: 'Shanghai, 2024.', sub: null },
      { t: 1800, text: 'The night before the Song dynasty history exam.', sub: null },
      { t: 3800, text: 'He has been studying for 36 hours straight.', sub: null },
    ],
  },
  {
    id: 'fever',
    duration: 5000,
    Scene: FeverDreamScene,
    bg: '#0a0010',
    camera: { position: [0, 0, 10], fov: 58 },
    lines: [
      { t: 0,    text: 'A fever takes hold...', sub: null },
      { t: 1800, text: 'The ancient words on the page begin to move.', sub: null },
      { t: 3400, text: '"108 heroes... sworn brothers... Liangshan..."', sub: null },
    ],
  },
  {
    id: 'liangshan',
    duration: 6000,
    Scene: LiangshanScene,
    bg: '#b8ccf0',
    camera: { position: [0, 3, 18], fov: 52 },
    lines: [
      { t: 0,    text: 'He opens his eyes.', sub: null },
      { t: 1800, text: 'Song dynasty China. The age of the 108 heroes.', sub: '宋朝 — 梁山泊' },
      { t: 4000, text: 'The fortress of Liangshan rises on the horizon.', sub: null },
    ],
  },
  {
    id: 'raiders',
    duration: 5500,
    Scene: RaiderScene,
    bg: '#0a0808',
    camera: { position: [0, 1, 9], fov: 56 },
    lines: [
      { t: 0,    text: 'But the kingdom is not at peace.', sub: null },
      { t: 1800, text: 'Raiders burn villages. Magistrates oppress the people.', sub: null },
      { t: 3600, text: 'The road home runs through blood.', sub: null },
    ],
  },
  {
    id: 'heroes',
    duration: 6500,
    Scene: HeroGatherScene,
    bg: '#1a0808',
    camera: { position: [0, 3, 14], fov: 52 },
    lines: [
      { t: 0,    text: 'Song Jiang, leader of the 108 heroes, finds the stranger.', sub: '宋江' },
      { t: 2200, text: '"Only by uniting all 108 sworn brothers can order be restored."', sub: null },
      { t: 4400, text: '"...and only then will you find your way home."', sub: null },
    ],
  },
];

// ── Per-scene 3D canvas ────────────────────────────────────────
function SceneCanvas({ SceneComp, bg, camera }) {
  return (
    <Canvas
      camera={{ position: camera.position, fov: camera.fov, near: 0.1, far: 500 }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMappingExposure: 1.4 }}
      dpr={[1, 1]}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(bg, 1);
        scene.background = new THREE.Color(bg);
        gl.toneMappingExposure = 1.4;
      }}
    >
      <Suspense fallback={null}>
        <SceneComp />
      </Suspense>
    </Canvas>
  );
}

// ── Main opening cinematic ─────────────────────────────────────
export default function OpeningCinematic({ onComplete }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [visibleLines, setVisibleLines] = useState([]);
  const [transitioning, setTransitioning] = useState(false);
  const lineTimers = useRef([]);
  const sceneTimer = useRef(null);

  const scene = SCENES[sceneIdx];

  // Schedule text lines for current scene
  useEffect(() => {
    lineTimers.current.forEach(clearTimeout);
    lineTimers.current = [];
    setVisibleLines([]);

    scene.lines.forEach((line, i) => {
      const t = lineTimers.current[i] = setTimeout(() => {
        setVisibleLines((prev) => [...prev, line]);
      }, line.t);
    });

    return () => lineTimers.current.forEach(clearTimeout);
  }, [sceneIdx]);

  // Auto-advance scene
  useEffect(() => {
    clearTimeout(sceneTimer.current);
    sceneTimer.current = setTimeout(() => {
      if (sceneIdx < SCENES.length - 1) {
        setTransitioning(true);
        setTimeout(() => {
          setSceneIdx((s) => s + 1);
          setTransitioning(false);
        }, 600);
      } else {
        setTransitioning(true);
        setTimeout(onComplete, 700);
      }
    }, scene.duration);
    return () => clearTimeout(sceneTimer.current);
  }, [sceneIdx]);

  const skip = () => {
    lineTimers.current.forEach(clearTimeout);
    clearTimeout(sceneTimer.current);
    setTransitioning(true);
    setTimeout(onComplete, 500);
  };

  return (
    <div className={`cinematic-overlay ${transitioning ? 'fade-out' : 'fade-in'}`}>
      {/* 3D scene */}
      <div className="cinematic-canvas">
        <SceneCanvas key={sceneIdx} SceneComp={scene.Scene} bg={scene.bg} camera={scene.camera} />
      </div>

      {/* Cinematic bars */}
      <div className="cine-bar top" />
      <div className="cine-bar bottom" />

      {/* Vignette */}
      <div className="cine-vignette" />

      {/* Text lines */}
      <div className="cine-text-area">
        {visibleLines.map((line, i) => (
          <div key={i} className="cine-line-wrap">
            <p className="cine-line">{line.text}</p>
            {line.sub && <p className="cine-line-sub">{line.sub}</p>}
          </div>
        ))}
      </div>

      {/* Scene progress dots */}
      <div className="cine-dots">
        {SCENES.map((_, i) => (
          <div key={i} className={`cine-dot ${i === sceneIdx ? 'active' : i < sceneIdx ? 'done' : ''}`} />
        ))}
      </div>

      {/* Skip button */}
      <button className="cine-skip" onClick={skip}>Skip ›</button>

      {/* Final title flash on last scene */}
      {sceneIdx === SCENES.length - 1 && (
        <div className="cine-title-flash">
          <div className="cine-title-chi">夢</div>
          <div className="cine-title-en">Dream of Water Margin</div>
        </div>
      )}
    </div>
  );
}

