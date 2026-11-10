/* FIG. 0 — a Turing tape wrapped round a sphere's equator, running a binary counter,
   a Bloch-style state vector (illustrative: θ from the symbol under the head, φ from the head position),
   and a dithered eye that watches the cursor. */
import { createEye } from '../lib/eye.js';
import { PROGRAMS } from '../lib/tm.js';
import { C, MONO, TAU, D2R, clamp, lerp, rgba, label, ink, line, circle, dim, corners, REDUCED } from '../core.js';

const N = 36, DELTA = TAU / N, RHO = 1.2;
const idx = (i) => ((i % N) + N) % N;
const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c]; };
const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };

export default function hero(env) {
  const small = env.small;
  const eye = createEye(small ? 160 : 240, small ? 107 : 160);
  const rules = PROGRAMS.increment.rules;

  /* the machine: 8-bit counter, MSB at cell 0 */
  const cells = Array(N).fill(' ');
  let value = 0, state = 'q0', head = 0, halted = false, steps = 0, wait = 0.6, acc = 0, last = '';
  const load = (v) => { cells.fill(' '); for (let i = 0; i < 8; i++) cells[i] = (v >> (7 - i)) & 1 ? '1' : '0'; };
  load(0);
  function step() {
    if (halted) return;
    const sym = cells[idx(head)], r = rules[`${state},${sym}`];
    if (!r) { halted = true; return; }
    cells[idx(head)] = r[0]; head += r[1] === 'R' ? 1 : -1; state = r[2]; steps++; last = `${state}`;
    if (state === 'H') { halted = true; wait = 0.9; }
  }
  function rewind() {
    if (cells[idx(-1)] === '1') { load(0); value = 0; }
    else value = parseInt(cells.slice(0, 8).map((c) => (c === '1' ? 1 : 0)).join(''), 2);
    head = 0; state = 'q0'; halted = false;
  }

  /* view + interaction */
  let dragYaw = 0, dragPitch = 0, ringAngle = 0, th = 0.3, ph = 0, gx = 0, gy = 0, blink = 0, nextBlink = 2.5, eyeTick = 0, eyeImg = null;
  let mx = 0, my = 0;
  const onMove = (e) => { mx = e.clientX; my = e.clientY; };
  addEventListener('pointermove', onMove);

  function draw(ctx, t, dt) {
    const { w, h, ptr } = env;
    const cx = w / 2, cy = h * 0.47, R = Math.min(w, h) * 0.285;
    if (ptr.down) { dragYaw += ptr.dx * 0.008; dragPitch = clamp(dragPitch + ptr.dy * 0.004, -0.3, 0.3); }
    const yaw = t * 0.1 + dragYaw, pitch = 0.42 + dragPitch;
    const V = (p, a = yaw) => rotX(rotY(p, a), pitch);
    const Sx = (v, k = 1) => cx + v[0] * R * k, Sy = (v, k = 1) => cy - v[1] * R * k;

    /* ── machine clock ── */
    if (!REDUCED || t < 0.05) {
      acc += dt;
      if (halted) { wait -= dt; if (wait <= 0) rewind(); }
      else if (acc >= 0.34) { acc = 0; step(); }
    }
    ringAngle = lerp(ringAngle, head * DELTA, clamp(dt * 7));
    const sym = cells[idx(head)];
    const tgtTh = sym === '1' ? 0.72 * Math.PI : sym === '0' ? 0.28 * Math.PI : 0.5 * Math.PI;
    th = lerp(th, tgtTh, clamp(dt * 4)); ph = lerp(ph, head * 0.55 + 0.4, clamp(dt * 4));

    /* ── registration ring + ticks ── */
    ctx.save(); ctx.translate(cx, cy);
    ink(ctx, 0.35, 1, C.g3);
    circle(ctx, 0, 0, R * 1.62);
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * TAU, long = i % 10 === 0, mid = i % 5 === 0, r0 = R * 1.62, r1 = r0 + (long ? 11 : mid ? 7 : 3.5);
      ink(ctx, long ? 0.7 : 0.3, 1, C.g4);
      line(ctx, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
    }
    ctx.restore();
    for (const [deg, tx, ty, al] of [[0, 0, -1, 'center'], [90, 1, 0, 'left'], [180, 0, 1, 'center'], [270, -1, 0, 'right']]) {
      label(ctx, deg + '°', cx + tx * (R * 1.62 + 22), cy + ty * (R * 1.62 + 22) + 3.5, { size: 9, color: C.g3, align: al });
    }
    // red arc marker on the ring that follows the head
    ctx.save(); ink(ctx, 1, 1.6, C.red);
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.62, Math.PI / 2 - 0.12, Math.PI / 2 + 0.12); ctx.stroke(); ctx.restore();

    /* ── back half of the tape ring ── */
    const ringCells = [];
    for (let i = 0; i < N; i++) {
      const a = i * DELTA - ringAngle;
      const c = rotX([RHO * Math.sin(a), 0, RHO * Math.cos(a)], pitch);
      ringCells.push({ i, a, c, front: c[2] > 0 });
    }
    const drawCell = (k, glyph) => {
      const { a, c } = k;
      const T = rotX([Math.cos(a), 0, -Math.sin(a)], pitch), U = rotX([0, 1, 0], pitch);
      const sx = Sx(c), sy = Sy(c);
      const cw = RHO * DELTA * 100 * 0.93, chh = 19;
      ctx.save();
      ctx.transform((T[0] * R) / 100, (-T[1] * R) / 100, (-U[0] * R) / 100, (U[1] * R) / 100, sx, sy);
      const fr = clamp(Math.cos(a) * 1.4 + 0.15);
      const isHead = k.i === idx(head);
      if (glyph) {
        ctx.fillStyle = isHead ? 'rgba(255,45,32,0.22)' : 'rgba(8,8,8,0.88)';
        ctx.fillRect(-cw / 2, -chh / 2, cw, chh);
        ctx.strokeStyle = isHead ? C.red : rgba(C.w, 0.25 + 0.55 * fr); ctx.lineWidth = (isHead ? 1.4 : 1) * (100 / R);
        ctx.strokeRect(-cw / 2, -chh / 2, cw, chh);
        const s = cells[k.i];
        ctx.fillStyle = isHead ? C.red : rgba(C.w, (s === ' ' ? 0.2 : 0.9) * (0.35 + 0.65 * fr));
        ctx.font = `500 12px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s === ' ' ? '·' : s, 0, 1);
      } else {
        ctx.strokeStyle = 'rgba(241,241,241,0.12)'; ctx.lineWidth = 100 / R; ctx.strokeRect(-cw / 2, -chh / 2, cw, chh);
      }
      ctx.restore();
    };
    ringCells.filter((k) => !k.front).forEach((k) => drawCell(k, false));

    /* ── sphere wireframe ── */
    const wire = (pts, a0, a1, lw = 1) => {
      let back = [], front = [];
      pts.forEach((p, i) => {
        if (!i) return;
        const v0 = V(pts[i - 1]), v1 = V(p);
        (v0[2] + v1[2] >= 0 ? front : back).push([v0, v1]);
      });
      for (const [list, al] of [[back, a0], [front, a1]]) {
        ctx.beginPath();
        for (const [v0, v1] of list) { ctx.moveTo(Sx(v0), Sy(v0)); ctx.lineTo(Sx(v1), Sy(v1)); }
        ctx.strokeStyle = rgba(C.w, al); ctx.lineWidth = lw; ctx.stroke();
      }
    };
    for (const lat of [-60, -30, 0, 30, 60]) {
      const pts = []; const f = lat * D2R;
      for (let a = 0; a <= 360; a += 6) pts.push([Math.cos(f) * Math.sin(a * D2R), Math.sin(f), Math.cos(f) * Math.cos(a * D2R)]);
      wire(pts, lat === 0 ? 0.18 : 0.07, lat === 0 ? 0.6 : 0.3, lat === 0 ? 1.3 : 1);
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const pts = [], l = lon * D2R;
      for (let a = -90; a <= 90; a += 6) { const f = a * D2R; pts.push([Math.cos(f) * Math.sin(l), Math.sin(f), Math.cos(f) * Math.cos(l)]); }
      wire(pts, 0.06, 0.26);
    }
    ink(ctx, 0.5, 1, C.w); circle(ctx, cx, cy, R);

    /* axis + poles */
    const top = V([0, 1.34, 0], 0), bot = V([0, -1.34, 0], 0);
    ctx.save(); ctx.setLineDash([3, 4]); ink(ctx, 0.5, 1, C.g4); line(ctx, Sx(bot), Sy(bot), Sx(top), Sy(top)); ctx.restore();
    label(ctx, '|0⟩', Sx(top) + 8, Sy(top) + 3, { size: 12, color: C.w });
    label(ctx, '|1⟩', Sx(bot) + 8, Sy(bot) + 3, { size: 12, color: C.w });

    /* Bloch vector */
    const v = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
    const tip = V(v), eq = V([v[0], 0, v[2]]), o = V([0, 0, 0]);
    ctx.save(); ctx.setLineDash([2, 4]); ink(ctx, 0.5, 1, C.g4);
    line(ctx, Sx(tip), Sy(tip), Sx(eq), Sy(eq)); line(ctx, Sx(o), Sy(o), Sx(eq), Sy(eq)); ctx.restore();
    ink(ctx, 1, 2, C.red); line(ctx, Sx(o), Sy(o), Sx(tip), Sy(tip));
    const ang = Math.atan2(Sy(tip) - Sy(o), Sx(tip) - Sx(o));
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(Sx(tip), Sy(tip));
    ctx.lineTo(Sx(tip) - 11 * Math.cos(ang - 0.35), Sy(tip) - 11 * Math.sin(ang - 0.35));
    ctx.lineTo(Sx(tip) - 11 * Math.cos(ang + 0.35), Sy(tip) - 11 * Math.sin(ang + 0.35)); ctx.fill();
    label(ctx, '|ψ⟩', Sx(tip) + 10, Sy(tip) - 6, { size: 12, color: C.red });

    /* ── the eye (in front of the sphere) ── */
    if (!REDUCED) {
      const rect = env.canvas.getBoundingClientRect();
      const ex = rect.left + cx, ey = rect.top + cy;
      const tx = clamp((mx - ex) / Math.max(300, innerWidth * 0.3), -1, 1), ty = clamp(-(my - ey) / Math.max(240, innerHeight * 0.3), -1, 1);
      gx = lerp(gx, mx ? tx : Math.sin(t * 0.35) * 0.6, clamp(dt * 6)); gy = lerp(gy, mx ? ty : Math.cos(t * 0.27) * 0.3, clamp(dt * 6));
    }
    nextBlink -= dt;
    if (nextBlink < 0) { blink = 0.0001; nextBlink = 2.5 + Math.random() * 3.5; }
    let open = 1;
    if (blink > 0) { blink += dt / 0.2; if (blink >= 1) blink = 0; else open = Math.abs(1 - 2 * blink) ** 1.4; }
    eyeTick += dt;
    if (!eyeImg || eyeTick > 1 / 30 || REDUCED) { eyeImg = eye.render(gx, gy, open, t); eyeTick = 0; }
    const ew = R * 1.5, eh = ew * (eye.H / eye.W);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(eyeImg, cx - ew / 2, cy - R * 0.02 - eh / 2, ew, eh);

    /* ── front half of the tape ring + head ── */
    ringCells.filter((k) => k.front).sort((a, b) => a.c[2] - b.c[2]).forEach((k) => drawCell(k, true));
    const fc = rotX([0, 0, RHO], pitch), hx = Sx(fc), hy = Sy(fc) + 15;
    ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.moveTo(hx - 17, hy + 20); ctx.lineTo(hx + 17, hy + 20); ctx.lineTo(hx + 8, hy); ctx.lineTo(hx - 8, hy); ctx.closePath(); ctx.fill();
    label(ctx, halted ? 'HALT' : `q${state.replace('q', '')}`, hx, hy + 14.5, { size: 10.5, color: '#000', align: 'center' });
    label(ctx, `HEAD · step ${steps}`, hx, hy + 36, { size: 9.5, color: C.red, align: 'center' });

    /* readouts */
    const bits = cells.slice(0, 8).map((c) => (c === ' ' ? '·' : c)).join('');
    label(ctx, `COUNTER  ${bits}  =  ${halted && state === 'H' ? '…' : value}`, 16, h - 16, { size: 10, color: C.g4 });
    label(ctx, 'DRAG TO TURN THE SPHERE', w - 16, h - 16, { size: 10, color: C.g3, align: 'right' });
    dim(ctx, cx - R, cy + R * 1.92, cx + R, cy + R * 1.92, 'UNIT SPHERE  r = 1', { size: 9 });
    corners(ctx, w, h, 8, 12, 0.35);
  }

  return { draw, destroy() { removeEventListener('pointermove', onMove); } };
}
