import { describe, it, expect } from 'vitest';
import { targetLoudness } from '../src/audio.js';
import { EnginePhysics } from '../src/physics.js';
import { ENGINES } from '../src/data/engines.js';

describe('audio loudness', () => {
  it('targetLoudness returns 0 when not running', () => {
    expect(targetLoudness(1, 1, false)).toBe(0);
  });

  it('targetLoudness returns 0.60 at minimum throttle and load', () => {
    expect(targetLoudness(0, 0, true)).toBeCloseTo(0.60, 2);
  });

  it('targetLoudness returns 1.00 at maximum throttle and load', () => {
    expect(targetLoudness(1, 1, true)).toBeCloseTo(1.00, 2);
  });

  it('targetLoudness accepts a physics object', () => {
    const physics = { effectiveThrottle: 0.5, load: 0.5 };
    // 0.60 + 0.30 * 0.5 + 0.10 * 0.5 = 0.60 + 0.15 + 0.05 = 0.80
    expect(targetLoudness(physics, true)).toBeCloseTo(0.80, 2);
  });

  it('every engine at idle has at least 60% of its power-mode loudness', () => {
    for (const id in ENGINES) {
      const p = new EnginePhysics(id);
      
      // Power mode: full throttle, full load
      p.throttle = 1;
      p.effectiveThrottle = 1;
      p.load = 1;
      const powerLoudness = targetLoudness(p, true);
      
      // Idle mode: zero throttle, zero load (physics will have some idleTrim)
      p.throttle = 0;
      p.load = 0;
      p.rpm = ENGINES[id].idleRpm;
      // Simulate one step to let idle control kick in
      p.step(0.1);
      
      const idleLoudness = targetLoudness(p, true);
      
      expect(powerLoudness).toBeGreaterThan(0);
      expect(idleLoudness / powerLoudness).toBeGreaterThanOrEqual(0.60);
    }
  });

  it('no engine has a silent spectrum at idle', () => {
    const { makeLayout } = require('../src/data/engines.js');
    const { cycleSpectrum } = require('../src/audio.js');
    for (const id in ENGINES) {
      const e = ENGINES[id];
      const { real, imag } = cycleSpectrum(id, makeLayout(e), 0, e.idleRpm);
      let power = 0;
      for (let h = 1; h < real.length; h++) {
        power += real[h] * real[h] + imag[h] * imag[h];
      }
      expect(power, `${id} should not be silent at idle`).toBeGreaterThan(1e-6);
    }
  });
});
