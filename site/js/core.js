/* core.js — shared runtime for every canvas on the page.
   One rAF loop · scenes tick only while visible · DPR clamped · ?motion=0 or prefers-reduced-motion
   renders settled still frames · plus the line-art helpers every plate uses. */

export const params = new URLSearchParams(location.search);
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('motion') === '0';
export const isSmall = () => innerWidth < 760;

/* palette: black, greys, white — and one red */
export const C = {
  k: '#000000', k1: '#0a0a0a', k2: '#121212', k3: '#1c1c1c',
  g1: '#2b2b2b', g2: '#444444', g3: '#6d6d6d', g4: '#9a9a9a',
  w: '#f1f1f1', red: '#c4382d', red2: '#8a2a22',   // red is a rare accent: tiny details only
};
export const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
export const SERIF = '"Bodoni Moda", "Didot", Georgia, serif';

const _rgb = {};
export function rgb(hex) {
  if (_rgb[hex]) return _rgb[hex];
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return (_rgb[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
export const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(r) { const u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }

/* ── line-art helpers ─────────────────────────────────────────── */
export function ink(ctx, a = 0.9, lw = 1, color = C.w) { ctx.strokeStyle = rgba(color, a); ctx.lineWidth = lw; }
export function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
export function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); }
export function centerline(ctx, x1, y1, x2, y2, a = 0.4) {
  ctx.save(); ink(ctx, a, 0.8, C.g4); ctx.setLineDash([14, 3, 2, 3]); line(ctx, x1, y1, x2, y2); ctx.restore();
}
export function crosshair(ctx, x, y, r = 8, color = C.red) {
  ctx.save(); ink(ctx, 1, 1, color); line(ctx, x - r, y, x + r, y); line(ctx, x, y - r, x, y + r); ctx.restore();
}
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function label(ctx, text, x, y, { size = 10.5, color = C.g4, align = 'left', base = 'alphabetic', alpha = 1, font = MONO, spacing = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha; ctx.font = `${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(text, x, y); ctx.restore();
}
/** small outlined pill label, anchored at (x, y) — y is the vertical centre */
export function tag(ctx, text, x, y, color = C.w, { size = 10, align = 'left' } = {}) {
  ctx.save();
  ctx.font = `${size}px ${MONO}`;
  const w = ctx.measureText(text).width + 14, h = size + 9;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  roundRect(ctx, x0, y - h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fill();
  ctx.strokeStyle = rgba(color, 0.6); ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(text, x0 + 7, y + 0.5);
  ctx.restore();
  return w;
}
export function grid(ctx, w, h, step, a = 0.05) {
  ctx.save(); ctx.strokeStyle = rgba(C.w, a); ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0.5; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0.5; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke(); ctx.restore();
}
export function arrow(ctx, x1, y1, x2, y2, head = 6) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  line(ctx, x1, y1, x2, y2);
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
  ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4));
  ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
}
/** engineering dimension line with end ticks and a centred label */
export function dim(ctx, x1, y1, x2, y2, text, { color = C.g4, off = 0, size = 9.5 } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * off, ny = Math.cos(a) * off;
  ctx.save(); ink(ctx, 0.7, 0.8, color);
  line(ctx, x1 + nx, y1 + ny, x2 + nx, y2 + ny);
  for (const [x, y] of [[x1, y1], [x2, y2]]) line(ctx, x + nx - Math.sin(a) * 4, y + ny + Math.cos(a) * 4, x + nx + Math.sin(a) * 4, y + ny - Math.cos(a) * 4);
  const mx = (x1 + x2) / 2 + nx, my = (y1 + y2) / 2 + ny;
  ctx.fillStyle = C.k; const tw = text.length * size * 0.62 + 8; ctx.fillRect(mx - tw / 2, my - 7, tw, 14);
  label(ctx, text, mx, my + 3.5, { size, color, align: 'center' });
  ctx.restore();
}
export function hatch(ctx, x, y, w, h, gap = 5, a = 0.25, color = C.g4) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ink(ctx, a, 0.7, color);
  for (let i = -h; i < w; i += gap) line(ctx, x + i, y + h, x + i + h, y);
  ctx.restore();
}
/** engraved corner marks for a canvas frame */
export function corners(ctx, w, h, m = 10, l = 12, a = 0.5) {
  ctx.save(); ink(ctx, a, 1, C.g4);
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke();
  }
  ctx.restore();
}

/** write into a [data-out="name"] element next to the canvas (readouts, rule tables…) */
export function out(env, name, html) {
  const root = env.canvas.closest('.plate') || document;
  const el = root.querySelector(`[data-out="${name}"]`);
  if (el && el.__last !== html) { el.innerHTML = html; el.__last = html; }
}

/* ── scene runner ─────────────────────────────────────────────── */
const scenes = [];
let started = false, last = performance.now();
const t0 = last;
let fpsFrames = 0, fpsClock = last;
export const stats = { fps: 0, active: 0 };
const dprFor = () => Math.min(devicePixelRatio || 1, isSmall() ? 1.5 : 2);

function ensureInstance(s) {
  if (s.inst || !s.factory || s.w < 2 || s.h < 2) return;
  s.env = { canvas: s.canvas, w: s.w, h: s.h, ptr: s.ptr, reduced: REDUCED, small: isSmall() };
  s.env.redraw = () => { if (REDUCED && s.inst) settle(s); };
  s.env.now = () => (performance.now() - t0) / 1000;      // same clock the draw loop passes as `t`
  s.env.kick = () => { s.burst = 1.4; };
  s.inst = s.factory(s.env);
  if (REDUCED) settle(s);
}
function settle(s) {
  if (!s.inst) return;
  const dt = 1 / 30, N = s.warm ?? 150;
  for (let i = 0; i <= N; i++) { s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0); s.ctx.clearRect(0, 0, s.w, s.h); s.inst.draw(s.ctx, i * dt, dt); }
}
function resize(s) {
  const r = s.canvas.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (w === s.w && h === s.h && s.dpr === dprFor()) return;
  s.w = w; s.h = h; s.dpr = dprFor();
  s.canvas.width = Math.max(1, Math.round(w * s.dpr)); s.canvas.height = Math.max(1, Math.round(h * s.dpr));
  if (s.env) { s.env.w = w; s.env.h = h; s.env.small = isSmall(); }
  ensureInstance(s);
  s.inst?.resize?.(w, h);
  if (REDUCED && s.inst) settle(s);
}

export function mount(canvas, factory, opts = {}) {
  const s = { canvas, factory, ctx: canvas.getContext('2d'), inst: null, env: null, w: 0, h: 0, dpr: 1, vis: false, warm: opts.warm, burst: 0,
    ptr: { x: -999, y: -999, in: false, down: false, dx: 0, dy: 0, click: false, sx: 0, sy: 0 } };
  scenes.push(s);
  const upd = (e) => { const r = canvas.getBoundingClientRect(); s.ptr.x = e.clientX - r.left; s.ptr.y = e.clientY - r.top; };
  // with reduced motion the loop only redraws a scene for a short burst after something touches it
  canvas.addEventListener('pointermove', (e) => {
    const px = s.ptr.x, py = s.ptr.y; upd(e);
    if (s.ptr.in || s.ptr.down) { s.ptr.dx += s.ptr.x - px; s.ptr.dy += s.ptr.y - py; }
    s.ptr.in = true; s.burst = 1.4;
  });
  canvas.addEventListener('pointerleave', () => { s.ptr.in = false; });
  canvas.addEventListener('pointerdown', (e) => { upd(e); s.burst = 1.4; s.ptr.down = true; s.ptr.sx = s.ptr.x; s.ptr.sy = s.ptr.y; s.ptr.dx = 0; s.ptr.dy = 0; try { canvas.setPointerCapture(e.pointerId); } catch {} });
  const up = (e) => {
    if (!s.ptr.down) return;
    s.ptr.down = false; upd(e); s.burst = 1.4;
    if (Math.hypot(s.ptr.x - s.ptr.sx, s.ptr.y - s.ptr.sy) < 6) s.ptr.click = true;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { s.ptr.down = false; });

  new ResizeObserver(() => resize(s)).observe(canvas);
  new IntersectionObserver((es) => { s.vis = es[0].isIntersecting; if (s.vis) { resize(s); ensureInstance(s); } }, { rootMargin: '80px' }).observe(canvas);
  resize(s);
  if (!started) { started = true; requestAnimationFrame(frame); }
  return {
    swap(f) { s.inst?.destroy?.(); s.inst = null; s.env = null; s.factory = f; ensureInstance(s); },
    kick() { s.burst = 1.4; },
    scene: s,
  };
}

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = (now - t0) / 1000;
  let active = 0;
  for (const s of scenes) {
    if (!s.vis || !s.inst) continue;
    if (REDUCED) { if (s.burst <= 0) continue; s.burst -= dt; }   // still frames, redrawn only while interacted with
    active++;
    s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    s.ctx.clearRect(0, 0, s.w, s.h);
    s.inst.draw(s.ctx, t, dt);
    s.ptr.dx = 0; s.ptr.dy = 0; s.ptr.click = false;
  }
  fpsFrames++;
  if (now - fpsClock > 1000) { stats.fps = Math.round((fpsFrames * 1000) / (now - fpsClock)); stats.active = active; fpsFrames = 0; fpsClock = now; }
}
window.__stats = stats;
