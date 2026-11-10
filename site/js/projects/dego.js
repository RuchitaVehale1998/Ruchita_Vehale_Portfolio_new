/* DeGould — a car mesh in a Blender-style scene, a scan plane sweeping it, and each defect projected
   through a pinhole camera into a 2D frame:  p ~ K [R|t] P.  Illustrative model, not production data. */
import { C, TAU, clamp, rgba, label, ink, line, corners, grid, roundRect, tag } from '../core.js';

const PROF = [[-1, 0], [-1, 0.26], [-0.86, 0.34], [-0.55, 0.38], [-0.28, 0.62], [0.16, 0.64], [0.5, 0.4], [0.92, 0.34], [1, 0.24], [1, 0]];
const hw = (y) => 0.42 * (1 - 0.22 * (y / 0.64));
const yAt = (x) => {
  for (let i = 0; i < PROF.length - 1; i++) {
    const [xa, ya] = PROF[i], [xb, yb] = PROF[i + 1];
    if (xa !== xb && ((x >= xa && x <= xb) || (x <= xa && x >= xb))) return ya + ((x - xa) / (xb - xa)) * (yb - ya);
  }
  return 0.3;
};
const EDGES = (() => {
  const E = [], V = (i, s) => [PROF[i][0], PROF[i][1], s * hw(PROF[i][1])];
  for (let i = 0; i < PROF.length; i++) {
    E.push([V(i, -1), V(i, 0)], [V(i, 0), V(i, 1)]);
    if (i < PROF.length - 1) E.push([V(i, -1), V(i + 1, -1)], [V(i, 1), V(i + 1, 1)], [V(i, 0), V(i + 1, 0)]);
  }
  for (const wx of [-0.55, 0.55]) for (const s of [-1, 1]) {
    let prev = null;
    for (let k = 0; k <= 18; k++) { const a = (k / 18) * TAU, p = [wx + Math.cos(a) * 0.16, 0.16 + Math.sin(a) * 0.16, s * 0.43]; if (prev) E.push([prev, p]); prev = p; }
  }
  return E;
})();
const DEFECTS = [
  { name: 'hood', p: [0.66, yAt(0.66), 0.1] },
  { name: 'door', p: [-0.05, 0.3, hw(0.3)] },
  { name: 'roof', p: [-0.06, 0.64, -0.13] },
];
function makeProj(yaw, pitch, cx, cy, S, D = 3.3) {
  const a = Math.cos(yaw), b = Math.sin(yaw), c = Math.cos(pitch), d = Math.sin(pitch);
  return (p) => {
    const x1 = p[0] * a + p[2] * b, z1 = -p[0] * b + p[2] * a, y2 = p[1] * c - z1 * d, z2 = p[1] * d + z1 * c, k = S / (D - z2);
    return [cx + x1 * k, cy - (y2 - 0.3) * k, z2];
  };
}

export default function dego(env) {
  function wire(ctx, proj, a0) {
    ctx.lineWidth = 1;
    for (const [a, b] of EDGES) {
      const pa = proj(a), pb = proj(b), d = clamp(0.4 + (pa[2] + pb[2]) * 0.25 + 0.3);
      ctx.strokeStyle = rgba(C.w, a0 * d); ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    }
  }
  function draw(ctx, t) {
    const { w, h } = env, narrow = w < 640;
    grid(ctx, w, h, 28, 0.035);
    const act = Math.floor(t / 2.2) % DEFECTS.length;

    /* 3D view */
    const M = narrow ? { cx: w / 2, cy: h * 0.27, S: Math.min(w * 0.9, h * 0.66) } : { cx: w * 0.31, cy: h * 0.56, S: Math.min(w * 0.55, h * 1.6) };
    const P = makeProj(t * 0.45, 0.32, M.cx, M.cy, M.S);
    label(ctx, 'BLENDER SCENE · 3D MESH', 18, 26, { size: 9.5, color: C.g3, spacing: 1.5 });
    ink(ctx, 0.08, 1);
    for (const rr of [0.9, 1.3]) { ctx.beginPath(); for (let k = 0; k <= 48; k++) { const a = (k / 48) * TAU, p = P([Math.cos(a) * rr * 1.1, 0, Math.sin(a) * rr]); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
    wire(ctx, P, 0.75);
    // scan plane
    const xs = Math.sin(t * 0.9) * 0.92, ys = yAt(xs), hh = hw(ys);
    const loop = [[xs, 0, -0.44], [xs, ys, -hh], [xs, ys, hh], [xs, 0, 0.44]].map(P);
    ctx.beginPath(); loop.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = rgba(C.w, 0.1); ctx.fill(); ink(ctx, 0.9, 1.4); ctx.stroke();

    /* camera frame */
    const F = narrow ? { x: 14, y: h * 0.57, w: w - 28, h: h * 0.34 } : { x: w * 0.6 + 12, y: 46, w: w * 0.4 - 30, h: h - 100 };
    roundRect(ctx, F.x, F.y, F.w, F.h, 8); ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fill(); ink(ctx, 0.35, 1); ctx.stroke();
    label(ctx, 'CAMERA FRAME · 2D', F.x, F.y - 10, { size: 9.5, color: C.g3, spacing: 1.5 });
    ctx.save(); roundRect(ctx, F.x, F.y, F.w, F.h, 8); ctx.clip();
    const CP = makeProj(-0.62, 0.2, F.x + F.w / 2, F.y + F.h * 0.6, Math.min(F.w * 1.45, F.h * 2.1), 3.6);
    wire(ctx, CP, 0.4);

    DEFECTS.forEach((d, i) => {
      const on = i === act, p3 = P(d.p), p2 = CP(d.p), col = on ? C.red : C.w;
      ctx.restore();
      ink(ctx, on ? 1 : 0.55, on ? 1.8 : 1.1, col); ctx.beginPath(); ctx.arc(p3[0], p3[1], on ? 7 : 5, 0, TAU); ctx.stroke();
      ctx.save(); ctx.setLineDash([2, 4]); ink(ctx, on ? 0.7 : 0.25, 1, col);
      ctx.beginPath(); ctx.moveTo(p3[0], p3[1]); ctx.bezierCurveTo(p3[0] + 50, p3[1] - 24, p2[0] - 60, p2[1] + 12, p2[0], p2[1]); ctx.stroke(); ctx.restore();
      ctx.save(); roundRect(ctx, F.x, F.y, F.w, F.h, 8); ctx.clip();
      const bs = narrow ? 11 : 14;
      ink(ctx, on ? 1 : 0.55, on ? 1.8 : 1.1, col); ctx.strokeRect(p2[0] - bs, p2[1] - bs * 0.75, bs * 2, bs * 1.5);
      label(ctx, `defect · ${d.name}`, p2[0] - bs, p2[1] - bs * 0.75 - 4, { size: 8.5, color: on ? C.w : C.g4 });
    });
    ctx.restore();

    label(ctx, 'p ~ K [R | t] P', F.x, F.y + F.h + 20, { size: 10.5, color: C.w });
    if (!narrow) label(ctx, 'scan · localise · project', 18, h - 14, { size: 9.5, color: C.g3 });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw };
}
