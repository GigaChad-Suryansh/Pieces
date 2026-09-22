# Engine Atlas

A smooth, educational WebGL engine-anatomy explorer for everyday car and motorcycle powerplants.

## Included

- Real-time Three.js model built from independently selectable mechanical components.
- Orbit, zoom and click-to-inspect controls.
- Smooth explode / assemble view.
- Cutaway mode for revealing the internal mechanism.
- Isolate mode for studying one component.
- Live piston motion and 0–720° crank-angle cycle.
- Adjustable demonstration RPM.
- Engine library: inline-4, V6, turbo-diesel and motorcycle layouts.
- 50+ catalogue entries across structure, motion, valvetrain, timing, air/fuel, ignition, cooling, lubrication, exhaust and starting systems.
- Search and system filters.
- Learn and Compare sections.
- GitHub Pages deployment workflow.

## Run locally

```bash
npm install
npm run dev
```

## 3D architecture

The current model is procedural Three.js geometry so the project runs immediately without large binary assets. Each visible component is a separate Three.js object with a part name and system category. This makes the interface ready for a later CAD/GLTF pipeline in which each real component can become its own high-detail mesh.

Three.js OrbitControls provides camera orbiting, zooming and panning, while Raycaster handles 3D part picking.

## Knowledge sources

The catalogue and educational explanations were researched from:

- Patsnap Eureka — car engine parts overview: https://eureka.patsnap.com/blog/machinery-tech-resources/car-engine-parts-that-everyone-should-know/
- The Engineers Post — basic engine components: https://www.theengineerspost.com/basic-engine-components-engine-parts/
- Royal Society of Chemistry Education — engine/lubrication worksheet and four-stroke schematic.
- Haynes Manuals — how a car engine works and the four-stroke cycle.
- Educational-Animation.org — interactive four-stroke component/function reference.
- Government of India / Skill Development Institute curriculum material covering IC-engine components and cooling systems.
- Three.js documentation for WebGLRenderer, OrbitControls and Raycaster.

The 3D assembly is an educational abstraction. Real engines differ substantially in packaging, valve arrangements, injection systems, timing drives, emissions equipment and component dimensions.
