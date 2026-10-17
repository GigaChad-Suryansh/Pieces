# Pieces — Engineverse

An interactive 3D engine playground. Orbit detailed engines, scrub the four-stroke cycle, hear the engine, and compare four designs built on one shared physics model.

**Live site:** deployed from `main` to GitHub Pages.

## What's in it

- **Four engines** — 2.0 L inline-4, 3.0 L V6 (60°, split crank pins), 2.2 L turbo-diesel and a 1.0 L high-revving motorcycle four. Each is built from ~300–450 individual parts (pistons with ring packs, I-beam rods, counterweighted cranks, four-valve heads with springs and buckets, cam lobes, timing chain, manifolds, turbo, radiator and more).
- **Physics tied to geometry** — bore, stroke, rod ratio, compression ratio, valve timing and firing order are defined once (`src/data/engines.js`) and drive both the equations and the 3D model. Slider-crank kinematics are exact; in-cylinder pressure comes from a polytropic compression and Wiebe heat-release model; gas exchange, friction, volumetric efficiency, turbo lag and an idle governor are included.
- **Engine tab** — click any part for a leader-line callout and description; Explode, Cutaway, X-ray and Isolate; live tachometer, readouts and drive controls; cycle ribbon you can scrub; pressure–crank-angle and pressure–volume charts; a full-throttle dyno pull.
- **Sound** — engine audio synthesised from the simulated cylinder pressure (firing order and combustion strength shape the tone). Off by default; use the *Sound* button.
- **Learn** — a one-cylinder schematic you can scrub, the P–V loop, ten engine systems and a quiz.
- **Compare** — torque and power curves for all four engines plus a spec table.
- Responsive down to phone width, keyboard accessible, honours reduced-motion and reduced-transparency settings.

The model is an educational abstraction, not manufacturer CAD. Figures are indicative, not calibrated.

## Run it

```bash
npm install
npm run dev      # development server
npm test         # physics, layout and sound tests (vitest)
npm run build    # production build in dist/
```

Add `?debug` to the URL to expose `window.__pieces` (state, engine, camera, physics) for inspection.

## Layout

| Path | Purpose |
| --- | --- |
| `src/data/engines.js` | Engine specs and cylinder layout (single source of truth) |
| `src/data/catalog.js` | Parts catalogue and system colours |
| `src/physics.js` | Engine physics and `steadyState()` for power curves |
| `src/engine3d/` | Procedural geometry, materials, studio lighting and assembly |
| `src/scene.js` | Renderer, camera moves, picking |
| `src/audio.js` | Engine sound synthesis |
| `src/ui/`, `src/views/` | Tachometer, charts, callouts; Learn and Compare tabs |
| `tests/` | Vitest suite |

## Knowledge sources

Catalogue descriptions were researched from:

- Patsnap Eureka — car engine parts overview: https://eureka.patsnap.com/blog/machinery-tech-resources/car-engine-parts-that-everyone-should-know/
- The Engineers Post — basic engine components: https://www.theengineerspost.com/basic-engine-components-engine-parts/
- Royal Society of Chemistry Education — engine/lubrication worksheet and four-stroke schematic.
- Haynes Manuals — how a car engine works and the four-stroke cycle.
- Educational-Animation.org — interactive four-stroke component/function reference.
- Government of India / Skill Development Institute curriculum material covering IC-engine components and cooling systems.
- Three.js documentation for WebGLRenderer, OrbitControls and Raycaster.
