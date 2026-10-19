import { EnginePhysics } from '../physics.js';
import { SYSTEMS, CATALOG } from '../data/catalog.js';
import { drawPV, STROKES, strokeAt } from '../ui/charts.js';
import { setupQuiz } from '../quiz.js';

const DEG = Math.PI / 180;
const TEXT = [
  ['Intake', 'The piston falls and the intake valve opens. Fresh air (and fuel in a petrol engine) is drawn in.'],
  ['Compression', 'Both valves shut and the piston rises, squeezing the charge to a fraction of its volume. It heats up as it goes.'],
  ['Power', 'Combustion pushes the pressure up and drives the piston down. This is the only stroke that makes work.'],
  ['Exhaust', 'The exhaust valve opens and the rising piston sweeps the burnt gas out.'],
];
const GAS = ['#9cc4f2', '#f0c75a', '#f0795a', '#b3b9bf'];

export function mountLearn(root, { openSystem }) {
  root.innerHTML = `
  <section class="page learn">
    <header class="pageHead"><h2 class="cap">Learn</h2><h1>One cycle.<br>Two turns of the crank.</h1>
      <p>Drag the slider and watch a single cylinder breathe, squeeze, burn and exhale. The loop on the right is the same pressure and volume you can watch live in the Engine tab once you press Run engine.</p></header>
    <div class="lab">
      <div class="labFig"><svg id="lSvg" viewBox="0 0 240 290" role="img" aria-label="Single cylinder schematic"></svg>
        <label class="scrub"><span>Crank angle</span><output id="lDeg"></output><input id="lAngle" type="range" min="0" max="719" value="20"></label></div>
      <div class="labSide"><canvas id="lPV" role="img" aria-label="Pressure volume loop"></canvas>
        <ol class="strokes">${TEXT.map(([t, d], i) => `<li data-i="${i}" style="--c:${STROKES[i].color}"><b>${t}</b><span>${d}</span><small>${i * 180}–${i * 180 + 180}°</small></li>`).join('')}</ol>
        <p class="valves"><span id="vI"></span><span id="vE"></span></p></div>
    </div>
    <h2 class="cap sp">Ten systems</h2>
    <div class="sysGrid">${SYSTEMS.map((s) => `<button data-sys="${s.id}" style="--c:${s.color}"><i></i><b>${s.id}</b><span>${s.blurb}</span><small>${CATALOG.filter((p) => p.system === s.id).length} parts →</small></button>`).join('')}</div>
    <section id="engineQuiz" class="quizPanel"><div class="quizTop"><div><h2 class="cap">Knowledge check</h2><h3>Test your engine IQ</h3></div><span id="quizProgress"></span></div>
      <p id="quizPrompt" class="quizPrompt"></p><div id="quizOptions" class="quizOptions"></div><div id="quizFeedback" class="quizFeedback" aria-live="polite"></div>
      <div class="quizFooter"><span id="quizScore"></span><button id="quizNext" class="quizNext" disabled>Next question →</button></div></section>
  </section>`;
  const ph = new EnginePhysics('i4');
  ph.rpm = 3000; ph.throttle = 0.7; ph.effectiveThrottle = 0.7; ph.updateCycle(true);
  const $ = (s) => root.querySelector(s);
  const svg = $('#lSvg'), slider = $('#lAngle');
  const s = ph.spec, strokeM = s.stroke;

  function draw() {
    const a = +slider.value, t = a * DEG, st = strokeAt(a), idx = STROKES.indexOf(st);
    const sp = ph.pistonPosition(t), crown = 62 + (sp / strokeM) * 56, pinY = crown + 22;
    const cx = 120, cy = 218, R = 28, px = cx + R * Math.sin(t), py = cy - R * Math.cos(t);
    const li = ph.valveLift(a, 'intake'), le = ph.valveLift(a, 'exhaust');
    const valve = (x, l, col) => `<line x1="${x}" y1="14" x2="${x}" y2="${46 + l * 11}" stroke="#59616b" stroke-width="3"/><rect x="${x - 14}" y="${44 + l * 11}" width="28" height="5" rx="2" fill="${col}"/>`;
    const burn = a >= 360 && a < 400 ? Math.sin(((a - 360) / 40) * Math.PI) : 0;
    svg.innerHTML = `
      <rect x="52" y="34" width="136" height="14" rx="3" fill="#59616b"/>
      <path d="M75 34v-6h40v6M125 34v-6h40v6" fill="none" stroke="#9aa1a8" stroke-width="2"/>
      <rect x="60" y="48" width="120" height="${crown - 48}" fill="${GAS[idx]}" opacity=".85"/>
      ${burn ? `<ellipse cx="120" cy="${52 + (crown - 52) / 2}" rx="${30 + burn * 26}" ry="${(crown - 52) / 2}" fill="#ffd27a" opacity="${(burn * 0.7).toFixed(2)}"/>` : ''}
      <path d="M60 48V176M180 48V176" stroke="#2b2f34" stroke-width="6"/>
      ${valve(95, li, '#2f7fe0')}${valve(145, le, '#7b848d')}
      <rect x="62" y="${crown}" width="116" height="34" rx="3" fill="#cfd3d6" stroke="#8d9296"/><path d="M62 ${crown + 8}h116M62 ${crown + 15}h116" stroke="#8d9296"/>
      <line x1="120" y1="${pinY}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#59616b" stroke-width="9" stroke-linecap="round"/>
      <circle cx="120" cy="${pinY}" r="5" fill="#cfd3d6"/>
      <circle cx="${cx}" cy="${cy}" r="${R + 8}" fill="none" stroke="#c9ccd0" stroke-dasharray="3 4"/>
      <line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#2b2f34" stroke-width="7" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="9" fill="#2b2f34"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="${st.color}"/>`;
    $('#lDeg').textContent = `${a}° · ${st.id}`;
    root.querySelectorAll('.strokes li').forEach((li2, i) => li2.classList.toggle('on', i === idx));
    $('#vI').textContent = `Intake valve ${li > 0.02 ? 'open' : 'closed'}`; $('#vI').className = li > 0.02 ? 'open i' : 'i';
    $('#vE').textContent = `Exhaust valve ${le > 0.02 ? 'open' : 'closed'}`; $('#vE').className = le > 0.02 ? 'open e' : 'e';
    drawPV($('#lPV'), ph, a);
  }
  slider.addEventListener('input', draw);
  root.querySelector('.sysGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-sys]'); if (b) openSystem(b.dataset.sys); });
  setupQuiz($('#engineQuiz'));
  return { show() { draw(); } };
}
