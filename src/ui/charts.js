// Small canvas charts. Each takes a canvas and draws at device resolution; colours follow the CSS theme.
const DEG = Math.PI / 180;
export const STROKES = [
  { id: 'Intake', from: 0, to: 180, color: '#2f7fe0' },
  { id: 'Compression', from: 180, to: 360, color: '#d49a00' },
  { id: 'Power', from: 360, to: 540, color: '#d9472b' },
  { id: 'Exhaust', from: 540, to: 720, color: '#7b848d' },
];
export const strokeAt = (a) => STROKES[Math.min(3, Math.floor((((a % 720) + 720) % 720) / 180))];

function css(name, fb) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; }

function prep(cv) {
  const d = Math.min(devicePixelRatio || 1, 2);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  const c = cv.getContext('2d');
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, w, h);
  c.font = '500 10.5px "IBM Plex Sans Variable", system-ui, sans-serif';
  return { c, w, h, ink: css('--ink-2', '#59616b'), grid: css('--line', '#e3e0d8') };
}

function frame(P, box, xmax, ymax, xticks, yticks, xfmt = (v) => v, yfmt = (v) => v) {
  const { c, ink, grid } = P;
  c.lineWidth = 1; c.fillStyle = ink; c.strokeStyle = grid; c.textBaseline = 'middle';
  c.textAlign = 'right';
  for (const t of yticks) {
    const y = box.y + box.h - (t / ymax) * box.h;
    c.beginPath(); c.moveTo(box.x, y); c.lineTo(box.x + box.w, y); c.stroke();
    c.fillText(yfmt(t), box.x - 6, y);
  }
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (const t of xticks) {
    const x = box.x + (t / xmax) * box.w;
    c.fillText(xfmt(t), x, box.y + box.h + 6);
  }
}
const nice = (v) => { const p = 10 ** Math.floor(Math.log10(v)); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
const ticksTo = (max, n = 4) => Array.from({ length: n + 1 }, (_, i) => (max * i) / n);

/** Pressure against crank angle with valve-lift bands and a live cursor. */
export function drawPressure(cv, ph, angle) {
  const P = prep(cv); if (!P) return;
  const { c, w, h } = P, box = { x: 34, y: 10, w: w - 46, h: h - 34 };
  const ys = [], N = 360;
  for (let i = 0; i <= N; i++) ys.push(ph.pressureAt((i / N) * 720) / 1e5);
  const ymax = nice(Math.max(...ys) * 1.08);
  frame(P, box, 720, ymax, [0, 180, 360, 540, 720], ticksTo(ymax, 4), (v) => v + '°', (v) => +v.toFixed(0));
  const X = (a) => box.x + (a / 720) * box.w, Y = (p) => box.y + box.h - (p / ymax) * box.h;
  // valve lift bands (intake blue, exhaust grey) rising from the baseline
  for (const [kind, col] of [['intake', 'rgba(47,127,224,.20)'], ['exhaust', 'rgba(123,132,141,.24)']]) {
    c.beginPath(); c.moveTo(X(0), Y(0));
    for (let a = 0; a <= 720; a += 4) c.lineTo(X(a), Y(0) - ph.valveLift(a, kind) * box.h * 0.2);
    c.lineTo(X(720), Y(0)); c.closePath(); c.fillStyle = col; c.fill();
  }
  c.lineJoin = 'round'; c.lineWidth = 2;
  for (const s of STROKES) {
    c.beginPath();
    for (let a = s.from; a <= s.to; a += 2) (a === s.from ? c.moveTo : c.lineTo).call(c, X(a), Y(ph.pressureAt(a) / 1e5));
    c.strokeStyle = s.color; c.stroke();
  }
  cursor(c, X(((angle % 720) + 720) % 720), box, Y(ph.pressureAt(angle) / 1e5), strokeAt(angle).color);
}

/** P–V loop of cylinder 1, coloured by stroke, with the live point. */
export function drawPV(cv, ph, angle) {
  const P = prep(cv); if (!P) return;
  const { c, w, h } = P, box = { x: 34, y: 10, w: w - 46, h: h - 34 };
  const vmax = ph.volume(Math.PI) * 1e6, vmin = ph.volume(0) * 1e6;
  const pts = []; let pmax = 0;
  for (let a = 0; a <= 720; a += 2) { const p = ph.pressureAt(a) / 1e5; pts.push([ph.volume(a * DEG) * 1e6, p, a]); pmax = Math.max(pmax, p); }
  const ymax = nice(pmax * 1.08);
  const xmax = Math.ceil((vmax * 1.04) / 100) * 100;
  frame(P, box, xmax, ymax, ticksTo(xmax, 4), ticksTo(ymax, 4), (v) => Math.round(v), (v) => +v.toFixed(0));
  const X = (v) => box.x + (v / xmax) * box.w, Y = (p) => box.y + box.h - (p / ymax) * box.h;
  c.lineJoin = 'round'; c.lineWidth = 2;
  for (const s of STROKES) {
    c.beginPath(); let first = true;
    for (const [v, p, a] of pts) if (a >= s.from && a <= s.to) { (first ? c.moveTo : c.lineTo).call(c, X(v), Y(p)); first = false; }
    c.strokeStyle = s.color; c.stroke();
  }
  c.fillStyle = P.ink; c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillText(`Vc ${vmin.toFixed(0)} cm³`, X(vmin) + 4, box.y + box.h - 14);
  const v = ph.volume(angle * DEG) * 1e6, p = ph.pressureAt(angle) / 1e5;
  c.beginPath(); c.arc(X(v), Y(p), 5.5, 0, 7); c.fillStyle = '#fff'; c.fill();
  c.lineWidth = 2.5; c.strokeStyle = strokeAt(angle).color; c.stroke();
}

function cursor(c, x, box, y, color) {
  c.beginPath(); c.moveTo(x, box.y); c.lineTo(x, box.y + box.h);
  c.strokeStyle = 'rgba(30,34,40,.28)'; c.lineWidth = 1; c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
  c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fillStyle = '#fff'; c.fill();
  c.lineWidth = 2.5; c.strokeStyle = color; c.stroke();
}

/** Torque (left axis) and power (right axis) against rpm for one or more series. */
export function drawCurves(cv, series, { redline, metric = 'both' } = {}) {
  const P = prep(cv); if (!P) return;
  const { c, w, h } = P, box = { x: 42, y: 26, w: w - 96, h: h - 52 };
  const all = series.flatMap((s) => s.points);
  const rtop = redline || Math.max(...all.map((p) => p.rpm));
  const rstep = rtop > 8000 ? 2000 : 1000, rmax = Math.ceil(rtop / rstep) * rstep;
  const tmax = nice(Math.max(30, ...all.map((p) => p.torque)) * 1.1);
  const pmax = nice(Math.max(10, ...all.map((p) => p.power)) * 1.1);
  frame(P, box, rmax, tmax, ticksTo(rmax, rmax / rstep), ticksTo(tmax, 4), (v) => v / 1000 + 'k', (v) => Math.round(v));
  c.fillStyle = P.ink; c.textAlign = 'left'; c.textBaseline = 'middle';
  for (const t of ticksTo(pmax, 4)) c.fillText(Math.round(t), box.x + box.w + 6, box.y + box.h - (t / pmax) * box.h);
  c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('Nm', box.x, 2); c.textAlign = 'right'; c.fillText('kW', box.x + box.w, 2); c.textAlign = 'left';
  const X = (r) => box.x + (r / rmax) * box.w;
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const s of series) {
    const line = (key, max, dash, wd) => {
      c.beginPath();
      s.points.forEach((p, i) => (i ? c.lineTo : c.moveTo).call(c, X(p.rpm), box.y + box.h - (p[key] / max) * box.h));
      c.strokeStyle = s.color; c.lineWidth = wd; c.setLineDash(dash); c.stroke(); c.setLineDash([]);
    };
    if (metric !== 'power') line('torque', tmax, [], 2.4);
    if (metric !== 'torque') line('power', pmax, metric === 'both' ? [5, 4] : [], 2.4);
  }
}
