// Engine sound, synthesised from the physics. The summed cylinder pressure over one 720° cycle is
// turned into a periodic wave (so firing order, cylinder count and combustion strength shape the
// tone), played at the cycle frequency (rpm / 120) and run through throttle-dependent filters.
import { EnginePhysics } from './physics.js';
import { makeLayout } from './data/engines.js';

const HARMONICS = 96;

/** Fourier coefficients (per cycle harmonic) of the summed cylinder pressure. */
export function cycleSpectrum(type, layout, throttle, rpm) {
  const ph = new EnginePhysics(type);
  const thr = Math.max(0.12, throttle);
  ph.rpm = rpm; ph.throttle = thr; ph.effectiveThrottle = thr;
  ph.boost = ph.spec.boostMax * thr * Math.min(1, Math.max(0, (rpm - 1300) / 1700));
  ph.updateCycle(true);
  const N = 720, s = new Float32Array(N);
  for (const c of layout.cylinders) for (let a = 0; a < N; a++) s[a] += ph.pressureAt(a + c.phase) / 1e5;
  const mean = s.reduce((x, y) => x + y, 0) / N;
  const real = new Float32Array(HARMONICS + 1), imag = new Float32Array(HARMONICS + 1);
  for (let h = 1; h <= HARMONICS; h++) {
    let re = 0, im = 0;
    for (let a = 0; a < N; a++) { const w = (2 * Math.PI * h * a) / N; re += (s[a] - mean) * Math.cos(w); im += (s[a] - mean) * Math.sin(w); }
    // a gentle spectral tilt keeps the top end from turning into hiss
    const tilt = 1 / (1 + h / 28);
    real[h] = (2 / N) * re * tilt; imag[h] = (2 / N) * im * tilt;
  }
  return { real, imag };
}

function buildWave(ctx, type, layout, throttle, rpm) {
  const { real, imag } = cycleSpectrum(type, layout, throttle, rpm);
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

export function createEngineAudio() {
  let ctx = null, osc, tone, noise, noiseGain, master, wave = null, key = '', lastBuild = 0;
  let on = false;

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    osc = ctx.createOscillator();
    tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.9;
    const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 110; body.gain.value = 5; body.Q.value = 0.8;
    master = ctx.createGain(); master.gain.value = 0;
    // soft saturation adds upper harmonics, so the low idle rumble is still audible on laptop and phone speakers
    const shaper = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / 511.5 - 1) * 2.4; curve[i] = Math.tanh(x); }
    shaper.curve = curve;
    osc.connect(tone); tone.connect(shaper); shaper.connect(body); body.connect(master);
    // intake / exhaust rush: filtered noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 700; nf.Q.value = 0.7;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
    noise.connect(nf); nf.connect(noiseGain); noiseGain.connect(master);
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    osc.start(); noise.start();
  }

  return {
    get on() { return on; },
    async set(enabled) {
      on = enabled;
      if (on) { if (!ctx) init(); await ctx.resume(); }
      else if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    /** Call every frame (cheap). */
    update({ physics, spec, running }) {
      if (!ctx || !on) return;
      const t = ctx.currentTime, thr = physics.effectiveThrottle ?? physics.throttle, rpm = physics.rpm;
      const k = spec.id + '|' + Math.round(rpm / 250) + '|' + Math.round(thr * 8);
      if (k !== key && performance.now() - lastBuild > 160) {
        key = k; lastBuild = performance.now();
        wave = buildWave(ctx, spec.id, makeLayout(spec), thr, rpm);
        osc.setPeriodicWave(wave);
      }
      osc.frequency.setTargetAtTime(Math.max(1, rpm / 120), t, 0.04);
      tone.frequency.setTargetAtTime(750 + thr * 1800 + rpm * 0.5, t, 0.06);
      noiseGain.gain.setTargetAtTime(running ? 0.03 + 0.06 * thr * Math.min(1, rpm / spec.redline + 0.2) : 0, t, 0.08);
      const loud = 0.55 + 0.35 * thr + 0.1 * physics.load;
      master.gain.setTargetAtTime(running ? loud * 0.5 : 0, t, running ? 0.08 : 0.12);
    },
  };
}
