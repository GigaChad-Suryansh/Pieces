// Geometry helpers. All dimensions are metres; the engine root is scaled up for display.
//
// Conventions used everywhere in engine3d:
//   * the crankshaft axis is +X,
//   * "up" is +Y (cylinder axis of an inline engine),
//   * angles about X are measured from +Y towards +Z (rotation.x = a sends +Y to (cos a, sin a) in (y, z)).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

const nonIndexed = (g) => (g.index ? g.toNonIndexed() : g);

/** Merge geometries into one (they are converted to a common non-indexed form first). */
export function merge(list) {
  const prepared = list.map((g) => {
    const n = nonIndexed(g);
    for (const key of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(key)) n.deleteAttribute(key);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((n.attributes.position.count) * 2), 2));
    return n;
  });
  return mergeGeometries(prepared, false);
}

export const at = (g, x = 0, y = 0, z = 0) => g.translate(x, y, z);

/** Cylinder whose axis is X, centred on the origin. */
export function cylX(r, len, seg = 32, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}
/** Cylinder whose axis is Z, centred on the origin. */
export function cylZ(r, len, seg = 32, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}
/** Cylinder from y0 to y1 (axis Y). */
export function cylY(r, y0, y1, seg = 32, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, Math.abs(y1 - y0), seg);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}
/** Hexagonal prism along Y. */
export function hexY(r, y0, y1) {
  return cylY(r, y0, y1, 6);
}

export function box(sx, sy, sz, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
}

/** Lathe from [[r, y], ...] about the Y axis. */
export function lathe(points, seg = 48) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

/** A rectangular tube/ring section about Y: outer/inner radius, y0..y1. */
export function ringY(rOut, rIn, y0, y1, seg = 48) {
  return lathe([[rIn, y0], [rOut, y0], [rOut, y1], [rIn, y1], [rIn, y0]], seg);
}

export function roundedRectShape(w, h, r = 0.01) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 1e-6, h / 2 - 1e-6);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

export function addHole(shape, cx, cy, r) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, TAU, true);
  shape.holes.push(p);
}

/**
 * Prism: extrude a 2D shape (shape x -> world x, shape y -> world -z) from y=0 up to y=height.
 * Used for cast blocks, heads and covers with real bore holes.
 */
export function prism(shape, height, bevel = 0.003) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 28,
  });
  g.translate(0, 0, bevel);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * Extrude a shape that lives in the Y/Z plane (shape x -> -z, shape y -> y) with thickness along X,
 * centred on x = 0. This is the natural frame for crank webs, rods, gears and cam lobes.
 */
export function plateX(shape, thickness, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 32,
  });
  g.translate(0, 0, -thickness / 2 + bevel);
  g.rotateY(Math.PI / 2);
  return g;
}

export function circleShape(r, cx = 0, cy = 0, seg = 40) {
  const s = new THREE.Shape();
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}

/** Convex hull (monotone chain) of [x, y] points, returned counter-clockwise. */
export function hull2D(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

/** Sample the outline of several circles [[cx, cy, r], ...] and return their convex hull. */
export function circlesHull(circles, samples = 48) {
  const pts = [];
  for (const [cx, cy, r] of circles) {
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * TAU;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return hull2D(pts);
}

export function polygonShape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Resample a closed polyline to `count` evenly spaced points (returns also the total length). */
export function resampleClosed(poly, count) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len, start: total });
    total += len;
  }
  return { total, segs };
}

export function pointOnClosed(path, s) {
  let d = ((s % path.total) + path.total) % path.total;
  // linear search is fine for the few dozen segments of a chain hull
  for (const seg of path.segs) {
    if (d <= seg.start + seg.len || seg === path.segs[path.segs.length - 1]) {
      const t = seg.len > 0 ? (d - seg.start) / seg.len : 0;
      return {
        x: seg.a[0] + (seg.b[0] - seg.a[0]) * t,
        y: seg.a[1] + (seg.b[1] - seg.a[1]) * t,
        angle: Math.atan2(seg.b[1] - seg.a[1], seg.b[0] - seg.a[0]),
      };
    }
  }
  return { x: 0, y: 0, angle: 0 };
}

/** Toothed wheel in the Y/Z plane, axis X, thickness `t`. */
export function gearX(rTip, rRoot, teeth, t, rHole = 0) {
  const s = new THREE.Shape();
  const p = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * p;
    const pts = [
      [rRoot, a], [rTip, a + 0.14 * p], [rTip, a + 0.42 * p], [rRoot, a + 0.56 * p],
    ];
    pts.forEach(([r, ang], k) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
    });
  }
  s.closePath();
  if (rHole > 0) addHole(s, 0, 0, rHole);
  return plateX(s, t, 0);
}

/** Tube along a list of [x, y, z] points. */
export function tube(points, radius, seg = 40, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.35);
  return new THREE.TubeGeometry(curve, seg, radius, radial, false);
}

/** Helical coil spring along +Y from y=0..h, radius R, wire radius w, `turns` coils. */
export function coil(R, h, turns, w, seg = 160, radial = 6) {
  const pts = [];
  const n = Math.round(turns * 18);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * R, t * h, Math.sin(a) * R));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, w, radial, false);
}

/**
 * Cam lobe: polar profile r(phi) in the Y/Z plane with the nose at +Y (phi = 0).
 * `lift(phiRad)` returns 0..1; radius = base + liftMax * lift.
 */
export function camLobeGeometry(base, liftMax, lift, width) {
  const s = new THREE.Shape();
  const N = 144;
  for (let i = 0; i < N; i++) {
    const phi = (i / N) * TAU - Math.PI; // -pi..pi, nose at 0
    const r = base + liftMax * lift(phi);
    const x = r * Math.sin(phi), y = r * Math.cos(phi);
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  return plateX(s, width, 0);
}
