#!/usr/bin/env node
/**
 * Independent verification of what the agent left in the working tree. The agent's own report is
 * never trusted: this runs the real roadmap validation, build and tests.
 * Writes ok / changed / errors to $GITHUB_OUTPUT. Always exits 0 so later steps can decide.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

function run(label, cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  console.log(`\n=== ${label}: exit ${r.status} ===\n${out.split('\n').slice(-40).join('\n')}`);
  return { label, status: r.status ?? 1, out };
}
const digest = (res) => {
  const lines = res.out.split('\n');
  const keep = lines.filter((l) => /FAIL|AssertionError|Error:|expected|received|Cannot find|does not exist|✗|×|Could not resolve|SyntaxError|is not defined/.test(l));
  return `### ${res.label} failed\n${(keep.length ? keep : lines.slice(-30)).slice(0, 40).join('\n')}`;
};

const results = [
  run('roadmap validation', 'node', ['scripts/validate-roadmap.mjs']),
  run('tests', 'npm', ['test']),
  run('build', 'npm', ['run', 'build']),
];
const failed = results.filter((r) => r.status !== 0);
const changed = (spawnSync('git', ['status', '--porcelain', '--', 'src', 'tests', 'index.html'], { encoding: 'utf8' }).stdout || '').trim().length > 0;

// The agent may not mark roadmap items complete itself: only record-progress.mjs does.
function tamper() {
  try {
    const before = JSON.parse(spawnSync('git', ['show', 'HEAD:roadmap/progress.json'], { encoding: 'utf8' }).stdout || '{}');
    const after = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
    if (JSON.stringify(before.completed_ids) !== JSON.stringify(after.completed_ids)) return '### progress tampering\nThe agent edited completed_ids; only the workflow may do that.';
    const rb = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', 'roadmap/roadmap.json']).status;
    if (rb !== 0) return '### roadmap tampering\nThe agent edited roadmap/roadmap.json; the backlog is fixed.';
  } catch { /* unreadable progress is caught by validation */ }
  return null;
}
const problem = tamper();
const ok = failed.length === 0 && !problem;
const errors = [...failed.map(digest), ...(problem ? [problem] : [])].join('\n\n').slice(0, 6000);

console.log(`\nVERIFY: ok=${ok} changed=${changed}`);
if (process.env.GITHUB_OUTPUT) {
  const d = `ERR_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `ok=${ok}\nchanged=${changed}\nerrors<<${d}\n${errors}\n${d}\n`);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Verification (${process.env.VERIFY_LABEL || 'check'})\n\n${ok ? '✅ roadmap, tests and build pass' : '❌ failed\n\n```\n' + errors + '\n```'}\n`);
}
