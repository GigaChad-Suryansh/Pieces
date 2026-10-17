import { describe, it, expect } from 'vitest';
import { EnginePhysics, steadyState } from '../src/physics.js';
import { ENGINES, makeLayout } from '../src/data/engines.js';
import { cycleSpectrum } from '../src/audio.js';
import { CATALOG, partsFor } from '../src/data/catalog.js';

const IDS = Object.keys(ENGINES);

describe('geometry', () => {
  for (const id of IDS) {
    it(`${id}: piston travel equals the stroke and compression ratio holds`, () => {
      const p = new EnginePhysics(id);
      expect(p.pistonPosition(Math.PI)).toBeCloseTo(p.spec.stroke, 6);
      expect(p.pistonPosition(0)).toBeCloseTo(0, 9);
      expect(p.volume(Math.PI) / p.volume(0)).toBeCloseTo(p.spec.compression, 4);
    });
    it(`${id}: dV/dθ matches a numerical derivative`, () => {
      const p = new EnginePhysics(id), h = 1e-5;
      for (const t of [0.4, 1.3, 2.2, 4.0]) {
        const num = (p.volume(t + h) - p.volume(t - h)) / (2 * h);
        expect(p.volumeDerivative(t)).toBeCloseTo(num, 9);
      }
    });
  }
});

describe('layout', () => {
  for (const id of IDS) {
    it(`${id}: firing events are evenly spread over 720° (or fixed by the layout)`, () => {
      const l = makeLayout(ENGINES[id]);
      const phases = l.cylinders.map((c) => c.phase).sort((a, b) => a - b);
      expect(new Set(phases).size).toBe(l.cylinders.length);
      phases.forEach((ph, i) => expect(((phases[(i + 1) % phases.length] - ph + 720) % 720)).toBeCloseTo(720 / phases.length, 6));
    });
  }
});

describe('combustion model', () => {
  for (const id of IDS) {
    it(`${id}: pressure is finite, peaks after TDC and the cycle does net positive work`, () => {
      const p = steadyState(id, ENGINES[id].redline * 0.5, 1);
      expect(p.peak).toBeGreaterThan(20);
      expect(p.peak).toBeLessThan(220);
      expect(p.torque).toBeGreaterThan(20);
      const e = new EnginePhysics(id);
      e.rpm = ENGINES[id].redline * 0.5; e.throttle = 1; e.effectiveThrottle = 1; e.updateCycle(true);
      expect(e.peakAngle).toBeGreaterThan(360);
      expect(e.peakAngle).toBeLessThan(400);
      expect(e.cycleWork).toBeGreaterThan(0);
      for (const v of e.trace) expect(Number.isFinite(v)).toBe(true);
    });
    it(`${id}: more throttle gives more torque`, () => {
      const r = ENGINES[id].redline * 0.5;
      expect(steadyState(id, r, 1).torque).toBeGreaterThan(steadyState(id, r, 0.3).torque);
    });
  }
});

describe('dynamics', () => {
  for (const id of IDS) {
    it(`${id}: idles near its target rpm with the pedal released`, () => {
      const e = new EnginePhysics(id);
      e.throttle = 0; e.load = 0.08; e.rpm = ENGINES[id].idleRpm * 1.4;
      e.settle(12);
      expect(Math.abs(e.rpm - ENGINES[id].idleRpm) / ENGINES[id].idleRpm).toBeLessThan(0.15);
    });
    it(`${id}: full throttle revs towards redline without NaN`, () => {
      const e = new EnginePhysics(id);
      e.throttle = 1; e.load = 0.12; e.rpm = ENGINES[id].idleRpm;
      const snap = e.settle(40);
      expect(Number.isFinite(snap.torque)).toBe(true);
      expect(snap.rpm).toBeGreaterThan(ENGINES[id].redline * 0.7);
      expect(snap.rpm).toBeLessThanOrEqual(ENGINES[id].redline + 1);
    });
  }
});

describe('sound', () => {
  it('the loudest harmonic of an inline-4 is its firing order (4th)', () => {
    const { real, imag } = cycleSpectrum('i4', makeLayout(ENGINES.i4), 0.8, 3000);
    const mag = Array.from(real, (r, i) => Math.hypot(r, imag[i]));
    const top = mag.indexOf(Math.max(...mag.slice(1)));
    expect(top % 4).toBe(0);
  });
});

describe('catalogue', () => {
  it('parts are unique and fuel-specific parts follow the engine', () => {
    expect(new Set(CATALOG.map((p) => p.name)).size).toBe(CATALOG.length);
    expect(partsFor(ENGINES.diesel).some((p) => p.name === 'Spark plug')).toBe(false);
    expect(partsFor(ENGINES.i4).some((p) => p.name === 'Turbocharger')).toBe(false);
  });
});

import { ANATOMY } from '../src/data/anatomy.js';
describe('anatomy data', () => {
  it('every catalogue part has complete anatomy and valid neighbours', () => {
    const names = new Set(CATALOG.map((p) => p.name));
    for (const p of CATALOG) {
      const a = ANATOMY[p.name];
      expect(a, p.name).toBeDefined();
      for (const k of ['does', 'made', 'fails', 'notice']) expect(a[k].length, `${p.name}.${k}`).toBeGreaterThan(20);
      expect(a.life.length, `${p.name}.life`).toBeGreaterThan(6);
      expect(a.links.length, p.name).toBeGreaterThan(0);
      for (const l of a.links) expect(names.has(l), `${p.name} -> ${l}`).toBe(true);
    }
    expect(Object.keys(ANATOMY).length).toBe(CATALOG.length);
  });
});
