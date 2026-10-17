// The 3D stage: renderer, studio, camera moves and picking. Knows nothing about the page's DOM
// beyond the container it is given.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildEngine } from './engine3d/build.js';
import { createEnvironment, createStudio } from './engine3d/studio.js';

export function createStage(container, { onPick, onHover } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 400);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  container.prepend(renderer.domElement);

  scene.environment = createEnvironment(renderer);
  scene.environmentIntensity = 0.9;
  createStudio(scene);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 7;
  controls.maxDistance = 110;
  controls.maxPolarAngle = Math.PI * 0.495;

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const home = { target: new THREE.Vector3(), cam: new THREE.Vector3() };
  const goal = { target: new THREE.Vector3(), cam: new THREE.Vector3(), active: false, vt: new THREE.Vector3(), vc: new THREE.Vector3() };
  let lastT = performance.now();
  let eng = null;

  function pointerNdc(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function partAt(e) {
    if (!eng) return null;
    pointerNdc(e);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(eng.parts.filter((p) => p.visible), false)[0];
    return hit ? hit.object.userData.part : null;
  }

  // Tell a click from the end of an orbit drag.
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; goal.active = false; goal.vt.set(0, 0, 0); goal.vc.set(0, 0, 0); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) {
      const name = partAt(e);
      if (name) onPick?.(name);
    }
    down = null;
  });
  let hoverAt = 0;
  renderer.domElement.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (down || now - hoverAt < 70) return;
    hoverAt = now;
    onHover?.(partAt(e), e);
  });
  renderer.domElement.addEventListener('pointerleave', () => onHover?.(null));

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  new ResizeObserver(resize).observe(container);

  function setEngine(spec) {
    if (eng) { scene.remove(eng.root); eng.root.traverse((o) => { o.geometry?.dispose?.(); }); }
    eng = buildEngine(spec);
    scene.add(eng.root);
    const c = eng.bounds.center, sz = eng.bounds.size;
    const aspect = Math.max(0.6, camera.aspect);
    const d = Math.max(sz.x * (1.7 / Math.min(1, aspect * 0.8)), sz.y * 1.9) * 1.42;
    home.target.set(c.x, c.y - 0.5, c.z);
    home.cam.set(c.x + d * 0.62, c.y + d * 0.42, c.z + d * 0.92);
    camera.position.copy(home.cam);
    controls.target.copy(home.target);
    controls.update();
    goal.active = false;
    resize();
    return eng;
  }

  function flyTo(target, cam) { goal.target.copy(target); goal.cam.copy(cam); goal.active = true; }
  // Critically damped spring (zeta = 1): no overshoot, keeps its velocity if retargeted mid-flight.
  const W = 8.5;
  function spring(x, v, g, dt) { v.addScaledVector(x.clone().sub(g), -W * W * dt).multiplyScalar(1 - 2 * W * dt); x.addScaledVector(v, dt); }
  function goHome() { flyTo(home.target, home.cam); }
  function view(name) {
    const t = controls.target.clone();
    const d = Math.max(30, camera.position.distanceTo(t));
    const off = { front: [0, 0.08, 1], side: [1, 0.08, 0], top: [0, 1, 0.001], iso: [0.62, 0.42, 0.92] }[name];
    flyTo(t, t.clone().add(new THREE.Vector3(...off).normalize().multiplyScalar(d)));
  }
  function focusPart(name) {
    const c = eng?.worldCenterOf(name);
    if (!c) return;
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = Math.max(14, Math.min(26, camera.position.distanceTo(controls.target) * 0.6));
    flyTo(c, c.clone().add(dir.multiplyScalar(dist)));
  }
  function dolly(factor, lift = 0) {
    const t = controls.target.clone();
    t.y += lift;
    flyTo(t, camera.position.clone().sub(controls.target).multiplyScalar(factor).add(t));
  }

  const tmp = new THREE.Vector3();
  function render() {
    const now = performance.now(), dt = Math.min(0.033, (now - lastT) / 1000); lastT = now;
    if (goal.active) {
      for (let i = 0; i < 3; i++) { spring(controls.target, goal.vt, goal.target, dt / 3); spring(camera.position, goal.vc, goal.cam, dt / 3); }
      if (camera.position.distanceTo(goal.cam) < 0.05 && controls.target.distanceTo(goal.target) < 0.05 && goal.vc.length() < 0.05) goal.active = false;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  /** Screen position (px, in container space) of a world point, or null if behind the camera. */
  function project(v) {
    tmp.copy(v).project(camera);
    if (tmp.z > 1) return null;
    return { x: (tmp.x * 0.5 + 0.5) * container.clientWidth, y: (-tmp.y * 0.5 + 0.5) * container.clientHeight };
  }

  return { camera, controls, renderer, get eng() { return eng; }, setEngine, resize, render, project, view, flyTo, goHome, focusPart, dolly, home };
}
