// Sky Courier: Island Run — the HUD and the screens.
// One clear job: draw every instrument the pilot sees — altitude, speed,
// heading, artificial horizon, throttle, fuel, score, the next gate — and
// the title, pause and game-over screens around them.
export function buildHud() {
  const root = document.getElementById('hud');

  root.innerHTML = `
    <div class="panel" id="flight-panel">
      <div class="row"><span>ALT</span><b id="hud-alt">0 m</b></div>
      <div class="row"><span>SPD</span><b id="hud-spd">0 km/h</b></div>
      <div class="row"><span>HDG</span><b id="hud-hdg">000°</b></div>
      <div class="row"><span>THR</span><b id="hud-thr">0%</b></div>
      <div id="compass"><div id="compass-strip"></div><div id="compass-needle">▲</div></div>
      <canvas id="horizon" width="150" height="90"></canvas>
    </div>
    <div class="panel" id="mission-panel">
      <div class="row"><span>SCORE</span><b id="hud-score">0</b></div>
      <div class="row"><span>RINGS</span><b id="hud-rings">0 / 8</b></div>
      <div class="row"><span>TIME</span><b id="hud-time">5:00</b></div>
      <div class="row"><span>LIVES</span><b id="hud-lives">✈ ✈ ✈</b></div>
      <div class="bar"><i id="fuel-bar"></i><em>FUEL</em></div>
      <div class="bar"><i id="thr-bar"></i><em>THROTTLE</em></div>
    </div>
    <div id="gate-panel">
      <div id="gate-arrow">➤</div>
      <div><div id="gate-label">Harbour Gate</div><div id="gate-dist">0 m</div></div>
    </div>
    <div id="warn-panel">
      <span id="warn-stall">STALL</span>
      <span id="warn-fuel">LOW FUEL</span>
      <span id="warn-gear">RUNWAY AHEAD</span>
    </div>
    <div id="toast"></div>
    <div id="centre-dot">+</div>
    <div id="help">W/S pitch · A/D bank · Q/E rudder · SHIFT throttle up · CTRL throttle down · C camera · drag mouse to look · P pause</div>
  `;

  const el = (id) => document.getElementById(id);
  const horizon = el('horizon');
  const hctx = horizon.getContext('2d');

  let toastTimer = 0;
  function toast(text, ms = 2200) {
    const t = el('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function drawHorizon(pitch, roll) {
    const w = horizon.width;
    const h = horizon.height;
    hctx.clearRect(0, 0, w, h);
    hctx.save();
    hctx.translate(w / 2, h / 2);
    hctx.rotate(-roll);
    const dy = pitch * 70;
    hctx.fillStyle = '#2f7fc9';
    hctx.fillRect(-w, -h + dy, w * 2, h);
    hctx.fillStyle = '#7a5a34';
    hctx.fillRect(-w, dy, w * 2, h);
    hctx.strokeStyle = '#fff';
    hctx.lineWidth = 2;
    hctx.beginPath();
    hctx.moveTo(-w, dy);
    hctx.lineTo(w, dy);
    hctx.stroke();
    hctx.restore();
    // Fixed wings marker.
    hctx.strokeStyle = '#ffd23f';
    hctx.lineWidth = 3;
    hctx.beginPath();
    hctx.moveTo(w / 2 - 26, h / 2);
    hctx.lineTo(w / 2 - 8, h / 2);
    hctx.moveTo(w / 2 + 8, h / 2);
    hctx.lineTo(w / 2 + 26, h / 2);
    hctx.stroke();
    hctx.fillStyle = '#ffd23f';
    hctx.beginPath();
    hctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
    hctx.fill();
  }

  function drawCompass(headingDeg) {
    const strip = el('compass-strip');
    const points = [
      [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
      [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'],
    ];
    // Named points only, every 45 degrees, inside a +-60 degree window:
    // labels sit ~34% apart and never overlap.
    let html = '';
    for (let d = Math.floor((headingDeg - 60) / 45) * 45; d <= headingDeg + 60; d += 45) {
      const norm = ((d % 360) + 360) % 360;
      const point = points.find(([deg]) => deg === norm);
      if (!point) continue;
      const offset = ((d - headingDeg + 540) % 360) - 180;
      html += `<span style="left:${50 + offset * 0.75}%">${point[1]}</span>`;
    }
    strip.innerHTML = html;
  }

  function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // One update per frame from the game state.
  function update(state) {
    const { flight, score, ringsPassed, laps, timeLeft, lives, nextGate } = state;
    el('hud-alt').textContent = `${Math.max(0, Math.round(flight.position.y))} m`;
    el('hud-spd').textContent = `${Math.round(flight.speed * 3.6)} km/h`;
    const hdg = ((flight.heading * 180) / Math.PI % 360 + 360) % 360;
    el('hud-hdg').textContent = `${String(Math.round(hdg)).padStart(3, '0')}°`;
    el('hud-thr').textContent = `${Math.round(flight.throttle * 100)}%`;
    drawCompass(hdg);
    drawHorizon(flight.pitch, flight.roll);

    el('hud-score').textContent = String(score);
    el('hud-rings').textContent = `${ringsPassed} / 8${laps > 0 ? ` · lap ${laps + 1}` : ''}`;
    el('hud-time').textContent = fmtTime(timeLeft);
    el('hud-lives').textContent = '✈ '.repeat(Math.max(0, lives)).trim() || '—';
    el('fuel-bar').style.width = `${Math.max(0, flight.fuel)}%`;
    el('fuel-bar').style.background = flight.fuel < 25 ? '#e23b3b' : '#37d67a';
    el('thr-bar').style.width = `${flight.throttle * 100}%`;

    if (nextGate) {
      el('gate-label').textContent = nextGate.label;
      el('gate-dist').textContent = `${Math.round(nextGate.distance)} m`;
      // Arrow rotates to the bearing relative to the current heading.
      // The arrow glyph points right at 0 degrees, so dead ahead is -90.
      let rel = nextGate.bearing - hdg;
      rel = ((rel + 540) % 360) - 180;
      el('gate-arrow').style.transform = `rotate(${rel - 90}deg)`;
      el('gate-arrow').style.color = Math.abs(rel) < 25 ? '#ffd23f' : '#fff';
    }

    el('warn-stall').classList.toggle('on', flight.speed < 36 && !flight.grounded);
    el('warn-fuel').classList.toggle('on', flight.fuel < 25);
    const r = document.getElementById('gate-panel');
    void r;
  }

  function setScreen(name, data) {
    // name: 'title' | 'playing' | 'paused' | 'crashed' | 'over'
    const overlay = document.getElementById('overlay');
    const screens = {
      title: `<h1>SKY COURIER</h1><p class="sub">Island Run — a little prop plane, eight golden gates, one runway home.</p>
        <p>Fly the course through every ring, land on the runway to refuel, and beat the clock. Three lives, five minutes.</p>
        <p class="keys">W/S pitch &nbsp;·&nbsp; A/D bank &nbsp;·&nbsp; Q/E rudder &nbsp;·&nbsp; SHIFT throttle up &nbsp;·&nbsp; CTRL throttle down &nbsp;·&nbsp; C camera &nbsp;·&nbsp; drag mouse to look</p>
        <button id="fly-btn">CLICK TO FLY</button>`,
      paused: `<h1>PAUSED</h1><p>Press P or click below to keep flying.</p><button id="fly-btn">RESUME</button>`,
      crashed: `<h1>CRASHED</h1><p>${data?.text ?? ''}</p><p>Score ${data?.score ?? 0} · Lives left ${data?.lives ?? 0}</p><button id="fly-btn">FLY AGAIN (R)</button>`,
      over: `<h1>SORTIE OVER</h1><p>Final score <b>${data?.score ?? 0}</b> · Rings ${data?.rings ?? 0} · Laps ${data?.laps ?? 0}</p><button id="fly-btn">FLY AGAIN (R)</button>`,
    };
    if (name === 'playing') {
      overlay.classList.remove('show');
      overlay.innerHTML = '';
      return;
    }
    overlay.innerHTML = screens[name] || '';
    overlay.classList.add('show');
    const btn = document.getElementById('fly-btn');
    if (btn) btn.addEventListener('click', () => data?.onFly?.());
  }

  return { update, toast, setScreen };
}
