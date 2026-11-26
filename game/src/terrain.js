// Sky Courier: Island Run — terrain and sky.
// One clear job: the islands, the ocean, the runway, the trees and the
// clouds, plus terrainHeight(), the single source of truth the flight model
// uses for ground collisions and landings.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { makeFbm, mulberry32 } from './random.js';

const fbm = makeFbm(CONFIG.worldSeed);
const runway = CONFIG.runway;

function islandFalloff(dx, dz, radius) {
  const d = Math.sqrt(dx * dx + dz * dz) / radius;
  if (d >= 1) return 0;
  const t = 1 - d;
  return t * t * (3 - 2 * t); // smoothstep falloff to the sea
}

function onRunway(x, z) {
  return (
    Math.abs(x - runway.x) < runway.length / 2 + 12 &&
    Math.abs(z - runway.z) < runway.width / 2 + 12
  );
}

// Final-approach corridor east of the strip: the glide path must stay
// clear of hills, rising gently away from the threshold.
function approachHeight(x) {
  const x0 = runway.x + runway.length / 2;
  const x1 = x0 + 320;
  const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  return 4.5 + t * 12;
}

function onApproach(x, z) {
  const x0 = runway.x + runway.length / 2;
  return (
    x > x0 - 12 && x < x0 + 332 &&
    Math.abs(z - runway.z) < 45 + 12
  );
}

// Height of the ground in metres at (x, z). Sea level is 0; the runway
// strip is flattened to its own height so landings read as landings.
export function terrainHeight(x, z) {
  let h = 0;
  const main = islandFalloff(x, z, CONFIG.islandRadius);
  if (main > 0) {
    const hills = fbm(x * 0.004 + 11, z * 0.004 + 7, 4);
    const peaks = Math.max(0, fbm(x * 0.006 + 40, z * 0.006 + 3, 3));
    h = Math.max(h, main * (10 + hills * 14 + Math.pow(peaks, 1.5) * 110));
  }
  const s = CONFIG.secondIsland;
  const second = islandFalloff(x - s.x, z - s.z, s.radius);
  if (second > 0) {
    const hills = fbm(x * 0.005 + 90, z * 0.005 + 21, 4);
    h = Math.max(h, second * (8 + hills * 10 + second * 22));
  }
  if (onRunway(x, z)) {
    const edge =
      Math.min(
        (runway.length / 2 + 12 - Math.abs(x - runway.x)) / 12,
        (runway.width / 2 + 12 - Math.abs(z - runway.z)) / 12,
      );
    const t = Math.max(0, Math.min(1, edge));
    h = h * (1 - t) + runway.height * t;
  }
  if (onApproach(x, z)) {
    const x0 = runway.x + runway.length / 2;
    const ex = Math.min((x - (x0 - 12)) / 12, (x0 + 332 - x) / 12);
    const ez = Math.min((z - (runway.z - 57)) / 12, (runway.z + 57 - z) / 12);
    const t = Math.max(0, Math.min(1, Math.min(ex, ez)));
    h = h * (1 - t) + approachHeight(x) * t;
  }
  return h;
}

function colourForHeight(h, out) {
  // Sand, grass, rock, snow — one palette for terrain and sky.
  if (h < 2.5) return out.setHex(0xd9c27a);
  if (h < 6) return out.setHex(0x8fae5d);
  if (h < 26) return out.setHex(0x5d8a48);
  if (h < 48) return out.setHex(0x6f6a5e);
  if (h < 68) return out.setHex(0x8d8578);
  return out.setHex(0xf2f5f7);
}

export function buildTerrain(scene) {
  // Island ground: a displaced plane with per-vertex colours.
  const size = 2600;
  const segments = 120;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    colourForHeight(h, c);
    // Slight variation so the ground does not read as flat paint.
    const v = 0.92 + 0.08 * fbm(x * 0.02, z * 0.02, 2);
    colours[i * 3] = c.r * v;
    colours[i * 3 + 1] = c.g * v;
    colours[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  scene.add(ground);

  // Ocean: one big blue plane just above sea level.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.worldSize, CONFIG.worldSize),
    new THREE.MeshLambertMaterial({ color: 0x1d6fb8, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0.4;
  scene.add(ocean);

  buildRunway(scene);
  buildTrees(scene);
  buildClouds(scene);
  buildLights(scene);
}

function buildRunway(scene) {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(runway.length, 0.6, runway.width),
    new THREE.MeshLambertMaterial({ color: 0x33373d }),
  );
  strip.position.set(runway.x, runway.height + 0.1, runway.z);
  group.add(strip);

  // Centre dashes and threshold bars, white on dark asphalt.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
  for (let x = -runway.length / 2 + 25; x < runway.length / 2 - 10; x += 30) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(14, 0.15, 1.6), dashMat);
    dash.position.set(runway.x + x, runway.height + 0.45, runway.z);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, runway.width - 6), dashMat);
    bar.position.set(runway.x + end * (runway.length / 2 - 8), runway.height + 0.45, runway.z);
    group.add(bar);
  }

  // Two windsocks and a small hangar so the strip reads as an airfield.
  const sockMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a });
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
    pole.position.set(runway.x + side * 60, runway.height + 4.5, runway.z + runway.width / 2 + 8);
    group.add(pole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 8), sockMat);
    sock.rotation.z = Math.PI / 2;
    sock.position.set(runway.x + side * 60 + 2.4, runway.height + 8.4, runway.z + runway.width / 2 + 8);
    group.add(sock);
  }
  const hangar = new THREE.Mesh(
    new THREE.BoxGeometry(26, 12, 20),
    new THREE.MeshLambertMaterial({ color: 0xb8452a }),
  );
  hangar.position.set(runway.x - 40, runway.height + 6, runway.z - runway.width / 2 - 26);
  group.add(hangar);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 26, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0x8a8f96 }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.set(runway.x - 40, runway.height + 12, runway.z - runway.width / 2 - 26);
  group.add(roof);

  scene.add(group);
}

function buildTrees(scene) {
  // Pines on the grassy band: instanced trunks and canopies, seeded.
  const rand = mulberry32(CONFIG.worldSeed + 5);
  const spots = [];
  let tries = 0;
  while (spots.length < 150 && tries < 3000) {
    tries++;
    const x = (rand() - 0.5) * 1900;
    const z = (rand() - 0.5) * 1900;
    const h = terrainHeight(x, z);
    if (h > 6 && h < 30 && !onRunway(x, z) && !onApproach(x, z)) spots.push([x, h, z, 0.7 + rand() * 0.9]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const canopyGeo = new THREE.ConeGeometry(3.4, 10, 7);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2f });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, h, z, s], i) => {
    m.makeScale(s, s, s);
    m.setPosition(x, h + 2 * s, z);
    trunks.setMatrixAt(i, m);
    m.makeScale(s, s, s);
    m.setPosition(x, h + (4 + 5) * s, z);
    canopies.setMatrixAt(i, m);
  });
  scene.add(trunks);
  scene.add(canopies);
}

function buildClouds(scene) {
  const rand = mulberry32(CONFIG.worldSeed + 9);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const geo = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 26; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(geo, mat);
      const r = 14 + rand() * 22;
      s.scale.set(r, r * 0.62, r * 0.8);
      s.position.set((rand() - 0.5) * 46, (rand() - 0.5) * 4, (rand() - 0.5) * 20);
      cloud.add(s);
    }
    cloud.position.set((rand() - 0.5) * 3400, 190 + rand() * 120, (rand() - 0.5) * 3400);
    scene.add(cloud);
  }
}

function buildLights(scene) {
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
  sun.position.set(600, 900, 300);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3f6b3a, 0.85));
}
