// A leader-line callout pinned to a 3D part, plus a lightweight hover tag.
export function createCallout(host) {
  host.insertAdjacentHTML('beforeend', `
    <svg class="leader" aria-hidden="true"><line id="coLine"/><circle id="coDot" r="4.5"/><circle id="coRing" r="9"/></svg>
    <div class="callout" id="callout" hidden><span class="coSys"></span><b class="coName"></b><small class="coHint"></small></div>
    <div class="hoverTag" id="hoverTag" hidden></div>`);
  const line = host.querySelector('#coLine'), dot = host.querySelector('#coDot'), ring = host.querySelector('#coRing');
  const box = host.querySelector('#callout'), tag = host.querySelector('#hoverTag');
  const svg = host.querySelector('.leader');
  const sysEl = box.querySelector('.coSys'), nameEl = box.querySelector('.coName'), hintEl = box.querySelector('.coHint');
  let current = null;

  return {
    set(info) { // {name, system, color, hint} or null
      current = info;
      if (!info) { box.hidden = true; svg.style.visibility = 'hidden'; return; }
      sysEl.textContent = info.system; sysEl.style.color = info.color;
      nameEl.textContent = info.name; hintEl.textContent = info.hint || '';
      box.style.setProperty('--c', info.color);
      for (const e of [line, dot, ring]) { e.style.stroke = info.color; }
      dot.style.fill = info.color;
    },
    /** screen: {x,y} px inside host or null (part hidden / behind camera). */
    place(screen) {
      if (!current || !screen) { box.hidden = true; svg.style.visibility = 'hidden'; return; }
      const W = host.clientWidth, H = host.clientHeight;
      box.hidden = false; svg.style.visibility = 'visible';
      const bw = box.offsetWidth, bh = box.offsetHeight;
      const right = screen.x < W * 0.55;
      let bx = right ? screen.x + 70 : screen.x - 70 - bw;
      let by = screen.y - 64 - bh / 2;
      bx = Math.max(12, Math.min(W - bw - 12, bx));
      by = Math.max(64, Math.min(H - bh - 150, by));
      box.style.transform = `translate(${bx.toFixed(0)}px,${by.toFixed(0)}px)`;
      const ex = bx + (right ? 0 : bw), ey = by + bh / 2;
      line.setAttribute('x1', screen.x); line.setAttribute('y1', screen.y);
      line.setAttribute('x2', ex); line.setAttribute('y2', ey);
      dot.setAttribute('cx', screen.x); dot.setAttribute('cy', screen.y);
      ring.setAttribute('cx', screen.x); ring.setAttribute('cy', screen.y);
    },
    hover(text, e) {
      if (!text) { tag.hidden = true; return; }
      const r = host.getBoundingClientRect();
      tag.hidden = false; tag.textContent = text;
      tag.style.transform = `translate(${(e.clientX - r.left + 14).toFixed(0)}px,${(e.clientY - r.top + 14).toFixed(0)}px)`;
    },
  };
}
