# Pieces — Engineverse

An anatomy atlas of everyday car engines, in the spirit of a human-anatomy atlas: every part is modelled in 3D, numbered, and explained in plain language, so anyone can learn what is under the bonnet of the car they use.

## What's in it

- **Four everyday engines** — a 1.2 L three-cylinder (city cars), a 2.0 L inline-four (family cars), a 3.0 L 60° V6 (large sedans and SUVs) and a 2.2 L turbo-diesel (SUVs and vans). Each is built from roughly 260–460 individual parts: pistons with ring packs, I-beam rods, counterweighted cranks, four-valve heads with springs and buckets, cam lobes, timing chain, manifolds, radiator and more.
- **Numbered plate** — every part carries a numbered marker in the colour of its system (structure, motion, valvetrain, timing, air and fuel, ignition, cooling, lubrication, exhaust, starting). A grouped index with the same numbers sits beside it, with search and system filters.
- **A page for every part** — what it's made of, what it does, how it fails, what you'd notice as a driver, how long it lasts, and which parts it sits next to (click through to walk around the engine). Step through the index with the buttons or the `[` and `]` keys.
- **Layers** — a slider peels the engine apart: accessories, valve cover, camshafts and timing drive, cylinder head, block, down to the moving parts.
- **Guided tours** — follow the air, fuel, oil, coolant or exhaust; the camera flies from part to part with a short caption.
- **View tools** — orbit and zoom, front/side/top views, explode, cutaway, X-ray, isolate.
- **Run engine** *(optional)* — start the engine to see a live tachometer, readouts, a scrubbable 720° cycle ribbon, pressure and P–V charts, a dyno pull and synthesised engine sound (off by default). The physics is tied to the same geometry as the 3D model.
- **Learn** — a one-cylinder schematic you can scrub through the four strokes, the ten systems and a quiz.
- **Compare** — torque and power curves for all four engines plus a spec table.
- Responsive, keyboard accessible, honours reduced-motion and reduced-transparency settings.

The models are educational abstractions, not manufacturer CAD, and the physics figures are indicative, not calibrated.

## Run it
Link to Site - https://gigachad-suryansh.github.io/Pieces/

```bash
npm install
npm run dev      # development server
npm test         # data, physics, layout and sound tests (vitest)
npm run build    # production build in dist/
```

Add `?debug` to the URL to expose `window.__pieces` (state, engine, camera, physics) for inspection.

## Layout

| Path | Purpose |
| --- | --- |
| `src/data/engines.js` | Engine specs and cylinder layout (single source of truth) |
| `src/data/catalog.js` | Parts catalogue and system colours |
| `src/data/anatomy.js` | Plain-language anatomy for every part |
| `src/data/layers.js` | Peel-away layers and guided tours |
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

Service lives and failure notes in `anatomy.js` are general, rounded figures for typical passenger cars; check the manual for your own vehicle.
