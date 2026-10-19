#!/usr/bin/env node
/**
 * Records the outcome of a verified run. Only this script (never the agent) marks items complete,
 * and only when verification passed AND source files actually changed.
 * Env: ITEM_ID, VERIFY_OK, CHANGED.
 */
import fs from 'node:fs';
import { nextItem } from './validate-roadmap.mjs';

const roadmap = JSON.parse(fs.readFileSync('roadmap/roadmap.json', 'utf8'));
const p = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
const id = process.env.ITEM_ID || '';
const ok = process.env.VERIFY_OK === 'true', changed = process.env.CHANGED === 'true';
p.last_run = new Date().toISOString();

if (ok && changed && id && id !== 'FIX') {
  if (!p.completed_ids.includes(id)) p.completed_ids.push(id);
  p.last_outcome = 'verified';
  p.consecutive_failures = 0;
  p.last_failure = null;
  p.notes = `${id} built and verified by the workflow (tests and build). Visual changes still need a human look in the pull request.`;
} else if (ok && changed && id === 'FIX') {
  p.last_outcome = 'baseline_fixed';
  p.consecutive_failures = 0;
  p.notes = 'The failing baseline was repaired and verified.';
} else if (ok && !changed) {
  p.last_outcome = id ? 'no_changes' : 'nothing_to_do';
  if (id) p.consecutive_failures = (p.consecutive_failures || 0) + 1;
  p.notes = id ? `The agent made no changes for ${id}.` : 'No eligible roadmap item; the remaining items need a person.';
  if (id && id !== 'FIX' && p.consecutive_failures >= 3) {
    p.blocked = [...(p.blocked || []), { id, reason: '3 runs in a row made no changes' }];
    p.consecutive_failures = 0;
  }
}
const n = nextItem(roadmap, p);
p.current_task = n ? `${n.id} — ${n.title}` : 'none eligible';
fs.writeFileSync('roadmap/progress.json', JSON.stringify(p, null, 2) + '\n');
console.log(`Recorded: ${p.last_outcome}; next: ${p.current_task}`);
