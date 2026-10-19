import { steadyState } from '../physics.js';
import { drawCurves } from '../ui/charts.js';

// Colours are assigned by position, so adding an engine to ENGINES needs no change here.
const PALETTE = ['#2f7fe0', '#8a5cc2', '#c47a14', '#0e8f8a', '#d9472b', '#4f8f3a', '#c2578f', '#5b6770', '#b08a1e', '#2a9d8f'];

export function mountCompare(root, { ENGINES, pick }) {
  const ids = Object.keys(ENGINES);
  const COLORS = Object.fromEntries(ids.map((id, i) => [id, PALETTE[i % PALETTE.length]]));
  const on = new Set(ids);
  let metric = 'both';
  // Sweep every engine once at full throttle.
  const data = {};
  for (const id of ids) {
    const s = ENGINES[id], pts = [];
    for (let r = Math.round((s.idleRpm * 1.15) / 250) * 250; r <= s.redline; r += 250) pts.push(steadyState(id, r, 1));
    data[id] = { pts, tq: Math.max(...pts.map((p) => p.torque)), pw: Math.max(...pts.map((p) => p.power)) };
    data[id].tqAt = pts.find((p) => p.torque === data[id].tq).rpm; data[id].pwAt = pts.find((p) => p.power === data[id].pw).rpm;
  }
  const disp = (s) => (Math.PI / 4) * s.bore * s.bore * s.stroke * s.cylinders * 1000;

  root.innerHTML = `
  <section class="page compare">
    <header class="pageHead"><h2 class="cap">Compare</h2><h1>Four engines,<br>one dyno.</h1>
      <p>Full-throttle torque and power from the same physics model, swept from just above idle to redline. Toggle engines to overlay them.</p></header>
    <div class="panel curvePanel">
      <header><div class="chipRow" id="cmpChips">${ids.map((id) => `<button data-id="${id}" aria-pressed="true" style="--c:${COLORS[id]}"><i></i>${ENGINES[id].short}</button>`).join('')}</div>
        <div class="seg" id="cmpMetric" role="group" aria-label="Metric"><button data-m="both" class="on">Both</button><button data-m="torque">Torque</button><button data-m="power">Power</button></div></header>
      <canvas id="cmpCv" role="img" aria-label="Torque and power curves for the selected engines"></canvas>
      <p class="note">Solid = torque (left axis, Nm). Dashed = power (right axis, kW). Indicative figures from a reduced-order model.</p>
    </div>
    <div class="tableWrap"><table class="cmpTable"><thead><tr><th></th>${ids.map((id) => `<th><i style="--c:${COLORS[id]}"></i>${ENGINES[id].name}<small>${ENGINES[id].sub}</small></th>`).join('')}</tr></thead><tbody>
      ${[
        ['Displacement', (s) => disp(s).toFixed(2) + ' L'], ['Cylinders', (s) => s.cylinders], ['Bore × stroke', (s) => `${(s.bore * 1000).toFixed(0)} × ${(s.stroke * 1000).toFixed(0)} mm`],
        ['Compression', (s) => s.compression + ':1'], ['Redline', (s) => s.redline.toLocaleString('en-US') + ' rpm'], ['Fuel', (s) => (s.fuel === 'diesel' ? 'Diesel, turbo' : 'Petrol')],
        ['Peak torque', (s, id) => `${data[id].tq.toFixed(0)} Nm @ ${data[id].tqAt}`], ['Peak power', (s, id) => `${data[id].pw.toFixed(0)} kW @ ${data[id].pwAt}`],
        ['Power per litre', (s, id) => (data[id].pw / disp(s)).toFixed(0) + ' kW/L'],
      ].map(([k, f]) => `<tr><th scope="row">${k}</th>${ids.map((id) => `<td>${f(ENGINES[id], id)}</td>`).join('')}</tr>`).join('')}
      <tr><th scope="row"></th>${ids.map((id) => `<td><button class="ghost" data-open="${id}">Open in Engine →</button></td>`).join('')}</tr>
    </tbody></table></div>
  </section>`;

  const cv = root.querySelector('#cmpCv');
  function draw() {
    const series = ids.filter((id) => on.has(id)).map((id) => ({ color: COLORS[id], points: data[id].pts }));
    const redline = Math.max(...ids.filter((id) => on.has(id)).map((id) => ENGINES[id].redline), 4000);
    drawCurves(cv, series.length ? series : [{ color: '#999', points: [{ rpm: 0, torque: 0, power: 0 }, { rpm: redline, torque: 0, power: 0 }] }], { redline, metric });
  }
  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-id]'), m = e.target.closest('[data-m]'), o = e.target.closest('[data-open]');
    if (c) { const id = c.dataset.id; on.has(id) ? on.delete(id) : on.add(id); c.setAttribute('aria-pressed', on.has(id)); draw(); }
    if (m) { metric = m.dataset.m; root.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b === m)); draw(); }
    if (o) pick(o.dataset.open);
  });
  new ResizeObserver(() => { if (!root.hidden) draw(); }).observe(cv);
  return { show() { draw(); } };
}
