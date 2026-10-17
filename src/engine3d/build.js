// Assembles a complete, animated engine from the shared engine data (data/engines.js).
//
// Everything is placed from the same numbers the physics model uses: bore, stroke, rod length,
// crank-pin phasing and valve timing. So the piston you see at TDC is the piston the pressure
// trace says is at TDC, and the valve opens exactly when the cam profile (generated from the
// valve-lift curve) pushes on its bucket.
//
// Frames
//   root        scaled metres -> scene units
//   crank       spins about X with the crank angle
//   bank        one per cylinder bank, rotated about X by the bank angle; cylinders live here
//               (inline = one bank at 0°, 60° V = banks at ±30°)

import * as THREE from 'three';
import { makeLayout } from '../data/engines.js';
import { valveLiftCurve } from '../physics.js';
import {
  TAU, DEG, merge, at, cylX, cylY, cylZ, hexY, box, lathe, ringY, roundedRectShape, addHole, prism, plateX,
  circleShape, circlesHull, polygonShape, gearX, tube, camLobeGeometry, resampleClosed, pointOnClosed,
} from './geom.js';
import * as C from './components.js';
import { createMaterials } from './studio.js';

export const SCALE = 20; // scene units per metre
const mod = (v, m) => ((v % m) + m) % m;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function buildEngine(spec, opts = {}) {
  const layout = makeLayout(spec);
  const diesel = spec.fuel === 'diesel';
  const isV = layout.kind === 'v';
  const k = spec.bore / 0.086; // scale for head details

  // ---- shared dimensions --------------------------------------------------------------
  const bore = spec.bore;
  const r = spec.stroke / 2;
  const L = spec.stroke * spec.rodRatio;
  const ch = 0.031; // piston compression height (pin to crown)
  const clearance = spec.stroke / (spec.compression - 1);
  const gasketT = 0.0015;
  const quench = 0.001;
  const chamberH = Math.max(0.002, clearance - quench - gasketT);
  const deckY = r + L + ch + quench; // block deck, along the bank axis
  const ySeat = deckY + gasketT + chamberH; // valve seat plane
  const pairX = 0.0165 * k;
  const rowZ = 0.026 * k;
  const camBase = 0.0135;
  const camY = ySeat + 0.0955 + camBase;
  const coverTop = ySeat + 0.148;
  const pinR = 0.023, mainR = 0.03;

  const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 14);
  const M = createMaterials(plane);
  const gasMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  gasMat.clippingPlanes = [plane];

  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const parts = [];
  const assemblies = [];
  const blockMat = diesel ? M.iron : M.alloy;

  const reg = (geo, mat, name, system, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.userData = { part: name, system };
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    parts.push(m);
    return m;
  };
  const group = (parent = root, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const asm = (node, dir, dist) => {
    node.userData.base = node.position.clone();
    assemblies.push({ node, dir: new THREE.Vector3(...dir), dist });
    return node;
  };

  const xs = layout.cylinders.map((c) => c.x);
  const xMin = Math.min(...xs) - bore * 0.62 - 0.012;
  const xMax = Math.max(...xs) + bore * 0.62 + 0.012;
  const xf = xMin - 0.004; // front face of the block
  const xr = xMax + 0.004; // rear face
  const xc = (xMin + xMax) / 2;
  const lenX = xMax - xMin;

  // ---- crankshaft (spins) ---------------------------------------------------------------
  const crank = group(root);
  const crankAsm = asm(crank, [0, -1, 0], 0.07);
  {
    const webT = 0.010;
    const webGeo = C.crankWebGeometry(r, webT, mainR, pinR);
    const pinGeo = cylX(pinR, 0.02, 32);
    const jGeo = (len) => cylX(mainR - 0.0035, len, 36);
    const xsRaw = layout.cylinders.map((c) => ({ x: c.x, pin: c.pin }));
    for (const p of xsRaw) {
      const pinPos = new THREE.Vector3(p.x, r * Math.cos(p.pin), r * Math.sin(p.pin));
      reg(pinGeo, M.forged, 'Crankshaft', 'Motion', crank).position.copy(pinPos);
      for (const sx of [-1, 1]) {
        const w = reg(webGeo, M.forged, 'Crankshaft', 'Motion', crank);
        w.position.set(p.x + sx * (0.01 + webT / 2), 0, 0);
        w.rotation.x = p.pin;
      }
    }
    // Main journals between throws and at both ends.
    const sorted = xsRaw.map((p) => p.x).sort((a, b) => a - b);
    const stops = [xf - 0.002];
    for (let i = 0; i < sorted.length - 1; i++) stops.push((sorted[i] + sorted[i + 1]) / 2);
    stops.push(xr + 0.002);
    const uniq = stops.filter((s, i) => i === 0 || Math.abs(s - stops[i - 1]) > 0.012);
    const mainCaps = [];
    for (const sx of uniq) {
      reg(jGeo(0.026), M.steel, 'Crankshaft', 'Motion', crank).position.set(sx, 0, 0);
      reg(C.ringX(mainR + 0.0007, mainR - 0.0035, 0.0235, 40), M.bearing, 'Main bearing', 'Motion', crank).position.set(sx, 0, 0);
      mainCaps.push(sx);
    }
    // Shaft body linking journals through the webs.
    reg(cylX(mainR - 0.0045, lenX + 0.03, 28), M.forged, 'Crankshaft', 'Motion', crank).position.set(xc, 0, 0);
    // Nose, timing sprocket, pulley and flywheel.
    reg(cylX(0.02, 0.08, 28), M.steel, 'Crankshaft', 'Motion', crank).position.set(xf - 0.04, 0, 0);
    const xChain = xf - 0.006;
    reg(gearX(0.0265, 0.0235, 20, 0.012), M.blackOxide, 'Timing chain / belt', 'Timing', crank).position.set(xChain, 0, 0);
    if (isV) reg(gearX(0.0265, 0.0235, 20, 0.012), M.blackOxide, 'Timing chain / belt', 'Timing', crank).position.set(xChain - 0.016, 0, 0);
    const xPulley = xf - 0.062;
    const pulley = merge([
      cylX(0.07, 0.03, 56),
      ...[-0.011, -0.0055, 0, 0.0055, 0.011].map((o) => cylX(0.0722, 0.0016, 56).translate(o, 0, 0)),
    ]);
    reg(pulley, M.blackOxide, 'Crank pulley', 'Motion', crank).position.set(xPulley, 0, 0);
    reg(cylX(0.026, 0.012, 24), M.steel, 'Crank pulley', 'Motion', crank).position.set(xPulley - 0.02, 0, 0);
    const fwShape = circleShape(0.142, 0, 0, 72);
    addHole(fwShape, 0, 0, 0.03);
    for (let i = 0; i < 6; i++) addHole(fwShape, Math.cos((i / 6) * TAU) * 0.088, Math.sin((i / 6) * TAU) * 0.088, 0.02);
    const fw = merge([plateX(fwShape, 0.026, 0.002), gearX(0.1515, 0.1445, 104, 0.02, 0.138)]);
    reg(fw, M.forged, 'Flywheel / flexplate', 'Motion', crank).position.set(xr + 0.034, 0, 0);
    reg(cylX(0.045, 0.05, 28), M.steel, 'Crankshaft', 'Motion', crank).position.set(xr + 0.02, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      reg(hexY(0.008, 0, 0.012).translate(0, 0.114, 0).rotateX(a), M.blackOxide, 'Flywheel / flexplate', 'Motion', crank).position.set(xr + 0.054, 0, 0);
    }
    crank.userData.mains = mainCaps;
  }

  // ---- banks ------------------------------------------------------------------------------
  const bankRefs = [];
  const toRoot = (alpha, [x, y, z]) => [x, y * Math.cos(alpha) - z * Math.sin(alpha), y * Math.sin(alpha) + z * Math.cos(alpha)];

  // Lobe profiles generated from the same valve-lift curve the physics uses.
  const lobeGeo = {
    intake: camLobeGeometry(camBase, spec.intake.lift, (phi) => valveLiftCurve(spec.intake.centre + (2 * phi) / DEG, spec.intake), 0.0115),
    exhaust: camLobeGeometry(camBase, spec.exhaust.lift, (phi) => valveLiftCurve(spec.exhaust.centre + (2 * phi) / DEG, spec.exhaust), 0.0115),
  };
  const valveGeoI = C.valveGeometry(0.0148 * k);
  const valveGeoE = C.valveGeometry(0.0124 * k);
  const bucketGeo = C.bucketGeometry(0.0155);
  const retainerGeo = C.retainerGeometry();
  const springGeo = C.springGeometry();
  const seatGeoI = C.valveSeatGeometry(0.0148 * k);
  const seatGeoE = C.valveSeatGeometry(0.0124 * k);
  const guideGeo = ringY(0.0066, 0.0029, 0.0, 0.026, 20);
  const pistonG = C.pistonGeometry(bore, ch);
  const rodG = C.rodGeometry(L, pinR);

  const headW = 0.172;
  const bankFootX = lenX + 0.012;

  for (const bank of layout.banks) {
    const alpha = bank.alpha;
    const side = bank.side; // intake side in the bank frame (+Z or -Z)
    const g = group(root);
    g.rotation.x = alpha;
    const cyls = bank.cyl.map((i) => layout.cylinders[i]);
    const bxs = cyls.map((c) => c.x);
    const bx0 = Math.min(...bxs) - bore * 0.62 - 0.012;
    const bx1 = Math.max(...bxs) + bore * 0.62 + 0.012;
    const bxc = (bx0 + bx1) / 2;
    const blen = bx1 - bx0;
    const ref = { bank, group: g, cyls: [], cams: [], chains: [] };
    bankRefs.push(ref);

    // Block deck
    {
      const shape = roundedRectShape(blen, 0.168, 0.014);
      for (const c of cyls) addHole(shape, c.x - bxc, 0, bore / 2 + 0.004);
      const y0 = isV ? 0.02 : 0.0;
      const geo = prism(shape, deckY - y0, 0.0025);
      reg(geo, blockMat, 'Engine block', 'Structure', g).position.set(bxc, y0, 0);
      // cast ribs on the outer faces
      const ribs = [];
      for (let y = y0 + 0.03; y < deckY - 0.05; y += 0.045) {
        ribs.push(box(blen * 0.96, 0.009, 0.007, 0, y, 0.0875), box(blen * 0.96, 0.009, 0.007, 0, y, -0.0875));
      }
      reg(merge(ribs), blockMat, 'Engine block', 'Structure', g).position.set(bxc, 0, 0);
      // coolant jackets + liners
      for (const c of cyls) {
        reg(ringY(bore / 2 + 0.0098, bore / 2 + 0.0042, deckY - 0.112, deckY - 0.01, 56), M.coolant, 'Coolant jacket', 'Cooling', g).position.set(c.x, 0, 0);
        reg(ringY(bore / 2 + 0.0042, bore / 2, L - r - 0.048, deckY - 0.0004, 64), M.liner, 'Cylinder liner', 'Structure', g).position.set(c.x, 0, 0);
      }
    }
    // Head gasket (steel layer with bore holes)
    const gasketG = group(g);
    asm(gasketG, [0, 1, 0], 0.04);
    {
      const shape = roundedRectShape(blen - 0.004, 0.166, 0.012);
      for (const c of cyls) addHole(shape, c.x - bxc, 0, bore / 2 + 0.0012);
      reg(prism(shape, gasketT, 0), M.blackOxide, 'Head gasket', 'Structure', gasketG).position.set(bxc, deckY, 0);
    }
    // Cylinder head: chamber plate with real chamber openings + solid cam carrier above
    const headG = group(g);
    asm(headG, [0, 1, 0], 0.085);
    {
      const plate = roundedRectShape(blen - 0.004, headW, 0.012);
      for (const c of cyls) addHole(plate, c.x - bxc, 0, bore / 2 * 0.985);
      reg(prism(plate, chamberH, 0.0005), M.alloyDark, 'Cylinder head', 'Structure', headG).position.set(bxc, deckY + gasketT, 0);
      const body = prism(roundedRectShape(blen - 0.004, headW, 0.012), 0.062, 0.003);
      reg(body, M.alloy, 'Cylinder head', 'Structure', headG).position.set(bxc, ySeat, 0);
      // cam bearing caps between cylinders and at the ends
      const capX = [bx0 + 0.012, ...cyls.slice(0, -1).map((c, i) => (c.x + cyls[i + 1].x) / 2), bx1 - 0.012];
      const caps = [];
      for (const cx of capX) for (const sz of [-1, 1]) caps.push(box(0.016, 0.026, 0.03, cx, ySeat + 0.062 + 0.013, sz * rowZ));
      reg(merge(caps), M.alloy, 'Cylinder head', 'Structure', headG);
      // head bolts
      const bolts = [];
      for (const cx of capX) for (const sz of [-1, 1]) bolts.push(hexY(0.0085, ySeat + 0.062, ySeat + 0.071).translate(cx, 0, sz * 0.067));
      reg(merge(bolts), M.blackOxide, 'Cylinder head', 'Structure', headG);
    }

    // Valve cover with plug wells, ribs and oil filler
    const coverG = group(g);
    asm(coverG, [0, 1, 0], 0.215);
    {
      const shape = roundedRectShape(blen - 0.008, 0.158, 0.02);
      for (const c of cyls) addHole(shape, c.x - bxc, 0, 0.0128);
      const cov = prism(shape, coverTop - (ySeat + 0.062), 0.004);
      reg(cov, M.cover, 'Valve cover', 'Structure', coverG).position.set(bxc, ySeat + 0.062, 0);
      const wells = merge(cyls.map((c) => ringY(0.0148, 0.0126, ySeat + 0.07, coverTop + 0.004, 28).translate(c.x, 0, 0)));
      reg(wells, M.blackOxide, 'Valve cover', 'Structure', coverG);
      const ridges = [];
      for (const sz of [-1, 1]) for (let i = 0; i < 7; i++) ridges.push(box(blen * 0.8, 0.003, 0.0035, 0, coverTop + 0.0015, sz * (0.045 + i * 0.0085)));
      reg(merge(ridges), M.cover, 'Valve cover', 'Structure', coverG).position.set(bxc, 0, 0);
      const cap = merge([cylY(0.019, coverTop - 0.002, coverTop + 0.014, 30), cylY(0.0215, coverTop + 0.014, coverTop + 0.019, 30)]);
      reg(cap, M.blackOxide, 'Valve cover', 'Structure', coverG).position.set(bx1 - 0.04, 0, side * 0.052);
    }

    // Valvetrain: valves, springs, buckets, guides, seats
    const valveG = group(g, 0, ySeat, 0);
    asm(valveG, [0, 1, 0], 0.125);
    const seatsG = group(g, 0, ySeat, 0);
    asm(seatsG, [0, 1, 0], 0.085);
    const camAsmG = group(g);
    asm(camAsmG, [0, 1, 0], 0.165);

    for (const c of cyls) {
      const e = { cyl: c, x: c.x, intake: [], exhaust: [] };
      for (const kind of ['intake', 'exhaust']) {
        const zRow = (kind === 'intake' ? side : -side) * rowZ;
        for (const sx of [-1, 1]) {
          const vx = c.x + sx * pairX;
          const vg = group(valveG, vx, 0, zRow);
          reg(kind === 'intake' ? valveGeoI : valveGeoE, kind === 'intake' ? M.steel : M.heat, kind === 'intake' ? 'Intake valve' : 'Exhaust valve', 'Valvetrain', vg);
          reg(bucketGeo, M.forged, kind === 'intake' ? 'Intake valve' : 'Exhaust valve', 'Valvetrain', vg);
          reg(retainerGeo, M.brass, kind === 'intake' ? 'Intake valve' : 'Exhaust valve', 'Valvetrain', vg);
          const sp = reg(springGeo, M.chrome, 'Valve spring', 'Valvetrain', valveG);
          sp.position.set(vx, 0.016, zRow);
          sp.scale.y = 0.0578;
          reg(guideGeo, M.brass, 'Valve guide', 'Valvetrain', seatsG).position.set(vx, 0.004, zRow);
          reg(kind === 'intake' ? seatGeoI : seatGeoE, M.bronze, 'Valve seat', 'Valvetrain', seatsG).position.set(vx, 0, zRow);
          e[kind].push({ vg, spring: sp });
        }
      }
      ref.cyls.push(e);
    }

    // Camshafts (DOHC): lobes phased per cylinder so the nose reaches the bucket at the right crank angle.
    for (const kind of ['intake', 'exhaust']) {
      const ev = spec[kind];
      const zCam = (kind === 'intake' ? side : -side) * rowZ;
      const cam = group(camAsmG, 0, camY, zCam);
      const shaft = merge([cylX(0.011, blen - 0.004, 28).translate(bxc, 0, 0)]);
      reg(shaft, M.forged, 'Camshaft', 'Valvetrain', cam);
      const capX = [bx0 + 0.012, ...cyls.slice(0, -1).map((c, i) => (c.x + cyls[i + 1].x) / 2), bx1 - 0.012];
      for (const cx of capX) reg(cylX(0.0125, 0.014, 24), M.steel, 'Camshaft', 'Valvetrain', cam).position.set(cx, 0, 0);
      for (const c of cyls) {
        const lam = Math.PI - ((ev.centre - c.phase) * DEG) / 2;
        for (const sx of [-1, 1]) {
          const lobe = reg(lobeGeo[kind], M.forged, 'Cam lobe', 'Valvetrain', cam);
          lobe.position.set(c.x + sx * pairX, 0, 0);
          lobe.rotation.x = lam;
        }
      }
      // cam sprocket + phaser
      const xt = xf - 0.006 - (isV && bank.id === 2 ? 0.016 : 0);
      reg(gearX(0.0508, 0.0468, 40, 0.012, 0.014), M.blackOxide, 'Timing chain / belt', 'Timing', cam).position.set(xt, 0, 0);
      reg(cylX(0.021, 0.02, 24), M.blueAnod, 'Camshaft', 'Valvetrain', cam).position.set(xt - 0.014, 0, 0);
      ref.cams.push({ cam, kind });
    }

    // Timing chain (instanced links on a hull around crank + 2 cam sprockets), guides and tensioner
    {
      const xt = xf - 0.006 - (isV && bank.id === 2 ? 0.016 : 0);
      const circles = [[0, 0, 0.0245], [camY, side * rowZ, 0.0489], [camY, -side * rowZ, 0.0489]];
      const poly = circlesHull(circles, 64);
      const path = resampleClosed(poly, 0);
      const pitch = 0.0077;
      const count = Math.round(path.total / pitch);
      const linkGeo = merge([box(0.0014, 0.0069, 0.0052, -0.0044, 0, 0), box(0.0014, 0.0069, 0.0052, 0.0044, 0, 0), box(0.0075, 0.0034, 0.0028, 0, 0, 0)]);
      const inst = new THREE.InstancedMesh(linkGeo, M.chrome, count);
      inst.userData = { part: 'Timing chain / belt', system: 'Timing' };
      inst.castShadow = true;
      g.add(inst);
      parts.push(inst);
      ref.chains.push({ inst, path, count, xt, spacing: path.total / count, radius: 0.0245 });
      // guide blade along the long slack run + tensioner
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const n = poly.length;
      let best = 0, bestLen = 0;
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > bestLen) { bestLen = len; best = i; }
      }
      const a = poly[best], b = poly[(best + 1) % n];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const m = mid(a, b);
      const guideBlade = box(0.008, bestLen * 0.82, 0.006);
      const gb = reg(guideBlade, M.plastic, 'Timing guide', 'Timing', g);
      gb.position.set(xt, m[0] - Math.sin(ang) * 0.01, m[1] + Math.cos(ang) * 0.01);
      gb.rotation.x = ang - Math.PI / 2;
      const tens = merge([cylY(0.011, 0, 0.05, 22), cylY(0.0075, 0.05, 0.07, 18), box(0.022, 0.012, 0.022, 0, 0.0, 0)]);
      const tn = reg(tens, M.blueAnod, 'Timing tensioner', 'Timing', g);
      tn.position.set(xt, ySeat * 0.45, -side * 0.0 + (isV ? 0 : 0.0));
      tn.position.z = (side > 0 ? 1 : -1) * 0.075;
      tn.rotation.x = 0;
      // rear backing plate (block-to-chain bracket)
    }

    // Pistons, rods, pins, jets
    const pistonG2 = group(g);
    asm(pistonG2, [0, 1, 0], 0.075);
    const rodG2 = group(g);
    asm(rodG2, [0, -1, 0], 0.05);
    for (let i = 0; i < cyls.length; i++) {
      const c = cyls[i];
      const e = ref.cyls[i];
      const pg = group(pistonG2);
      reg(pistonG.body, M.piston, 'Piston', 'Motion', pg);
      pistonG.rings.forEach((rg, ri) => reg(rg, ri === 2 ? M.blackOxide : M.steel, 'Piston rings', 'Motion', pg));
      reg(pistonG.pin, M.chrome, 'Wrist pin', 'Motion', pg);
      const rg = group(rodG2);
      reg(rodG.body, M.forged, 'Connecting rod', 'Motion', rg);
      reg(rodG.bolts, M.blackOxide, 'Connecting rod', 'Motion', rg);
      reg(rodG.shell, M.bearing, 'Rod bearing', 'Motion', rg);
      reg(rodG.smallBush, M.bronze, 'Connecting rod', 'Motion', rg);
      // Gas column between crown and chamber roof (visible in cutaway/x-ray)
      const gasGeo = new THREE.CylinderGeometry(bore / 2 * 0.995, bore / 2 * 0.995, 1, 40, 1, false);
      gasGeo.translate(0, 0.5, 0);
      const gas = new THREE.Mesh(gasGeo, gasMat.clone());
      gas.material.clippingPlanes = [plane];
      gas.renderOrder = 5;
      gas.userData = { gas: true };
      g.add(gas);
      Object.assign(e, { piston: pg, rod: rg, gas });
      // oil jet + gallery stub
      reg(merge([cylY(0.004, 0.0, 0.02, 12), cylY(0.0028, 0.02, 0.034, 10).translate(0, 0, 0)]), M.brass, 'Oil jet', 'Lubrication', g).position.set(c.x + 0.03, 0.045, side * 0.03 * -1);
    }

    // Spark plugs / injectors / glow plugs / coils
    const plugG = group(g);
    asm(plugG, [0, 1, 0], 0.27);
    const sp = C.sparkPlugGeometry();
    const coil = C.coilPackGeometry();
    const inj = C.injectorGeometry(0.07);
    for (const c of cyls) {
      if (!diesel) {
        reg(sp.metal, M.steel, 'Spark plug', 'Ignition', plugG).position.set(c.x, ySeat - 0.0005, 0);
        reg(sp.ceramic, M.ceramic, 'Spark plug', 'Ignition', plugG).position.set(c.x, ySeat - 0.0005, 0);
        const cp = group(plugG, c.x, ySeat + 0.098, 0);
        reg(coil.boot, M.rubber, 'Ignition coil', 'Ignition', cp);
        reg(coil.body, M.plastic, 'Ignition coil', 'Ignition', cp);
      } else {
        reg(inj, M.blackOxide, 'Fuel injector', 'Air & fuel', plugG).position.set(c.x, ySeat - 0.002, 0);
        const gp = reg(C.glowPlugGeometry(), M.steel, 'Glow plug', 'Ignition', plugG);
        gp.position.set(c.x, ySeat + 0.002, -side * 0.012);
        gp.rotation.x = -side * 0.62;
      }
    }

    // Intake runners, plenum entries, injectors (petrol) and the fuel rail
    const manifoldG = group(g);
    asm(manifoldG, [0, 0.35, side * 0.9], 0.11);
    ref.manifold = manifoldG;
  }

  // ---- intake plenum + runners (root frame so V6 banks share one plenum) ---------------------------
  const intakeG = group(root);
  asm(intakeG, [0, 1, 0], 0.16);
  const plenumY = isV ? 0.33 : ySeat + 0.088;
  const plenumZ = isV ? 0 : layout.banks[0].side * 0.152;
  const plenumR = isV ? 0.05 : 0.034;
  {
    const len = lenX + 0.03;
    const plenum = merge([cylX(plenumR, len, 40), cylX(plenumR + 0.004, 0.012, 40).translate(-len / 2 + 0.004, 0, 0), cylX(plenumR + 0.004, 0.012, 40).translate(len / 2 - 0.004, 0, 0)]);
    reg(plenum, M.alloy, 'Intake manifold', 'Air & fuel', intakeG).position.set(xc, plenumY, plenumZ);
    for (const bank of layout.banks) {
      const a = bank.alpha;
      const sgn = bank.side;
      for (const ci of bank.cyl) {
        const c = layout.cylinders[ci];
        const p0 = toRoot(a, [c.x, ySeat + 0.045, sgn * 0.044]);
        const p1 = toRoot(a, [c.x, ySeat + 0.058, sgn * 0.092]);
        const p2 = toRoot(a, [c.x, ySeat + 0.082, sgn * 0.128]);
        const entry = isV ? [c.x, plenumY - 0.005, sgn * 0.036] : [c.x, plenumY - plenumR * 0.4, plenumZ - sgn * 0.002];
        reg(tube([p0, p1, p2, entry], 0.0145, 24, 14), M.alloy, 'Intake manifold', 'Air & fuel', intakeG);
        reg(cylZ(0.021, 0.008, 28), M.alloyDark, 'Intake manifold', 'Air & fuel', intakeG).position.set(...toRoot(a, [c.x, ySeat + 0.0495, sgn * 0.0855]));
      }
    }
    // throttle body + air duct to the airbox
    const tb = merge([cylX(0.0335, 0.05, 32), cylX(0.0275, 0.058, 28).translate(0.0, 0, 0), cylX(0.0295, 0.004, 28).translate(0.026, 0, 0)]);
    const tbMesh = reg(tb, M.alloy, 'Throttle body', 'Air & fuel', intakeG);
    tbMesh.position.set(xMax + 0.036, plenumY, plenumZ);
    const butterfly = reg(new THREE.CircleGeometry(0.0265, 28), M.steel, 'Throttle body', 'Air & fuel', intakeG);
    butterfly.rotation.y = Math.PI / 2;
    butterfly.position.set(xMax + 0.036, plenumY, plenumZ);
    reg(cylY(0.007, 0, 0.034, 12).rotateX(Math.PI / 2).translate(0, 0, 0), M.blackOxide, 'Throttle body', 'Air & fuel', intakeG).position.set(xMax + 0.036, plenumY, plenumZ + 0.0);
    const ab = reg(roundedBox(0.15, 0.085, 0.11, 0.014), M.plastic, 'Air filter', 'Air & fuel', intakeG);
    ab.position.set(xMax + 0.15, plenumY + 0.02, plenumZ + (plenumZ >= 0 ? 0.075 : -0.075) * (isV ? 0 : 1) + (isV ? 0.06 : 0));
    reg(box(0.12, 0.05, 0.085), M.filterWhite, 'Air filter', 'Air & fuel', intakeG).position.copy(ab.position).add(new THREE.Vector3(0, 0.0, 0));
    reg(tube([[xMax + 0.036 + 0.026, plenumY, plenumZ], [xMax + 0.075, plenumY + 0.004, plenumZ + (isV ? 0.03 : 0.0)], [xMax + 0.106, plenumY + 0.02, ab.position.z]], 0.03, 20, 18), M.hoseBlack, 'Air filter', 'Air & fuel', intakeG);
  }

  // petrol: injectors on each runner + fuel rail
  if (!diesel) {
    const railG = group(root);
    asm(railG, [0, 1, 0], 0.2);
    for (const bank of layout.banks) {
      const a = bank.alpha, sg = bank.side;
      const tops = [];
      for (const ci of bank.cyl) {
        const c = layout.cylinders[ci];
        const ia = sg * 0.7;
        const base = toRoot(a, [c.x, ySeat + 0.055, sg * 0.082]);
        const body = reg(C.injectorGeometry(0.07), M.blackOxide, 'Fuel injector', 'Air & fuel', railG);
        body.position.set(...base);
        body.rotation.x = a + ia;
        const topPt = new THREE.Vector3(0, 0.066, 0).applyEuler(new THREE.Euler(a + ia, 0, 0)).add(new THREE.Vector3(...base));
        tops.push(topPt);
      }
      const x0 = tops[0].x, x1 = tops[tops.length - 1].x;
      reg(cylX(0.0075, x1 - x0 + 0.045, 18), M.alloyDark, 'Fuel rail', 'Air & fuel', railG).position.set((x0 + x1) / 2, tops[0].y, tops[0].z);
      reg(cylX(0.0095, 0.012, 18), M.brass, 'Fuel rail', 'Air & fuel', railG).position.set(x1 + 0.024, tops[0].y, tops[0].z);
    }
  } else {
    // common rail above the cover with feed lines to each injector
    const railG = group(root);
    asm(railG, [0, 1, 0], 0.22);
    const bank = layout.banks[0];
    const sg = bank.side;
    const yr = coverTop + 0.045;
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    reg(cylX(0.0105, x1 - x0 + 0.05, 20), M.steel, 'Fuel rail', 'Air & fuel', railG).position.set((x0 + x1) / 2, yr, -sg * 0.05);
    for (const x of xs) {
      reg(tube([[x, yr - 0.004, -sg * 0.05], [x, yr - 0.018, -sg * 0.03], [x, coverTop + 0.03, -sg * 0.004], [x, ySeat + 0.0985, 0]], 0.0034, 20, 8), M.steel, 'Fuel rail', 'Air & fuel', railG);
    }
  }

  // ---- exhaust: headers per bank, collector, catalyst, O2 sensor ------------------------------------
  const exhaustG = group(root);
  asm(exhaustG, [0, -0.2, -1], 0.17);
  const collectorEnds = [];
  for (const bank of layout.banks) {
    const a = bank.alpha, sg = bank.side; // exhaust is on -sg
    const xe = xMax + 0.045;
    const ys = ySeat;
    let endPt = null;
    for (const ci of bank.cyl) {
      const c = layout.cylinders[ci];
      const pts = [
        toRoot(a, [c.x, ys + 0.04, -sg * 0.048]),
        toRoot(a, [c.x, ys + 0.038, -sg * 0.102]),
        toRoot(a, [lerp(c.x, xe, 0.45), ys - 0.012, -sg * 0.142]),
        toRoot(a, [lerp(c.x, xe, 0.82), ys - 0.05, -sg * 0.15]),
        toRoot(a, [xe, ys - 0.06, -sg * 0.15]),
      ];
      reg(tube(pts, 0.0205, 36, 16), M.exhaustPipe, 'Exhaust manifold', 'Air & fuel', exhaustG);
      endPt = pts[pts.length - 1];
      const fl = toRoot(a, [c.x, ys + 0.04, -sg * 0.0855]);
      reg(cylZ(0.0265, 0.008, 30), M.heat, 'Exhaust manifold', 'Air & fuel', exhaustG).position.set(...fl);
      for (const bz of [-1, 1]) {
        const bp = toRoot(a, [c.x + bz * 0.026, ys + 0.04, -sg * 0.0855]);
        reg(cylZ(0.0045, 0.012, 6), M.blackOxide, 'Exhaust manifold', 'Air & fuel', exhaustG).position.set(...bp);
      }
    }
    reg(cylX(0.027, 0.02, 24), M.heat, 'Exhaust manifold', 'Air & fuel', exhaustG).position.set(endPt[0], endPt[1], endPt[2]);
    collectorEnds.push(endPt);
  }
  const catX = xMax + 0.17;
  const catY = -0.03;
  const catZ = isV ? 0 : -layout.banks[0].side * 0.15;
  let turboNode = null;
  if (diesel) {
    // Turbocharger: turbine housing on the collector, compressor on the intake side
    const tGroup = group(root);
    asm(tGroup, [1, 0.2, -0.4], 0.12);
    const e0 = collectorEnds[0];
    const tx = e0[0] + 0.07, ty = e0[1] - 0.012, tz = e0[2];
    const housing = merge([new THREE.SphereGeometry(0.058, 30, 20).translate(0.0, 0, 0), cylX(0.034, 0.1, 28).translate(0.07, 0, 0), cylX(0.04, 0.045, 28).translate(-0.04, 0, 0)]);
    reg(housing, M.heat, 'Turbocharger', 'Air & fuel', tGroup).position.set(tx, ty, tz);
    const comp = merge([new THREE.SphereGeometry(0.052, 30, 20), cylX(0.038, 0.05, 28).translate(0.055, 0, 0)]);
    reg(comp, M.alloyDark, 'Turbocharger', 'Air & fuel', tGroup).position.set(tx + 0.115, ty, tz);
    reg(cylX(0.012, 0.13, 16), M.steel, 'Turbocharger', 'Air & fuel', tGroup).position.set(tx + 0.058, ty, tz);
    const turbine = reg(C.turboWheel(0.042, 11), M.heat, 'Turbocharger', 'Air & fuel', tGroup);
    turbine.position.set(tx, ty, tz);
    const compressor = reg(C.turboWheel(0.04, 9), M.chrome, 'Turbocharger', 'Air & fuel', tGroup);
    compressor.position.set(tx + 0.115, ty, tz);
    turboNode = { turbine, compressor };
    reg(tube([[tx + 0.14, ty, tz], [tx + 0.19, ty + 0.03, tz + 0.04], [tx + 0.19, ty + 0.1, tz + 0.1]], 0.026, 20, 16), M.hoseBlack, 'Turbocharger', 'Air & fuel', tGroup);
    // downpipe from turbine outlet
    collectorEnds[0] = [tx + 0.12, ty, tz];
  }
  // downpipe -> catalytic converter -> O2 sensor
  {
    const dp = collectorEnds.map((p) => [p, [Math.min(p[0] + 0.05, catX - 0.03), (p[1] + catY) / 2, lerp(p[2], catZ, 0.6)], [catX - 0.07, catY, catZ]]);
    for (const pts of dp) reg(tube(pts, 0.0245, 30, 16), M.exhaustPipe, 'Exhaust manifold', 'Air & fuel', exhaustG);
    const cat = merge([cylX(0.056, 0.2, 36), cylX(0.034, 0.085, 28).translate(-0.12, 0, 0), cylX(0.034, 0.085, 28).translate(0.12, 0, 0)]);
    reg(cat, M.exhaustPipe, 'Catalytic converter', 'Exhaust', exhaustG).position.set(catX, catY, catZ);
    reg(cylX(0.0575, 0.012, 36), M.heat, 'Catalytic converter', 'Exhaust', exhaustG).position.set(catX - 0.07, catY, catZ);
    reg(cylX(0.0575, 0.012, 36), M.heat, 'Catalytic converter', 'Exhaust', exhaustG).position.set(catX + 0.07, catY, catZ);
    reg(tube([[catX + 0.16, catY, catZ], [catX + 0.26, catY - 0.01, catZ], [catX + 0.34, catY - 0.03, catZ - 0.0]], 0.0245, 20, 14), M.exhaustPipe, 'Catalytic converter', 'Exhaust', exhaustG);
    const o2 = merge([hexY(0.0085, 0, 0.012), cylY(0.0055, 0.012, 0.04, 12), cylY(0.003, 0.04, 0.055, 8)]);
    const o2m = reg(o2, M.steel, 'Oxygen sensor', 'Exhaust', exhaustG);
    o2m.position.set(catX - 0.115, catY + 0.0235, catZ);
    reg(tube([[catX - 0.115, catY + 0.08, catZ], [catX - 0.14, catY + 0.12, catZ + 0.02], [catX - 0.2, catY + 0.15, catZ + 0.05]], 0.0028, 20, 6), M.rubber, 'Oxygen sensor', 'Exhaust', exhaustG);
    if (diesel) {
      const egr = merge([box(0.05, 0.034, 0.04), cylY(0.016, 0, 0.04).translate(0, 0.037, 0)]);
      reg(egr, M.alloyDark, 'EGR valve', 'Exhaust', exhaustG).position.set(xMax + 0.02, plenumY + 0.01, plenumZ - 0.06 * Math.sign(plenumZ || 1));
    } else {
      reg(box(0.04, 0.03, 0.035), M.alloyDark, 'EGR valve', 'Exhaust', exhaustG).position.set(xMax + 0.02, plenumY + 0.015, plenumZ - 0.06 * Math.sign(plenumZ || 1));
    }
  }

  // ---- crankcase bottom end, oil pan, ladder, bolts --------------------------------------------------
  {
    const caseG = group(root);
    const lower = prism(roundedRectShape(lenX + 0.004, isV ? 0.236 : 0.19, 0.02), 0.082, 0.004);
    reg(lower, diesel ? M.iron : M.alloy, 'Engine block', 'Structure', caseG).position.set(xc, -0.062, 0);
    // ladder frame / bearing caps
    const capsGeo = [];
    for (const sx of crank.userData.mains) capsGeo.push(box(0.021, 0.036, 0.1, sx, -0.045, 0), cylY(0.0085, -0.063, -0.054).translate(sx, 0, 0.05), cylY(0.0085, -0.063, -0.054).translate(sx, 0, -0.05));
    reg(merge(capsGeo), M.forged, 'Main bearing', 'Motion', caseG);
    // bolts around the pan rail
    const bolts = [];
    for (let i = 0; i < 9; i++) {
      const x = xMin + 0.014 + (i * (lenX - 0.028)) / 8;
      for (const sz of [-1, 1]) bolts.push(hexY(0.0075, -0.0805, -0.0725).translate(x, 0, sz * (isV ? 0.115 : 0.094)));
    }
    reg(merge(bolts), M.blackOxide, 'Oil pan / sump', 'Structure', caseG);
    const panG = group(root);
    asm(panG, [0, -1, 0], 0.15);
    const pan = prism(roundedRectShape(lenX + 0.014, isV ? 0.246 : 0.2, 0.026), 0.075, 0.006);
    reg(pan, M.pan, 'Oil pan / sump', 'Structure', panG).position.set(xc + 0.01, -0.153, 0);
    const finsG = [];
    for (let i = 0; i < 8; i++) finsG.push(box(0.003, 0.05, isV ? 0.24 : 0.194, xMin + 0.02 + (i * (lenX - 0.04)) / 7, -0.115, 0));
    reg(merge(finsG), M.pan, 'Oil pan / sump', 'Structure', panG);
    reg(cylY(0.0105, -0.164, -0.152).translate(xc - 0.03, 0, 0), M.blackOxide, 'Oil pan / sump', 'Structure', panG);
    // Oil pump (front) with pickup and gallery
    const opG = group(root);
    asm(opG, [-0.4, -1, 0], 0.12);
    reg(merge([cylX(0.043, 0.032, 32), cylX(0.036, 0.012, 28).translate(-0.02, 0, 0)]), M.alloyDark, 'Oil pump', 'Lubrication', opG).position.set(xf - 0.014, -0.008, 0);
    reg(tube([[xf + 0.01, -0.05, 0.0], [xf + 0.03, -0.09, 0.02], [xf + 0.06, -0.12, 0.02]], 0.0105, 20, 10), M.steel, 'Oil pump', 'Lubrication', opG);
    const galG = group(root);
    asm(galG, [0, -1, 0], 0.09);
    const sgn0 = layout.banks[0].side;
    reg(cylX(0.0058, lenX - 0.01, 14), M.oil, 'Oil gallery', 'Lubrication', galG).position.set(xc, 0.032, -sgn0 * 0.062);
    for (const sx of crank.userData.mains) reg(tube([[sx, 0.032, -sgn0 * 0.062], [sx, 0.016, -sgn0 * 0.03], [sx, 0.002, -0.0]], 0.0045, 12, 8), M.oil, 'Oil gallery', 'Lubrication', galG);
    // oil filter canister on the intake side
    const filter = merge([cylZ(0.04, 0.095, 36), cylZ(0.0415, 0.012, 36).translate(0, 0, -0.05), cylZ(0.0225, 0.02, 24).translate(0, 0, 0.058)]);
    const fSide = isV ? 1 : layout.banks[0].side;
    const filterMesh = reg(filter, M.blueAnod, 'Oil filter', 'Lubrication', galG);
    filterMesh.position.set(xf + 0.075, 0.0, fSide * (isV ? 0.15 : 0.145));
    filterMesh.rotation.y = fSide < 0 ? Math.PI : 0;
  }

  // ---- front accessories: water pump, alternator, belt, thermostat, radiator, fan -----------------------
  const xPulley = xf - 0.062;
  const wpPos = [0.034, 0.152, 0.0];
  const altPos = [0.138, -0.178];
  const accG = group(root);
  asm(accG, [-1, 0, 0], 0.12);
  {
    // water pump
    const wp = merge([cylX(0.05, 0.05, 36), cylX(0.034, 0.018, 28).translate(0.03, 0, 0)]);
    reg(wp, M.alloy, 'Water pump', 'Cooling', accG).position.set(xf - 0.022, wpPos[0], wpPos[1]);
    reg(cylX(0.043, 0.02, 36), M.blackOxide, 'Water pump', 'Cooling', accG).position.set(xPulley, wpPos[0], wpPos[1]);
    // alternator
    const alt = merge([cylX(0.056, 0.082, 36), cylX(0.048, 0.016, 32).translate(0.0, 0, 0)]);
    const altM = reg(alt, M.alloyDark, 'Alternator', 'Starting', accG);
    altM.position.set(xf - 0.026, altPos[0], altPos[1]);
    const finsA = [];
    for (let i = 0; i < 16; i++) finsA.push(box(0.07, 0.006, 0.014, 0.0, 0.0575, 0).rotateX((i / 16) * TAU));
    reg(merge(finsA), M.alloyDark, 'Alternator', 'Starting', accG).position.set(xf - 0.026, altPos[0], altPos[1]);
    reg(cylX(0.0285, 0.02, 32), M.blackOxide, 'Alternator', 'Starting', accG).position.set(xPulley, altPos[0], altPos[1]);
    reg(cylX(0.0135, 0.014, 20), M.steel, 'Alternator', 'Starting', accG).position.set(xPulley - 0.012, altPos[0], altPos[1]);
    // belt
    const outer = circlesHull([[0, 0, 0.0735], [wpPos[0], wpPos[1], 0.0455], [altPos[0], altPos[1], 0.0315]], 64);
    const inner = circlesHull([[0, 0, 0.0715], [wpPos[0], wpPos[1], 0.0435], [altPos[0], altPos[1], 0.0295]], 64);
    const beltShape = polygonShape(outer);
    const hole = new THREE.Path();
    inner.slice().reverse().forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)));
    hole.closePath();
    beltShape.holes.push(hole);
    reg(plateX(beltShape, 0.022, 0.0008), M.rubber, 'Crank pulley', 'Motion', accG).position.set(xPulley, 0, 0);
    // starter motor at the rear
    const stG = group(root);
    asm(stG, [1, -0.3, -0.6], 0.15);
    const stSide = isV ? -1 : -layout.banks[0].side;
    const starter = merge([cylX(0.038, 0.12, 30), cylX(0.044, 0.04, 30).translate(-0.08, 0, 0), cylX(0.03, 0.045, 24).translate(0.08, 0, 0), cylX(0.0095, 0.03, 12).translate(0.115, 0, 0)]);
    reg(starter, M.blackOxide, 'Starter motor', 'Starting', stG).position.set(xr + 0.0, 0.016, stSide * 0.09);
    reg(cylX(0.016, 0.07, 20), M.alloyDark, 'Starter motor', 'Starting', stG).position.set(xr + 0.04, 0.016, stSide * 0.06);
    // thermostat housing + hoses to the radiator
    const coolG = group(root);
    asm(coolG, [-1, 0.3, 0], 0.16);
    const thermoPos = [xf - 0.016, ySeat + 0.045, 0.0];
    const th = merge([cylX(0.032, 0.05, 28), cylY(0.021, 0, 0.044).translate(0, 0.03, 0)]);
    reg(th, M.alloy, 'Thermostat', 'Cooling', coolG).position.set(...thermoPos);
    const rx = xf - 0.215;
    const rad = merge([box(0.036, 0.3, 0.34), box(0.052, 0.05, 0.34, 0, 0.17, 0), box(0.052, 0.05, 0.34, 0, -0.17, 0)]);
    reg(rad, M.plastic, 'Radiator', 'Cooling', coolG).position.set(rx, 0.1, 0);
    reg(C.finPack(0.034, 0.288, 0.332, 34, 0.0006), M.fin, 'Radiator', 'Cooling', coolG).position.set(rx + 0.0, 0.1, 0);
    reg(tube([[thermoPos[0] - 0.02, thermoPos[1] + 0.04, 0.0], [xf - 0.08, thermoPos[1] + 0.08, 0.04], [rx + 0.04, 0.265, 0.12]], 0.0185, 24, 14), M.hoseBlue, 'Radiator', 'Cooling', coolG);
    reg(tube([[xf - 0.04, wpPos[0] - 0.01, wpPos[1] * 0.6], [xf - 0.09, -0.02, 0.17], [rx + 0.04, -0.07, 0.12]], 0.0185, 24, 14), M.hoseBlue, 'Radiator', 'Cooling', coolG);
    const shroud = merge([ringY(0.158, 0.145, -0.008, 0.008, 48).rotateZ(Math.PI / 2)]);
    reg(shroud, M.plastic, 'Cooling fan', 'Cooling', coolG).position.set(rx + 0.052, 0.1, 0);
    const fan = reg(C.fanGeometry(0.14, 7), M.plastic, 'Cooling fan', 'Cooling', coolG);
    fan.position.set(rx + 0.052, 0.1, 0);
    root.userData.fan = fan;
  }
  if (diesel) {
    const icG = group(root);
    asm(icG, [-1, 0, 0], 0.2);
    const icx = xf - 0.262;
    reg(merge([box(0.034, 0.24, 0.3), box(0.05, 0.24, 0.036, 0, 0, 0.168), box(0.05, 0.24, 0.036, 0, 0, -0.168)]), M.alloyDark, 'Intercooler', 'Air & fuel', icG).position.set(icx, 0.12, 0);
    reg(C.finPack(0.032, 0.228, 0.3, 30, 0.0006), M.fin, 'Intercooler', 'Air & fuel', icG).position.set(icx, 0.12, 0);
  }

  // ---- bounds + helpers ------------------------------------------------------------------------------------
  root.updateMatrixWorld(true);
  // Frame the engine itself: leave out the radiator, tail pipe and other far-flung hardware.
  const periphery = new Set(['Radiator', 'Cooling fan', 'Intercooler', 'Catalytic converter', 'Oxygen sensor', 'Air filter', 'Starter motor', 'EGR valve', 'Alternator', 'Water pump', 'Thermostat']);
  const box3 = new THREE.Box3();
  for (const p of parts) if (!periphery.has(p.userData.part) && !p.isInstancedMesh) box3.expandByObject(p);
  const bounds = { center: box3.getCenter(new THREE.Vector3()), size: box3.getSize(new THREE.Vector3()) };

  // ---- animation state ---------------------------------------------------------------------------------------
  const state = {
    explodeT: 0, cutawayT: 1, xray: false, turboAngle: 0, fanAngle: 0, filter: { system: 'All', isolate: null }, selected: null, flow: 0,
  };
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3(1, 1, 1);
  const AX = new THREE.Vector3(1, 0, 0);
  const col = new THREE.Color();

  function gasLook(mat, physics, a) {
    if (!physics) return;
    const T = physics.gasTemperature(a);
    const burn = physics.burnFraction(a);
    const hot = clamp((T - 900) / 1700, 0, 1);
    const afterIgn = a >= physics.burnStart - 2 && a < 560;
    const aa = mod(a, 720);
    let opacity;
    if (afterIgn && burn > 0.002) {
      col.setRGB(1.0, lerp(0.34, 0.86, hot * hot), lerp(0.05, 0.5, hot * hot * hot));
      opacity = 0.3 + 0.62 * Math.min(1, hot * 1.2);
    } else if (aa < 540 && aa > 300) {
      col.setRGB(0.28, 0.55 + 0.25 * hot, 1.0);
      opacity = 0.22 + 0.3 * hot;
    } else if (aa >= 540 || aa < 20) {
      col.setRGB(0.55, 0.5, 0.45);
      opacity = 0.16;
    } else {
      col.setRGB(0.28, 0.62, 1.0);
      opacity = 0.2;
    }
    mat.color.copy(col);
    mat.opacity = opacity;
  }

  function update({ theta = 0, physics = null, dt = 0.016, explode = false, cutaway = false, xray = false } = {}) {
    const th = theta * DEG;
    crank.rotation.x = th;

    for (const ref of bankRefs) {
      for (const e of ref.cyls) {
        const phase = e.cyl.phase;
        const psi = (theta + phase) * DEG;
        const sPsi = Math.sin(psi), cPsi = Math.cos(psi);
        const s = r * cPsi + Math.sqrt(L * L - r * r * sPsi * sPsi);
        e.piston.position.set(e.x, s, 0);
        e.rod.position.set(e.x, r * cPsi, r * sPsi);
        e.rod.rotation.x = Math.atan2(-r * sPsi, s - r * cPsi);

        const a = mod(theta + phase, 720);
        const li = valveLiftCurve(a, spec.intake) * spec.intake.lift;
        const le = valveLiftCurve(a, spec.exhaust) * spec.exhaust.lift;
        for (const v of e.intake) {
          v.vg.position.y = -li;
          v.spring.scale.y = 0.0578 - li;
        }
        for (const v of e.exhaust) {
          v.vg.position.y = -le;
          v.spring.scale.y = 0.0578 - le;
        }
        const crown = s + ch;
        const h = Math.max(1e-4, ySeat - crown);
        e.gas.position.set(e.x, crown, 0);
        e.gas.scale.set(1, h, 1);
        gasLook(e.gas.material, physics, a);
      }
      for (const c of ref.cams) c.cam.rotation.x = th / 2;
      for (const ch2 of ref.chains) {
        const off = ch2.radius * th;
        for (let i = 0; i < ch2.count; i++) {
          const p = pointOnClosed(ch2.path, off + i * ch2.spacing);
          tmpQ.setFromAxisAngle(AX, p.angle);
          tmpV.set(ch2.xt, p.x, p.y);
          tmpM.compose(tmpV, tmpQ, tmpS);
          ch2.inst.setMatrixAt(i, tmpM);
        }
        ch2.inst.instanceMatrix.needsUpdate = true;
      }
    }

    // turbo + fan spin with the engine state
    if (turboNode) {
      const boost = physics ? physics.boost : 0;
      state.turboAngle += dt * (20 + boost * 900 + (physics ? physics.rpm : 0) * 0.04);
      turboNode.turbine.rotation.x = state.turboAngle;
      turboNode.compressor.rotation.x = state.turboAngle;
    }
    if (root.userData.fan) {
      const hot = physics ? clamp((physics.temperature - 90) / 12, 0, 1) : 0;
      state.fanAngle -= dt * (4 + 26 * hot);
      root.userData.fan.rotation.x = state.fanAngle;
    }

    // explode / cutaway / x-ray easing
    state.explodeT += ((explode ? 1 : 0) - state.explodeT) * Math.min(1, dt * 6);
    if (Math.abs(state.explodeT - (explode ? 1 : 0)) < 0.001) state.explodeT = explode ? 1 : 0;
    const e = state.explodeT * state.explodeT * (3 - 2 * state.explodeT);
    for (const a of assemblies) a.node.position.copy(a.node.userData.base).addScaledVector(a.dir, a.dist * e);

    const cutTarget = cutaway ? 0 : 1;
    state.cutawayT += (cutTarget - state.cutawayT) * Math.min(1, dt * 7);
    if (Math.abs(state.cutawayT - cutTarget) < 0.002) state.cutawayT = cutTarget;
    // The plane lives in world units (the root is scaled): 0 clips the front half, 14 clips nothing.
    plane.constant = state.cutawayT * 14;

    if (xray !== state.xray) {
      state.xray = xray;
      for (const m of M._structural) {
        const [o, t, d] = M._baseOpacity.get(m);
        if (xray) { m.transparent = true; m.opacity = m === M.coolant ? 0.35 : 0.16; m.depthWrite = false; }
        else { m.transparent = t; m.opacity = o; m.depthWrite = d; }
        m.needsUpdate = true;
      }
    }
  }

  // ---- visibility / highlighting ----------------------------------------------------------------------------
  function applyFilter({ system = 'All', isolate = null } = {}) {
    state.filter = { system, isolate };
    for (const p of parts) {
      const sysOk = system === 'All' || p.userData.system === system;
      const isoOk = !isolate || p.userData.part === isolate;
      p.visible = sysOk && isoOk;
    }
  }

  function highlight(name, color = 0x56b6ff, intensity = 0.55) {
    for (const p of parts) {
      if (p.userData.hl && p.userData.origMat) {
        p.material = p.userData.origMat;
        p.userData.hl = false;
      }
    }
    state.selected = name;
    for (const p of parts) {
      if (p.userData.part !== name) continue;
      const base = p.material;
      if (!base.emissive) continue;
      p.userData.origMat = base;
      const m = base.clone();
      m.clippingPlanes = base.clippingPlanes;
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = intensity;
      p.material = m;
      p.userData.hl = true;
    }
  }

  function has(name) {
    return parts.some((p) => p.userData.part === name);
  }
  function worldCenterOf(name) {
    const b = new THREE.Box3();
    let any = false;
    for (const p of parts) if (p.userData.part === name && p.visible) { b.expandByObject(p); any = true; }
    return any ? b.getCenter(new THREE.Vector3()) : null;
  }

  /** World-space centre of the visible instance of a part closest to the camera (for callouts). */
  function anchorOf(name, camera) {
    const b = new THREE.Box3(), c = new THREE.Vector3();
    let best = null, bd = Infinity;
    for (const p of parts) {
      if (p.userData.part !== name || !p.visible) continue;
      b.makeEmpty().expandByObject(p);
      if (b.isEmpty()) continue;
      b.getCenter(c);
      const d = camera ? c.distanceTo(camera.position) : 0;
      if (d < bd) { bd = d; best = c.clone(); }
    }
    return best;
  }

  applyFilter();
  update({ theta: 0 });

  return {
    root, parts, bounds, layout, update, applyFilter, highlight, has, worldCenterOf, anchorOf, plane, materials: M,
    dims: { deckY, ySeat, camY, coverTop, r, L, ch, bore },
  };
}

/** Box with rounded vertical edges. */
function roundedBox(w, h, d, r) {
  const s = roundedRectShape(w, d, r);
  const g = prism(s, h, Math.min(r * 0.4, 0.004));
  g.translate(0, -h / 2, 0);
  return g;
}
