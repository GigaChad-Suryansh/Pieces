# Pieces roadmap and daily agent

`roadmap.json` is a fixed backlog (engines, parts, UI, content, quality). `progress.json` is the saved state. A GitHub Actions workflow (`.github/workflows/pieces-agent.yml`) runs once a day, hands the next eligible item to a Gemini agent, checks the result itself, and opens a pull request.

## How a run works
1. Validate the roadmap, then run the baseline tests and build.
2. **Bug-first:** if the baseline fails, the task is to fix it; no new item starts.
3. Otherwise pick the first `auto` item that is not done or blocked and whose `depends` are done.
4. Gemini edits `src/`, `tests/` or `index.html`. Edits to workflow, scripts, `GEMINI.md`, package files and `roadmap/*.json` are reverted.
5. The workflow re-runs roadmap validation, tests and build. One repair attempt is allowed. Work that still fails is discarded; three failures block the item.
6. Only the workflow marks an item complete, and only for verified work that changed files.
7. A PR `automation/pieces-daily` is opened and a comment is posted on the "Daily agent report" issue.

Items with `"auto": false` need a person (real-device checks, listening tests, art direction).

## One-time setup (repository settings, done by the owner)
1. **Secret `GEMINI_API_KEY`**: a Google AI Studio key (Settings → Secrets and variables → Actions → Secrets).
2. **Settings → Actions → General → Workflow permissions**: tick *Allow GitHub Actions to create and approve pull requests*. (Or add a fine-grained token as secret `PR_TOKEN` with Contents and Pull requests write.)
3. Optional variable `AUTO_MERGE = true` to squash-merge verified PRs and start a deploy. **Off by default**, because automated checks cannot see the screen.
4. Optional variable `GEMINI_MODEL` to force a model.

Run it by hand: Actions → *Pieces Autonomous Developer* → Run workflow (optionally enter an item id such as `E01`).

## Local commands
- `npm run roadmap:validate` checks the backlog and progress file.
- `npm run roadmap:next` prints the next automatic item.
- `node scripts/engine-report.mjs [id]` prints peak torque and power for engines.
