#!/usr/bin/env node
/**
 * Pre-flight for the autonomous developer workflow.
 *
 * Problem this solves: with a free Gemini API key, some models have no free
 * quota (or the key/model is rejected). The Gemini CLI then retries with
 * back-off for ~90 s and exits with code 1 and no explanation. This script
 * finds out *first*, in a few seconds, and says exactly what is wrong.
 *
 * It:
 *   1. checks the key is present and accepted (lists models),
 *   2. sends a tiny test prompt to each candidate model, best first,
 *   3. writes `model` (and `fallback_model`) to $GITHUB_OUTPUT,
 *   4. writes a readable table to $GITHUB_STEP_SUMMARY,
 *   5. exits 1 with a clear message if no model works.
 *
 * Override the preferred model with the repository variable GEMINI_MODEL
 * (Settings → Secrets and variables → Actions → Variables).
 * The API key is only ever sent in a header and is never printed.
 */
import fs from 'node:fs';

const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const BASE = (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
const PREFERRED = (process.env.GEMINI_MODEL || '').trim().replace(/^models\//, '');
const TIMEOUT_MS = Number(process.env.GEMINI_PICK_TIMEOUT_MS || 20000);
const MAX_RETRY_WAIT_S = 20;

/** Best-first. Only models the key can actually see are tried. */
const DEFAULT_CANDIDATES = [
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

const rows = [];
const log = (msg) => console.log(msg);

function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
function writeSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}
function fail(title, detail) {
  console.error(`::error title=${title}::${detail.split('\n')[0]}`);
  writeSummary(`## Gemini pre-flight failed\n\n**${title}**\n\n${detail}\n`);
  process.exit(1);
}

async function call(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'x-goog-api-key': API_KEY, 'content-type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, ok: res.ok, body };
}

function errorMessage(body) {
  const m = body?.error?.message || '';
  return m.replace(/\s+/g, ' ').slice(0, 220);
}

/** Seconds suggested by a 429 response ("retryDelay": "12s"), or null. */
function retryAfterSeconds(body) {
  const details = body?.error?.details;
  if (!Array.isArray(details)) return null;
  for (const d of details) {
    const m = typeof d?.retryDelay === 'string' && d.retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
    if (m) return Math.ceil(Number(m[1]));
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(model) {
  const request = () =>
    call(`/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }],
        generationConfig: { maxOutputTokens: 32 },
      }),
    });

  let r = await request();
  if (r.status === 429) {
    const wait = retryAfterSeconds(r.body);
    // A per-minute limit clears quickly; a per-day / zero quota will not.
    if (wait !== null && wait <= MAX_RETRY_WAIT_S) {
      log(`  429 on ${model}; waiting ${wait}s and retrying once`);
      await sleep((wait + 1) * 1000);
      r = await request();
    }
  }
  return r;
}

function classify(r) {
  if (r.ok) return { ok: true, note: 'works' };
  const msg = errorMessage(r.body);
  switch (r.status) {
    case 429:
      return { ok: false, note: `no free quota right now (429). ${msg}` };
    case 404:
      return { ok: false, note: 'model not available to this key (404)' };
    case 400:
      return { ok: false, note: `rejected (400). ${msg}` };
    case 401:
    case 403:
      return { ok: false, note: `permission denied (${r.status}). ${msg}` };
    default:
      return { ok: false, note: `HTTP ${r.status}. ${msg}` };
  }
}

async function main() {
  if (!API_KEY) {
    fail(
      'GEMINI_API_KEY is empty',
      'The repository secret GEMINI_API_KEY is missing or not available to this run (secrets are not passed to workflows triggered from forks). Add it under Settings → Secrets and variables → Actions → Secrets.'
    );
  }

  // 1. Is the key accepted at all, and which models can it see?
  let visible = null;
  try {
    const list = await call('/models?pageSize=200');
    if ([400, 401, 403].includes(list.status)) {
      fail(
        'Gemini API key was rejected',
        `The Gemini API answered HTTP ${list.status}: ${errorMessage(list.body) || 'no message'}. Create a new key at https://aistudio.google.com/apikey and update the GEMINI_API_KEY secret.`
      );
    }
    if (list.ok && Array.isArray(list.body?.models)) {
      visible = new Set(
        list.body.models
          .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m) => String(m.name).replace(/^models\//, ''))
      );
    } else {
      log(`Could not list models (HTTP ${list.status}); will probe candidates directly.`);
    }
  } catch (e) {
    log(`Could not reach the model list (${e.message}); will probe candidates directly.`);
  }

  // 2. Build the candidate list: preferred → known good → any other visible flash model.
  const extras = visible
    ? [...visible].filter(
        (n) => /flash/.test(n) && !/(image|live|tts|audio|transcribe|translate|embed|robotics|computer-use)/.test(n)
      )
    : [];
  let candidates = [...new Set([PREFERRED, ...DEFAULT_CANDIDATES, ...extras].filter(Boolean))];
  if (visible) {
    const seen = candidates.filter((c) => visible.has(c));
    // Keep an explicitly requested model even if it is not listed, so the user sees why it fails.
    candidates = PREFERRED && !visible.has(PREFERRED) ? [PREFERRED, ...seen] : seen;
  }
  candidates = candidates.slice(0, 8);

  if (candidates.length === 0) {
    fail(
      'No usable Gemini models',
      'The key is valid but none of the expected text models are available to it. Set the repository variable GEMINI_MODEL to a model id from https://ai.google.dev/gemini-api/docs/models.'
    );
  }

  // 3. Probe until we have a primary and a fallback.
  const working = [];
  for (const model of candidates) {
    log(`Probing ${model} …`);
    let result;
    try {
      result = classify(await probe(model));
    } catch (e) {
      result = { ok: false, note: `request failed: ${e.name === 'TimeoutError' ? 'timed out' : e.message}` };
    }
    rows.push({ model, ...result });
    log(`  ${result.ok ? 'OK' : 'FAIL'}: ${result.note}`);
    if (result.ok) working.push(model);
    if (working.length >= 2) break;
  }

  const table = [
    '| Model | Result |',
    '|---|---|',
    ...rows.map((r) => `| \`${r.model}\` | ${r.ok ? '✅ works' : '❌ ' + r.note.replace(/\|/g, '\\|')} |`),
  ].join('\n');

  if (working.length === 0) {
    const allQuota = rows.length > 0 && rows.every((r) => /429/.test(r.note));
    fail(
      allQuota ? 'Gemini free quota exhausted' : 'No Gemini model responded',
      (allQuota
        ? 'Every model returned HTTP 429 (no free quota left right now). Quota resets daily; the next scheduled run will try again. '
        : 'No candidate model accepted a test request. ') + `\n\n${table}`
    );
  }

  writeOutput('model', working[0]);
  writeOutput('fallback_model', working[1] || '');
  writeSummary(
    `## Gemini pre-flight\n\nUsing **\`${working[0]}\`**${working[1] ? ` (fallback: \`${working[1]}\`)` : ''}.\n\n${table}\n`
  );
  log(`Selected model: ${working[0]}${working[1] ? ` (fallback ${working[1]})` : ''}`);
}

main().catch((e) => fail('Pre-flight crashed', e.message));
