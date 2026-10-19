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
