// Sky Courier: Island Run — the aircraft and its flight model.
// One clear job: build the prop plane from primitives, and fly it with a
// forgiving arcade model — throttle sets speed, bank turns the nose, pitch
// climbs or dives, and below stall speed the nose drops.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { terrainHeight } from './terrain.js';

export function buildPlaneMesh() {
  const group = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({ color: 0xe8641c });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2ede2 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x16324a });

  // Fuselage points forward along -z in local space.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.85, 6.4, 12), orange);
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.8, 12), white);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.1;
  group.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), glass);
  canopy.scale.set(0.95, 0.75, 1.7);
  canopy.position.set(0, 0.85, -0.9);
  group.add(canopy);

  // Main wing and tail.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.28, 2.3), white);
  wing.position.set(0, -0.15, -0.4);
  group.add(wing);
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 1.5), white);
  tailWing.position.set(0, 0.25, 3.1);
  group.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 1.7), orange);
  fin.position.set(0, 1.15, 3.1);
  group.add(fin);
  // Wingtip stripes so the bank reads from a distance.
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 2.3), orange);
    tip.position.set(side * 6.3, -0.15, -0.4);
    group.add(tip);
  }

  // Spinning prop: a soft radial blur reads as a prop at speed, where
  // solid blades would read as slabs — especially from the cockpit.
  // The texture fades to transparent at the rim, so no hard edge shows.
  const propCanvas = document.createElement('canvas');
  propCanvas.width = 256;
  propCanvas.height = 256;
  const propCtx = propCanvas.getContext('2d');
  const propGrad = propCtx.createRadialGradient(128, 128, 8, 128, 128, 128);
  propGrad.addColorStop(0, 'rgba(35,35,40,0.55)');
  propGrad.addColorStop(0.5, 'rgba(35,35,40,0.20)');
  propGrad.addColorStop(1, 'rgba(35,35,40,0)');
  propCtx.fillStyle = propGrad;
  propCtx.fillRect(0, 0, 256, 256);
  const propTexture = new THREE.CanvasTexture(propCanvas);
  const prop = new THREE.Group();
  prop.position.z = -5.1;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.3, 24),
    new THREE.MeshBasicMaterial({ map: propTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  prop.add(disc);
  group.add(prop);

  // Fixed landing gear.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), dark);
    leg.position.set(side * 1.1, -1.5, -1.2);
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -2.1, -1.2);
    group.add(wheel);
  }
  group.userData.prop = prop;
  return group;
}

// Flight state, kept in plain numbers so the HUD and the camera can read it.
export function createFlight() {
  return {
    position: new THREE.Vector3(0, 70, 60),
    heading: Math.PI, // radians; 0 = north (-z), grows clockwise
    pitch: 0,
    roll: 0,
    speed: 55,
    throttle: 0.6,
    fuel: CONFIG.fuel.start,
    grounded: false,
    crashed: false,
    landed: false,
  };
}

// Forward vector from heading + pitch. North is -z, east is +x.
export function forwardVector(flight) {
  const cp = Math.cos(flight.pitch);
  return new THREE.Vector3(
    Math.sin(flight.heading) * cp,
    Math.sin(flight.pitch),
    -Math.cos(flight.heading) * cp,
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  return Math.max(target, v - step);
}

// One physics step. `input` is { pitch, roll, yaw, throttleUp, throttleDown }
// with each axis in -1..1. Returns 'flying' | 'landed' | 'crashed'.
export function stepFlight(flight, input, dt) {
  const p = CONFIG.plane;
  if (flight.crashed) return 'crashed';

  if (input.throttleUp) flight.throttle = clamp(flight.throttle + p.throttleRate * dt, 0, 1);
  if (input.throttleDown) flight.throttle = clamp(flight.throttle - p.throttleRate * dt, 0, 1);

  const targetSpeed = p.minSpeed + flight.throttle * (p.maxSpeed - p.minSpeed);
  flight.speed = approach(flight.speed, targetSpeed, p.accelRate * dt);

  const targetRoll = input.roll * p.maxRoll;
  flight.roll = approach(flight.roll, targetRoll, 2.2 * dt);
  const targetPitch = input.pitch * p.maxPitch;
  flight.pitch = approach(flight.pitch, targetPitch, 1.6 * dt);

  // A banked turn: the nose follows the bank, faster at higher speed.
  // Bank right (positive roll) turns right: heading grows clockwise.
  flight.heading += flight.roll * p.turnRate * (flight.speed / p.maxSpeed) * dt;
  flight.heading += input.yaw * 0.35 * dt;

  // Stall: below stall speed lift fades, the nose drops, and the plane
  // sinks — hold the throttle up or trade altitude for speed to recover.
  if (flight.speed < p.stallSpeed) {
    const deficit = (p.stallSpeed - flight.speed) / p.stallSpeed;
    flight.pitch = approach(flight.pitch, -0.35 * deficit, 2.5 * dt);
    flight.position.y -= deficit * p.stallSpeed * 0.6 * dt;
  }

  const fwd = forwardVector(flight);
  flight.position.addScaledVector(fwd, flight.speed * dt);

  // Fuel burns with throttle; empty tanks mean a glide, not a flame-out.
  if (flight.fuel > 0) {
    flight.fuel = Math.max(0, flight.fuel - (CONFIG.fuel.drainPerSecond + flight.throttle * CONFIG.fuel.drainPerThrottle) * dt);
    if (flight.fuel === 0) flight.throttle = 0;
  }

  // Ground contact.
  const ground = terrainHeight(flight.position.x, flight.position.z);
  const r = CONFIG.runway;
  const overRunway =
    Math.abs(flight.position.x - r.x) < r.length / 2 &&
    Math.abs(flight.position.z - r.z) < r.width / 2;
  const heightAbove = flight.position.y - ground;

  if (heightAbove <= 1.6) {
    if (overRunway && flight.speed <= p.safeLandingSpeed && Math.abs(flight.pitch) < 0.25) {
      flight.position.y = ground + 1.6;
      flight.grounded = true;
      flight.landed = true;
      flight.pitch = 0;
      flight.roll = 0;
      flight.speed = approach(flight.speed, 0, 30 * dt);
      return 'landed';
    }
    if (flight.speed > p.crashSpeed || heightAbove < -0.5) {
      flight.crashed = true;
      flight.position.y = ground + 1.2;
      return 'crashed';
    }
    // Gentle scrape on a slope: bounce back up, lose speed.
    flight.position.y = ground + 1.6;
    flight.speed *= 0.92;
    flight.pitch = Math.max(flight.pitch, 0.1);
  }
  flight.grounded = false;
  flight.landed = false;
  return 'flying';
}

// Write the flight state into the visible mesh (bank, pitch, prop blur).
export function posePlane(mesh, flight, time) {
  mesh.position.copy(flight.position);
  mesh.rotation.order = 'YXZ';
  // Local -z is the nose. Rotating about Y by -heading maps -z onto
  // (sin heading, 0, -cos heading), exactly forwardVector(); rotating
  // about X by +pitch lifts the nose when climbing; -roll drops the
  // right wing when banking right.
  mesh.rotation.y = -flight.heading;
  mesh.rotation.x = flight.pitch;
  mesh.rotation.z = -flight.roll;
  const prop = mesh.userData.prop;
  if (prop) prop.rotation.z += (2 + flight.throttle * 38) * 0.016;
  void time;
}
