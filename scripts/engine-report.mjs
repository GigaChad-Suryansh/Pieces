#!/usr/bin/env node
/** Prints a quick plausibility report for one or all engines: node scripts/engine-report.mjs [id] */
import { ENGINES } from '../src/data/engines.js';
import { steadyState } from '../src/physics.js';

const ids = process.argv[2] ? [process.argv[2]] : Object.keys(ENGINES);
for (const id of ids) {
  const e = ENGINES[id];
  if (!e) { console.error(`unknown engine "${id}"`); process.exit(1); }
  const disp = (Math.PI / 4) * e.bore * e.bore * e.stroke * e.cylinders * 1000;
  let tq = { torque: 0 }, pw = { power: 0 };
  for (let r = Math.round(e.idleRpm * 1.15 / 250) * 250; r <= e.redline; r += 250) {
    const s = steadyState(id, r, 1);
    if (s.torque > tq.torque) tq = s;
    if (s.power > pw.power) pw = s;
  }
  const bmep = (tq.torque * 4 * Math.PI) / (disp / 1000) / 1e5;
  console.log(`${id.padEnd(8)} ${disp.toFixed(2)} L | peak torque ${tq.torque.toFixed(0)} Nm @ ${tq.rpm} (BMEP ${bmep.toFixed(1)} bar) | peak power ${pw.power.toFixed(0)} kW @ ${pw.rpm} | ${(pw.power / disp).toFixed(0)} kW/L | peak cylinder pressure ${pw.peak.toFixed(0)} bar`);
}
