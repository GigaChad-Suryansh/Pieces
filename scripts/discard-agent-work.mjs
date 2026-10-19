#!/usr/bin/env node
/**
 * Called when the agent's work failed independent verification even after a repair attempt.
 * Throws away its source changes, records the failure in roadmap/progress.json, and after three
 * failures on the same item marks it blocked so the next run moves on.
 * Env: ITEM_ID, FAIL_NOTE. Writes `discarded_files` to $GITHUB_OUTPUT.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const sh = (args) => spawnSync('git', args, { encoding: 'utf8' });
const PATHS = ['src', 'tests', 'index.html', 'roadmap/roadmap.json'];
const changed = sh(['status', '--porcelain', '--', ...PATHS]).stdout.split('\n').filter(Boolean).map((l) => l.slice(3).trim());
sh(['restore', '--source=HEAD', '--staged', '--worktree', '--', ...PATHS]);
sh(['clean', '-fdq', '--', 'src', 'tests']);

const p = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
const id = process.env.ITEM_ID || null;
const note = (process.env.FAIL_NOTE || 'verification failed').replace(/\s+/g, ' ').trim().slice(0, 500);
p.last_run = new Date().toISOString();
p.last_outcome = 'failed_verification';
p.current_task = id ? `Retry ${id}` : p.current_task;
p.consecutive_failures = (p.consecutive_failures || 0) + 1;
p.last_failure = { id, note, at: p.last_run };
p.notes = "Last run: the agent's changes did not pass the checks and were discarded by the workflow. Nothing was marked complete.";
if (id && id !== 'FIX' && p.consecutive_failures >= 3) {
  p.blocked = [...(p.blocked || []), { id, reason: `3 consecutive failed attempts. Last error: ${note}` }];
  p.consecutive_failures = 0;
}
fs.writeFileSync('roadmap/progress.json', JSON.stringify(p, null, 2) + '\n');
console.log(`Discarded agent changes: ${changed.join(', ') || '(none)'}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `discarded_files=${changed.join(', ')}\n`);
