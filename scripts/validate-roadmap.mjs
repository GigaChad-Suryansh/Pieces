#!/usr/bin/env node
/** Validates roadmap/roadmap.json and roadmap/progress.json. Exit 1 with a list of problems. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIZES = ['S', 'M', 'L'];

export function validateRoadmap(roadmap, progress) {
  const errors = [];
  const items = roadmap?.items;
  if (!Array.isArray(items) || items.length === 0) return ['roadmap.items must be a non-empty array'];
  const areas = new Set(roadmap.areas || []);
  const seen = new Map();
  items.forEach((it, idx) => {
    const where = `item ${it?.id ?? '#' + idx}`;
    if (!it.id || typeof it.id !== 'string') errors.push(`${where}: missing id`);
    if (seen.has(it.id)) errors.push(`${where}: duplicate id`);
    for (const d of it.depends || []) if (!seen.has(d)) errors.push(`${where}: depends on "${d}" which is not an earlier item`);
    seen.set(it.id, idx);
    if (!areas.has(it.area)) errors.push(`${where}: unknown area "${it.area}"`);
    if (!SIZES.includes(it.size)) errors.push(`${where}: size must be one of ${SIZES.join('/')}`);
    if (typeof it.auto !== 'boolean') errors.push(`${where}: auto must be true or false`);
    if (typeof it.title !== 'string' || it.title.length < 5) errors.push(`${where}: title too short`);
    if (typeof it.detail !== 'string' || it.detail.length < 30) errors.push(`${where}: detail too short`);
    if (!Array.isArray(it.acceptance) || it.acceptance.length === 0) errors.push(`${where}: needs at least one acceptance criterion`);
    // Small-step rule: anything the daily agent runs must be tiny so one run can finish it.
    if (it.auto === true && !(progress?.completed_ids || []).includes(it.id)) {
      if (it.size !== 'S') errors.push(`${where}: automatic items must be size S (split it into smaller steps)`);
      if (!Array.isArray(it.files) || it.files.length < 1 || it.files.length > 3) errors.push(`${where}: automatic items must list 1-3 files to touch`);
      if (typeof it.detail === 'string' && it.detail.length > 700) errors.push(`${where}: detail longer than 700 characters`);
      if (Array.isArray(it.acceptance) && it.acceptance.length > 4) errors.push(`${where}: more than 4 acceptance criteria`);
    }
  });
  const done = progress?.completed_ids;
  if (!Array.isArray(done)) errors.push('progress.completed_ids must be an array');
  else {
    for (const id of done) if (!seen.has(id)) errors.push(`progress: completed id "${id}" is not in the roadmap`);
    if (new Set(done).size !== done.length) errors.push('progress: completed_ids has duplicates');
    for (const id of done) {
      const it = items[seen.get(id)];
      for (const d of it?.depends || []) if (!done.includes(d)) errors.push(`progress: "${id}" completed before its dependency "${d}"`);
    }
  }
  for (const b of progress?.blocked || []) if (!seen.has(b.id)) errors.push(`progress: blocked id "${b.id}" is not in the roadmap`);
  return errors;
}

/** The first item the agent may take: not done, not blocked, dependencies done, auto=true. */
export function nextItem(roadmap, progress) {
  const done = new Set(progress.completed_ids || []);
  const blocked = new Set((progress.blocked || []).map((b) => b.id));
  return roadmap.items.find((it) => it.auto && !done.has(it.id) && !blocked.has(it.id) && (it.depends || []).every((d) => done.has(d))) || null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const roadmap = JSON.parse(fs.readFileSync('roadmap/roadmap.json', 'utf8'));
    const progress = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
    const errors = validateRoadmap(roadmap, progress);
    if (errors.length) {
      console.error('Roadmap problems:\n- ' + errors.join('\n- '));
      process.exit(1);
    }
    const n = nextItem(roadmap, progress);
    console.log(`Roadmap OK: ${roadmap.items.length} items, ${progress.completed_ids.length} done. Next automatic item: ${n ? `${n.id} — ${n.title}` : 'none'}`);
  } catch (e) {
    console.error('Roadmap files unreadable: ' + e.message);
    process.exit(1);
  }
}
