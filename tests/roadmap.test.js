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
});
