#!/usr/bin/env node
/**
 * Builds the task brief handed to the agent. Choosing the next roadmap item, listing files and
 * reading the baseline are deterministic, so they are done here and the agent spends its few turns
 * building.
 *
 * Outputs ($GITHUB_OUTPUT): item_id (empty when nothing is eligible), item_title, prompt (multi-line).
 * Env: TEST_EXIT, BUILD_EXIT (baseline exit codes), FORCE_ITEM (optional roadmap id to run).
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { nextItem } from './validate-roadmap.mjs';

const roadmap = JSON.parse(fs.readFileSync('roadmap/roadmap.json', 'utf8'));
const progress = JSON.parse(fs.readFileSync('roadmap/progress.json', 'utf8'));
const testExit = process.env.TEST_EXIT ?? 'unknown';
const buildExit = process.env.BUILD_EXIT ?? 'unknown';
const healthy = testExit === '0' && buildExit === '0';

const tail = (file, n = 40) => {
  try { return fs.readFileSync(file, 'utf8').split('\n').slice(-n).join('\n'); } catch { return '(no log)'; }
};
const head = (f, n = 90) => { try { return fs.readFileSync(f, 'utf8').split('\n').slice(0, n).join('\n'); } catch { return '(new file: create it)'; } };
const engineBlock = (id) => {
  try {
    const s = fs.readFileSync('src/data/engines.js', 'utf8');
    const a = s.indexOf(`\n  ${id}: {`); if (a < 0) return '';
    const e = s.indexOf('\n  },', a);
    return s.slice(a + 1, e + 5);
  } catch { return ''; }
};
const sh = (cmd, args) => (spawnSync(cmd, args, { encoding: 'utf8' }).stdout || '').trim();

let item = null;
if (process.env.FORCE_ITEM) item = roadmap.items.find((i) => i.id === process.env.FORCE_ITEM) || null;
if (!item && healthy) item = nextItem(roadmap, progress);

const RECIPES = {
  engine: `ENGINE RECIPE (engines are built in three small stages; do only the stage in this item)
Staging data lives in src/data/upcoming.js (picker shows it as "Building n/3"). Only the final "publish" stage touches ENGINES.
1. Add one entry to ENGINES in src/data/engines.js, copying an existing engine of the same fuel and layout as a template. Every field in tests/physics.test.js REQUIRED must be present, including \`where\` (the everyday cars it is found in).
2. Do not touch src/engine3d unless the item says the builder needs work. Compare colours, the picker, parts lists and tours are all driven by ENGINES.
3. Run \`npm test\` — it builds the 3D model, checks layout phasing, physics sanity, idle and wide-open-throttle behaviour for every engine. Fix the data (not the tests) until it passes.
4. Run \`node scripts/engine-report.mjs <id>\` to print peak torque/power and check they are plausible for the real-world engine class.`,
  part: `PART RECIPE
1. Add the part to the rows array in src/data/catalog.js (name, system, short description, optional fuel restriction).
2. Add a full entry to src/data/anatomy.js (the test checks every field and that neighbour links exist).
3. Model it in src/engine3d/build.js / components.js with userData.part set to exactly the catalogue name, and a system from the catalogue. Reuse helpers in geom.js; keep triangle counts modest.
4. If it belongs in a peel layer or tour, update src/data/layers.js.
5. \`npm test\` must pass (it checks every mesh name against the catalogue).`,
  ui: `UI RECIPE
Keep the existing design tokens in src/style.css (CSS variables on :root) and the structure in src/main.js. Respect prefers-reduced-motion and prefers-reduced-transparency, keep touch targets at least 44px on coarse pointers, and never break keyboard use. Prefer small modules in src/ui or src/views over growing main.js. Extract logic you can test into pure functions and add vitest tests.`,
  content: `CONTENT RECIPE
Write plain-language, accurate text for a curious non-expert. Keep claims general and rounded for typical passenger cars. Put data in src/data/*.js with a vitest test that checks its integrity (names exist, no duplicates, minimum lengths).`,
  quality: `QUALITY RECIPE
Behaviour must not change unless the item says so. Add or extend tests. Report measurable before/after numbers in your summary.`,
};

let prompt;
if (!healthy) {
  prompt = `## Task: fix the failing baseline (bug-first gate)
The checks failed before any new work: tests exit ${testExit}, build exit ${buildExit}.
Find the root cause and fix it. Never delete, skip or weaken a test. Do not start any roadmap item.

### Test log (tail)
${tail('/tmp/pieces-baseline-tests.log')}

### Build log (tail)
${tail('/tmp/pieces-baseline-build.log')}`;
  item = null;
} else if (item) {
  prompt = `## Task: roadmap item ${item.id} — ${item.title}
Area: ${item.area} · Size: ${item.size}

${item.detail}

### Acceptance criteria
${item.acceptance.map((a) => `- ${a}`).join('\n')}

${RECIPES[item.area] || ''}

### Files to touch (only these)
${(item.files || []).map((f) => `- ${f}`).join('\n')}

${(item.files || []).map((f) => `#### ${f} (first 90 lines)\n\`\`\`\n${head(f)}\n\`\`\``).join('\n\n')}
${item.template ? `\n### Template engine entry (copy its shape)\n\`\`\`js\n${engineBlock(item.template)}\n\`\`\`\n` : ''}

### Recent run log
${tail('roadmap/daily-log.md', 25)}

Implement only this item. Run \`npm test\` and \`npm run build\` before you finish and fix every failure. Finish with a short plain summary of what changed and anything a reviewer should look at (especially anything visual that automated checks cannot see).`;
} else {
  prompt = '';
}

console.log(prompt || '(nothing eligible: the roadmap is exhausted or only has items that need a person)');
if (process.env.GITHUB_OUTPUT) {
  const d = `BRIEF_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `item_id=${item?.id || (healthy ? '' : 'FIX')}\nitem_title=${(item?.title || (healthy ? '' : 'Fix failing baseline')).replace(/\n/g, ' ')}\nprompt<<${d}\n${prompt}\n${d}\n`);
}
