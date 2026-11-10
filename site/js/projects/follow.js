/* Leader–follower robots — illustrative toy model. Line-following robots with reflectance-sensor bars (QTR-RC style).
   Same leader, two convoys: noisy gap sensing + P control (outer) vs filtered sensing + feed-forward + PID (inner).
   The plot is a live toy simulation — it is not the published 97.93% result. */
import { C, TAU, clamp, lerp, rgba, rng, gauss, label, ink, line, corners, grid, roundRect } from '../core.js';

function makeTrack(a, b, n = 6) {
  const pts = [], cum = [0], N = 360;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * TAU, c = Math.cos(th), s = Math.sin(th), x = Math.sign(c) * Math.abs(c) ** (2 / n) * a, y = Math.sign(s) * Math.abs(s) ** (2 / n) * b;
    pts.push([x, y]); if (i) cum.push(cum[i - 1] + Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]));
  }
  const L = cum[N];
  const at = (u) => {
    u = ((u % 1) + 1) % 1; const d = u * L; let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; cum[m] < d ? (lo = m) : (hi = m); }
    const k = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return [lerp(pts[lo][0], pts[hi][0], k), lerp(pts[lo][1], pts[hi][1], k), Math.atan2(pts[hi][1] - pts[lo][1], pts[hi][0] - pts[lo][0])];
  };
  return { pts, at };
}

export default function follow(env) {
  const r = rng(61), D = 0.075, V0 = 0.05;
  const mk = (name, a, sig, fused, scale) => ({ name, a, sig, fused, scale, rob: [0, 1, 2].map((_, i) => ({ u: -i * D, v: V0, I: 0, f: 0 })), err: [] });
  const lanes = [mk('baseline', 0.45, 0.012, false, 1), mk('fused', 1, 0.004, true, 0.68)];
  let sim = 0, track = null, geo = null, acc = 0;

  function layout() {
    const { w, h } = env, narrow = w < 720, k = `${w}x${h}`;
    if (narrow) { const top = 50, th = (h - top) * 0.46; return { narrow, k, cx: w / 2, cy: top + th / 2, a: (w - 28) * 0.43, b: th * 0.42, px0: 20, px1: w - 20, py0: top + th + 30, py1: h - 78 }; }
    const tw = w * 0.6, th = h - 60; return { narrow, k, cx: w * 0.3 + 12, cy: 44 + th / 2, a: tw * 0.43, b: th * 0.42, px0: w * 0.64, px1: w - 18, py0: 56, py1: h - 100 };
  }
  function ensure() { const g = layout(); if (geo && geo.k === g.k) return; geo = g; track = lanes.map((ln) => makeTrack(g.a * ln.scale, g.b * ln.scale)); }
  function step(dt) {
    sim += dt;
    for (const ln of lanes) {
      const L = ln.rob, vL = V0 * (1 + 0.5 * Math.sin(sim * 0.9) + 0.25 * Math.sin(sim * 2.3));
      L[0].v = vL; L[0].u += vL * dt;
      for (let j = 1; j < L.length; j++) {
        const q = L[j], p = L[j - 1], m = (p.u - q.u) + gauss(r) * ln.sig; let cmd;
        if (ln.fused) { q.f += (m - q.f) * clamp(dt * 12); const e = q.f - D; q.I = clamp(q.I + e * dt, -0.05, 0.05); cmd = p.v + 1.4 * e + 1.2 * q.I; }
        else cmd = V0 + 2.4 * (m - D);
        q.v += (cmd - q.v) * dt * 3; q.u += q.v * dt;
      }
      ln.err.push(((L[0].u - L[1].u) - D) / D * 100); if (ln.err.length > 400) ln.err.shift();
    }
  }
  function draw(ctx, t, dt) {
    const { w, h } = env; ensure(); acc += dt; while (acc > 1 / 60) { step(1 / 60); acc -= 1 / 60; }
    const { cx, cy, px0, px1, py0, py1, narrow } = geo;
    grid(ctx, w, h, 28, 0.03);
    label(ctx, w < 400 ? 'LINE-FOLLOWING ROBOTS' : 'LINE-FOLLOWING ROBOTS · QTR-RC SENSOR BARS', 16, 24, { size: 9.5, color: C.g3, spacing: 1.2 });
    lanes.forEach((ln, li) => {
      const tr = track[li], hot = ln.fused;
      ctx.beginPath(); tr.pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x, cy + y) : ctx.moveTo(cx + x, cy + y)));
      ink(ctx, hot ? 0.28 : 0.14, 7); ctx.stroke(); ink(ctx, hot ? 0.55 : 0.3, 1); ctx.save(); ctx.setLineDash([4, 5]); ctx.stroke(); ctx.restore();
      ln.rob.forEach((q, i) => {
        if (!i) return; const a = tr.at(ln.rob[i - 1].u), b = tr.at(q.u);
        ink(ctx, 0.35, 1); line(ctx, cx + a[0], cy + a[1], cx + b[0], cy + b[1]);
      });
      ln.rob.forEach((q, i) => {
        const [x, y, a] = tr.at(q.u);
        ctx.save(); ctx.translate(cx + x, cy + y); ctx.rotate(a);
        roundRect(ctx, -9, -6, 18, 12, 3); ctx.fillStyle = i === 0 ? C.w : hot ? rgba(C.w, 0.85) : rgba(C.w, 0.35); ctx.fill();
        ctx.fillStyle = '#000'; for (let k = 0; k < 5; k++) ctx.fillRect(7, -5 + k * 2.4, 1.6, 1.4);     // reflectance sensor bar
        if (i === 0) { ink(ctx, 1, 1.2, C.red); ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke(); }
        ctx.restore();
      });
    });
    const mid = (py0 + py1) / 2;
    label(ctx, 'GAP ERROR · NORMALISED · TOY SIMULATION', px0, py0 - 12, { size: 9, color: C.g3 });
    for (const v of [-1, -0.5, 0, 0.5, 1]) { ink(ctx, v ? 0.08 : 0.3, 1); line(ctx, px0, mid - v * (py1 - py0) / 2, px1, mid - v * (py1 - py0) / 2); }
    lanes.forEach((ln) => {
      ctx.beginPath(); ln.err.forEach((e, i) => { const x = px0 + (i / 400) * (px1 - px0), y = mid - clamp(e / 60, -1, 1) * (py1 - py0) / 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ink(ctx, ln.fused ? 1 : 0.45, 1.5); ctx.stroke();
    });
    [['outer · noisy sensing + P only', 0.45], ['inner · filtered + feed-forward + PID', 1]].forEach(([s, a], i) => { ink(ctx, a, 2); line(ctx, px0, py1 + 20 + i * 18, px0 + 10, py1 + 20 + i * 18); label(ctx, s, px0 + 16, py1 + 24 + i * 18, { size: 9.5, color: a === 1 ? C.w : C.g4 }); });
    label(ctx, w < 340 ? 'illustrative · published: 97.93%' : 'illustrative · the published result is 97.93%', px0, py1 + 62, { size: 9, color: C.g3 });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, resize() { geo = null; } };
}
