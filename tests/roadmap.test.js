import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { validateRoadmap, nextItem } from '../scripts/validate-roadmap.mjs';

const roadmap = JSON.parse(fs.readFileSync('roadmap/roadmap.json', 'utf8'));
const progress = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));

describe('roadmap', () => {
  it('is valid', () => {
    expect(validateRoadmap(roadmap, progress)).toEqual([]);
  });
  it('rejects a dependency on a later item', () => {
    const bad = structuredClone(roadmap);
    bad.items[0].depends = [bad.items[1].id];
    expect(validateRoadmap(bad, progress).length).toBeGreaterThan(0);
  });
  it('picks the first eligible automatic item and respects dependencies', () => {
    const first = nextItem(roadmap, { ...progress, completed_ids: [], blocked: [] });
    expect(first.auto).toBe(true);
    expect(first.depends).toEqual([]);
    const skipped = nextItem(roadmap, { ...progress, completed_ids: [], blocked: [{ id: first.id, reason: 'x' }] });
    expect(skipped.id).not.toBe(first.id);
  });
});

import { UPCOMING, STAGES } from '../src/data/upcoming.js';
import { ENGINES } from '../src/data/engines.js';

describe('upcoming engines', () => {
  it('have unique ids that are not yet published and a valid stage', () => {
    const ids = UPCOMING.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of UPCOMING) {
      expect(ENGINES[u.id], `${u.id} is published, remove it from UPCOMING`).toBeUndefined();
      for (const k of ['short', 'name', 'sub']) expect(typeof u[k]).toBe('string');
      expect(Number.isInteger(u.done) && u.done >= 0 && u.done < STAGES.length - 1).toBe(true);
    }
  });

  it('have valid draft figures and displacement matching name within 5% when done >= 1', () => {
    for (const u of UPCOMING) {
      if (u.done >= 1) {
        expect(u.draft).toBeDefined();
        expect(u.draft.cylinders).toBeGreaterThan(0);
        expect(u.draft.bore).toBeGreaterThan(0);
        expect(u.draft.stroke).toBeGreaterThan(0);
        expect(u.draft.compression).toBeGreaterThan(0);
        expect(u.draft.redline).toBeGreaterThan(0);
        expect(Array.isArray(u.draft.firingOrder)).toBe(true);

        const displacementL = u.draft.cylinders * Math.PI * Math.pow(u.draft.bore / 2, 2) * u.draft.stroke * 1000;
        const match = u.name.match(/([0-9.]+)L/);
        if (match) {
          const nominalL = parseFloat(match[1]);
          const diffRatio = Math.abs(displacementL - nominalL) / nominalL;
          expect(diffRatio).toBeLessThan(0.05);
        }
      }
    }
  });
});
