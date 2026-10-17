// SVG tachometer. Static dial is built once per engine; only the needle and read-out move.
const A0 = -125, A1 = 125; // sweep in degrees from 12 o'clock
const pol = (r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]; };
const arc = (r, d0, d1) => {
  const [x0, y0] = pol(r, d0), [x1, y1] = pol(r, d1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export function tachMarkup(redline) {
  const max = Math.ceil((redline + 400) / 1000) * 1000;
  const ang = (rpm) => A0 + (rpm / max) * (A1 - A0);
  let ticks = '';
  for (let r = 0; r <= max; r += 500) {
    const major = r % 1000 === 0, a = ang(r);
    const [x0, y0] = pol(major ? 70 : 74, a), [x1, y1] = pol(80, a);
    ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${major ? 'tk major' : 'tk'}${r >= redline ? ' red' : ''}"/>`;
    if (major) { const [lx, ly] = pol(58, a); ticks += `<text x="${lx.toFixed(1)}" y="${(ly + 3.5).toFixed(1)}" class="tl${r >= redline ? ' red' : ''}">${r / 1000}</text>`; }
  }
  return `<svg class="tach" viewBox="0 0 200 200" role="img" aria-label="Tachometer">
    <circle cx="100" cy="100" r="96" class="face"/>
    <path d="${arc(86, A0, A1)}" class="track"/>
    <path d="${arc(86, ang(redline), A1)}" class="redzone"/>
    <path id="tachArc" d="${arc(86, A0, A0)}" class="sweep"/>
    ${ticks}
    <g id="tachNeedle" data-max="${max}" data-a0="${A0}" data-a1="${A1}"><line x1="100" y1="112" x2="100" y2="30" class="needle"/></g>
    <circle cx="100" cy="100" r="7" class="hub"/>
    <text x="100" y="146" class="rpmNum" id="tachNum">0</text>
    <text x="100" y="161" class="rpmUnit">rpm × 1</text>
  </svg>`;
}

export function tachUpdate(root, rpm) {
  const n = root.querySelector('#tachNeedle');
  if (!n) return;
  const max = +n.dataset.max, a0 = +n.dataset.a0, a1 = +n.dataset.a1;
  const a = a0 + (Math.min(rpm, max) / max) * (a1 - a0);
  n.style.transform = `rotate(${a}deg)`;
  root.querySelector('#tachArc').setAttribute('d', arc(86, a0, Math.max(a0 + 0.01, a)));
  root.querySelector('#tachNum').textContent = Math.round(rpm).toLocaleString('en-US');
}
