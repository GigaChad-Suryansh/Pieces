// Materials and the photographic "studio" the engine sits in.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Image-based lighting so polished metal actually reflects something. */
export function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  pmrem.dispose();
  return env;
}

/**
 * Material set. `structural` materials are the ones the cutaway plane and X-ray mode act on
 * (castings and covers); moving parts and fasteners always stay solid.
 */
export function createMaterials(plane) {
  const std = (o) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o });
  const phys = (o) => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o });

  const M = {
    // Castings
    alloy: phys({ color: 0xb9bdc1, metalness: 0.92, roughness: 0.42, clearcoat: 0.0 }),
    alloyDark: phys({ color: 0x6f757b, metalness: 0.9, roughness: 0.46 }),
    iron: phys({ color: 0x3a3d40, metalness: 0.85, roughness: 0.55 }),
    cover: phys({ color: 0x23272b, metalness: 0.55, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.35 }),
    pan: phys({ color: 0x2a2d30, metalness: 0.7, roughness: 0.5 }),
    // Machined / moving metal
    steel: phys({ color: 0xcfd3d6, metalness: 1.0, roughness: 0.22 }),
    liner: phys({ color: 0x4d5257, metalness: 0.95, roughness: 0.36 }),
    forged: phys({ color: 0x8d9296, metalness: 1.0, roughness: 0.3 }),
    chrome: phys({ color: 0xf1f3f4, metalness: 1.0, roughness: 0.08 }),
    blackOxide: phys({ color: 0x1b1d1f, metalness: 0.9, roughness: 0.38 }),
    piston: phys({ color: 0xc8ccd0, metalness: 0.95, roughness: 0.32 }),
    brass: phys({ color: 0xc8a14a, metalness: 1.0, roughness: 0.26 }),
    bronze: phys({ color: 0xa8743c, metalness: 1.0, roughness: 0.3 }),
    bearing: phys({ color: 0xb98a46, metalness: 1.0, roughness: 0.2 }),
    copper: phys({ color: 0xb8683a, metalness: 1.0, roughness: 0.28 }),
    exhaustPipe: phys({ color: 0x8a8d90, metalness: 1.0, roughness: 0.36 }),
    heat: phys({ color: 0x7a5f4a, metalness: 0.9, roughness: 0.5 }),
    // Non-metal
    rubber: std({ color: 0x151617, metalness: 0.0, roughness: 0.85 }),
    hoseBlue: std({ color: 0x2f5f9e, metalness: 0.0, roughness: 0.6 }),
    hoseBlack: std({ color: 0x1a1b1c, metalness: 0.0, roughness: 0.7 }),
    ceramic: phys({ color: 0xf2efe7, metalness: 0.0, roughness: 0.25, clearcoat: 0.7 }),
    plastic: std({ color: 0x2b2e31, metalness: 0.0, roughness: 0.55 }),
    orange: phys({ color: 0xe8742a, metalness: 0.15, roughness: 0.4, clearcoat: 0.5 }),
    blueAnod: phys({ color: 0x2f6dc4, metalness: 0.7, roughness: 0.3, clearcoat: 0.4 }),
    redAnod: phys({ color: 0xc43a30, metalness: 0.7, roughness: 0.3, clearcoat: 0.4 }),
    filterWhite: phys({ color: 0xe5e7e9, metalness: 0.2, roughness: 0.45 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fc8ff, metalness: 0, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    coolant: new THREE.MeshPhysicalMaterial({ color: 0x22b8a8, metalness: 0, roughness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    oil: new THREE.MeshPhysicalMaterial({ color: 0xe0a21c, metalness: 0.1, roughness: 0.25, transparent: true, opacity: 0.85 }),
    fin: std({ color: 0x9aa3ab, metalness: 0.8, roughness: 0.5 }),
  };

  const structural = [M.alloy, M.alloyDark, M.iron, M.cover, M.pan, M.coolant, M.liner];
  for (const m of structural) {
    m.clippingPlanes = [plane];
    m.clipShadows = true;
  }
  M._structural = structural;
  M._baseOpacity = new Map(structural.map((m) => [m, [m.opacity, m.transparent, m.depthWrite]]));
  return M;
}

/** Soft studio: key, fill and rim lights, a shadow-catching floor, a faint ring on the ground. */
export function createStudio(scene, scale = 20) {
  const group = new THREE.Group();
  scene.add(group);

  const key = new THREE.DirectionalLight(0xfff2e0, 2.1);
  key.position.set(6, 14, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const c = key.shadow.camera;
  c.left = -13; c.right = 13; c.top = 13; c.bottom = -13; c.near = 1; c.far = 50;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  group.add(key);

  const fill = new THREE.DirectionalLight(0x9fb7d6, 0.7);
  fill.position.set(-9, 5, 6);
  group.add(fill);

  const rim = new THREE.DirectionalLight(0xffd8b0, 1.3);
  rim.position.set(-4, 7, -11);
  group.add(rim);

  const floorY = -0.2 * scale;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 96),
    new THREE.ShadowMaterial({ opacity: 0.38 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  group.add(floor);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
  for (const [r0, r1] of [[5.8, 5.84], [9.6, 9.62], [13.4, 13.41]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 128), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = floorY + 0.01;
    group.add(ring);
  }
  return { group, floorY, key };
}
