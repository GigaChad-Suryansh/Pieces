import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/ibm-plex-sans';
import './style.css';
import { EnginePhysics } from './physics.js';
import { ENGINES } from './data/engines.js';
import { SYSTEMS, SYSTEM_COLOR, PART_INFO, partsFor } from './data/catalog.js';
import { createStage } from './scene.js';
import { createCallout } from './ui/callout.js';
import { tachMarkup, tachUpdate } from './ui/tach.js';
import { drawPressure, drawPV, drawCurves, STROKES, strokeAt } from './ui/charts.js';
import { mountLearn } from './views/learn.js';
import { mountCompare } from './views/compare.js';

const PRESETS = { idle: { throttle: 0, load: 8 }, road: { throttle: 40, load: 32 }, power: { throttle: 92, load: 12 } };
const state = {
  tab: 'engine', engine: 'i4', selected: 'Piston', system: 'All', search: '',
  explode: false, cutaway: false, xray: false, isolate: false,
  running: false, rpm: 850, cycle: 0, throttle: 18, load: 25, advance: 12, preset: null,
};
const dyno = { running: false, elapsed: 0, last: 0, points: [] };
let physics = new EnginePhysics(state.engine);
const spec = () => ENGINES[state.engine];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------------------------------------------------------------------------------------------------- shell
$('#app').innerHTML = `
<header class="top">
  <a class="brand" href="./" aria-label="Pieces home"><span class="mark" aria-hidden="true"></span><b>PIECES</b><i>Engineverse</i></a>
  <nav class="tabs" role="tablist" aria-label="Sections">
    <button role="tab" data-tab="engine" aria-selected="true">Engine</button>
    <button role="tab" data-tab="learn" aria-selected="false">Learn</button>
    <button role="tab" data-tab="compare" aria-selected="false">Compare</button>
  </nav>
  <label class="search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4.5 4.5"/></svg>
    <input id="search" type="search" placeholder="Search parts" autocomplete="off" aria-label="Search parts"><kbd>/</kbd></label>
</header>
<main>
  <div id="engineTab" class="tabPane"></div>
  <div id="learnTab" class="tabPane" hidden></div>
  <div id="compareTab" class="tabPane" hidden></div>
</main>
<footer class="foot">Pieces · an educational engine playground. Physics is a reduced-order model of real engine geometry; figures are indicative, not calibrated.</footer>`;

$('#engineTab').innerHTML = `
<section class="engineView">
  <aside class="rail" aria-label="Engines and parts">
    <div class="railBlock"><h2 class="cap">Engine</h2><div id="engineList" class="engineList"></div></div>
    <div class="railBlock"><h2 class="cap">Systems</h2><div id="chips" class="chips"></div></div>
    <div class="railBlock grow"><h2 class="cap"><span id="partCount">Parts</span></h2><ul id="partList" class="partList"></ul></div>
  </aside>

  <section class="stage" aria-label="3D engine">
    <div id="viewport" class="viewport">
      <div class="stageHead">
        <div class="title"><h1 id="engName"></h1><p id="engSub"></p></div>
        <div class="tools" role="toolbar" aria-label="View controls">
          <div class="seg" role="group" aria-label="Camera"><button data-view="iso" class="on">3/4</button><button data-view="front">Front</button><button data-view="side">Side</button><button data-view="top">Top</button></div>
          <div class="seg" role="group" aria-label="Display">
            <button data-tool="explode" aria-pressed="false">Explode</button>
            <button data-tool="cutaway" aria-pressed="false">Cutaway</button>
            <button data-tool="xray" aria-pressed="false">X-ray</button>
            <button data-tool="isolate" aria-pressed="false">Isolate</button>
          </div>
          <button class="ghost" id="resetBtn" title="Reset view and engine">Reset</button>
        </div>
      </div>
      <div class="dial" id="dial"></div>
      <div class="deck">
        <div class="deckTop">
          <button class="play" id="play" aria-label="Start engine"></button>
          <div class="phase"><small>Cylinder 1</small><b id="phaseName">Intake</b></div>
          <div class="presets" role="group" aria-label="Drive mode"><button data-preset="idle">Idle</button><button data-preset="road">Road</button><button data-preset="power">Power</button></div>
          <span class="deg"><b id="degNum">0</b>°</span>
        </div>
        <div class="ribbon" id="ribbon" role="slider" tabindex="0" aria-label="Crank angle" aria-valuemin="0" aria-valuemax="720" aria-valuenow="0">
          ${STROKES.map((s) => `<span class="seg4" style="--c:${s.color}"><i>${s.id}</i></span>`).join('')}
          <u id="ribbonPin"></u>
        </div>
      </div>
    </div>
  </section>

  <aside class="inspector" aria-label="Inspector">
    <section class="card part" id="partCard"></section>
    <section class="card"><h2 class="cap">Live</h2>
      <div class="read">
        <div><small>Power</small><b id="rPower">0</b><i>kW</i></div>
        <div><small>Torque</small><b id="rTorque">0</b><i>Nm</i></div>
        <div><small>Peak pressure</small><b id="rPeak">0</b><i>bar</i></div>
        <div><small>BMEP</small><b id="rBmep">0</b><i>bar</i></div>
        <div><small>Boost</small><b id="rBoost">0</b><i>bar</i></div>
        <div><small>Efficiency</small><b id="rEff">0</b><i>%</i></div>
        <div><small>Coolant</small><b id="rCool">0</b><i>°C</i></div>
        <div><small>Exhaust</small><b id="rExh">0</b><i>°C</i></div>
      </div>
      <div class="knock"><small>Knock risk</small><span class="meter"><i id="knockBar"></i></span></div>
    </section>
    <section class="card"><h2 class="cap">Drive</h2>
      <label class="slide"><span>Throttle</span><output id="oThrottle"></output><input id="throttle" type="range" min="0" max="100"></label>
      <label class="slide"><span>Load</span><output id="oLoad"></output><input id="load" type="range" min="0" max="100"></label>
      <label class="slide"><span id="advLabel">Ignition advance</span><output id="oAdv"></output><input id="advance" type="range" min="0" max="35"></label>
    </section>
    <section class="card"><h2 class="cap">Specification</h2><dl id="specs" class="specs"></dl></section>
  </aside>
</section>

<section class="panel charts" aria-label="Cylinder traces">
  <header><div><h2 class="cap">Cylinder 1</h2><h3>What the gas is doing</h3></div><p class="note">Drag the crank ribbon to scrub through the cycle.</p></header>
  <div class="chartGrid">
    <figure><figcaption><b>Pressure vs crank angle</b><span><i class="k" style="--c:#2f7fe0"></i>intake valve <i class="k" style="--c:#7b848d"></i>exhaust valve</span></figcaption><canvas id="cvP" role="img" aria-label="Cylinder pressure against crank angle"></canvas></figure>
    <figure><figcaption><b>Pressure vs volume</b><span>work = enclosed area</span></figcaption><canvas id="cvPV" role="img" aria-label="Pressure volume loop"></canvas></figure>
  </div>
  <div class="strokeKey">${STROKES.map((s) => `<span><i class="k" style="--c:${s.color}"></i>${s.id}</span>`).join('')}</div>
</section>

<section class="panel dyno" aria-label="Dyno">
  <header><div><h2 class="cap">Dyno</h2><h3>Full-throttle pull</h3></div>
    <div class="dynoBtns"><button id="dynoStart" class="solid">Run pull</button><button id="dynoClear" class="ghost">Clear</button></div></header>
  <div class="dynoBody"><canvas id="cvDyno" role="img" aria-label="Torque and power against rpm"></canvas>
    <div class="dynoStats"><div><small>Peak torque</small><b id="dPT">—</b></div><div><small>Peak power</small><b id="dPP">—</b></div><div><small>Status</small><span id="dStatus">Ready</span></div>
    <p class="note"><i class="k" style="--c:var(--accent)"></i>Torque (solid) · power (dashed). Uses the Load slider as brake load.</p></div></div>
</section>`;

// ---------------------------------------------------------------------------------------------------- stage
const viewport = $('#viewport');
const callout = createCallout(viewport);
const stage = createStage(viewport, {
  onPick: (name) => select(name, { list: true }),
  onHover: (name, e) => { callout.hover(name, e); viewport.style.cursor = name ? 'pointer' : ''; },
});

function applyState() {
  const eng = stage.eng; if (!eng) return;
  eng.applyFilter({ system: state.system, isolate: state.isolate ? state.selected : null });
}

function loadEngine(id) {
  state.engine = id;
  const s = spec();
  physics = new EnginePhysics(id);
  state.rpm = s.idleRpm; state.cycle = 0; state.running = false; state.preset = null;
  dyno.running = false; dyno.points = [];
  physics.throttle = state.throttle / 100; physics.load = state.load / 100; physics.rpm = state.rpm; physics.sparkAdvance = state.advance;
  stage.setEngine(s);
  const names = new Set(partsFor(s).map((p) => p.name));
  if (!names.has(state.selected)) state.selected = 'Piston';
  $('#engName').textContent = s.name; $('#engSub').textContent = s.sub;
  $('#dial').innerHTML = tachMarkup(s.redline);
  $('#advLabel').textContent = s.fuel === 'diesel' ? 'Injection advance' : 'Ignition advance';
  renderEngineList(); renderSpecs(); renderParts(); syncControls(); syncToggles();
  applyState(); select(state.selected, { silent: true });
  $('#dynoStart').textContent = 'Run pull'; drawDyno();
}

// ---------------------------------------------------------------------------------------------------- rail
function renderEngineList() {
  $('#engineList').innerHTML = Object.values(ENGINES).map((e) =>
    `<button data-engine="${e.id}" aria-pressed="${e.id === state.engine}"><b>${esc(e.short)}</b><span>${esc(e.name)}<small>${esc(e.sub)}</small></span></button>`).join('');
  const chips = ['All', ...SYSTEMS.map((s) => s.id)];
  $('#chips').innerHTML = chips.map((c) =>
    `<button data-system="${esc(c)}" aria-pressed="${c === state.system}" style="--c:${SYSTEM_COLOR[c] || 'var(--ink)'}"><i></i>${esc(c)}</button>`).join('');
}
function visibleParts() {
  const q = state.search.trim().toLowerCase();
  return partsFor(spec()).filter((p) => (state.system === 'All' || p.system === state.system) && (!q || `${p.name} ${p.system} ${p.desc}`.toLowerCase().includes(q)));
}
function renderParts() {
  const list = visibleParts(), eng = stage.eng;
  $('#partCount').textContent = `${list.length} part${list.length === 1 ? '' : 's'}`;
  $('#partList').innerHTML = list.map((p) => {
    const modelled = !eng || eng.has(p.name);
    return `<li><button data-part="${esc(p.name)}" class="${p.name === state.selected ? 'sel' : ''}${modelled ? '' : ' flat'}" style="--c:${SYSTEM_COLOR[p.system]}"><i></i><span>${esc(p.name)}</span>${modelled ? '' : '<em>ref</em>'}</button></li>`;
  }).join('') || '<li class="empty">No parts match.</li>';
}
function renderSpecs() {
  const s = spec(), disp = ((Math.PI / 4) * s.bore * s.bore * s.stroke * s.cylinders * 1000).toFixed(2);
  const rows = [
    ['Layout', s.layout === 'v' ? `${s.vAngle || 60}° V${s.cylinders}` : s.layout === 'inline' ? `Inline-${s.cylinders}` : s.layout],
    ['Displacement', `${disp} L`], ['Bore × stroke', `${(s.bore * 1000).toFixed(0)} × ${(s.stroke * 1000).toFixed(0)} mm`],
    ['Compression', `${s.compression}:1`], ['Valves', `${s.valvesPerCylinder * s.cylinders}`], ['Redline', `${s.redline.toLocaleString('en-US')} rpm`],
    ['Firing order', s.firingOrder.join('–')], ['Fuel', s.fuel === 'diesel' ? 'Diesel · turbo' : 'Petrol'],
  ];
  $('#specs').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
}

// ---------------------------------------------------------------------------------------------------- selection
function select(name, { list = false, silent = false, focus = false } = {}) {
  state.selected = name;
  const info = PART_INFO[name] || { system: 'Engine', desc: '' };
  const color = SYSTEM_COLOR[info.system] || '#6f7b86';
  const eng = stage.eng, modelled = !eng || eng.has(name);
  eng?.highlight(name, parseInt(color.slice(1), 16), 0.5);
  if (state.isolate) applyState();
  $('#partCard').innerHTML = `<span class="sysTag" style="--c:${color}"><i></i>${esc(info.system)}</span><h2>${esc(name)}</h2><p>${esc(info.desc)}</p>
    ${modelled ? '' : '<p class="flatNote">Shown for reference — this engine has no modelled part of this kind.</p>'}`;
  callout.set(modelled ? { name, system: info.system, color, hint: '' } : null);
  $$('#partList button').forEach((b) => b.classList.toggle('sel', b.dataset.part === name));
  if (focus || list) stage.focusPart(name);
  if (!silent && list) $(`#partList button[data-part="${CSS.escape(name)}"]`)?.scrollIntoView({ block: 'nearest' });
}

// ---------------------------------------------------------------------------------------------------- controls
function syncControls() {
  $('#throttle').value = state.throttle; $('#load').value = state.load; $('#advance').value = state.advance;
  $('#oThrottle').textContent = state.throttle + '%'; $('#oLoad').textContent = state.load + '%'; $('#oAdv').textContent = state.advance + '°';
  $$('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.preset === state.preset));
  const play = $('#play'); play.dataset.on = state.running; play.setAttribute('aria-label', state.running ? 'Pause engine' : 'Start engine');
}
function syncToggles() {
  for (const k of ['explode', 'cutaway', 'xray', 'isolate']) $(`[data-tool="${k}"]`).setAttribute('aria-pressed', state[k]);
}
function setDrive(throttle, load) {
  state.throttle = throttle; state.load = load; physics.throttle = throttle / 100; physics.load = load / 100; syncControls();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.tab) return setTab(t.dataset.tab);
  if (t.dataset.engine && $('#engineTab').contains(t)) return loadEngine(t.dataset.engine);
  if (t.dataset.system) { state.system = t.dataset.system; $$('#chips button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.system === state.system)); applyState(); return renderParts(); }
  if (t.dataset.part) return select(t.dataset.part, { focus: true });
  if (t.dataset.view) { $$('[data-view]').forEach((b) => b.classList.toggle('on', b === t)); return stage.view(t.dataset.view); }
  if (t.dataset.tool) {
    const k = t.dataset.tool; state[k] = !state[k]; syncToggles(); applyState();
    if (k === 'explode') stage.dolly(state.explode ? 1.3 : 1 / 1.3, state.explode ? 2.2 : -2.2);
    return;
  }
  if (t.dataset.preset) { const p = PRESETS[t.dataset.preset]; state.preset = t.dataset.preset; setDrive(p.throttle, p.load); state.running = true; return syncControls(); }
  if (t.id === 'play') { state.running = !state.running; return syncControls(); }
  if (t.id === 'resetBtn') {
    Object.assign(state, { explode: false, cutaway: false, xray: false, isolate: false, system: 'All', search: '', throttle: 18, load: 25, advance: 12 });
    $('#search').value = ''; stage.goHome(); $$('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === 'iso'));
    return loadEngine(state.engine);
  }
  if (t.id === 'dynoStart') return toggleDyno();
  if (t.id === 'dynoClear') { dyno.running = false; dyno.points = []; $('#dynoStart').textContent = 'Run pull'; return drawDyno(); }
});
$('#throttle').oninput = (e) => { state.preset = null; setDrive(+e.target.value, state.load); };
$('#load').oninput = (e) => { state.preset = null; setDrive(state.throttle, +e.target.value); };
$('#advance').oninput = (e) => { state.advance = +e.target.value; physics.sparkAdvance = state.advance; syncControls(); };

// Crank ribbon: pointer-down scrubs immediately and tracks the pointer 1:1.
const ribbon = $('#ribbon');
function scrub(e) { const r = ribbon.getBoundingClientRect(); state.cycle = Math.max(0, Math.min(719.9, ((e.clientX - r.left) / r.width) * 720)); }
ribbon.addEventListener('pointerdown', (e) => { ribbon.setPointerCapture(e.pointerId); state.running = false; syncControls(); scrub(e); ribbon.classList.add('drag'); });
ribbon.addEventListener('pointermove', (e) => { if (ribbon.hasPointerCapture(e.pointerId)) scrub(e); });
ribbon.addEventListener('pointerup', () => ribbon.classList.remove('drag'));
ribbon.addEventListener('keydown', (e) => {
  const d = { ArrowRight: 5, ArrowLeft: -5, PageUp: 45, PageDown: -45 }[e.key]; if (!d) return;
  e.preventDefault(); state.running = false; syncControls(); state.cycle = (state.cycle + d + 720) % 720;
});

$('#search').addEventListener('input', (e) => { state.search = e.target.value; if (state.tab !== 'engine') setTab('engine'); renderParts(); });
document.addEventListener('keydown', (e) => {
  const typing = /input|textarea/i.test(document.activeElement?.tagName);
  if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); $('#search').focus(); }
  if (e.key === ' ' && !typing && state.tab === 'engine' && !/button|a/i.test(document.activeElement?.tagName)) { e.preventDefault(); state.running = !state.running; syncControls(); }
});

function setTab(t) {
  state.tab = t;
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === t));
  for (const id of ['engine', 'learn', 'compare']) $(`#${id}Tab`).hidden = id !== t;
  if (t === 'learn') learn.show();
  if (t === 'compare') compare.show();
  if (t === 'engine') { stage.resize(); drawCharts(); drawDyno(); }
  scrollTo({ top: 0 });
}

// ---------------------------------------------------------------------------------------------------- dyno
function toggleDyno() {
  dyno.running = !dyno.running;
  if (dyno.running) {
    Object.assign(dyno, { points: [], elapsed: 0, last: 0 }); state.preset = null;
    physics.rpm = Math.max(physics.rpm, spec().idleRpm); state.rpm = physics.rpm;
    setDrive(100, state.load); state.running = true;
  }
  $('#dynoStart').textContent = dyno.running ? 'Stop' : 'Run pull'; drawDyno();
}
function dynoTick(dt) {
  dyno.elapsed += dt; dyno.last += dt;
  if (dyno.last >= 0.1) {
    dyno.last = 0;
    const rpm = Math.round(physics.rpm / 100) * 100, prev = dyno.points.at(-1);
    if (!prev || rpm > prev.rpm + 70) {
      const torque = Math.max(0, physics.torque);
      dyno.points.push({ rpm, torque, power: (torque * rpm * 2 * Math.PI) / 60000 });
    }
  }
  if (physics.rpm >= spec().redline - 30 || dyno.elapsed > 25) { dyno.running = false; $('#dynoStart').textContent = 'Run pull'; }
}
function drawDyno() {
  const pts = dyno.points, cv = $('#cvDyno');
  if (pts.length > 1) drawCurves(cv, [{ color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d9472b', points: pts }], { redline: spec().redline });
  else drawCurves(cv, [{ color: '#d9472b', points: [{ rpm: 0, torque: 0, power: 0 }, { rpm: spec().redline, torque: 0, power: 0 }] }], { redline: spec().redline });
  const pt = Math.max(0, ...pts.map((p) => p.torque)), pp = Math.max(0, ...pts.map((p) => p.power));
  $('#dPT').textContent = pts.length ? `${pt.toFixed(0)} Nm` : '—'; $('#dPP').textContent = pts.length ? `${pp.toFixed(0)} kW` : '—';
  $('#dStatus').textContent = dyno.running ? 'Pulling…' : pts.length ? 'Complete · modelled' : 'Ready';
}

// ---------------------------------------------------------------------------------------------------- frame loop
const num = (id, v) => { const e = document.getElementById(id); if (e && e.textContent !== v) e.textContent = v; };
function drawCharts() { drawPressure($('#cvP'), physics, state.cycle); drawPV($('#cvPV'), physics, state.cycle); }
function readouts() {
  const p = physics;
  num('rPower', p.power.toFixed(1)); num('rTorque', Math.round(p.torque)); num('rPeak', p.pressure.toFixed(0)); num('rBmep', (p.bmep || 0).toFixed(1));
  num('rBoost', (p.boost || 0).toFixed(2)); num('rEff', ((p.efficiency || 0) * 100).toFixed(0)); num('rCool', Math.round(p.temperature)); num('rExh', Math.round(p.exhaustTemp));
  $('#knockBar').style.width = Math.min(100, (p.knock || 0) * 100) + '%';
  const st = strokeAt(state.cycle);
  num('phaseName', st.id); $('#phaseName').style.color = st.color; num('degNum', String(Math.round(state.cycle)));
  $('#ribbonPin').style.left = (state.cycle / 720) * 100 + '%'; ribbon.setAttribute('aria-valuenow', Math.round(state.cycle));
}

let last = performance.now(), slow = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.04, Math.max(0, (now - last) / 1000)); last = now;
  if (state.tab !== 'engine') return;
  if (state.running) { const s = physics.step(dt); state.rpm = s.rpm; state.cycle = s.theta; if (dyno.running) dynoTick(dt); }
  else { physics.theta = state.cycle; physics.rpm = state.rpm; }
  const eng = stage.eng;
  eng?.update({ theta: state.cycle, physics, dt, explode: state.explode, cutaway: state.cutaway, xray: state.xray });
  stage.render();
  const pos = eng && state.selected ? eng.anchorOf(state.selected, stage.camera) : null;
  callout.place(pos ? stage.project(pos) : null);
  tachUpdate($('#dial'), physics.rpm);
  slow += dt;
  if (slow > 0.08) { slow = 0; readouts(); drawCharts(); if (dyno.running || dyno.points.length) drawDyno(); }
}

const learn = mountLearn($('#learnTab'), { openSystem: (id) => { state.system = id; state.search = ''; $('#search').value = ''; setTab('engine'); renderEngineList(); applyState(); renderParts(); } });
const compare = mountCompare($('#compareTab'), { ENGINES, pick: (id) => { setTab('engine'); loadEngine(id); } });
loadEngine(state.engine);
requestAnimationFrame(frame);
if (new URLSearchParams(location.search).has('debug')) {
  window.__pieces = { state, get eng() { return stage.eng; }, get camera() { return stage.camera; }, get controls() { return stage.controls; }, get physics() { return physics; }, stage };
}
