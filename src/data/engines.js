// Engine definitions. One source of truth shared by the physics model and the 3D builder,
// so the geometry you see is the geometry the equations use (bore, stroke, rod length,
// crank-pin phasing, firing order).
//
// Angles: crank angle θ is measured from +Y (up) towards +Z, the same sense in which a
// cylinder bank leans (alpha). All lengths are in metres here; the 3D scene scales them.

export const ENGINES = {
  i4: {
    id: 'i4',
    short: 'I4',
    name: '2.0L Inline-4',
    sub: 'Petrol · DOHC · 16 valves',
    blurb: 'The everyday workhorse. Four cylinders in a row, firing every 180°.',
    layout: 'inline',
    cylinders: 4,
    valvesPerCylinder: 4,
    fuel: 'petrol',
    bore: 0.086,
    stroke: 0.086,
    rodRatio: 1.9,
    compression: 10.5,
    ve: 0.94,
    veRpm: 4300,
    veSlope: 1.0,
    redline: 7000,
    ratedTorque: 200,
    inertia: 0.24,
    idleRpm: 850,
    fmep: [0.55, 0.10, 0.012],
    afr: 14.7,
    boostMax: 0,
    firingOrder: [1, 3, 4, 2],
    intake: { open: -10, close: 235, centre: 112, half: 125, lift: 0.0105 },
    exhaust: { open: 485, close: 740, centre: 612, half: 128, lift: 0.0098 },
  },
  v6: {
    id: 'v6',
    short: 'V6',
    name: '3.0L V6',
    sub: 'Petrol · 60° V · 24 valves',
    blurb: 'Two banks of three cylinders sharing one crankshaft. Smooth and compact.',
    layout: 'v',
    cylinders: 6,
    valvesPerCylinder: 4,
    fuel: 'petrol',
    bore: 0.086,
    stroke: 0.086,
    rodRatio: 1.85,
    compression: 10.5,
    ve: 0.93,
    veRpm: 4600,
    veSlope: 1.0,
    redline: 6800,
    ratedTorque: 300,
    inertia: 0.32,
    idleRpm: 800,
    fmep: [0.60, 0.11, 0.013],
    afr: 14.7,
    boostMax: 0,
    firingOrder: [1, 6, 3, 5, 2, 4],
    vAngle: 60,
    intake: { open: -10, close: 235, centre: 112, half: 125, lift: 0.0105 },
    exhaust: { open: 485, close: 740, centre: 612, half: 128, lift: 0.0098 },
  },
  diesel: {
    id: 'diesel',
    short: 'TDI',
    name: '2.2L Turbo Diesel',
    sub: 'Diesel · common rail · turbo',
    blurb: 'High compression, no spark. A turbocharger forces extra air in.',
    layout: 'inline',
    cylinders: 4,
    valvesPerCylinder: 4,
    fuel: 'diesel',
    bore: 0.085,
    stroke: 0.097,
    rodRatio: 1.75,
    compression: 16.5,
    ve: 0.95,
    veRpm: 2600,
    veSlope: 1.4,
    redline: 4800,
    ratedTorque: 420,
    inertia: 0.30,
    idleRpm: 800,
    fmep: [0.95, 0.12, 0.016],
    afr: 19,
    afrMin: 17.2,
    boostMax: 1.25,
    firingOrder: [1, 3, 4, 2],
    intake: { open: -5, close: 215, centre: 105, half: 110, lift: 0.0095 },
    exhaust: { open: 490, close: 735, centre: 612, half: 122, lift: 0.0092 },
  },
  bike: {
    id: 'bike',
    short: 'I4 bike',
    name: '1.0L Motorcycle',
    sub: 'Petrol · DOHC · high-revving',
    blurb: 'Short stroke, big bore, 12,000 rpm. Built to scream.',
    layout: 'inline',
    cylinders: 4,
    valvesPerCylinder: 4,
    fuel: 'petrol',
    bore: 0.076,
    stroke: 0.055,
    rodRatio: 2.0,
    compression: 12.2,
    ve: 0.97,
    veRpm: 9000,
    veSlope: 0.9,
    redline: 12000,
    ratedTorque: 115,
    inertia: 0.09,
    idleRpm: 1200,
    fmep: [0.50, 0.09, 0.006],
    afr: 14.7,
    boostMax: 0,
    firingOrder: [1, 2, 4, 3],
    intake: { open: -20, close: 245, centre: 112, half: 132, lift: 0.0098 },
    exhaust: { open: 480, close: 745, centre: 612, half: 133, lift: 0.0092 },
  },
};

export const ENGINE_LIST = Object.values(ENGINES);

const DEG = Math.PI / 180;
const mod = (v, m) => ((v % m) + m) % m;

/**
 * Cylinder layout: bank, lean angle, position along the crank, four-stroke phase and
 * crank-pin angle for every cylinder.
 *
 *   cycle angle of cylinder j   a_j = (θ + phase_j) mod 720      (360 = ignition TDC)
 *   crank pin angle             pin_j = phase_j + alpha_j        (mod 360)
 *
 * The second line is what makes the picture and the physics agree: the piston reaches
 * TDC exactly when the cycle angle is 0 or 360.
 */
export function makeLayout(spec) {
  const n = spec.cylinders;
  const cylinders = [];
  const order = spec.firingOrder;
  // Firing interval: ignition of the k-th cylinder in the order happens at t = k * 720/n.
  const phaseFor = (label) => mod(360 - (order.indexOf(label) * 720) / n, 720);

  if (spec.layout === 'inline') {
    const pitch = spec.bore * 1.11 + 0.011;
    for (let i = 0; i < n; i++) {
      const phase = phaseFor(i + 1);
      cylinders.push({
        index: i,
        label: i + 1,
        bank: 0,
        alpha: 0,
        side: 1, // intake side (+Z)
        x: (i - (n - 1) / 2) * pitch,
        phase,
        pin: mod(phase, 360) * DEG,
      });
    }
    return {
      kind: 'inline',
      pitch,
      cylinders,
      banks: [{ id: 0, name: 'main', alpha: 0, side: 1, cyl: cylinders.map((c) => c.index) }],
      length: (n - 1) * pitch + spec.bore * 1.25,
    };
  }

  // 60° V: two banks, three split-pin throws. Labels 1-3 on bank A (leans +Z), 4-6 on bank B.
  const half = (spec.vAngle / 2) * DEG;
  const throwPitch = 0.122;
  const jog = 0.026;
  const phases = {};
  // Throw centres at 60°, 300°, 540° give three throws 120° apart with 60° split pins.
  const T = [60, 300, 540];
  for (let k = 0; k < 3; k++) {
    phases[1 + k] = mod(T[k] - 60, 720); // bank A cylinder k+1
    phases[4 + k] = mod(T[k] + 60, 720); // bank B cylinder k+4
  }
  for (let k = 0; k < 3; k++) {
    const xk = (k - 1) * throwPitch;
    for (const [bank, label, alpha, dx] of [
      [1, 1 + k, +half, -jog],
      [2, 4 + k, -half, +jog],
    ]) {
      const phase = phases[label];
      cylinders.push({
        index: label - 1,
        label,
        bank,
        alpha,
        // Intake manifold sits in the valley between the banks.
        side: bank === 1 ? -1 : 1,
        x: xk + dx,
        phase,
        pin: mod(phase + alpha / DEG, 360) * DEG,
      });
    }
  }
  cylinders.sort((a, b) => a.index - b.index);
  return {
    kind: 'v',
    pitch: throwPitch,
    cylinders,
    banks: [
      { id: 1, name: 'A', alpha: +half, side: -1, cyl: [0, 1, 2] },
      { id: 2, name: 'B', alpha: -half, side: 1, cyl: [3, 4, 5] },
    ],
    length: 2 * throwPitch + 0.15,
  };
}

/** Firing intervals in crank degrees, handy for the UI ("fires every 180°"). */
export function firingInterval(spec) {
  return 720 / spec.cylinders;
}
