#!/usr/bin/env node
/* Records the website walkthrough video (site/walkthrough.mp4) and its preview GIF (docs/preview.gif).

   It drives headless Chrome over the DevTools protocol, scrolls through the plates, uses a few of the controls
   (a fake cursor and a caption bar are injected into the page for the recording only), grabs the frames with
   Page.startScreencast, and lets ffmpeg turn them into a 1080p H.264 video: the desktop pass first, then a short
   phone pass at 390 px. The GIF is cut from three moments of the desktop pass.

   Needs: Node 22+, Google Chrome, ffmpeg.
   Usage:  node tools/record-walkthrough.mjs [outDir] [desktop|phone|both]
   Env:    SITE_URL (default https://www.ruchita.uk/)   CHROME (path to the Chrome binary)
   It never clicks the résumé download, the paper links or the Enigma "email me" button. */
import { spawn, execFile } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const SITE = process.env.SITE_URL || 'https://www.ruchita.uk/';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.resolve(process.argv[2] || './walkthrough-out');
const WHICH = process.argv[3] || 'both';
const PORT = 9333;
const W = 1920, H = 1080;                       // output size
const RANGE = 'in_range=pc:out_range=tv:out_color_matrix=bt709';   // the screencast frames are full-range JPEG; the video is limited-range BT.709 so every player shows it the same
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Stop extends Error {}                      // STOP_AFTER=<scene> ends the recording after that scene (handy while iterating)

/* ── minimal DevTools-protocol client ─────────────────────────── */
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (m) => {
      const d = JSON.parse(m.data);
      if (d.id) { const p = this.pending.get(d.id); if (p) { this.pending.delete(d.id); d.error ? p.rej(new Error(`${d.error.message}`)) : p.res(d.result); } }
      else if (d.method) (this.handlers.get(d.method) || []).forEach((f) => f(d.params));
    });
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.pending.set(id, { res, rej })); }
  on(ev, fn) { if (!this.handlers.has(ev)) this.handlers.set(ev, []); this.handlers.get(ev).push(fn); }
}

/* ── page-side helpers: caption bar, fake cursor, smooth scrolling ─ */
const OVERLAY = `(() => {
  if (window.__ov) return; window.__ov = 1;
  document.documentElement.style.scrollBehavior = 'auto';
  const s = document.createElement('style');
  s.textContent = '#__cap{position:fixed;left:68px;right:0;bottom:0;height:60px;display:flex;align-items:center;padding:0 28px;z-index:150;pointer-events:none;background:#000;border-top:1px solid rgba(255,255,255,.28);font:500 15px/1.35 "IBM Plex Mono",monospace;color:#f1f1f1;letter-spacing:.03em;opacity:0;transition:opacity .3s}'
    + '#__cap.on{opacity:1}#__cap b{letter-spacing:.2em;color:#a0a0a0;margin-right:16px;font-weight:500;font-size:11px;white-space:nowrap}'
    + '#__cur{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid #fff;border-radius:50%;background:rgba(255,255,255,.2);z-index:170;pointer-events:none;opacity:0}#__cur.on{opacity:1}'
    + '.panel{z-index:160}'
    + '@media (max-width:760px){#__cap{left:30px;height:56px;padding:0 12px;font-size:12px}#__cap b{margin-right:10px;font-size:10px}}';
  document.head.append(s);
  const c = document.createElement('div'); c.id = '__cap'; const u = document.createElement('div'); u.id = '__cur'; document.body.append(c, u);
  window.__cap = (k, t) => { const e = document.getElementById('__cap'); if (!t) { e.classList.remove('on'); return; } e.innerHTML = '<b>' + k + '</b><span>' + t + '</span>'; e.classList.add('on'); };
  window.__cur = (x, y, on) => { u.style.transform = 'translate(' + x + 'px,' + y + 'px)'; u.classList.toggle('on', on !== false); };
  addEventListener('mousemove', (e) => window.__cur(e.clientX, e.clientY, true), true);   // the cursor follows the protocol's mouse events
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  window.__go = (a, b, bias) => new Promise((res) => {   // scroll so that a..b sits in the area between the header and the caption bar
    const hdr = 58, bar = innerWidth < 761 ? 56 : 60, avail = innerHeight - hdr - bar;
    const A = document.querySelector(a).getBoundingClientRect(), B = (b ? document.querySelector(b) : document.querySelector(a)).getBoundingClientRect();
    const top = A.top + scrollY, h = B.bottom + scrollY - top;
    const y1 = Math.max(0, h + 40 <= avail ? top - hdr - (avail - h) / 2 : top - (bias ?? hdr + 38)), y0 = scrollY, d = Math.abs(y1 - y0);
    const ms = Math.min(1100, Math.max(600, 400 + d * 0.5)), t0 = performance.now();
    (function step(now) { const t = Math.min(1, (now - t0) / ms); scrollTo(0, y0 + (y1 - y0) * ease(t)); t < 1 ? requestAnimationFrame(step) : res(); })(t0);
  });
})()`;

/* ── one recording session ─────────────────────────────────── */
async function session(cdp, name, { width, height, dpr, mobile }, script) {
  const dir = path.join(OUT, `frames-${name}`);
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  if (mobile) {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  }
  const evalJs = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const loaded = new Promise((res) => cdp.on('Page.loadEventFired', res));
  await cdp.send('Page.navigate', { url: SITE });
  await loaded;
  await evalJs('document.fonts.ready.then(() => 1)');
  await evalJs(OVERLAY);
  // Not recorded: visit every canvas once so each scene is mounted and its readouts are filled in. Some plates grow when that
  // happens (the Turing rule table, for one), which would otherwise shift the layout under a scroll that was already measured.
  const total = await evalJs(`document.querySelectorAll('canvas[data-scene]').length`);
  for (let i = 0; i < total; i++) { await evalJs(`document.querySelectorAll('canvas[data-scene]')[${i}].scrollIntoView({ block: 'center' })`); await sleep(380); }
  await evalJs('scrollTo(0, 0)');
  await sleep(1800);                                          // let the hero draw before recording

  /* frames */
  const frames = []; const writes = []; let n = 0;
  cdp.on('Page.screencastFrame', (p) => {
    cdp.send('Page.screencastFrameAck', { sessionId: p.sessionId });
    const file = path.join(dir, `f${String(n++).padStart(6, '0')}.jpg`);
    frames.push({ file, ts: p.metadata.timestamp });
    writes.push(writeFile(file, Buffer.from(p.data, 'base64')));
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: Math.round(width * dpr), maxHeight: Math.round(height * dpr), everyNthFrame: 1 });
  const t0 = Date.now(); const marks = [];

  /* helpers for the scripts */
  let cur = [width / 2, height / 2];
  // a release must name the button that was released (left), even though no button is held afterwards
  const mouse = (type, x, y, buttons = 0) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? (buttons ? 'left' : 'none') : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
  const moveTo = async (x, y, ms = 450, buttons = 0) => {    // time-based, so it lasts `ms` however slow the protocol round trips are
    const [x0, y0] = cur, s = Date.now();
    for (;;) {
      const t = Math.min(1, (Date.now() - s) / ms), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await mouse('mouseMoved', x0 + (x - x0) * e, y0 + (y - y0) * e, buttons);
      if (t >= 1) break;
      await sleep(6);
    }
    cur = [x, y];
  };
  const click = async (x, y) => { await moveTo(x, y, 450); await mouse('mousePressed', x, y, 1); await sleep(90); await mouse('mouseReleased', x, y, 0); await sleep(150); };
  const drag = async (pts, ms) => {                           // pts: [[x,y],...] polyline; press at the first, release at the last
    await moveTo(pts[0][0], pts[0][1], 350);
    await mouse('mousePressed', pts[0][0], pts[0][1], 1);
    for (let i = 1; i < pts.length; i++) await moveTo(pts[i][0], pts[i][1], ms / (pts.length - 1), 1);
    await mouse('mouseReleased', cur[0], cur[1], 0);
  };
  const cursorOff = () => evalJs('__cur(0,0,false)');
  const rect = (sel) => evalJs(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const cv = (key) => rect(`canvas[data-key="${key}"]`);
  const at = (r, fx, fy) => [r.x + fx * r.w, r.y + fy * r.h];
  const go = async (a, b, bias) => {
    const r = await evalJs(`__go(${JSON.stringify(a)}, ${b ? JSON.stringify(b) : 'null'}, ${bias ?? 'null'})`);
    if (process.env.DEBUG) {
      const ra = await rect(a), rb = b ? await rect(b) : null;
      console.log(`go ${a}${b ? ' .. ' + b : ''}: scrollY=${await evalJs('Math.round(scrollY)')} a.y=${Math.round(ra.y)} a.h=${Math.round(ra.h)}${rb ? ` b.bottom=${Math.round(rb.y + rb.h)}` : ''}`);
    }
    return r;
  };
  const clickEl = async (sel) => {
    let r = await rect(sel);
    const hidden = r.y + r.h > height - 62;                   // under the caption bar (the fixed header buttons are always reachable)
    if (process.env.DEBUG) console.log(`clickEl ${sel}: y=${Math.round(r.y)} h=${Math.round(r.h)} scrollY=${await evalJs('Math.round(scrollY)')} ${hidden ? '-> scrolling it into view' : 'visible'}`);
    if (hidden) {                                             // can't be shown together with the figure: press it without moving the page, so the figure stays in frame
      await evalJs(`document.querySelector(${JSON.stringify(sel)}).click()`); await sleep(300); return;
    }
    await click(r.x + r.w / 2, r.y + r.h / 2);
  };
  const tap = async (sel) => { const r = await rect(sel); await evalJs(`__cur(${r.x + r.w / 2},${r.y + r.h / 2})`); await sleep(260); await evalJs(`document.querySelector(${JSON.stringify(sel)}).click()`); await sleep(260); await cursorOff(); };
  const typeText = async (text, ms = 150) => {
    for (const ch of text) {
      const code = /[A-Za-z]/.test(ch) ? `Key${ch.toUpperCase()}` : ch === ' ' ? 'Space' : '';
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch, code, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0) });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, code });
      await sleep(ms);
    }
  };
  const S = async (mark, k, text, ms, fn) => {                // a captioned scene that lasts `ms` in total
    marks.push({ name: mark, t: (Date.now() - t0) / 1000 });
    await evalJs(`__cap(${JSON.stringify(k)}, ${JSON.stringify(text)})`);
    const s = Date.now(); if (fn) await fn(); await cursorOff();
    const rest = ms - (Date.now() - s); if (rest > 0) await sleep(rest);
    if (process.env.STOP_AFTER === mark) throw new Stop();
  };

  try { await script({ evalJs, go, S, sleep, moveTo, click, clickEl, drag, tap, typeText, cursorOff, rect, cv, at, mouse, cdp }); }
  catch (e) { if (!(e instanceof Stop)) throw e; }

  await evalJs('__cap(null, null)');
  await sleep(300);
  await cdp.send('Page.stopScreencast');
  await Promise.all(writes);
  const span = Math.max(...frames.map((f) => f.ts)) - Math.min(...frames.map((f) => f.ts));
  console.log(`[${name}] ${frames.length} frames over ${span.toFixed(1)} s (${(frames.length / span).toFixed(1)} fps captured)`);
  await writeFile(path.join(OUT, `timeline-${name}.json`), JSON.stringify(marks, null, 1));
  return frames;
}

/* ── the walkthrough itself (every caption reuses wording from the site) ── */
const desktop = async (x) => {
  const { S, go, evalJs, sleep, click, clickEl, drag, moveTo, cv, at, typeText, rect, cdp } = x;
  const key = (k, code, vk) => cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }).then(() => cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }));

  await S('hero', 'FIG. 0', 'A LiDAR scan being mapped, above a Turing tape counting in binary', 5000);
  await S('index', 'INDEX', 'Thirteen plates, each project set beside the machine it descends from', 4600, async () => {
    await clickEl('#index-open'); await sleep(2300); await key('Escape', 'Escape', 27);
  });

  await go('#p1', null, 62); await sleep(350);                      // heading and canvas; its controls sit below the tall rule table, so they are pressed without scrolling
  await S('p1', 'PLATE I', 'Turing machine, 1936. Pick a program and watch the rules run', 4600, async () => {
    await clickEl('button[data-arg="beaver"]');
    if (await evalJs(`document.getElementById('turing-run').textContent.includes('Run')`)) await clickEl('#turing-run');
  });

  await go('#p2', null, 70); await sleep(350);
  await S('p2a', 'PLATE II', 'DeGould: 3D localisation for defect inspection (illustrative model)', 3200);
  await go('canvas[data-key="obscura"]', '#p2 .ctrls'); await sleep(350);
  await S('p2b', 'CAMERA OBSCURA', 'c. 1011. Drag the object, add a second pinhole for stereo', 4400, async () => {
    const r = await cv('obscura');
    await drag([at(r, 0.3, 0.5), at(r, 0.22, 0.36), at(r, 0.4, 0.62), at(r, 0.3, 0.46)], 2200);
    await clickEl('label.fld.chk');
  });

  await go('#p3', null, 70); await sleep(350);
  await S('p3a', 'PLATE III', 'DriveSense: seeing what doesn’t belong', 4200);
  await go('canvas[data-key="loom"]', '#p3 .ctrls'); await sleep(350);
  await S('p3b', 'JACQUARD LOOM', '1804. Punch holes in the cards and the cloth changes', 4000, async () => {
    const r = await cv('loom');
    for (const [fx, fy] of [[0.13, 0.5], [0.22, 0.6], [0.3, 0.42]]) await click(...at(r, fx, fy));
  });

  await go('#p4', null, 70); await sleep(350);
  await S('p4a', 'PLATE IV', 'Dynamic object-aware visual SLAM', 3200);
  await go('canvas[data-key="chart"]'); await sleep(350);
  await S('p4b', 'SEA CHART', 'Dead reckoning. Click the water to drop a beacon', 4000, async () => {
    const r = await cv('chart');
    for (const [fx, fy] of [[0.3, 0.6], [0.72, 0.45], [0.5, 0.78]]) { await click(...at(r, fx, fy)); await sleep(350); }
  });

  await go('#p5', null, 70); await sleep(350);
  await S('p5a', 'PLATE V', 'Autonomous precision landing, no GPS', 3400);
  await go('canvas[data-key="gyro"]'); await sleep(350);
  await S('p5b', 'GYROSCOPE', '1852. Drag sideways to tilt the frame; the rotor keeps its axis', 4200, async () => {
    const r = await cv('gyro');
    await drag([at(r, 0.3, 0.5), at(r, 0.48, 0.4), at(r, 0.22, 0.58), at(r, 0.4, 0.5)], 2800);
  });

  await go('#p6', null, 70); await sleep(350);
  await S('p6a', 'PLATE VI', 'Multi-band antennas: designed, printed, measured (illustrative)', 3400);
  await go('canvas[data-key="radio"]', '#p6 .ctrls'); await sleep(350);
  await S('p6b', 'SPARK-GAP TELEGRAPH', '1887. Tune the receiver to a band', 4000, async () => {
    await clickEl('button[data-arg="3.5"]'); await sleep(900); await clickEl('button[data-arg="1.575"]');
  });

  await go('#p7', null, 70); await sleep(350);
  await S('p7a', 'PLATE VII', 'Leader–follower robots, controlled and estimated', 3200);
  await go('canvas[data-key="engine"]', '#p7 .ctrls'); await sleep(350);
  await S('p7b', 'DIFFERENCE ENGINE', '1822. A crank and four number wheels: addition only', 3800, async () => { await clickEl('#engine-auto'); });

  await go('#p8', null, 70); await sleep(350);
  await S('p8', 'PLATE VIII', 'The firmware between autopilot and world', 3400);

  await go('canvas[data-key="switch"]'); await sleep(350);
  await S('p9', 'PLATE IX', 'Switchboard: patch a project, light the skills', 6000, async () => {
    const r = await cv('switch'), rowH = (r.h - 44 - 26) / 9;
    for (const i of [2, 5]) { await click(r.x + r.w * 0.285, r.y + 44 + (i + 0.5) * rowH); await sleep(1500); }
  });

  await go('canvas[data-key="gears"]', '#p10 .ctrls'); await sleep(350);
  await S('p10', 'PLATE X', 'Antikythera mechanism: ten years wound onto a dial', 6000, async () => {
    const r = await cv('gears'), cx = r.x + r.w * 0.38, cy = r.y + r.h * 0.5, R = Math.min(r.h * 0.45, r.w * 0.32) * 0.82;
    const pts = []; for (let a = -70; a <= 215; a += 12) pts.push([cx + Math.cos((a * Math.PI) / 180) * R, cy + Math.sin((a * Math.PI) / 180) * R]);
    await drag(pts, 3600);
  });

  await go('canvas[data-key="card"]', '#p11 .ctrls'); await sleep(350);
  await S('p11', 'PLATE XI', 'Hollerith card: eighty columns, one résumé', 3200, async () => {
    const r = await cv('card'); await moveTo(...at(r, 0.2, 0.4), 400); await moveTo(...at(r, 0.78, 0.5), 1800);
  });

  await go('#drawer', null, 100); await sleep(350);
  await S('p12', 'PLATE XII', 'The drawer: published work, each card linked to its publisher', 4400, async () => {
    const r = await rect('#drawer .card .pub'); await moveTo(r.x + r.w / 2, r.y + r.h / 2, 900); await sleep(900);
  });

  await go('canvas[data-key="enigma"]', '#p13 .ctrls'); await sleep(350);
  await S('p13', 'PLATE XIII', 'Enigma: type a message and the rotors do the rest', 6400, async () => {
    await clickEl('#enigma-in'); await evalJs(`document.getElementById('enigma-in').select()`); await typeText('RUCHITA VEHALE', 160);
  });

  await go('.foot', null, 300); await sleep(300);
  await S('end', 'LIVE', 'www.ruchita.uk', 3000);
};

const phone = async (x) => {
  const { S, go, evalJs, sleep, tap } = x;
  await S('hero', 'PHONE', 'The same site, laid out for small screens', 4200);
  await S('index', 'INDEX', 'A full-screen index with a Close button', 4000, async () => { await tap('#index-open'); await sleep(1800); await tap('#index-close'); });
  await go('#p2', null, 60); await sleep(350);
  await S('p2', 'PLATE II', 'Project first: DeGould', 3200);
  await go('canvas[data-key="switch"]'); await sleep(350);
  await S('p9', 'PLATE IX', 'Switchboard', 3600);
  await go('canvas[data-key="gears"]'); await sleep(350);
  await S('p10', 'PLATE X', 'The gears calendar, scaled to fit', 3400);
  await go('#drawer', null, 100); await sleep(350);
  await S('p12', 'PLATE XII', 'Published work, linked to the publishers', 3200);
  await go('.foot', null, 300); await sleep(300);
  await S('end', 'LIVE', 'www.ruchita.uk', 2600);
};

/* ── encoding ─────────────────────────────────────────────── */
async function encode(name, frames, vf, crf) {
  const fr = [...frames].sort((a, b) => a.ts - b.ts);          // the first frames can arrive with out-of-order timestamps
  const lines = fr.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.0005, i < fr.length - 1 ? fr[i + 1].ts - f.ts : 0.04).toFixed(4)}`);
  lines.push(`file '${fr.at(-1).file}'`);                      // the concat demuxer ignores the last duration unless the file is repeated
  const list = path.join(OUT, `${name}.txt`); await writeFile(list, lines.join('\n'));
  const out = path.join(OUT, `${name}.mp4`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30,${vf},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', out]);
  return out;
}

async function makeGif(final, marks) {                          // hero, switchboard and gears calendar, ~10 s at 720 px
  const m = Object.fromEntries(marks.map((k) => [k.name, k.t]));
  const cuts = [[m.hero + 0.6, m.hero + 4.2], [m.p9 + 1.2, m.p9 + 4.6], [m.p10 + 1.0, m.p10 + 4.4]];
  const trims = cuts.map(([a, b], i) => `[0:v]trim=start=${a.toFixed(2)}:end=${b.toFixed(2)},setpts=PTS-STARTPTS[v${i}]`).join(';');
  const fc = `${trims};[v0][v1][v2]concat=n=3:v=1:a=0,fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  const out = path.join(OUT, 'preview.gif');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', final, '-filter_complex', fc, '-loop', '0', out]);
  return out;
}

/* ── main ─────────────────────────────────────────────────── */
await mkdir(OUT, { recursive: true });
const profile = path.join(os.tmpdir(), `rv-chrome-${Date.now()}`); await mkdir(profile, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
try {
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) throw new Error('Chrome did not start');
  const ws = new WebSocket(wsUrl); await new Promise((r) => ws.addEventListener('open', r));
  const cdp = new CDP(ws);
  const parts = [];
  if (WHICH !== 'phone') {
    const fr = await session(cdp, 'desktop', { width: 1366, height: 768, dpr: W / 1366, mobile: false }, desktop);
    parts.push(await encode('desktop', fr, `scale=${W}:${H}:flags=lanczos:${RANGE}`, 28));
  }
  if (WHICH !== 'desktop' && !process.env.STOP_AFTER) {
    const fr = await session(cdp, 'phone', { width: 390, height: 844, dpr: 2, mobile: true }, phone);
    parts.push(await encode('phone', fr, `scale=-2:1000:flags=lanczos:${RANGE},pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`, 28));
  }
  const final = path.join(OUT, 'walkthrough.mp4');
  await writeFile(path.join(OUT, 'parts.txt'), parts.map((p) => `file '${p}'`).join('\n'));
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'parts.txt'), '-c', 'copy', '-movflags', '+faststart', final]);
  console.log('wrote', final);
  if (WHICH !== 'phone' && !process.env.STOP_AFTER) { const marks = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(OUT, 'timeline-desktop.json'), 'utf8')); console.log('wrote', await makeGif(final, marks)); }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
