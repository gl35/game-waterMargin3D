// ── Procedural sound effects via Web Audio API ──
// All sounds are synthesized from oscillators + noise + envelopes at runtime.
// No external audio files. Cheap, ~kB-free, controllable.

let _ctx = null;
let _master = null;
let _muted = false;

function ctx() {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
    _master = _ctx.createGain();
    _master.gain.value = 0.55;
    _master.connect(_ctx.destination);
  }
  // Browsers suspend audio until user gesture — resume opportunistically
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

export function setMuted(m) { _muted = !!m; }
export function isMuted()    { return _muted; }
export function setMasterVolume(v) {
  if (!_master) ctx();
  if (_master) _master.gain.value = Math.max(0, Math.min(1, v));
}

// Helpers
function envGain(c, attack, hold, release, peak = 0.5, startGain = 0) {
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(startGain, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return g;
}

function noiseBuffer(c, durationSec) {
  const len = Math.floor(c.sampleRate * durationSec);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Public effects ──

// Generic light hit — short noise pop + brief tone
export function sfxHit() {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  // Noise burst
  const ns = c.createBufferSource();
  ns.buffer = noiseBuffer(c, 0.10);
  const nf = c.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 1800;
  const ng = envGain(c, 0.003, 0.02, 0.08, 0.30);
  ns.connect(nf); nf.connect(ng); ng.connect(_master);
  ns.start(t); ns.stop(t + 0.12);
  // Quick down-chirp tone
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(380, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
  const og = envGain(c, 0.001, 0.02, 0.07, 0.18);
  o.connect(og); og.connect(_master);
  o.start(t); o.stop(t + 0.10);
}

// Crit — louder, descending bigger pitch
export function sfxCrit() {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const o1 = c.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.setValueAtTime(560, t);
  o1.frequency.exponentialRampToValueAtTime(140, t + 0.16);
  const og = envGain(c, 0.005, 0.04, 0.14, 0.32);
  o1.connect(og); og.connect(_master);
  o1.start(t); o1.stop(t + 0.20);
  // Higher-frequency sparkle
  const o2 = c.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(1600, t);
  o2.frequency.exponentialRampToValueAtTime(800, t + 0.10);
  const o2g = envGain(c, 0.001, 0.01, 0.08, 0.18);
  o2.connect(o2g); o2g.connect(_master);
  o2.start(t); o2.stop(t + 0.10);
}

// Heavy kill — deep thud with low rumble
export function sfxKill() {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.30);
  const og = envGain(c, 0.005, 0.05, 0.30, 0.42);
  o.connect(og); og.connect(_master);
  o.start(t); o.stop(t + 0.36);
  // Noise tail
  const ns = c.createBufferSource();
  ns.buffer = noiseBuffer(c, 0.22);
  const nf = c.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 350;
  const ng = envGain(c, 0.003, 0.05, 0.18, 0.22);
  ns.connect(nf); nf.connect(ng); ng.connect(_master);
  ns.start(t); ns.stop(t + 0.24);
}

// Item pickup — rising chime, varies by type
export function sfxPickup(type = 'gold') {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const tones = {
    heal:   [520, 880],
    gold:   [660, 1040],
    energy: [780, 1240],
    scroll: [880, 1480],
  };
  const [start, end] = tones[type] || tones.gold;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(start, t);
  o.frequency.exponentialRampToValueAtTime(end, t + 0.18);
  const og = envGain(c, 0.005, 0.05, 0.18, 0.26);
  o.connect(og); og.connect(_master);
  o.start(t); o.stop(t + 0.24);
}

// Footstep — short filtered noise tap
export function sfxFootstep() {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const ns = c.createBufferSource();
  ns.buffer = noiseBuffer(c, 0.06);
  const nf = c.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 900 + Math.random() * 200;
  const ng = envGain(c, 0.002, 0.01, 0.04, 0.12);
  ns.connect(nf); nf.connect(ng); ng.connect(_master);
  ns.start(t); ns.stop(t + 0.06);
}

// Dialog typewriter blip — a soft brief click
export function sfxDialogBlip() {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(620 + Math.random() * 80, t);
  const og = envGain(c, 0.001, 0.005, 0.025, 0.08);
  o.connect(og); og.connect(_master);
  o.start(t); o.stop(t + 0.03);
}

// Chapter banner — three-note rising chord
export function sfxBanner() {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const notes = [330, 415, 523]; // E4, G#4, C5 — bright lift
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t + i * 0.08);
    const og = envGain(c, 0.01, 0.20, 0.45, 0.16);
    // Schedule its envelope starting offset
    og.gain.cancelScheduledValues(t);
    og.gain.setValueAtTime(0, t + i * 0.08);
    og.gain.linearRampToValueAtTime(0.16, t + i * 0.08 + 0.02);
    og.gain.linearRampToValueAtTime(0.14, t + i * 0.08 + 0.20);
    og.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.65);
    o.connect(og); og.connect(_master);
    o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.7);
  });
}

// Generic UI click / button
export function sfxClick() {
  if (_muted) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(640, t + 0.05);
  const og = envGain(c, 0.001, 0.01, 0.05, 0.10);
  o.connect(og); og.connect(_master);
  o.start(t); o.stop(t + 0.07);
}
