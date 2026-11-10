/* FIG. 0 — a LiDAR scan above a Turing tape.
   Top: a street being mapped point by point (hero-lidar.js). Bottom: a flat tape that counts in binary, its read head
   marked by one small red tooth. A vertical centre line ties the scan to the head. */
import { PROGRAMS } from '../lib/tm.js';
import { C, clamp, lerp, rgba, label, ink, line, centerline, corners, REDUCED } from '../core.js';
import lidar from './hero-lidar.js';

const N = 36;
const idx = (i) => ((i % N) + N) % N;

export default function hero(env) {
  const rules = PROGRAMS.increment.rules;

  /* the machine: an 8-bit counter, most-significant bit at cell 0 */
  const cells = Array(N).fill(' ');
  let value = 0, state = 'q0', head = 0, halted = false, steps = 0, wait = 0.6, acc = 0;
  const load = (v) => { cells.fill(' '); for (let i = 0; i < 8; i++) cells[i] = (v >> (7 - i)) & 1 ? '1' : '0'; };
  load(0);
  function step() {
    if (halted) return;
    const r = rules[`${state},${cells[idx(head)]}`];
    if (!r) { halted = true; return; }
    cells[idx(head)] = r[0]; head += r[1] === 'R' ? 1 : -1; state = r[2]; steps++;
    if (state === 'H') { halted = true; wait = 0.9; }
  }
  function rewind() {
    if (cells[idx(-1)] === '1') { load(0); value = 0; }
    else value = parseInt(cells.slice(0, 8).map((c) => (c === '1' ? 1 : 0)).join(''), 2);
    head = 0; state = 'q0'; halted = false;
  }

  const art = lidar(env);
  let pos = 0, artT0 = null;

  function draw(ctx, t, dt) {
    const { w, h } = env;
    const cx = w / 2;

    /* machine clock */
    if (!REDUCED || t < 0.05) {
      acc += dt;
      if (halted) { wait -= dt; if (wait <= 0) rewind(); }
      else if (acc >= 0.36) { acc = 0; step(); }
    }
    pos = lerp(pos, head, clamp(dt * 8));

    const ty0 = h * 0.8, cs = Math.min(56, (w - 36) / 10), tapeY = ty0 + 8;
    const R = { x: 18, y: 24, w: w - 36, h: ty0 - 24 - 44 };

    centerline(ctx, cx, 8, cx, h - 8, 0.2);
    corners(ctx, w, h, 8, 12, 0.4);

    if (artT0 === null) artT0 = t;
    art.draw(ctx, REDUCED ? 2 : t - artT0, dt, R);

    /* plumb line to the read head, then the flat tape */
    ink(ctx, 0.5, 1, C.w); ctx.save(); ctx.setLineDash([2, 4]); line(ctx, cx, R.y + R.h + 6, cx, ty0 - 22); ctx.restore();
    // head: a bracket over the cell, one small red tooth
    ink(ctx, 1, 1.4, C.w); ctx.beginPath(); ctx.moveTo(cx - cs / 2 - 4, ty0 - 14); ctx.lineTo(cx - cs / 2 - 4, ty0 - 22); ctx.lineTo(cx + cs / 2 + 4, ty0 - 22); ctx.lineTo(cx + cs / 2 + 4, ty0 - 14); ctx.stroke();
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(cx - 6, ty0 - 22); ctx.lineTo(cx + 6, ty0 - 22); ctx.lineTo(cx, ty0 - 12); ctx.fill();
    label(ctx, halted ? 'HALT' : state, cx, ty0 - 30, { size: 10.5, color: C.w, align: 'center' });

    const vis = Math.ceil(w / cs / 2) + 2;
    for (let k = -vis; k <= vis; k++) {
      const j = Math.round(pos) + k, x = cx + (j - pos) * cs;
      if (x < -cs || x > w + cs) continue;
      const s = cells[idx(j)], isHead = j === head, fade = clamp(1 - Math.abs(x - cx) / (w * 0.56));
      ctx.fillStyle = isHead ? 'rgba(241,241,241,0.12)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(x - cs / 2 + 1, tapeY, cs - 2, cs);
      ctx.strokeStyle = isHead ? C.w : rgba(C.w, 0.15 + 0.35 * fade); ctx.lineWidth = isHead ? 1.6 : 1;
      ctx.strokeRect(x - cs / 2 + 1, tapeY, cs - 2, cs);
      label(ctx, s === ' ' ? '·' : s, x, tapeY + cs * 0.66, { size: cs * 0.5, align: 'center', color: isHead ? C.w : s === ' ' ? C.g3 : C.g4, alpha: 0.25 + 0.75 * fade });
    }
    const bits = cells.slice(0, 8).map((c) => (c === ' ' ? '·' : c)).join('');
    label(ctx, `TAPE  ·  BINARY COUNTER  ${bits}  =  ${halted && state === 'H' ? '…' : value}`, 18, h - 14, { size: 9.5, color: C.g3 });
    label(ctx, `STEP ${steps}`, w - 18, h - 14, { size: 9.5, color: C.g3, align: 'right' });
  }

  return { draw };
}
