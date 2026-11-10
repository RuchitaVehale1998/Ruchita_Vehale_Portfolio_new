/* main.js — mounts every plate's canvas lazily, wires the HTML controls to scene APIs,
   and starts the global machines: paper tape, split-flap board, front panel, index. */
import { mount, REDUCED, stats } from './core.js';
import { initTape } from './tape.js';
import { initFlaps } from './flap.js';
import { initPanel } from './panel.js';

const root = document.documentElement;
root.classList.add('js');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const loaders = {
  hero: () => import('./plates/hero.js'),
  turing: () => import('./plates/turing.js'),
  obscura: () => import('./plates/obscura.js'),
  loom: () => import('./plates/loom.js'),
  chart: () => import('./plates/chart.js'),
  gyro: () => import('./plates/gyro.js'),
  radio: () => import('./plates/radio.js'),
  engine: () => import('./plates/engine.js'),
  core: () => import('./plates/core.js'),
  switch: () => import('./plates/switch.js'),
  gears: () => import('./plates/gears.js'),
  card: () => import('./plates/card.js'),
  enigma: () => import('./plates/enigma.js'),
  // project illustrations
  dego: () => import('./projects/dego.js'),
  drive: () => import('./projects/drive.js'),
  apple: () => import('./projects/apple.js'),
  slam: () => import('./projects/slam.js'),
  landing: () => import('./projects/landing.js'),
  antenna: () => import('./projects/antenna.js'),
  follow: () => import('./projects/follow.js'),
  firmware: () => import('./projects/firmware.js'),
};
const handles = {};

function lazyMount(canvas) {
  const name = canvas.dataset.scene, key = canvas.dataset.key || name;
  const io = new IntersectionObserver(async (es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    try {
      const factory = (await loaders[name]()).default;
      handles[key] = mount(canvas, factory, { warm: 150 });
    } catch (e) { console.error(`[plate:${name}]`, e); canvas.closest('.fig')?.classList.add('failed'); }
  }, { rootMargin: '600px' });
  io.observe(canvas);
}

/* HTML controls → scene api.  <input data-for="gyro" data-call="roll"> etc. */
function call(key, name, val, el) {
  const api = handles[key]?.scene.inst?.api;
  if (!api || !api[name]) return;
  const r = api[name](val);
  handles[key].kick();                       // reduced-motion: redraw for a moment after the control changed something
  if (typeof r === 'boolean' && el?.tagName === 'BUTTON' && (name === 'run' || name === 'auto')) {
    el.textContent = r ? 'Pause ❚❚' : name === 'run' ? 'Run ▸' : 'Auto ▸';
  }
}
document.addEventListener('input', (e) => {
  const t = e.target.closest('[data-call]');
  if (t && t.tagName === 'INPUT') call(t.dataset.for, t.dataset.call, t.type === 'checkbox' ? t.checked : t.value, t);
});
document.addEventListener('click', (e) => {
  const t = e.target.closest('button[data-call]');
  if (!t) return;
  const seg = t.closest('.seg');
  if (seg) { $$('button', seg).forEach((b) => b.classList.toggle('on', b === t)); }
  call(t.dataset.for, t.dataset.call, t.dataset.arg, t);
});

try {
  $$('canvas[data-scene]').forEach(lazyMount);
  initTape($('#tape'));
  initFlaps($('#flaps'));
  initPanel();
  $('#yr').textContent = new Date().getFullYear();

  // email the plain-text message typed into the Enigma
  $('#enigma-send').addEventListener('click', () => {
    const msg = $('#enigma-in').value.trim() || 'Hello Ruchita';
    const body = `${msg}\n\n(typed on the Enigma plate of your portfolio)`;
    location.href = `mailto:ruchita.uob.2024@gmail.com?subject=${encodeURIComponent('Hello from your catalogue')}&body=${encodeURIComponent(body)}`;
  });

  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.1 });
  $$('.plate .desc, .plate .ph').forEach((el) => { el.classList.add('rv'); io.observe(el); });
} catch (err) {
  console.error('[boot]', err);
  root.classList.remove('js');
}

if (new URLSearchParams(location.search).has('debug')) {
  window.__handles = handles;
  const d = Object.assign(document.createElement('div'), { id: 'dbg' });
  d.style.cssText = 'position:fixed;left:80px;bottom:10px;z-index:999;font:11px monospace;background:#000c;color:#c4382d;padding:6px 10px;border:1px solid #c4382d';
  document.body.append(d);
  setInterval(() => (d.textContent = `${stats.fps} fps · ${stats.active} scenes`), 500);
}
