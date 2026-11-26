// Sky Courier: Island Run — the game loop.
// One clear job: own the renderer, the camera and the game states (title,
// flying, paused, crashed, over), and wire the plane, the rings, the HUD
// and the sound together every frame.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';
import { buildTerrain, terrainHeight } from './terrain.js';
import { buildPlaneMesh, createFlight, forwardVector, stepFlight, posePlane } from './plane.js';
import { buildRings, setNextRing, checkRingPass, nextRingInfo } from './rings.js';
import { createInput } from './input.js';
import { createSound } from './audio.js';
import { buildHud } from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87bfe8);
scene.fog = new THREE.Fog(0xa8c8e8, 900, 3400);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 6000);

buildTerrain(scene);
const planeMesh = buildPlaneMesh();
scene.add(planeMesh);
const course = buildRings(scene);
setNextRing(course, 0);

const input = createInput(canvas);
const sound = createSound();
const hud = buildHud();

const flight = createFlight();
const game = {
  state: 'title', // title | playing | paused | crashed | over
  score: 0,
  timeLeft: CONFIG.sortie.durationSeconds,
  lives: CONFIG.sortie.lives,
  cameraMode: 'chase',
  shot: null,
};

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  const preset = applyShot(shotName, { flight, course });
  game.shot = preset;
  game.cameraMode = preset.camera;
  game.score = preset.score;
  game.state = 'playing';
  hud.setScreen('playing');
  // A shot frame has the instruments lit and a gate ahead: the HUD must
  // already show numbers on the very first rendered frame.
  hud.update({
    flight,
    score: game.score,
    ringsPassed: course.passedCount,
    laps: course.laps,
    timeLeft: game.timeLeft,
    lives: game.lives,
    nextGate: nextRingInfo(course, flight.position),
  });
} else {
  hud.setScreen('title', { onFly: startFlying });
}

function startFlying() {
  sound.unlock();
  sound.click();
  game.state = 'playing';
  hud.setScreen('playing');
  hud.toast('Fly through the golden gate!');
}

function resetFlight() {
  const fresh = createFlight();
  Object.assign(flight, fresh);
  flight.position.set(0, 70, 60);
  flight.heading = Math.PI;
  game.timeLeft = CONFIG.sortie.durationSeconds;
  game.score = 0;
}

function endSortie(reason) {
  game.state = 'over';
  sound.setEngine(0, 0, false);
  hud.setScreen('over', {
    score: game.score,
    rings: course.passedCount + course.laps * 8,
    laps: course.laps,
    onFly: () => {
      resetFlight();
      game.lives = CONFIG.sortie.lives;
      startFlying();
    },
  });
  hud.toast(reason, 3000);
}

function crashPlane(reason) {
  game.lives -= 1;
  game.state = 'crashed';
  sound.crash();
  sound.setEngine(0, 0, false);
  spawnCrashBurst(flight.position);
  if (game.lives <= 0) {
    setTimeout(() => endSortie('Out of lives — the courier hangs up the goggles.'), 1200);
    return;
  }
  hud.setScreen('crashed', {
    text: reason,
    score: game.score,
    lives: game.lives,
    onFly: () => {
      resetFlight();
      startFlying();
    },
  });
}

// A quick burst of orange sparks where the plane went down.
let burst = null;
function spawnCrashBurst(position) {
  if (burst) scene.remove(burst);
  const geo = new THREE.BufferGeometry();
  const count = 90;
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = position.x;
    pos[i * 3 + 1] = position.y;
    pos[i * 3 + 2] = position.z;
    vel.push(new THREE.Vector3((Math.random() - 0.5) * 40, Math.random() * 30, (Math.random() - 0.5) * 40));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  burst = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xff7a1a, size: 2.2 }));
  burst.userData = { vel, life: 1.4 };
  scene.add(burst);
}

function updateCamera(dt) {
  const inp = input.state;
  if (game.cameraMode === 'cockpit') {
    // In the cockpit: the camera sits just above the canopy, looking out
    // over the nose; dragging the mouse looks around. The eye must clear
    // the canopy (top at about +1.6 m) or the fuselage fills the frame.
    const fwd = forwardVector(flight);
    const eye = flight.position.clone().addScaledVector(fwd, 0.8);
    eye.y += 1.9;
    const look = flight.position.clone().addScaledVector(fwd, 60);
    look.y += Math.sin(flight.pitch) * 60 - 1.5;
    // Mouse look: rotate the view around the eye.
    const yawOff = inp.orbitX;
    const pitchOff = -inp.orbitY * 0.6;
    const dir = look.clone().sub(eye).normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const rotated = dir.clone().applyAxisAngle(up, yawOff).applyAxisAngle(right, pitchOff);
    snapOrFollow(eye, dt);
    camera.lookAt(eye.clone().add(rotated));
    camera.up.set(0, 1, 0);
    return;
  }

  // Chase camera: behind and above the tail, banking with the plane, with
  // the mouse drag orbiting around it and the wheel zooming it.
  const dist = CONFIG.camera.chaseDistance + inp.zoom;
  const back = forwardVector(flight).multiplyScalar(-dist);
  const target = flight.position.clone().add(back);
  target.y += CONFIG.camera.chaseHeight + inp.orbitY * 6;
  // Orbit the camera around the plane on the drag axis.
  const offset = target.clone().sub(flight.position);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), inp.orbitX * 0.9);
  const eye = flight.position.clone().add(offset);
  const ground = terrainHeight(eye.x, eye.z);
  if (eye.y < ground + 3) eye.y = ground + 3;
  snapOrFollow(eye, dt);
  const look = flight.position.clone().addScaledVector(forwardVector(flight), 22);
  camera.lookAt(look);
  camera.up.set(0, 1, 0);
}

// The camera starts at the world origin: the first frame snaps it to the
// eye, so a screenshot never catches it mid-flight from nowhere. After
// that it follows smoothly.
let cameraPlaced = false;
function snapOrFollow(eye, dt) {
  if (!cameraPlaced) {
    camera.position.copy(eye);
    cameraPlaced = true;
    return;
  }
  camera.position.lerp(eye, 1 - Math.pow(0.0001, dt));
}

const clock = new THREE.Clock();
let lastHud = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // Edge-triggered keys.
  if (input.consume('KeyC')) {
    game.cameraMode = game.cameraMode === 'chase' ? 'cockpit' : 'chase';
    hud.toast(game.cameraMode === 'cockpit' ? 'Cockpit view' : 'Chase view');
  }
  if (input.consume('KeyP') && (game.state === 'playing' || game.state === 'paused')) {
    game.state = game.state === 'playing' ? 'paused' : 'playing';
    if (game.state === 'paused') hud.setScreen('paused', { onFly: startFlying });
    else hud.setScreen('playing');
  }
  if (input.consume('KeyM')) hud.toast(sound.toggleMute() ? 'Sound off' : 'Sound on');
  if (input.consume('KeyR') && (game.state === 'crashed' || game.state === 'over')) {
    resetFlight();
    if (game.state === 'over') game.lives = CONFIG.sortie.lives;
    startFlying();
  }

  // In shot mode the frame is frozen: no physics, no clock, no ring
  // passes — the preset pose is the frame, exactly, every run.
  if (game.state === 'playing' && !game.shot) {
    const before = flight.position.clone();
    const inp = input.read();
    const result = stepFlight(flight, inp, dt);
    sound.setEngine(flight.throttle, flight.speed, !flight.crashed);

    if (result === 'crashed') {
      crashPlane('The courier is down. The island keeps the plane.');
    } else if (result === 'landed') {
      if (flight.fuel < 99) {
        flight.fuel = CONFIG.fuel.start;
        game.score += CONFIG.sortie.landingScore;
        sound.land();
        hud.toast(`Smooth landing — refuelled, +${CONFIG.sortie.landingScore}`);
      }
    } else if (checkRingPass(course, before, flight.position)) {
      game.score += CONFIG.rings.score;
      if (course.passedCount === 0 && course.laps > 0) {
        game.score += CONFIG.rings.courseBonus;
        sound.course();
        hud.toast(`Course complete! +${CONFIG.rings.score + CONFIG.rings.courseBonus}`);
      } else {
        sound.ring();
        hud.toast(`Gate ${course.passedCount} of 8 — +${CONFIG.rings.score}`);
      }
    }

    // The sortie clock only runs while flying.
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) endSortie('Time! The sortie clock ran out.');
  }

  // Ring glow pulses so the next gate is never lost in the scenery.
  const next = course.meshes[course.nextIndex];
  if (next) {
    const s = 1 + Math.sin(time * 3) * 0.06;
    next.ring.scale.set(s, s, s);
  }

  if (burst) {
    const pos = burst.geometry.attributes.position;
    const { vel } = burst.userData;
    for (let i = 0; i < vel.length; i++) {
      pos.array[i * 3] += vel[i].x * dt;
      pos.array[i * 3 + 1] += vel[i].y * dt;
      pos.array[i * 3 + 2] += vel[i].z * dt;
      vel[i].y -= 30 * dt;
    }
    pos.needsUpdate = true;
    burst.userData.life -= dt;
    if (burst.userData.life <= 0) {
      scene.remove(burst);
      burst = null;
    }
  }

  posePlane(planeMesh, flight, time);
  updateCamera(dt);

  // HUD at most every 80 ms — the instruments stay live without churn.
  if (time - lastHud > 0.08) {
    lastHud = time;
    hud.update({
      flight,
      score: game.score,
      ringsPassed: course.passedCount,
      laps: course.laps,
      timeLeft: game.timeLeft,
      lives: game.lives,
      nextGate: nextRingInfo(course, flight.position),
    });
  }

  renderer.render(scene, camera);
  if (game.shot) document.title = 'SHOT_READY';
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

tick();

// Exposed for play-testing and for the screenshot runner.
window.__game = game;
window.__flight = flight;
