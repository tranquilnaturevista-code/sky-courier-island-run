[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/tranquilnaturevista-code/sky-courier-island-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/tranquilnaturevista-code/sky-courier-island-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Sky Courier — Island Run

A little orange prop plane, eight golden gates, one runway home. Fly the
course over an island archipelago: thread every ring, mind the throttle
and the fuel gauge, land on the runway to refuel, and beat the five-minute
sortie clock. Three lives, one courier, no autopilot.

**Entry for the [make.fun bounty "Make the best flight game"](https://make.fun/bounty/best-flight-game-20261126-0057)** ($500, 50 places, closes 2026-11-28 07:57 WIB).

## How to play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and open http://localhost:8080). No network, no install, no build step.

- **Pitch:** W / S or ↑ / ↓ — pull up, push down.
- **Bank:** A / D or ← / → — bank to turn; a banked plane turns.
- **Rudder:** Q / E — fine heading nudges.
- **Throttle:** SHIFT up, CTRL down (SPACE is an airbrake).
- **Camera:** C toggles chase / cockpit. Drag the mouse to look around, scroll wheel to zoom the chase camera.
- **Pause:** P. **Mute:** M. **Restart after a crash:** R.

## The sortie

- **Rings:** fly through the golden gate ahead (+100). The HUD arrow points at the next gate with its distance. All eight gates = course complete (+500) and the course starts again.
- **Fuel:** burns with the throttle. Land gently on the runway (slow, level, on the strip) to refuel (+50) and fly on.
- **Stall:** below ~34 m/s the nose drops — keep the speed up or trade altitude for it.
- **Crash:** hitting terrain or the sea too fast ends the run; a gentle scrape just costs speed.
- **Clock:** five minutes. When it hits zero, the sortie is over.

## How it is built

- `game/src/main.js` — renderer, camera, game states, the loop.
- `game/src/plane.js` — the aircraft mesh and the arcade flight model.
- `game/src/terrain.js` — the islands, ocean, runway, trees, clouds; `terrainHeight()` is the one ground truth for collisions.
- `game/src/rings.js` — the golden gate course and pass detection.
- `game/src/hud.js` — altitude, speed, heading, compass, artificial horizon, fuel, score, gate arrow.
- `game/src/audio.js` — synthesized engine hum, gate chimes, crash thud (WebAudio only, no sound files).
- `game/src/input.js` — keyboard + mouse.
- `game/src/config.js` — every tunable number. `game/src/random.js` — the seeded RNG behind the world.
- `game/vendor/three.module.min.js` — Three.js r152, vendored.

Screenshots in `screenshots/` are real renders of the game in headless
Chrome (`node take-shots.mjs`): chase view over the harbour, cockpit view
on the Peak Gate, final approach to the runway, and the Twin Island Gate.
