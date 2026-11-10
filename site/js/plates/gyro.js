/* PLATE V — a three-gimbal gyroscope. The frame follows your tilt; the rotor's axis stays fixed in space
   (gimbal angles are solved so that it does), and an artificial horizon reports the frame's attitude. */
import { C, D2R, TAU, clamp, lerp, rgba, label, ink, line, corners, out, MONO } from '../core.js';

const mul = (a, b) => a.map((_, i) => [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]));
const Rx = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
const Ry = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]];
const Rz = (a) => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const app = (R, p) => [R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2], R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2], R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2]];
const T = (R) => [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];

export default function gyro(env) {
  const tgt = { roll: 12, pitch: -8, yaw: 20 }, cur = { ...tgt };
  const api = { roll(v) { tgt.roll = +v; }, pitch(v) { tgt.pitch = +v; }, yaw(v) { tgt.yaw = +v; } };
  const plate = env.canvas.closest('.plate');
  const slider = (call, v) => { const el = plate.querySelector(`input[data-call="${call}"]`); if (el) el.value = Math.round(v); };

  function draw(ctx, t, dt) {
    const { w, h, ptr } = env;
    const narrow = w < 640;
    if (ptr.down) {
      tgt.roll = clamp(tgt.roll + ptr.dx * 0.4, -60, 60); tgt.yaw = clamp(tgt.yaw + ptr.dx * 0.25, -90, 90); tgt.pitch = clamp(tgt.pitch - ptr.dy * 0.3, -45, 45);
      slider('roll', tgt.roll); slider('yaw', tgt.yaw); slider('pitch', tgt.pitch);
    }
    for (const k of ['roll', 'pitch', 'yaw']) cur[k] = lerp(cur[k], tgt[k], clamp(dt * 8));

    /* frame orientation, then the gimbal angles that keep the rotor axis along world-up */
    const Rb = mul(Ry(cur.yaw * D2R), mul(Rx(cur.pitch * D2R), Rz(cur.roll * D2R)));
    const u = app(T(Rb), [0, 1, 0]);                                  // world-up in frame coordinates
    const beta = Math.asin(clamp(u[0], -1, 1)), alpha = Math.atan2(-u[1], u[2]);
    const Ro = mul(Rb, Rx(alpha)), Ri = mul(Ro, Ry(beta));
    const spin = t * 9;

    const gcx = narrow ? w * 0.5 : w * 0.37, gcy = narrow ? h * 0.36 : h * 0.5, S = Math.min(narrow ? w * 0.34 : w * 0.24, h * (narrow ? 0.2 : 0.3));
    const view = mul(Rx(-0.5), Ry(-0.55));
    const P = (R, p) => { const v = app(view, app(R, p)); return [gcx + v[0] * S, gcy - v[1] * S, v[2]]; };
    const poly = (R, pts, col, a, lw, close = false) => {
      ctx.beginPath(); pts.forEach((p, i) => { const q = P(R, p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      if (close) ctx.closePath(); ink(ctx, a, lw, col); ctx.stroke();
    };
    const circ = (rad, plane, n = 56) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * TAU, c = Math.cos(a) * rad, s = Math.sin(a) * rad; return plane === 'xy' ? [c, s, 0] : plane === 'yz' ? [0, c, s] : [c, 0, s]; });
    const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

    /* fixed world reference: ground circle and a vertical dashed axis */
    ctx.save(); ctx.setLineDash([3, 5]); poly(I, circ(1.55, 'xz'), C.g3, 0.5, 1); poly(I, [[0, -1.3, 0], [0, 1.45, 0]], C.g4, 0.55, 1); ctx.restore();
    label(ctx, 'world up', P(I, [0, 1.45, 0])[0] + 8, P(I, [0, 1.45, 0])[1] + 3, { size: 9.5, color: C.g3 });

    /* frame (rotates with the base): rectangle, posts, pedestal */
    const fr = [[-1.12, -0.98, 0], [1.12, -0.98, 0], [1.12, 0.98, 0], [-1.12, 0.98, 0]];
    poly(Rb, fr, C.w, 0.85, 1.6, true);
    poly(Rb, [[-1.12, -0.98, 0.16], [1.12, -0.98, 0.16], [1.12, 0.98, 0.16], [-1.12, 0.98, 0.16]], C.w, 0.35, 1, true);
    for (const f of fr) poly(Rb, [f, [f[0], f[1], 0.16]], C.w, 0.35, 1);
    poly(Rb, [[-1.12, 0, 0], [-0.86, 0, 0]], C.w, 1, 2); poly(Rb, [[1.12, 0, 0], [0.86, 0, 0]], C.w, 1, 2);
    poly(Rb, [[0, -0.98, 0], [0, -1.3, 0]], C.w, 0.85, 2); poly(Rb, circ(0.5, 'xz').map((p) => [p[0], -1.3, p[2]]), C.w, 0.7, 1.4);

    /* outer gimbal (hinged to the frame about X), inner gimbal (hinged to the outer about its Y), rotor */
    poly(Ro, circ(0.86, 'xy'), C.w, 0.75, 1.4);
    poly(Ro, [[0, -0.86, 0], [0, -0.62, 0]], C.w, 0.9, 2); poly(Ro, [[0, 0.86, 0], [0, 0.62, 0]], C.w, 0.9, 2);
    poly(Ri, circ(0.62, 'yz'), C.g4, 0.9, 1.4);
    poly(Ri, [[0, 0, -0.62], [0, 0, 0.62]], C.g4, 0.9, 1.4);                              // rotor axle
    const disc = (z) => circ(0.45, 'xy').map((p) => [p[0], p[1], z]);
    poly(Ri, disc(0.05), C.w, 1, 1.8); poly(Ri, disc(-0.05), C.w, 0.55, 1.2);
    for (let k = 0; k < 8; k++) { const a = spin + (k / 8) * TAU; poly(Ri, [[0, 0, 0.05], [Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.05]], k === 0 ? C.red : C.w, k === 0 ? 1 : 0.6, k === 0 ? 2.2 : 1); }
    const q0 = P(Ri, [0, 0, 0]); ctx.fillStyle = C.w; ctx.beginPath(); ctx.arc(q0[0], q0[1], 2.6, 0, TAU); ctx.fill();
    // rotor axis, shown leaving the rotor along world-up
    const ax = app(Ri, [0, 0, 0.8]), ay = P(Ri, [0, 0, 0.8]);
    label(ctx, 'rotor axis', ay[0] + 10, ay[1] - 4, { size: 9.5, color: C.w });

    /* attitude indicator (artificial horizon) */
    const ar = narrow ? Math.min(w * 0.22, h * 0.15) : Math.min(w * 0.15, h * 0.3), ax0 = narrow ? w * 0.5 : w * 0.8, ay0 = narrow ? h * 0.8 : h * 0.5;
    ctx.save(); ctx.beginPath(); ctx.arc(ax0, ay0, ar, 0, TAU); ctx.clip();
    ctx.translate(ax0, ay0); ctx.rotate(-cur.roll * D2R);
    const py = cur.pitch * (ar / 38);
    ctx.fillStyle = '#000'; ctx.fillRect(-ar * 2, -ar * 2 + py, ar * 4, ar * 2);
    ctx.fillStyle = '#0e0e0e'; ctx.fillRect(-ar * 2, py, ar * 4, ar * 2);
    ctx.strokeStyle = 'rgba(241,241,241,0.22)'; ctx.lineWidth = 1;
    for (let x = -ar * 2; x < ar * 2; x += 7) { ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x - ar * 0.6, py + ar * 1.4); ctx.stroke(); }
    ink(ctx, 1, 1.6); line(ctx, -ar * 2, py, ar * 2, py);
    for (let p = -30; p <= 30; p += 10) { if (!p) continue; const yy = py - p * (ar / 38); ink(ctx, 0.6, 1); line(ctx, -ar * 0.28, yy, ar * 0.28, yy); label(ctx, String(Math.abs(p)), ar * 0.34, yy + 3, { size: 8, color: C.g4 }); }
    ctx.restore();
    ink(ctx, 0.9, 1.4); ctx.beginPath(); ctx.arc(ax0, ay0, ar, 0, TAU); ctx.stroke();
    ink(ctx, 1, 2.4, C.w); line(ctx, ax0 - ar * 0.55, ay0, ax0 - ar * 0.2, ay0); line(ctx, ax0 + ar * 0.2, ay0, ax0 + ar * 0.55, ay0); line(ctx, ax0 - ar * 0.2, ay0, ax0, ay0 + 6); line(ctx, ax0 + ar * 0.2, ay0, ax0, ay0 + 6);
    for (let a = -60; a <= 60; a += 15) { const an = (a - 90) * D2R; ink(ctx, 0.7, 1); line(ctx, ax0 + Math.cos(an) * ar, ay0 + Math.sin(an) * ar, ax0 + Math.cos(an) * (ar + (a % 30 ? 4 : 8)), ay0 + Math.sin(an) * (ar + (a % 30 ? 4 : 8))); }
    ctx.fillStyle = C.w; { const an = (-cur.roll - 90) * D2R, rr = ar - 2; ctx.beginPath(); ctx.moveTo(ax0 + Math.cos(an) * rr, ay0 + Math.sin(an) * rr); ctx.lineTo(ax0 + Math.cos(an - 0.07) * (rr - 11), ay0 + Math.sin(an - 0.07) * (rr - 11)); ctx.lineTo(ax0 + Math.cos(an + 0.07) * (rr - 11), ay0 + Math.sin(an + 0.07) * (rr - 11)); ctx.fill(); }
    label(ctx, 'ATTITUDE', ax0, ay0 + ar + 22, { size: 9.5, color: C.g3, align: 'center', spacing: 2 });
    label(ctx, `HDG ${String(Math.round(((cur.yaw % 360) + 360) % 360)).padStart(3, '0')}`, ax0, ay0 - ar - 14, { size: 10, color: C.w, align: 'center' });

    out(env, 'gyro-read', `<b>roll</b> ${cur.roll.toFixed(0)}° &nbsp; <b>pitch</b> ${cur.pitch.toFixed(0)}° &nbsp; <b>yaw</b> ${cur.yaw.toFixed(0)}°<br><span style="color:#6b6b6b">gimbal angles solved to hold the axis: ${(alpha / D2R).toFixed(0)}° / ${(beta / D2R).toFixed(0)}°</span>`);
    label(ctx, 'DRAG SIDEWAYS TO TILT', 14, h - 14, { size: 9.5, color: C.g3 });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
