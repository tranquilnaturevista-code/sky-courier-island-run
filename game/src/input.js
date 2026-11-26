// Sky Courier: Island Run — keyboard and mouse.
// One clear job: read the pilot's hands and hand the flight model one
// clean input object per frame. Mouse drag orbits the camera; the wheel
// zooms the chase camera; keys fly the plane.
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0, // -1..1, positive = pull up
    roll: 0, // -1..1, positive = bank right
    yaw: 0, // -1..1, positive = rudder right
    throttleUp: false,
    throttleDown: false,
    orbitX: 0, // camera orbit offset, radians, from mouse drag
    orbitY: 0,
    zoom: 0, // chase distance offset from the wheel
    pressed: new Set(), // keys pressed since last frame (edge-triggered)
  };

  const KEYMAP = {
    ArrowUp: 'pitchDown',
    KeyW: 'pitchDown',
    ArrowDown: 'pitchUp',
    KeyS: 'pitchUp',
    ArrowLeft: 'rollLeft',
    KeyA: 'rollLeft',
    ArrowRight: 'rollRight',
    KeyD: 'rollRight',
    KeyQ: 'yawLeft',
    KeyE: 'yawRight',
    ShiftLeft: 'throttleUp',
    ShiftRight: 'throttleUp',
    ControlLeft: 'throttleDown',
    ControlRight: 'throttleDown',
    KeyC: 'camera',
    KeyP: 'pause',
    KeyM: 'mute',
    KeyR: 'restart',
    Space: 'brake',
  };

  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code]) {
      e.preventDefault();
      if (!keys.has(e.code)) state.pressed.add(e.code);
      keys.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.orbitX += (e.clientX - lastX) * 0.005;
    state.orbitY = Math.max(-0.5, Math.min(0.6, state.orbitY + (e.clientY - lastY) * 0.004));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.zoom = Math.max(-6, Math.min(10, state.zoom + Math.sign(e.deltaY) * 1.5));
  }, { passive: false });

  function read() {
    const down = (code) => keys.has(code);
    state.pitch =
      (down('ArrowDown') || down('KeyS') ? 1 : 0) - (down('ArrowUp') || down('KeyW') ? 1 : 0);
    state.roll =
      (down('ArrowRight') || down('KeyD') ? 1 : 0) - (down('ArrowLeft') || down('KeyA') ? 1 : 0);
    state.yaw = (down('KeyE') ? 1 : 0) - (down('KeyQ') ? 1 : 0);
    state.throttleUp = down('ShiftLeft') || down('ShiftRight');
    state.throttleDown = down('ControlLeft') || down('ControlRight');
    // Space is an airbrake: it cuts the throttle while held.
    if (down('Space')) state.throttleDown = true;
    return state;
  }

  // Edge-triggered keys, consumed once per frame by the game loop.
  function consume(code) {
    if (state.pressed.has(code)) {
      state.pressed.delete(code);
      return true;
    }
    return false;
  }

  return { read, consume, state };
}
