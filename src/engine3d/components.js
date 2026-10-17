// Geometry factories for individual engine components. Pure functions: spec in, geometry out.
// Every dimension is in metres and loosely follows a modern passenger-car engine.
import * as THREE from 'three';
import {
  TAU, merge, at, cylX, cylY, cylZ, hexY, box, lathe, ringY, roundedRectShape, addHole,
  plateX, circleShape, circlesHull, polygonShape, gearX, tube, coil,
} from './geom.js';

/** Piston with ring lands, skirt, crown dish and hollow underside. Pin axis = X, pin at origin. */
export function pistonGeometry(bore, compHeight = 0.031) {
  const R = bore / 2 - 0.0007;
  const ch = compHeight;
  const g = R * 0.9; // groove root radius
  const l = R * 0.988; // land radius
  const outer = [
    [0, ch - 0.0016],
    [R * 0.55, ch - 0.0004],
    [l, ch],
    [l, ch - 0.0045],
    [g, ch - 0.0047], [g, ch - 0.0092],
    [l, ch - 0.0094], [l, ch - 0.0118],
    [g, ch - 0.012], [g, ch - 0.0165],
    [l, ch - 0.0167], [l, ch - 0.0182],
    [g, ch - 0.0184], [g, ch - 0.0225],
    [R, ch - 0.0227], [R, -0.0345],
  ];
  const inner = [
    [R - 0.0032, -0.0345],
    [R - 0.0032, 0.004],
    [R * 0.62, 0.019],
    [0, 0.0205],
  ];
  const body = lathe([...outer, ...inner], 64);

  // Pin bosses inside the skirt.
  const bosses = merge([
    at(cylX(0.0175, 0.02, 24), -R * 0.62, 0, 0),
    at(cylX(0.0175, 0.02, 24), R * 0.62, 0, 0),
  ]);

  const mkRing = (rOut, h, y) => ringY(rOut, rOut - 0.0034, y - h / 2, y + h / 2, 64);
  const rings = [
    mkRing(R * 0.993, 0.0012, ch - 0.0070 + 0.0002),
    mkRing(R * 0.993, 0.0012, ch - 0.0141),
    mkRing(R * 0.993, 0.0026, ch - 0.0204),
  ];
  const pin = cylX(0.0108, bore * 0.8, 28);
  return { body: merge([body, bosses]), rings, pin };
}

/** Connecting rod: big end at origin, small end at +Y*L, thickness along X. */
export function rodGeometry(L, pinR = 0.023, wristR = 0.0108) {
  const Rb = pinR + 0.0095;
  const Rs = wristR + 0.0058;
  const T = 0.0185; // thickness (along X)
  const web = 0.0065;

  const big = circleShape(Rb);
  addHole(big, 0, 0, pinR + 0.0022);
  const small = circleShape(Rs, 0, L);
  addHole(small, 0, L, wristR + 0.0003);

  const hb = 0.0128, hs = 0.0085; // half widths of the shank at big / small end
  const y0 = Rb * 0.7, y1 = L - Rs * 0.7;
  const shank = polygonShape([[-hb, y0], [hb, y0], [hs, y1], [-hs, y1]]);
  const flangeW = 0.0034;
  const fl = polygonShape([[-hb, y0], [-hb + flangeW, y0], [-hs + flangeW, y1], [-hs, y1]]);
  const fr = polygonShape([[hb - flangeW, y0], [hb, y0], [hs, y1], [hs - flangeW, y1]]);

  const parts = [
    plateX(big, T, 0.0008),
    plateX(small, T * 0.82, 0.0006),
    plateX(shank, web, 0),
    plateX(fl, T, 0.0004),
    plateX(fr, T, 0.0004),
  ];
  // Cap bolts across the split line (z = ±).
  const bolts = [];
  for (const sz of [-1, 1]) {
    bolts.push(at(cylY(0.0042, -0.044, -0.014, 14), 0, 0, sz * (pinR + 0.0068)));
    bolts.push(at(hexY(0.0075, -0.0525, -0.044), 0, 0, sz * (pinR + 0.0068)));
  }
  // A fine split line on the cap (visual only).
  const cap = at(box(T * 1.02, 0.0007, Rb * 2.05, 0, -0.0005, 0), 0, 0, 0);
  return {
    body: merge(parts),
    bolts: merge(bolts),
    cap,
    shell: ringX(pinR + 0.0022, pinR, T * 0.96, 40),
    smallBush: at(ringX(wristR + 0.0003, wristR - 0.0004, T * 0.8, 24), 0, L, 0),
  };
}

/** Ring (tube) with axis X, centred. */
export function ringX(rOut, rIn, len, seg = 48) {
  const g = ringY(rOut, rIn, -len / 2, len / 2, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}

/**
 * One crank web (arm + counterweight) lying in the Y/Z plane, thickness along X, with the pin end
 * pointing at +Y. Rotate about X by the pin angle to place it.
 */
export function crankWebGeometry(r, thickness, mainR = 0.03, pinR = 0.023, cwR = 0.064, cwSpan = 100 * (Math.PI / 180)) {
  const armHull = circlesHull([[0, 0, mainR + 0.004], [0, r, pinR + 0.0075]], 40);
  const arm = plateX(polygonShape(armHull), thickness, 0.0006);

  const s = new THREE.Shape();
  const half = cwSpan / 2;
  const steps = 18;
  s.moveTo(0, 0);
  for (let i = 0; i <= steps; i++) {
    const phi = Math.PI - half + (i / steps) * cwSpan; // centred on -Y
    const x = cwR * Math.sin(phi), y = cwR * Math.cos(phi);
    s.lineTo(x, y);
  }
  s.closePath();
  const cw = plateX(s, thickness, 0.0006);
  return merge([arm, cw]);
}

export function valveGeometry(headR, stemLen = 0.092) {
  const stem = 0.0028;
  return lathe([
    [0, stemLen],
    [stem, stemLen],
    [stem, 0.016],
    [0.0052, 0.0085],
    [headR * 0.55, 0.0032],
    [headR * 0.93, 0.0006],
    [headR, -0.0008],
    [headR, -0.0021],
    [headR * 0.92, -0.0028],
    [0, -0.0032],
  ], 32);
}

export function bucketGeometry(R = 0.0175) {
  return lathe([
    [0, 0.0955],
    [R, 0.0955],
    [R, 0.078],
    [R - 0.0012, 0.078],
    [R - 0.0012, 0.0915],
    [0, 0.0915],
  ], 32);
}

export function retainerGeometry() {
  return merge([
    cylY(0.0106, 0.0738, 0.0768, 28),
    cylY(0.0062, 0.0768, 0.0822, 24, 0.0042),
  ]);
}

export function springGeometry() {
  return coil(0.0098, 1, 7.5, 0.0013, 170, 5);
}

export function valveSeatGeometry(headR) {
  const g = ringY(headR + 0.0025, headR - 0.0018, -0.0016, 0.0018, 36);
  return g;
}

/** Spark plug standing on Y from the seat (y=0) up through the cover. */
export function sparkPlugGeometry() {
  const thread = cylY(0.0062, 0.0, 0.026, 18);
  const hex = hexY(0.0108, 0.026, 0.0385);
  const ceramic = lathe([[0, 0.0385], [0.0054, 0.0385], [0.0054, 0.07], [0.0066, 0.0715], [0.0066, 0.105], [0.0072, 0.1065], [0.0, 0.1065]], 24);
  const tip = cylY(0.0018, -0.0007, 0.0, 10);
  const terminal = cylY(0.0028, 0.1065, 0.116, 12);
  const ground = box(0.0016, 0.0028, 0.0058, 0, -0.0002, 0.0032);
  return { metal: merge([thread, hex, tip, terminal, ground]), ceramic };
}

export function coilPackGeometry() {
  const boot = lathe([[0, 0.0], [0.0105, 0.0], [0.0118, 0.012], [0.0094, 0.05], [0.0094, 0.052], [0, 0.052]], 20);
  const body = new THREE.CapsuleGeometry(0.0155, 0.052, 6, 20);
  body.translate(0, 0.052 + 0.03, 0);
  const connector = box(0.026, 0.02, 0.022, 0.0, 0.098, 0.0185);
  return { boot, body: merge([body, connector]) };
}

export function injectorGeometry(len = 0.07) {
  return merge([
    cylY(0.0062, 0, len * 0.55, 16),
    cylY(0.0085, len * 0.55, len, 16),
    cylY(0.0035, -0.012, 0, 12),
    box(0.016, 0.016, 0.012, 0, len * 0.9, 0.011),
  ]);
}

export function glowPlugGeometry() {
  return merge([cylY(0.0034, -0.009, 0.0, 10), cylY(0.0055, 0.0, 0.026, 14), hexY(0.0085, 0.026, 0.0345), cylY(0.0028, 0.0345, 0.05, 10)]);
}

/** Cooling fan: hub plus swept blades in the Y/Z plane (axis X). */
export function fanGeometry(R, blades = 7) {
  const parts = [cylX(R * 0.2, R * 0.12, 28)];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TAU;
    const s = new THREE.Shape();
    s.moveTo(R * 0.16, -R * 0.075);
    s.bezierCurveTo(R * 0.45, -R * 0.2, R * 0.82, -R * 0.2, R, -R * 0.06);
    s.bezierCurveTo(R * 0.98, R * 0.14, R * 0.7, R * 0.26, R * 0.4, R * 0.18);
    s.lineTo(R * 0.16, R * 0.07);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: R * 0.012, bevelEnabled: false, curveSegments: 14 });
    g.translate(0, 0, -R * 0.006);
    // Blade lies in the shape's XY plane; pitch it about its radial axis, then spin it about X.
    g.rotateX(0.5);
    g.rotateZ(Math.PI / 2); // radial direction -> +Y
    g.rotateX(a);
    g.rotateY(0); // keep axis X
    parts.push(g);
  }
  return merge(parts);
}

export function turboWheel(R, blades, swept = true) {
  const parts = [cylX(R * 0.22, R * 0.35, 24)];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TAU;
    const s = new THREE.Shape();
    s.moveTo(R * 0.2, 0);
    s.quadraticCurveTo(R * 0.7, swept ? R * 0.25 : 0, R, swept ? R * 0.12 : 0.002);
    s.lineTo(R, swept ? R * 0.12 - 0.0022 : -0.0006);
    s.quadraticCurveTo(R * 0.7, swept ? R * 0.22 : 0, R * 0.2, -0.002);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: R * 0.32, bevelEnabled: false });
    g.translate(0, 0, -R * 0.16);
    g.rotateY(Math.PI / 2);
    g.rotateX(a);
    parts.push(g);
  }
  return merge(parts);
}

/** Fin pack: many thin plates (radiators, intercoolers, fins). Plates are YZ-planes spaced along X. */
export function finPack(w, h, d, count, thickness = 0.0007) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + (i + 0.5) * (w / count);
    parts.push(box(thickness, h, d, x, 0, 0));
  }
  return merge(parts);
}

export { tube, gearX, plateX, circleShape, circlesHull, polygonShape, roundedRectShape, addHole, cylZ };
