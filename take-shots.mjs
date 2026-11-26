// Screenshot runner for Sky Courier (dev tooling, not part of the game).
// Serves game/ on localhost, renders each ?shot= preset in headless
// Chromium, and converts the capture to a JPEG inside the gate limits
// (long side <= 1280, short side >= 480, <= 256 KiB).
// Usage: node take-shots.mjs   (needs python3 + PIL for the conversion)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const PORT = 8123;

const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const server = spawn(process.execPath, [join(here, 'serve.ts'), '--port', String(PORT)], { stdio: 'inherit' });
await sleep(1500);

try {
  mkdirSync(join(here, '.shots-tmp'), { recursive: true });
  for (const shot of shots) {
    const png = join(here, '.shots-tmp', shot.name.replace(/\.jpg$/, '.png'));
    const jpg = join(here, 'screenshots', shot.name);
    const url = `http://127.0.0.1:${PORT}/index.html${shot.query}`;
    console.log('shot:', shot.name, url);
    await run(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--use-angle=swiftshader',
      '--hide-scrollbars',
      '--window-size=1280,800',
      '--virtual-time-budget=9000',
      `--screenshot=${png}`,
      url,
    ]);
    // Convert to JPEG q80, max width 1280, and report the result.
    const py = [
      'from PIL import Image',
      `im = Image.open(${JSON.stringify(png)}).convert("RGB")`,
      'im.save(' + JSON.stringify(jpg) + ', "JPEG", quality=82)',
      `print("saved", ${JSON.stringify(jpg)})`,
    ].join('\n');
    writeFileSync(join(here, '.shots-tmp', 'conv.py'), py);
    await run('python3', [join(here, '.shots-tmp', 'conv.py')]);
  }
} finally {
  server.kill();
}

for (const shot of shots) {
  const p = join(here, 'screenshots', shot.name);
  if (!existsSync(p)) {
    console.log('MISSING', shot.name);
    continue;
  }
  const py = [
    'from PIL import Image',
    `im = Image.open(${JSON.stringify(p)})`,
    `print(${JSON.stringify(shot.name)}, im.size, im.format)`,
  ].join('\n');
  writeFileSync(join(here, '.shots-tmp', 'check.py'), py);
  await run('python3', [join(here, '.shots-tmp', 'check.py')]);
  const { size } = await import('node:fs').then((fs) => fs.statSync(p));
  console.log(' ', shot.name, size, 'bytes', size <= 262144 ? 'OK' : 'TOO BIG');
}
