/* PLATE IV — a sea chart that draws itself. The ship navigates by dead reckoning (drift grows, the red ellipse swells);
   a fix on a beacon collapses the error and snaps the already-charted coast back into place — loop closure.
   Other vessels are seen but never charted: the dynamic-object problem, in ink. */
import { C, TAU, D2R, clamp, lerp, rgba, rng, gauss, label, ink, line, corners, hatch, centerline } from '../core.js';

function resample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / step));
    for (let k = 0; k < n; k++) out.push([lerp(x0, x1, k / n), lerp(y0, y1, k / n)]);
  }
  out.push(pts[pts.length - 1]); return out;
}

export default function chart(env) {
  const r = rng(8);
  /* world in unit coordinates, scaled to the canvas each frame */
  const north = [], south = [], island = [];
  for (let i = 0; i <= 24; i++) { const x = i / 24; north.push([x, 0.2 + 0.07 * Math.sin(x * 9) + 0.05 * Math.sin(x * 22 + 1) - 0.1 * Math.exp(-((x - 0.5) ** 2) / 0.02) * 0]); }
  for (let i = 0; i <= 24; i++) { const x = i / 24; south.push([x, 0.82 - 0.06 * Math.sin(x * 7 + 2) - 0.045 * Math.sin(x * 19) + 0.06 * Math.exp(-((x - 0.82) ** 2) / 0.012)]); }
  for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU; island.push([0.5 + Math.cos(a) * (0.1 + 0.025 * Math.sin(a * 3 + 1)), 0.5 + Math.sin(a) * (0.085 + 0.02 * Math.sin(a * 4))]); }
  const coasts = [north, south, island].map((c) => resample(c, 0.012));
  const pts = coasts.flatMap((c, ci) => c.map(([x, y], i) => ({ x, y, c: ci, i, seen: false, dx: 0, dy: 0, k: 1, decay: false })));

  let phi = -Math.PI / 2, drift = { x: 0, y: 0 }, sinceFix = 0, fixAt = -9, trail = [], trailClock = 0, fixes = 0;
  let beacons = [{ x: 0.2, y: 0.24 }, { x: 0.8, y: 0.76 }];
  const others = [{ x: -0.1, y: 0.4, vx: 0.05, vy: 0.003, s: 1 }, { x: 1.1, y: 0.62, vx: -0.04, vy: -0.002, s: -1 }];

  function draw(ctx, t, dt) {
    const { w, h, ptr } = env;
    const U = (x, y) => [x * w, y * h], K = Math.min(w, h);
    if (ptr.click) { beacons.push({ x: ptr.x / w, y: ptr.y / h }); if (beacons.length > 5) beacons.splice(2, 1); }

    /* sim */
    phi += (TAU / 26) * dt;
    const px = 0.5 + 0.34 * Math.cos(phi), py = 0.5 + 0.18 * Math.sin(phi);
    sinceFix += dt;
    const closing = t - fixAt < 1;
    if (closing) { const f = Math.exp(-dt * 5); drift.x *= f; drift.y *= f; }
    else { drift.x += (0.004 + (r() - 0.5) * 0.02) * dt * 5; drift.y += (-0.003 + (r() - 0.5) * 0.02) * dt * 5; }
    const ex = px + drift.x, ey = py + drift.y;
    for (const o of others) { o.x += o.vx * dt; o.y += o.vy * dt; if (o.x > 1.15 || o.x < -0.15) { o.x = o.s > 0 ? -0.1 : 1.1; } }
    // chart the coast within sensing range (stored at the *estimated* offset → smears while lost)
    const range = 0.17;
    for (const p of pts) if (!p.seen && Math.hypot((p.x - px) * w, (p.y - py) * h) < range * K) { p.seen = true; p.dx = drift.x; p.dy = drift.y; p.k = 1; }
    // fix on a beacon
    if (sinceFix > 3.5) {
      const b = beacons.find((q) => Math.hypot((q.x - px) * w, (q.y - py) * h) < 0.2 * K);
      if (b) { sinceFix = 0; fixAt = t; fixes++; pts.forEach((p) => { if (p.seen) p.decay = true; }); b.at = t; }
    }
    pts.forEach((p) => { if (p.decay) { p.k = Math.max(0, p.k - dt / 1); if (p.k === 0) p.decay = false; } });
    trailClock += dt; if (trailClock > 0.12) { trailClock = 0; trail.push([ex, ey]); if (trail.length > 160) trail.shift(); }

    /* graticule + compass */
    ink(ctx, 0.07, 1);
    for (let x = 0; x <= 10; x++) line(ctx, (x / 10) * w, 0, (x / 10) * w, h); for (let y = 0; y <= 6; y++) line(ctx, 0, (y / 6) * h, w, (y / 6) * h);
    const cr = Math.min(40, K * 0.07), cx0 = w - cr - 20, cy0 = cr + 26;
    ink(ctx, 0.6, 1); ctx.beginPath(); ctx.arc(cx0, cy0, cr, 0, TAU); ctx.stroke();
    for (let a = 0; a < 16; a++) { const an = (a / 16) * TAU - Math.PI / 2, l = a % 4 === 0 ? cr * 1.25 : cr * 0.85; ink(ctx, a % 4 ? 0.35 : 0.9, 1, a === 0 ? C.w : C.w); line(ctx, cx0 + Math.cos(an) * cr * 0.5, cy0 + Math.sin(an) * cr * 0.5, cx0 + Math.cos(an) * l, cy0 + Math.sin(an) * l); }
    label(ctx, 'N', cx0, cy0 - cr * 1.25 - 5, { size: 10, align: 'center', color: C.w });

    /* charted coast (engraved line + landward ticks) */
    ctx.lineCap = 'round';
    coasts.forEach((cc, ci) => {
      let pen = false; ctx.beginPath();
      cc.forEach((_, i) => {
        const p = pts.find((q) => q.c === ci && q.i === i);
        if (!p.seen) { pen = false; return; }
        const x = (p.x + p.dx * p.k) * w, y = (p.y + p.dy * p.k) * h;
        pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true;
      });
      ink(ctx, 0.95, 1.5); ctx.stroke();
      // ticks pointing to land
      cc.forEach((_, i) => {
        if (i % 3) return; const p = pts.find((q) => q.c === ci && q.i === i); if (!p.seen || i + 1 >= cc.length) return;
        const q = pts.find((z) => z.c === ci && z.i === i + 1); const x = (p.x + p.dx * p.k) * w, y = (p.y + p.dy * p.k) * h;
        const tx = ((q.x + q.dx * q.k) * w - x), ty = ((q.y + q.dy * q.k) * h - y), l = Math.hypot(tx, ty) || 1;
        const sgn = ci === 0 ? -1 : ci === 1 ? 1 : 0, nx = (-ty / l) * sgn, ny = (tx / l) * sgn;
        if (ci === 2) { const ax = x - 0.5 * w, ay = y - 0.5 * h, al = Math.hypot(ax, ay) || 1; ink(ctx, 0.5, 1); line(ctx, x, y, x - (ax / al) * 5, y - (ay / al) * 5); }
        else { ink(ctx, 0.5, 1); line(ctx, x, y, x + nx * 6, y + ny * 6); }
      });
    });

    /* beacons (lighthouses) */
    for (const b of beacons) {
      const [bx, by] = U(b.x, b.y), on = b.at && t - b.at < 1.5;
      ink(ctx, 1, 1.4, on ? C.w : C.w); ctx.beginPath(); ctx.moveTo(bx - 4, by + 7); ctx.lineTo(bx + 4, by + 7); ctx.lineTo(bx + 2.5, by - 5); ctx.lineTo(bx - 2.5, by - 5); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = on ? C.w : C.w; ctx.beginPath(); ctx.arc(bx, by - 8, 2.2, 0, TAU); ctx.fill();
      const a = t * 2 + b.x * 9; ink(ctx, 0.35, 1, C.w); line(ctx, bx, by - 8, bx + Math.cos(a) * 16, by - 8 + Math.sin(a) * 16);
      if (on) { ink(ctx, 0.9, 1, C.w); ctx.save(); ctx.setLineDash([3, 3]); line(ctx, bx, by, ex * w, ey * h); ctx.restore(); }
    }

    /* other vessels: seen, never charted */
    for (const o of others) {
      const [ox, oy] = U(o.x, o.y); ink(ctx, 0.9, 1.2, C.g4);
      ctx.beginPath(); ctx.moveTo(ox - 8, oy); ctx.lineTo(ox + 8, oy); ctx.lineTo(ox + 5, oy + 5); ctx.lineTo(ox - 5, oy + 5); ctx.closePath(); ctx.stroke(); line(ctx, ox, oy, ox, oy - 11);
      if (Math.hypot((o.x - px) * w, (o.y - py) * h) < range * K * 1.4) { ink(ctx, 1, 1.2, C.w); line(ctx, ox - 9, oy - 9, ox + 9, oy + 9); line(ctx, ox - 9, oy + 9, ox + 9, oy - 9); label(ctx, 'seen · not charted', ox, oy + 22, { size: 9, align: 'center', color: C.w }); }
    }

    /* estimated track, ship, error ellipse */
    ctx.save(); ctx.setLineDash([2, 5]); ink(ctx, 0.55, 1); ctx.beginPath(); trail.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))); ctx.stroke(); ctx.restore();
    const sigma = (0.012 + clamp(sinceFix / 12) * 0.075) * K;
    ctx.save(); ctx.translate(ex * w, ey * h); ctx.rotate(0.4);
    ctx.beginPath(); ctx.ellipse(0, 0, sigma * 1.3, sigma * 0.8, 0, 0, TAU); ink(ctx, 0.95, 1.3, C.red); ctx.stroke(); ctx.restore();
    // true position ghost + tie when lost
    ink(ctx, 0.35, 1); ctx.beginPath(); ctx.arc(px * w, py * h, 7, 0, TAU); ctx.stroke(); ctx.save(); ctx.setLineDash([2, 3]); line(ctx, px * w, py * h, ex * w, ey * h); ctx.restore();
    const hd = Math.atan2(Math.cos(phi) * 0.18, -Math.sin(phi) * 0.34) ;
    ctx.save(); ctx.translate(ex * w, ey * h); ctx.rotate(hd + Math.PI / 2);
    ctx.fillStyle = C.w; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(6, 8); ctx.lineTo(0, 5); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.restore();

    /* HUD */
    label(ctx, 'DEAD RECKONING', 14, 22, { size: 10, color: C.g3, spacing: 2 });
    label(ctx, 'UNCERTAINTY', 14, 40, { size: 9.5, color: C.g3 });
    ctx.fillStyle = rgba(C.w, 0.15); ctx.fillRect(100, 33, 90, 6); ctx.fillStyle = C.w; ctx.fillRect(100, 33, 90 * clamp(sinceFix / 12 * 0.9 + 0.08), 6);
    label(ctx, `FIXES ${fixes}   BEACONS ${beacons.length}`, 14, 58, { size: 9.5, color: C.g4 });
    label(ctx, 'CLICK THE WATER TO DROP A BEACON', w - 14, h - 12, { size: 9.5, color: C.g3, align: 'right' });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw };
}
