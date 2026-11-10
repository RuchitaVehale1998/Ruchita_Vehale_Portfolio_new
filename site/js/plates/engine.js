/* PLATE VII — a difference engine: four columns of number wheels tabulate f(n) = 5 + 3n + 2n² + n³
   by addition alone (logic seeded and checked by lib/codes.js differenceTable). Drag the crank. */
import { differenceTable } from '../lib/codes.js';
import { C, TAU, clamp, lerp, rgba, label, ink, line, arrow, corners, out, dim } from '../core.js';

const COEFF = [5, 3, 2, 1], NMAX = 40, DIG = 6;
const seed = () => differenceTable(COEFF, 0, 1)[0];       // [n, f, d1, d2, d3]

export default function engine(env) {
  const plate = env.canvas.closest('.plate');
  let n, cols, shown, rows, crank = 0, crankShow = 0, turned = 0, auto = false, accAuto = 0, flash = -9, addT = 0;
  function reset() { const s = seed(); n = s[0]; cols = s.slice(1); shown = [...cols]; rows = [[n, cols[0]]]; turned = 0; }
  reset();
  function turn(t) {
    cols[0] += cols[1]; cols[1] += cols[2]; cols[2] += cols[3]; n++;
    rows.push([n, cols[0]]); if (rows.length > 12) rows.shift();
    flash = t ?? env.now();
    if (n >= NMAX) { setTimeout(reset, 900); }
  }
  const api = {
    turn() { crank += TAU; },                       // the draw loop turns the engine once per full crank revolution
    auto() { if (env.reduced) { crank += TAU * 8; return false; } auto = !auto; return auto; },   // reduced motion: eight turns at once, no spinning
    reset() { reset(); },
  };

  function wheel(ctx, x, y, cw, ch, v, hot) {
    // DIG digit drums, drawn as a window with curved shading; rolling only while the lower digit carries
    const dw = cw / DIG;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, cw, ch); ink(ctx, hot ? 1 : 0.7, hot ? 1.6 : 1.1, hot ? C.w : C.w); ctx.strokeRect(x, y, cw, ch);
    for (let k = 0; k < DIG; k++) {
      const p = DIG - 1 - k, dx = x + k * dw;
      const digit = Math.floor(v / 10 ** p) % 10;
      const roll = p === 0 ? v % 1 : clamp(((v / 10 ** (p - 1)) % 10) - 9);
      ctx.save(); ctx.beginPath(); ctx.rect(dx + 1, y + 1, dw - 2, ch - 2); ctx.clip();
      for (const o of [-1, 0, 1, 2]) {
        const yy = y + ch / 2 + (o - roll) * ch * 0.62, d = (digit + o + 100) % 10, near = 1 - Math.min(1, Math.abs(o - roll) * 0.75);
        const lead = p > 0 && v < 10 ** p;                       // leading zero: dim, like an unlit wheel
        label(ctx, String(d), dx + dw / 2, yy + ch * 0.17, { size: ch * 0.52, align: 'center', color: o === 0 && roll < 0.5 || (o === 1 && roll >= 0.5) ? (hot ? C.w : lead ? C.g3 : C.w) : C.g3, alpha: (0.25 + 0.75 * near) * (lead ? 0.55 : 1) });
      }
      ctx.restore();
      if (k) { ink(ctx, 0.25, 1); line(ctx, dx, y, dx, y + ch); }
    }
    // curvature shading
    const g = ctx.createLinearGradient(0, y, 0, y + ch); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.3, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
  }

  function draw(ctx, t, dt) {
    const { w, h, ptr } = env;
    const narrow = w < 640;
    if (auto) { accAuto += dt; crank += dt * TAU * 1.1; }
    if (addT > 0) addT -= dt;
    /* crank drag → whole turns */
    const kx = narrow ? w - 46 : w * 0.9 - 6, ky = narrow ? 56 : h * 0.18, kr = narrow ? 26 : 34;
    if (ptr.down && Math.hypot(ptr.x - kx, ptr.y - ky) < kr * 3.2) crank += ptr.dx * 0.05 - ptr.dy * 0.0;
    while (crank - turned * TAU >= TAU) { turned++; turn(t); addT = 0.6; }
    if (crank < turned * TAU - TAU) crank = turned * TAU - TAU;
    for (let i = 0; i < 4; i++) shown[i] = lerp(shown[i], cols[i], clamp(dt * 12));
    crankShow = lerp(crankShow, crank, clamp(dt * 10));

    /* columns of wheels, right-most Δ³ feeding left */
    const names = ['f(n)', 'Δ¹', 'Δ²', 'Δ³'];
    const area = narrow ? w - 28 : w * 0.66, cw = (area - 3 * 30) / 4, ch = narrow ? 46 : Math.min(64, h * 0.14), x0 = 14, y0 = narrow ? 100 : 62;
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * (cw + 30), hot = t - flash < 0.45;
      wheel(ctx, x, y0, cw, ch, Math.max(0, shown[i]), hot && i < 3);
      label(ctx, names[i], x + cw / 2, y0 - 12, { size: 11, align: 'center', color: i === 0 ? C.w : C.g4 });
      // ruled column below the wheel
      ink(ctx, 0.25, 1); line(ctx, x + cw / 2, y0 + ch, x + cw / 2, y0 + ch + 20);
      if (i < 3) {
        const ax = x + cw + 30, ay = y0 + ch / 2, a = clamp(addT / 0.6);
        ctx.strokeStyle = a > 0 ? C.w : rgba(C.w, 0.5); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = a > 0 ? 2 : 1;
        arrow(ctx, ax - 4, ay, x + cw + 5, ay, 6);
        label(ctx, '+', x + cw + 15, ay - 8, { size: 11, align: 'center', color: a > 0 ? C.w : C.g3 });
      }
    }
    // the rule of the machine
    label(ctx, 'EACH TURN:  f += Δ¹   Δ¹ += Δ²   Δ² += Δ³   (ADDITION ONLY)', x0, y0 + ch + 44, { size: 10, color: C.g4 });
    label(ctx, `n = ${n}`, x0, y0 + ch + 66, { size: 14, color: C.w });

    /* printed table */
    const ty = narrow ? y0 + ch + 92 : y0 + ch + 100, rh = narrow ? 15 : 17, tx = x0, tw = narrow ? w - 28 : area;
    ink(ctx, 0.6, 1); line(ctx, tx, ty - 14, tx + tw, ty - 14);
    label(ctx, 'PRINTED TABLE', tx, ty - 22, { size: 9.5, color: C.g3, spacing: 2 });
    const maxRows = Math.floor((h - ty - 16) / rh);
    rows.slice(-maxRows).forEach(([nn, ff], i, arr) => {
      const y = ty + i * rh + 8, last = i === arr.length - 1;
      label(ctx, String(nn).padStart(3, ' '), tx + 4, y, { size: 11, color: last ? C.w : C.g3 });
      label(ctx, String(ff).padStart(7, ' '), tx + 56, y, { size: 11, color: last ? C.w : C.w });
      ctx.fillStyle = last ? rgba(C.w, 0.6) : rgba(C.w, 0.16); ctx.fillRect(tx + 130, y - 7, clamp(ff / 90000) * (tw - 140), 4);
    });

    /* crank */
    const ang = crankShow;
    ctx.strokeStyle = rgba(C.w, 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.stroke();
    ink(ctx, 1, 3, C.w); line(ctx, kx, ky, kx + Math.cos(ang) * kr, ky + Math.sin(ang) * kr);
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(kx + Math.cos(ang) * kr, ky + Math.sin(ang) * kr, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(kx, ky, 6, 0, TAU); ctx.fill(); ink(ctx, 1, 1.5); ctx.stroke();
    label(ctx, 'CRANK', kx, ky + kr + 22, { size: 10, align: 'center', color: C.g4 });
    label(ctx, 'DRAG ↔', kx, ky + kr + 36, { size: 9, align: 'center', color: C.g3 });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
