// Sky Courier: Island Run — deterministic screenshot presets.
// One clear job: given ?shot=<name>, place the plane, the camera and the
// course so a headless browser renders the exact frame the screenshots
// need — no input, no title screen, no randomness between runs.
import { RING_COURSE } from './config.js';
import { setNextRing } from './rings.js';

function lookAtGate(flight, gate) {
  const dx = gate.x - flight.position.x;
  const dz = gate.z - flight.position.z;
  flight.heading = Math.atan2(dx, -dz);
  const dist = Math.hypot(dx, dz);
  flight.pitch = Math.atan2(gate.y - flight.position.y, dist) * 0.6;
  flight.roll = 0;
}

// Each preset returns { camera, message } for the game loop.
export function applyShot(name, game) {
  const { flight, course } = game;
  flight.speed = 62;
  flight.throttle = 0.62;
  flight.fuel = 78;
  flight.crashed = false;
  flight.grounded = false;

  if (name === 'cover') {
    // Chase view: plane climbing over the harbour towards the first gate,
    // runway and hangar visible below on the left.
    flight.position.set(60, 88, 40);
    lookAtGate(flight, RING_COURSE[0]);
    setNextRing(course, 0);
    return { camera: 'chase', score: 120, message: 'Chase view over the harbour' };
  }
  if (name === 'cockpit') {
    // Cockpit view: instruments lit, a golden gate dead ahead, the peak
    // island behind it.
    flight.position.set(300, 96, -260);
    lookAtGate(flight, RING_COURSE[1]);
    setNextRing(course, 1);
    return { camera: 'cockpit', score: 240, message: 'Cockpit view on the Peak Gate' };
  }
  if (name === 'runway') {
    // Final approach: low over the island, runway threshold straight
    // ahead, windsock and hangar in frame.
    flight.position.set(60, 20, 330);
    flight.heading = -Math.PI / 2; // fly west, down the strip
    flight.pitch = -0.04;
    flight.speed = 40;
    flight.throttle = 0.35;
    setNextRing(course, 6);
    return { camera: 'chase', score: 410, message: 'Final approach to the runway' };
  }
  if (name === 'rings') {
    // Through the gate: the Twin Island gate fills the frame, second
    // island and sea beyond it.
    flight.position.set(880, 74, -430);
    lookAtGate(flight, RING_COURSE[3]);
    setNextRing(course, 3);
    return { camera: 'chase', score: 560, message: 'Through the Twin Island Gate' };
  }
  // Default: the cover preset.
  flight.position.set(60, 88, 40);
  lookAtGate(flight, RING_COURSE[0]);
  setNextRing(course, 0);
  return { camera: 'chase', score: 120, message: 'Chase view over the harbour' };
}

export function shotNames() {
  return ['cover', 'cockpit', 'runway', 'rings'];
}
