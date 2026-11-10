/* PLATE XIII — Enigma I (rotors I-II-III, reflector B, rings AAA, start AAA).
   Logic is in lib/enigma.js (tested: AAAAA → BDZGO). The red line is the real current path. */
import { Enigma } from '../lib/enigma.js';
import { C, MONO, TAU, clamp, rgba, label, ink, line, roundRect, corners, out } from '../core.js';

const ROWS = ['QWERTZUIO', 'ASDFGHJK', 'PYXCVBNML'];
const L = (i) => String.fromCharCode(65 + i);

export default function enigma(env) {
  const plate = env.canvas.closest('.plate');
  const input = plate.querySelector('#enigma-in');
  let m = new Enigma(), plain = '', cipher = '', lastKey = -1, lastOut = -1, path = null, pressedAt = -9;
  let auto = { text: input.value || 'HELLO RUCHITA', i: 0, next: 0.5 };

  function recompute(str) {
    m = new Enigma(); plain = ''; cipher = ''; path = null; lastKey = lastOut = -1;
    for (const ch of str.toUpperCase()) {
      if (ch < 'A' || ch > 'Z') continue;
      const r = m.press(ch.charCodeAt(0) - 65);
      plain += ch; cipher += L(r.out); lastKey = ch.charCodeAt(0) - 65; lastOut = r.out; path = r.path;
    }
    pressedAt = env.now();
    out(env, 'enigma-read', `<b>PLAIN</b>&nbsp;&nbsp; ${plain || '—'}<br><b>CIPHER</b> ${cipher || '—'}<br><b>ROTORS</b> ${m.pos.map(L).join(' ')}`);
  }
  recompute('');

  const api = {
    text(v) { auto = null; recompute(v); },
    clear() { auto = null; input.value = ''; recompute(''); },
  };

  const keyPos = [];   // for hit-testing the lamp board
  function draw(ctx, t) {
    const { w, h, ptr } = env;
    const narrow = w < 640;
    if (auto && t > auto.next) {
      auto.i++; recompute(auto.text.slice(0, auto.i)); auto.next = t + 0.24;
      if (auto.i >= auto.text.length) auto = null;
    }
    if (ptr.click) {
      const hit = keyPos.find((k) => Math.hypot(k.x - ptr.x, k.y - ptr.y) < k.r + 3);
      if (hit) { input.value = (input.value + hit.ch).slice(0, 40); api.text(input.value); }
    }
    const still = env.reduced;                                   // reduced motion: show the finished path / lit lamp, no reveal animation
    const age = still ? 0 : t - pressedAt, reveal = still ? 1 : clamp(age / 0.7);

    /* geometry */
    const xL = w * 0.09, xR = w * 0.93, span = xR - xL;
    const gx = [xR, xL + span * 0.74, xL + span * 0.47, xL + span * 0.22];   // g0 entry · g1 · g2 · g3 reflector face
    const wy0 = narrow ? 96 : 104, wy1 = narrow ? h * 0.5 : h * 0.6, rs = (wy1 - wy0) / 25;
    const rowY = (c) => wy0 + c * rs;

    /* rotor windows */
    const names = ['I', 'II', 'III'];
    for (let i = 0; i < 3; i++) {
      const mid = (gx[3 - i] + gx[2 - i]) / 2, wx = mid - 24;
      ctx.fillStyle = '#000'; ctx.fillRect(wx, 22, 48, 54); ink(ctx, 0.8, 1.2); ctx.strokeRect(wx, 22, 48, 54);
      const p = m.pos[i];
      label(ctx, L((p + 25) % 26), mid, 38, { size: 11, align: 'center', color: C.g3 });
      label(ctx, L(p), mid, 62, { size: 24, align: 'center', color: C.w });
      label(ctx, L((p + 1) % 26), mid, 74, { size: 9, align: 'center', color: C.g3 });
      ctx.fillStyle = C.red; ctx.fillRect(wx, 47, 3, 2); ctx.fillRect(wx + 45, 47, 3, 2);
      label(ctx, narrow ? names[i] : `ROTOR ${names[i]}`, mid, 90, { size: 9, align: 'center', color: C.g3, spacing: 1 });
    }
    label(ctx, narrow ? 'UKW' : 'REFLECTOR B', (xL + gx[3]) / 2, 90, { size: 9, align: 'center', color: C.g3, spacing: 1 });
    if (!narrow) label(ctx, 'KEYS / LAMPS', gx[0] - 4, 90, { size: 9, align: 'right', color: C.g3, spacing: 1 });

    /* stator rows (faint letters on the entry side) */
    for (let c = 0; c < 26; c++) label(ctx, L(c), gx[0] + 7, rowY(c) + 3, { size: 7.5, color: C.g3 });

    /* rotor internals: wires from the right face (row c) to the left face (row out) */
    const faces = [[gx[1], gx[0], 2], [gx[2], gx[1], 1], [gx[3], gx[2], 0]];  // [leftX, rightX, rotor index]
    for (const [xl, xr, ri] of faces) {
      ink(ctx, 0.5, 1, C.g3);
      ctx.strokeStyle = 'rgba(160,160,160,0.16)';
      ctx.beginPath();
      for (let c = 0; c < 26; c++) { const o = m._pass(ri, c, true); ctx.moveTo(xr, rowY(c)); ctx.lineTo(xl, rowY(o)); }
      ctx.stroke();
      ink(ctx, 0.7, 1.2); ctx.strokeRect(xl + 3, wy0 - 8, xr - xl - 6, wy1 - wy0 + 16);
    }
    // reflector arcs
    ctx.strokeStyle = 'rgba(160,160,160,0.2)'; ctx.lineWidth = 1;
    for (let c = 0; c < 26; c++) {
      const o = m.refl[c]; if (o < c) continue;
      const a = rowY(c), b = rowY(o), r = (b - a) / 2;
      ctx.beginPath(); ctx.moveTo(gx[3], a); ctx.bezierCurveTo(gx[3] - r * 0.9, a, gx[3] - r * 0.9, b, gx[3], b); ctx.stroke();
    }

    /* the live current path */
    if (path) {
      const xs = [gx[0], gx[1], gx[2], gx[3], gx[3], gx[2], gx[1], gx[0]];
      const pts = path.map((r, i) => [xs[i], rowY(r)]);
      const segs = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]];
      const total = segs.length, upto = reveal * total;
      ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = C.red; ctx.shadowBlur = 8;
      segs.forEach(([a, b], k) => {
        const f = clamp(upto - k); if (f <= 0) return;
        const [x0, y0] = pts[a], [x1, y1] = pts[b];
        ink(ctx, 1, k >= 4 ? 1.6 : 2.2, C.red);
        if (k === 3) { // through the reflector as a loop
          const r = Math.abs(y1 - y0) / 2;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 - r * 0.9, y0, x0 - r * 0.9, y0 + (y1 - y0), x0, y0 + (y1 - y0) * f); ctx.stroke();
        } else line(ctx, x0, y0, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
      });
      ctx.restore();
      ctx.fillStyle = C.red; for (const [x, y] of [pts[0], pts[7]]) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill(); }
    }

    /* lamp board / keyboard */
    keyPos.length = 0;
    const lr = clamp(w * 0.021, 8.5, 15), pitch = lr * 2.7, by = wy1 + (narrow ? 52 : 62);
    ROWS.forEach((row, ri) => {
      const rw = (row.length - 1) * pitch;
      [...row].forEach((ch, ci) => {
        const x = w / 2 - rw / 2 + ci * pitch, y = by + ri * (lr * 3.1), k = ch.charCodeAt(0) - 65;
        const lit = k === lastOut && age < 6, pressed = k === lastKey && age < 1.2;
        if (lit) { const g = ctx.createRadialGradient(x, y, 0, x, y, lr * 2.6); g.addColorStop(0, 'rgba(255,45,32,0.55)'); g.addColorStop(1, 'rgba(255,45,32,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, lr * 2.6, 0, TAU); ctx.fill(); }
        ctx.beginPath(); ctx.arc(x, y, lr, 0, TAU); ctx.fillStyle = lit ? C.red : '#000'; ctx.fill();
        ink(ctx, pressed ? 1 : 0.7, pressed ? 2 : 1.1, pressed ? C.w : C.w); ctx.stroke();
        label(ctx, ch, x, y + lr * 0.36, { size: lr * 0.95, align: 'center', color: lit ? '#000' : C.w });
        keyPos.push({ x, y, r: lr, ch });
      });
    });
    label(ctx, narrow ? 'ENIGMA I · TAP A KEY' : 'ENIGMA I · UKW-B · I–II–III · RINGS AAA', 14, h - 14, { size: 9.5, color: C.g3 });
    if (!narrow) label(ctx, 'CLICK A KEY', w - 14, h - 14, { size: 9.5, color: C.g3, align: 'right' });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
