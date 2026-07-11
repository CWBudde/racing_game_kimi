// Synthesized game audio (PLAN.md · 2.5 / A1+A2): an engine loop pitched by
// speed, a boost hiss, and one-shot SFX for the countdown, collisions, items,
// laps, and the race finish. Everything is generated from WebAudio primitives
// at call time, so the bundle ships zero audio assets.
//
// Plain singleton module (like the shared `keys` object) so both the physics
// frame loop and DOM handlers can call it without React plumbing. Every entry
// point is safe to call before the AudioContext exists or while the browser
// still has it suspended — calls are simply dropped until `unlockAudio` has
// run inside a user gesture.

const MASTER_VOLUME = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  return ctx;
};

// Browsers refuse to start (or resume) an AudioContext outside a user
// gesture. Call from any pointer/key handler; repeat calls are no-ops.
export const unlockAudio = () => {
  const c = getContext();
  if (c?.state === "suspended") void c.resume();
};

// Rate-limits repeatable one-shots: collision spam while grinding a wall, and
// Strict-mode's double effect run replaying the first countdown beep.
const lastPlayed: Record<string, number> = {};
const throttled = (key: string, minGapS: number): boolean => {
  const t = ctx?.currentTime ?? 0;
  const last = lastPlayed[key];
  if (last !== undefined && t - last < minGapS) return true;
  lastPlayed[key] = t;
  return false;
};

interface ToneOpts {
  type: OscillatorType;
  freq: number;
  freqEnd?: number; // exponential glide target over the duration
  start?: number; // seconds from now
  duration: number;
  gain: number;
}

const playTone = ({ type, freq, freqEnd, start = 0, duration, gain }: ToneOpts) => {
  const c = getContext();
  if (!c || !master || c.state !== "running") return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
};

// One second of shared white noise, looped by the boost hiss and windowed by
// collision bursts.
let noiseBuffer: AudioBuffer | null = null;
const getNoiseBuffer = (c: AudioContext): AudioBuffer => {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
};

// --- Engine loop (A1) --------------------------------------------------------
// A sawtooth + half-frequency square through a lowpass: the saw reads as the
// rev fundamental, the sub-square fills in the body, and the filter opening
// with speed stands in for the intake getting louder. Pitched by speed ratio
// (1.0 = unboosted top speed) every physics frame.

const ENGINE_IDLE_HZ = 55;
const ENGINE_MAX_HZ = 195;

let engine: {
  osc: OscillatorNode;
  sub: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
} | null = null;

export const engineStart = () => {
  const c = getContext();
  if (!c || !master || engine) return;
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = ENGINE_IDLE_HZ;
  const sub = c.createOscillator();
  sub.type = "square";
  sub.frequency.value = ENGINE_IDLE_HZ / 2;

  const oscMix = c.createGain();
  oscMix.gain.value = 1;
  const subMix = c.createGain();
  subMix.gain.value = 0.4;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.Q.value = 1;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.055, t + 0.25);

  osc.connect(oscMix).connect(filter);
  sub.connect(subMix).connect(filter);
  filter.connect(gain).connect(master);
  osc.start(t);
  sub.start(t);
  engine = { osc, sub, filter, gain };
};

export const engineUpdate = (speedRatio: number, throttle: number) => {
  if (!engine || !ctx) return;
  const t = ctx.currentTime;
  const r = Math.min(Math.max(speedRatio, 0), 1.25); // boost revs past 1.0
  const freq =
    ENGINE_IDLE_HZ + (ENGINE_MAX_HZ - ENGINE_IDLE_HZ) * r + throttle * 12;
  // setTargetAtTime = exponential approach, so per-frame retargeting glides
  // instead of zipper-stepping.
  const tc = 0.08;
  engine.osc.frequency.setTargetAtTime(freq, t, tc);
  engine.sub.frequency.setTargetAtTime(freq / 2, t, tc);
  engine.filter.frequency.setTargetAtTime(420 + 2600 * r + 300 * throttle, t, tc);
  engine.gain.gain.setTargetAtTime(0.05 + 0.05 * r + 0.02 * throttle, t, tc);
};

export const engineStop = () => {
  setBoostHiss(false);
  if (!engine || !ctx) return;
  const { osc, sub, gain } = engine;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setTargetAtTime(0, t, 0.05);
  osc.stop(t + 0.4);
  sub.stop(t + 0.4);
  engine = null;
};

// --- Boost hiss (A2) ---------------------------------------------------------
// A looped noise source through a bandpass, faded in/out on state changes. The
// loop is created once and left running at zero gain — cheaper than rebuilding
// the graph on every SHIFT tap.

let boost: { gain: GainNode } | null = null;
let boostOn = false;

export const setBoostHiss = (on: boolean) => {
  if (on === boostOn) return;
  boostOn = on;
  const c = getContext();
  if (!c || !master) return;
  const t = c.currentTime;
  if (on && !boost) {
    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2400;
    filter.Q.value = 0.8;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    boost = { gain };
  }
  if (!boost) return;
  boost.gain.gain.cancelScheduledValues(t);
  boost.gain.gain.setTargetAtTime(on ? 0.09 : 0, t, on ? 0.05 : 0.08);
};

// --- One-shot SFX (A2) -------------------------------------------------------

// Countdown light steps: short blips for the red lights, a longer higher "GO".
export const playCountdownBeep = (isGo: boolean) => {
  if (throttled("beep", 0.15)) return;
  if (isGo) {
    playTone({ type: "square", freq: 880, duration: 0.45, gain: 0.16 });
  } else {
    playTone({ type: "square", freq: 440, duration: 0.14, gain: 0.12 });
  }
};

// Collision thud: a pitch-dropping sine for the body plus a lowpassed noise
// burst for the crunch. `intensity` in [0,1] scales the level.
export const playCollision = (intensity: number) => {
  if (throttled("collision", 0.12)) return;
  const c = getContext();
  if (!c || !master || c.state !== "running") return;
  const t = c.currentTime;
  const level = 0.1 + 0.25 * Math.min(1, Math.max(0, intensity));
  playTone({ type: "sine", freq: 110, freqEnd: 40, duration: 0.18, gain: level });
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const gain = c.createGain();
  gain.gain.setValueAtTime(level * 0.8, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.16);
};

export const playItemPickup = () => {
  playTone({ type: "triangle", freq: 880, duration: 0.09, gain: 0.12 });
  playTone({ type: "triangle", freq: 1320, start: 0.09, duration: 0.12, gain: 0.12 });
};

export const playItemUse = () => {
  playTone({ type: "sawtooth", freq: 700, freqEnd: 160, duration: 0.22, gain: 0.14 });
};

// Two-note chime on closing a lap; a third rising note announces the final lap.
export const playLapChime = (finalLap: boolean) => {
  playTone({ type: "sine", freq: 660, duration: 0.12, gain: 0.14 });
  playTone({ type: "sine", freq: 880, start: 0.12, duration: 0.18, gain: 0.14 });
  if (finalLap) {
    playTone({ type: "sine", freq: 1100, start: 0.3, duration: 0.3, gain: 0.15 });
  }
};

// Race-finish sting: a rising C-major arpeggio.
export const playFinishSting = () => {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    playTone({
      type: "triangle",
      freq,
      start: i * 0.14,
      duration: i === notes.length - 1 ? 0.5 : 0.16,
      gain: 0.15,
    });
  });
};
