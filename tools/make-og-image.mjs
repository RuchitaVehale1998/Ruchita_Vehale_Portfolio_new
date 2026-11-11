#!/usr/bin/env node
/* Makes the link-preview image (site/og-image.jpg, 1200 x 630) from the site's hero: headless Chrome loads the page,
   a few UI bits are hidden and the address is added for the screenshot only, and ffmpeg scales it down to a small JPEG.

   Needs: Node 22+, Google Chrome, ffmpeg.
   Usage:  node tools/make-og-image.mjs [out.jpg]        Env: SITE_URL (default https://www.ruchita.uk/)  CHROME */
import { spawn, execFile } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const SITE = process.env.SITE_URL || 'https://www.ruchita.uk/';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.resolve(process.argv[2] || 'og-image.jpg');
const PORT = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = path.join(os.tmpdir(), `rv-og-${Date.now()}`); await mkdir(profile, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
try {
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) throw new Error('Chrome did not start');
  const ws = new WebSocket(wsUrl); await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const waiters = [];
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } else if (d.method) waiters.filter((w) => w.m === d.method).forEach((w) => w.r()); });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = (m) => new Promise((r) => waiters.push({ m, r }));
  const js = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  const loaded = once('Page.loadEventFired'); await send('Page.navigate', { url: SITE }); await loaded;
  await js('document.fonts.ready.then(() => 1)');
  await js(`(() => {
    const s = document.createElement('style');
    s.textContent = '.top nav,.panel,.lede,.cta,.meta,.figlab,.flaps{display:none!important}'
      + '#__url{position:fixed;left:96px;bottom:38px;z-index:99;font:500 30px/1 "IBM Plex Mono",monospace;letter-spacing:.06em;color:#f1f1f1}'
      + '#__url i{font-style:normal;color:#c4382d}';
    document.head.append(s);
    const u = document.createElement('div'); u.id = '__url'; u.innerHTML = 'www.ruchita.uk'; document.body.append(u);
    scrollTo(0, 0);
  })()`);
  await sleep(6500);                                            // let the LiDAR scan and the tape get going
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const png = path.join(profile, 'og.png'); await writeFile(png, Buffer.from(shot.data, 'base64'));
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=1200:630:flags=lanczos', '-q:v', '3', OUT]);
  console.log('wrote', OUT);
  ws.close();
} finally {
  chrome.kill(); await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
