// Real-time reduced-order four-stroke engine model.
//
// One cylinder is modelled as a single-zone gas volume:
//   * slider-crank kinematics give the volume V(θ) and its derivative exactly;
//   * the gas is compressed polytropically after intake-valve closing;
//   * combustion adds heat with a Wiebe burn rate, and pressure follows the first law
//         dp/dθ = [ -γ p dV/dθ + (γ-1) dQ/dθ ] / V
//   * the cylinders are identical, so the engine torque is the cycle-mean indicated torque
//     (work per cycle / 4π) per cylinder, times the cylinder count, minus friction.
//
// It is an educational model, not an ECU calibration: heat loss is lumped into one factor
// and gas exchange is idealised. It is validated against textbook limits in the tests.

import { ENGINES } from './data/engines.js';

const R_AIR = 287.05;
const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const LHV = { petrol: 43.5e6, diesel: 42.6e6 };
const P_AMB = 1.013e5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (v, m) => ((v % m) + m) % m;

// Kept for callers that only need the headline numbers.
export const ENGINE_PHYSICS = Object.fromEntries(
  Object.entries(ENGINES).map(([k, e]) => [
    k,
    { bore: e.bore, stroke: e.stroke, compression: e.compression, redline: e.redline, boostMax: e.boostMax, afr: e.afr },
  ])
);

/** Smooth cam lift (0..1) at four-stroke cycle angle `a` (deg) for a valve event {centre, half}. */
export function valveLiftCurve(a, ev) {
  let d = mod(a - ev.centre + 360, 720) - 360;
  const u = Math.abs(d) / ev.half;
  if (u >= 1) return 0;
  return Math.pow((1 + Math.cos(Math.PI * u)) / 2, 1.25);
}

export class EnginePhysics {
  constructor(type = 'i4') {
    this.type = ENGINES[type] ? type : 'i4';
    this.spec = ENGINES[this.type];
    this.cylinders = this.spec.cylinders;
    this.sparkAdvance = 12;
    this._key = '';
    this.reset();
  }

  reset() {
    const s = this.spec;
    this.rpm = s.idleRpm;
    this.theta = 0;
    this.throttle = 0;
    this.load = 0.1;
    this.temperature = 88;
    this.oil = 90;
    this.exhaustTemp = 320;
    this.manifoldPressure = 40;
    this.torque = 0;
    this.power = 0;
    this.fuelRate = 0;
    this.pressure = 1;
    this.boost = 0;
    this.knock = 0;
    this.efficiency = 0;
    this.imep = 0;
    this.bmep = 0;
    this.airMass = 0;
    this.intakeFlow = 0;
    this.idleTrim = 0.05;
    this._key = '';
    this.updateCycle();
  }

  // ---- geometry -----------------------------------------------------------------------
  get boreArea() { return (Math.PI * this.spec.bore * this.spec.bore) / 4; }
  get rodLength() { return this.spec.stroke * this.spec.rodRatio; }
  displacementPerCylinder() { return this.boreArea * this.spec.stroke; }
  clearanceVolume() { return this.displacementPerCylinder() / (this.spec.compression - 1); }

  /** Distance of the piston from TDC (m) at crank angle t (rad). 0 at TDC, `stroke` at BDC. */
  pistonPosition(t) {
    const r = this.spec.stroke / 2;
    const L = this.rodLength;
    const s = Math.sin(t);
    return r * (1 - Math.cos(t)) + L - Math.sqrt(L * L - r * r * s * s);
  }

  /** Piston velocity (m/s) at crank angle t (rad), at the current rpm. */
  pistonVelocity(t, rpm = this.rpm) {
    const r = this.spec.stroke / 2;
    const L = this.rodLength;
    const s = Math.sin(t);
    const dpos = r * s + (r * r * s * Math.cos(t)) / Math.sqrt(L * L - r * r * s * s);
    return dpos * ((rpm * TWO_PI) / 60);
  }

  volume(t) { return this.clearanceVolume() + this.boreArea * this.pistonPosition(t); }

  /** dV/dθ in m³/rad (analytic). */
  volumeDerivative(t) {
    const r = this.spec.stroke / 2;
    const L = this.rodLength;
    const s = Math.sin(t);
    return this.boreArea * (r * s + (r * r * s * Math.cos(t)) / Math.sqrt(L * L - r * r * s * s));
  }

  // ---- valves -------------------------------------------------------------------------
  /** Normalised valve lift 0..1 at four-stroke cycle angle a (deg). */
  valveLift(a, kind = 'intake') {
    return valveLiftCurve(a, kind === 'intake' ? this.spec.intake : this.spec.exhaust);
  }
  valveLiftMm(a, kind = 'intake') {
    return this.valveLift(a, kind) * (kind === 'intake' ? this.spec.intake.lift : this.spec.exhaust.lift) * 1000;
  }

  // ---- in-cylinder pressure -----------------------------------------------------------
  /** Rebuild the 720° pressure trace if operating point changed enough to matter. */
  updateCycle(force = false) {
    const key = [
      Math.round(this.rpm / 40),
      Math.round(clamp(this.effectiveThrottle ?? this.throttle, 0, 1) * 200),
      Math.round(this.boost * 100),
      Math.round(this.sparkAdvance),
      this.type,
    ].join('|');
    if (!force && key === this._key) return;
    this._key = key;
    this._buildTrace();
  }

  _manifoldPressure(thr) {
    const s = this.spec;
    if (s.fuel === 'diesel') return P_AMB * 0.97 + this.boost * 1e5;
    return P_AMB * (0.2 + 0.8 * Math.pow(clamp(thr, 0, 1), 0.85)) + this.boost * 1e5;
  }

  _buildTrace() {
    const s = this.spec;
    const diesel = s.fuel === 'diesel';
    const thr = clamp(this.effectiveThrottle ?? this.throttle, 0, 1);
    const rpm = this.rpm;

    const pMan = this._manifoldPressure(thr);
    const pExh = P_AMB * 1.04 + 0.5 * this.boost * 1e5 + 0.35e5 * thr * Math.pow(rpm / s.redline, 2);
    const ivc = s.intake.close; // deg
    const evo = s.exhaust.open;

    // Volumetric efficiency falls off either side of its peak-rpm.
    const x = (rpm - s.veRpm) / s.redline;
    const ve = clamp(s.ve * (1 - s.veSlope * x * x * 1.4), 0.5, 1.05);
    const Vivc = this.volume(ivc * DEG);
    const Tin = 305 + 28 * thr + 22 * this.boost;
    const mAir = (pMan * Vivc * ve) / (R_AIR * Tin);
    this.airMass = mAir;

    let mFuel;
    if (diesel) {
      const lambdaFuel = mAir / s.afrMin; // smoke limit
      mFuel = lambdaFuel * clamp(0.08 + 0.92 * thr, 0.08, 1);
    } else {
      mFuel = mAir / s.afr;
    }
    const lhv = LHV[s.fuel];
    // Lumped combustion efficiency x wall heat loss.
    const Qtot = mFuel * lhv * (diesel ? 0.80 : 0.78);
    this.fuelPerCycle = mFuel;
    this.heatPerCycle = Qtot;

    const nC = 1.33;
    const gammaB = diesel ? 1.30 : 1.28;
    // Start / duration of burn (deg crank). Burn lasts longer at high rpm in crank degrees.
    const ign = diesel ? 360 - 4 : 360 - this.sparkAdvance - 3;
    const dur = diesel ? 62 + rpm / 220 : 38 + rpm / 260;
    this.burnStart = ign;
    this.burnDuration = dur;

    const N = 720;
    const P = new Float32Array(N + 1);
    const XB = new Float32Array(N + 1);
    const wb = (a) => (a <= ign ? 0 : 1 - Math.exp(-5 * Math.pow((a - ign) / dur, 3)));
    const dwb = (a) => (a <= ign ? 0 : (15 * Math.pow(a - ign, 2) / Math.pow(dur, 3)) * Math.exp(-5 * Math.pow((a - ign) / dur, 3)));

    // 1) intake: cylinder follows manifold, slightly depressed by flow.
    for (let a = 0; a <= ivc; a++) {
      const flow = Math.sin((Math.PI * Math.max(a, 0)) / ivc);
      P[a] = pMan * (1 - 0.05 * flow * (rpm / s.redline));
    }
    // 2) compression from IVC to ignition, then combustion + expansion to EVO (RK2, 0.5°).
    let p = pMan;
    let a = ivc;
    const h = 0.5;
    const hr = h * DEG;
    const f = (ad, pp) => {
      const t = ad * DEG;
      const V = this.volume(t);
      const dV = this.volumeDerivative(t);
      if (ad < ign) return (-nC * pp * dV) / V;
      return (-gammaB * pp * dV + (gammaB - 1) * Qtot * dwb(ad) * (1 / DEG)) / V;
    };
    let nextStore = ivc + 1;
    while (a < evo) {
      const k1 = f(a, p);
      const k2 = f(a + h / 2, p + (k1 * hr) / 2);
      p += k2 * hr;
      a += h;
      if (a >= nextStore - 1e-6 && nextStore <= evo) {
        P[nextStore] = p;
        nextStore++;
      }
    }
    const pEvo = p;
    this.evoPressure = pEvo;
    this.evoTemperature = (pEvo * this.volume(evo * DEG)) / (Math.max(mAir + mFuel, 1e-6) * R_AIR);

    // 3) blow-down then exhaust stroke.
    for (let k = evo + 1; k <= N; k++) {
      const u = (k - evo) / 14;
      P[k] = pExh + (pEvo - pExh) * Math.exp(-u);
    }
    // After blow-down the cylinder follows the exhaust pressure, gently pumped by the piston.
    for (let k = Math.ceil(evo + 60); k <= N; k++) P[k] = pExh * (1 + 0.02 * Math.sin(((k - evo) * Math.PI) / (N - evo)));

    for (let k = 0; k <= N; k++) XB[k] = wb(k);

    // Cycle work and the torque it produces.
    let W = 0;
    let Wgross = 0;
    let peak = 0;
    for (let k = 0; k < N; k++) {
      const t = (k + 0.5) * DEG;
      const pm = 0.5 * (P[k] + P[k + 1]);
      const dW = pm * this.volumeDerivative(t) * DEG;
      W += dW;
      if (k >= 180 && k < 540) Wgross += dW;
      peak = Math.max(peak, P[k]);
    }
    this.trace = P;
    this.burn = XB;
    this.cycleWork = W;
    this.grossWork = Wgross;
    this.peakPressure = peak;
    this.peakAngle = P.indexOf(peak);
    this.torquePerCylinder = W / (4 * Math.PI);
    this.imepCylinder = W / this.displacementPerCylinder();
  }

  /** In-cylinder pressure (Pa) at four-stroke cycle angle a (deg), interpolated. */
  pressureAt(a) {
    this.updateCycle();
    const u = mod(a, 720);
    const i = Math.floor(u);
    const f = u - i;
    return this.trace[i] * (1 - f) + this.trace[Math.min(i + 1, 720)] * f;
  }

  /** Back-compat name; the second argument is ignored (state comes from the live operating point). */
  cylinderPressure(a) { return this.pressureAt(a); }

  /** Mass fraction burned (0..1) at cycle angle a. */
  burnFraction(a) {
    this.updateCycle();
    const u = mod(a, 720);
    return this.burn[Math.min(720, Math.round(u))];
  }

  /** Mean gas temperature (K) from the ideal gas law, for colouring the combustion chamber. */
  gasTemperature(a) {
    const u = mod(a, 720);
    const V = this.volume(u * DEG);
    const m = Math.max(this.airMass + (this.fuelPerCycle || 0), 1e-6);
    return clamp((this.pressureAt(u) * V) / (m * R_AIR), 250, 2900);
  }

  /** Instantaneous gas torque of one cylinder (N·m) at cycle angle a; net of crankcase pressure. */
  gasTorque(a) {
    const u = mod(a, 720);
    return (this.pressureAt(u) - P_AMB) * this.volumeDerivative(u * DEG);
  }

  /** Total instantaneous gas torque of the whole engine at crank angle θ (deg). */
  totalGasTorque(thetaDeg, phases) {
    let sum = 0;
    for (const ph of phases) sum += this.gasTorque(thetaDeg + ph);
    return sum;
  }

  /** Kept for older callers: mean torque of a single cylinder at a given phase offset. */
  cylinderWorkTorque() {
    this.updateCycle();
    return { torque: this.torquePerCylinder, peak: this.peakPressure };
  }

  frictionTorque(rpm = this.rpm) {
    const [a, b, c] = this.spec.fmep;
    const n = rpm / 1000;
    const fmepBar = a + b * n + c * n * n;
    return (fmepBar * 1e5 * this.displacementPerCylinder() * this.cylinders) / (4 * Math.PI);
  }

  // ---- time stepping ------------------------------------------------------------------
  /** Idle governor: PI control of rpm error, active only while the pedal is (almost) released. */
  _applyIdleControl(dt) {
    const s = this.spec;
    const err = (s.idleRpm - this.rpm) / s.idleRpm; // fractional rpm error
    if (this.throttle < 0.12) {
      this._idleI = clamp((this._idleI ?? 0.04) + err * 0.35 * dt, 0, 0.3);
      this.idleTrim = clamp(this._idleI + err * 0.5, 0, 0.35);
    } else {
      this._idleI = 0.04; // pre-load so release from the pedal lands near idle
      this.idleTrim = 0;
    }
    if (s.fuel === 'diesel') {
      this.effectiveThrottle = Math.max(this.throttle, this.idleTrim);
    } else {
      this.effectiveThrottle = clamp(this.throttle + this.idleTrim * (1 - this.throttle), 0, 1);
    }
  }

  step(dt) {
    const s = this.spec;
    dt = clamp(dt, 1e-4, 0.05);

    // Turbo: boost follows exhaust energy, with lag.
    const targetBoost = s.boostMax * Math.pow(clamp(this.throttle * 0.9 + 0.1, 0, 1), 1.1) * clamp((this.rpm - 1300) / 1700, 0, 1);
    this.boost += (targetBoost - this.boost) * clamp(dt * (targetBoost > this.boost ? 2.2 : 3.5), 0, 1);

    this._applyIdleControl(dt);
    this.updateCycle();

    const indicated = this.torquePerCylinder * this.cylinders;
    const friction = this.frictionTorque();
    const accessories = 2 + 0.0012 * this.rpm;
    const brakeNet = indicated - friction - accessories;
    // Road/brake load grows with speed (drag, a torque-converter-like ramp), so a lugged
    // engine can always recover instead of stalling against a constant brake.
    const loadTorque = this.load * s.ratedTorque * clamp(this.rpm / (2.5 * s.idleRpm), 0.15, 1);
    const omega = (this.rpm * TWO_PI) / 60;

    const accel = (brakeNet - loadTorque) / s.inertia;
    this.rpm = clamp(this.rpm + (accel * dt * 60) / TWO_PI, s.idleRpm * 0.55, s.redline);
    this.theta = mod(this.theta + (omega * dt) / DEG, 720);

    this.torque = Math.max(0, brakeNet);
    this.power = (this.torque * omega) / 1000;

    const cycleRate = this.rpm / 120; // cycles per second per cylinder
    this.intakeFlow = this.airMass * this.cylinders * cycleRate * 1000; // g/s
    this.fuelRate = (this.fuelPerCycle || 0) * this.cylinders * cycleRate; // kg/s
    this.manifoldPressure = this._manifoldPressure(this.effectiveThrottle ?? this.throttle) / 1000;

    this.pressure = this.peakPressure / 1e5;
    const Vd = this.displacementPerCylinder() * this.cylinders;
    this.imep = (indicated * 4 * Math.PI) / Vd / 1e5;
    this.bmep = (this.torque * 4 * Math.PI) / Vd / 1e5;

    const fuelPower = this.fuelRate * LHV[s.fuel];
    this.efficiency = fuelPower > 1 ? clamp((this.power * 1000) / fuelPower, 0, 0.6) : 0;

    // Thermal state (lumped, thermostat-regulated coolant).
    const heatFrac = clamp((this.torque * omega) / (s.ratedTorque * s.redline * 0.8 * TWO_PI / 60), 0, 1);
    const tCool = 86 + 16 * heatFrac;
    this.temperature += (tCool - this.temperature) * dt * 0.05;
    this.oil += (this.temperature + 6 + 14 * heatFrac - this.oil) * dt * 0.02;
    const tEvo = this.evoTemperature || 900;
    this.exhaustTemp += (clamp(tEvo * 0.82 - 273, 200, 980) - this.exhaustTemp) * dt * 0.4;

    // Knock risk: high peak pressure + hot charge, petrol only.
    this.knock =
      s.fuel === 'petrol'
        ? clamp((this.peakPressure / 1e5 - 55) / 30, 0, 1) * clamp((this.temperature - 90) / 25 + this.sparkAdvance / 60, 0, 1)
        : 0;

    return this.snapshot();
  }

  /** Jump straight to a steady operating point (used by the dyno and tests). */
  settle(seconds = 6, dt = 1 / 120) {
    let snap;
    for (let t = 0; t < seconds; t += dt) snap = this.step(dt);
    return snap;
  }

  snapshot() {
    return {
      rpm: this.rpm,
      theta: this.theta,
      torque: this.torque,
      power: this.power,
      pressure: this.pressure,
      manifold: this.manifoldPressure,
      fuel: this.fuelRate * 3600,
      temperature: this.temperature,
      oil: this.oil,
      exhaust: this.exhaustTemp,
      boost: this.boost,
      imep: this.imep,
      bmep: this.bmep,
      efficiency: this.efficiency * 100,
      knock: this.knock * 100,
      intakeFlow: this.intakeFlow,
    };
  }
}
