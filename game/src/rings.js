// Sky Courier: Island Run — the ring course.
// One clear job: build the glowing gates, light up the next one, and tell
// the game when the plane flies through it.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, RING_COURSE } from './config.js';

export function buildRings(scene) {
  const group = new THREE.Group();
  const meshes = RING_COURSE.map((gate, i) => {
    const ring = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.rings.radius, 1.4, 12, 40),
      new THREE.MeshBasicMaterial({ color: 0x35c8ff }),
    );
    ring.add(torus);
    // A wider faint halo so the gate reads from far away.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.rings.radius + 3, 0.5, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x35c8ff, transparent: true, opacity: 0.35 }),
    );
    ring.add(halo);
    // A small beacon pole under the gate so it reads against the sea too.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 30, 6),
      new THREE.MeshBasicMaterial({ color: 0x35c8ff, transparent: true, opacity: 0.4 }),
    );
    pole.position.y = -CONFIG.rings.radius - 15;
    ring.add(pole);
    ring.position.set(gate.x, gate.y, gate.z);
    // Face the gate along the course: look at the previous gate.
    const prev = RING_COURSE[(i + RING_COURSE.length - 1) % RING_COURSE.length];
    ring.lookAt(prev.x, prev.y, prev.z);
    group.add(ring);
    return { gate, ring, torus, halo, pole, passed: false };
  });
  scene.add(group);
  return { group, meshes, nextIndex: 0, passedCount: 0, laps: 0 };
}

export function setNextRing(course, index) {
  course.nextIndex = index;
  course.meshes.forEach((m, i) => {
    const active = i === index;
    const colour = m.passed ? 0x37d67a : active ? 0xffb020 : 0x35c8ff;
    m.torus.material.color.setHex(colour);
    m.halo.material.color.setHex(colour);
    m.pole.material.color.setHex(colour);
    m.halo.material.opacity = active ? 0.6 : 0.35;
  });
}

export function resetCourse(course) {
  course.meshes.forEach((m) => {
    m.passed = false;
  });
  course.passedCount = 0;
  setNextRing(course, 0);
}

// True when the plane crosses the plane of the next ring within its radius.
// Checks the segment from `from` to `to` so fast flight cannot skip a gate.
export function checkRingPass(course, from, to) {
  const m = course.meshes[course.nextIndex];
  if (!m) return false;
  const c = new THREE.Vector3(m.gate.x, m.gate.y, m.gate.z);
  const normal = new THREE.Vector3();
  m.ring.getWorldDirection(normal);
  const d0 = from.clone().sub(c).dot(normal);
  const d1 = to.clone().sub(c).dot(normal);
  if (d0 === 0 || d0 * d1 > 0) return false; // never crossed the gate plane
  const t = d0 / (d0 - d1);
  const hit = from.clone().lerp(to, t);
  const dist = hit.distanceTo(c);
  if (dist > CONFIG.rings.radius - 1) return false;
  m.passed = true;
  course.passedCount++;
  if (course.passedCount >= RING_COURSE.length) {
    course.laps++;
    resetCourse(course);
  } else {
    setNextRing(course, course.nextIndex + 1);
  }
  return true;
}

// Distance and bearing to the next gate, for the HUD arrow.
export function nextRingInfo(course, position) {
  const m = course.meshes[course.nextIndex];
  if (!m) return null;
  const dx = m.gate.x - position.x;
  const dy = m.gate.y - position.y;
  const dz = m.gate.z - position.z;
  return {
    label: m.gate.label,
    distance: Math.sqrt(dx * dx + dy * dy + dz * dz),
    bearing: (Math.atan2(dx, -dz) * 180) / Math.PI, // degrees, 0 = north
  };
}
