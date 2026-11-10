/* Dynamic-object-aware SLAM — illustrative model. A forward RGB-D camera (≈87° field of view) maps a room while
   people walk through it: rays that hit a person are masked and never reach the occupancy grid.
   The pose estimate drifts, then a loop closure snaps it back. */
import { C, TAU, D2R, clamp, lerp, rgba, rng, label, ink, line, corners, grid, tag } from '../core.js';

const W = 800, H = 450, CELL = 5, GW = 160, GH = 90, RANGE = 230, NR = 64, FOV = 87 * D2R, STEP = 2.5;
const rect = (x, y, w, h) => [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]];
const WALLS = [...rect(10, 10, 780, 430), ...rect(190, 150, 90, 60), ...rect(470, 240, 110, 70), ...rect(330, 120, 60, 60)];
const PEOPLE = [{ a: [130, 40], b: [130, 410], sp: 46, ph: 0, id: 1 }, { a: [210, 405], b: [650, 405], sp: 60, ph: 0.35, id: 2 }, { a: [705, 60], b: [705, 380], sp: 42, ph: 0.6, id: 3 }];
const tri = (u) => { u = ((u % 2) + 2) % 2; return u < 1 ? u : 2 - u; };
function raySeg(ox, oy, dx, dy, s) {
  const ex = s[2] - s[0], ey = s[3] - s[1], den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-9) return Infinity;
  const t = ((s[0] - ox) * ey - (s[1] - oy) * ex) / den, u = ((s[0] - ox) * dy - (s[1] - oy) * dx) / den;
  return t > 0 && u >= 0 && u <= 1 ? t : Infinity;
}
function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx = ox - cx, fy = oy - cy, b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r, d = b * b - c;
  if (d < 0) return Infinity; const t = -b - Math.sqrt(d); return t > 0 ? t : Infinity;
}

export default function slam(env) {
  const r = rng(4);
  const grid2 = new Float32Array(GW * GH), gcv = document.createElement('canvas');
  gcv.width = GW; gcv.height = GH;
  const gctx = gcv.getContext('2d'), img = gctx.createImageData(GW, GH);
  let phi = -Math.PI / 2, phi0 = phi, lap = 0, closeT = -9, trailClock = 0;
  const drift = { x: 0, y: 0 }, trueTrail = [], est = [], hits = new Float32Array(NR * 3);

  function draw(ctx, t, dt) {
    const { w, h } = env, narrow = w < 640;
    const sc = Math.min(w / W, h / H) * 0.96, ox = (w - W * sc) / 2, oy = (h - H * sc) / 2 + 8;
    const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;

    /* simulate */
    phi += (TAU / 22) * dt;
    const px = 400 + 300 * Math.cos(phi), py = 225 + 160 * Math.sin(phi), hd = Math.atan2(160 * Math.cos(phi), -300 * Math.sin(phi));
    const ppl = PEOPLE.map((p) => { const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]), u = tri((t * p.sp) / len + p.ph); return { x: lerp(p.a[0], p.b[0], u), y: lerp(p.a[1], p.b[1], u), r: 11, id: p.id }; });
    let masked = 0;
    for (let i = 0; i < NR; i++) {
      const a = hd - FOV / 2 + (i / (NR - 1)) * FOV, dx = Math.cos(a), dy = Math.sin(a);
      let tw = Infinity, tp = Infinity;
      for (const s of WALLS) { const q = raySeg(px, py, dx, dy, s); if (q < tw) tw = q; }
      for (const p of ppl) { const q = rayCircle(px, py, dx, dy, p.x, p.y, p.r); if (q < tp) tp = q; }
      const dyn = tp < tw && tp < RANGE, hit = Math.min(tw, tp, RANGE), reach = dyn ? Math.max(0, tp - 6) : hit;
      for (let d = 0; d < reach; d += STEP) { const cx = Math.floor((px + dx * d) / CELL), cy = Math.floor((py + dy * d) / CELL); if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) continue; const k = cy * GW + cx; grid2[k] = Math.max(-1.6, grid2[k] - 0.1); }
      if (!dyn && tw < RANGE) { const cx = Math.floor((px + dx * tw) / CELL), cy = Math.floor((py + dy * tw) / CELL); if (cx >= 0 && cy >= 0 && cx < GW && cy < GH) { const k = cy * GW + cx; grid2[k] = Math.min(3, grid2[k] + 0.9); } }
      hits[i * 3] = px + dx * hit; hits[i * 3 + 1] = py + dy * hit; hits[i * 3 + 2] = dyn ? 2 : tw < RANGE ? 1 : 0; if (dyn) masked++;
    }
    if (phi - phi0 >= TAU) { phi0 = phi; lap++; closeT = t; est.forEach((e) => (e.decay = true)); }
    if (t - closeT < 0.9) { const f = Math.exp(-dt * 6); drift.x *= f; drift.y *= f; } else { drift.x += (2.4 + (r() - 0.5) * 9) * dt; drift.y += (-1.7 + (r() - 0.5) * 9) * dt; }
    trailClock += dt;
    if (trailClock > 0.1) { trailClock = 0; trueTrail.push({ x: px, y: py }); if (trueTrail.length > 230) trueTrail.shift(); est.push({ x: px, y: py, dx: drift.x, dy: drift.y, k: 1, decay: false }); if (est.length > 230) est.shift(); }
    est.forEach((e) => { if (e.decay) e.k = Math.max(0, e.k - dt / 0.9); });

    /* draw */
    grid(ctx, w, h, 28, 0.03);
    ink(ctx, 0.06, 1); ctx.beginPath(); for (const s of WALLS) { ctx.moveTo(X(s[0]), Y(s[1])); ctx.lineTo(X(s[2]), Y(s[3])); } ctx.stroke();
    for (let k = 0; k < grid2.length; k++) {
      const v = grid2[k], o = k * 4;
      if (v > 0.45) { img.data[o] = 215; img.data[o + 1] = 215; img.data[o + 2] = 215; img.data[o + 3] = Math.min(190, 90 + v * 40); }
      else if (v < -0.1) { img.data[o] = 120; img.data[o + 1] = 120; img.data[o + 2] = 120; img.data[o + 3] = Math.min(70, -v * 40); }
      else img.data[o + 3] = 0;
    }
    gctx.putImageData(img, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(gcv, ox, oy, GW * CELL * sc, GH * CELL * sc);

    // camera field of view
    ctx.beginPath(); ctx.moveTo(X(px), Y(py));
    for (let i = 0; i < NR; i += 1) ctx.lineTo(X(hits[i * 3]), Y(hits[i * 3 + 1]));
    ctx.closePath(); ctx.fillStyle = rgba(C.w, 0.04); ctx.fill();
    for (let i = 0; i < NR; i += 3) {
      const kind = hits[i * 3 + 2];
      ctx.save(); if (kind === 2) ctx.setLineDash([3, 3]);
      ink(ctx, kind === 2 ? 0.5 : 0.1, 1); line(ctx, X(px), Y(py), X(hits[i * 3]), Y(hits[i * 3 + 1])); ctx.restore();
    }
    for (let i = 0; i < NR; i += 2) { if (hits[i * 3 + 2] !== 1) continue; ctx.fillStyle = rgba(C.w, 0.9); ctx.fillRect(X(hits[i * 3]) - 1, Y(hits[i * 3 + 1]) - 1, 2, 2); }

    for (const p of ppl) {
      const bw = 15 * sc, bh = 24 * sc;
      ctx.save(); ctx.setLineDash([3, 3]); ink(ctx, 0.9, 1.2); ctx.strokeRect(X(p.x) - bw / 2, Y(p.y) - bh / 2, bw, bh); ctx.restore();
      ink(ctx, 0.9, 1); line(ctx, X(p.x) - bw / 2, Y(p.y) - bh / 2, X(p.x) + bw / 2, Y(p.y) + bh / 2); line(ctx, X(p.x) + bw / 2, Y(p.y) - bh / 2, X(p.x) - bw / 2, Y(p.y) + bh / 2);
      if (!narrow) label(ctx, `person ${p.id} · masked`, X(p.x) - bw / 2, Y(p.y) - bh / 2 - 5, { size: 8.5, color: C.g4 });
    }

    ctx.save(); ctx.setLineDash([3, 4]); ink(ctx, 0.3, 1); ctx.beginPath(); trueTrail.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)))); ctx.stroke(); ctx.restore();
    ink(ctx, 0.95, 1.8); ctx.beginPath(); est.forEach((e, i) => { const x = X(e.x + e.dx * e.k), y = Y(e.y + e.dy * e.k); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    const ex = px + drift.x, ey = py + drift.y;
    ctx.save(); ctx.translate(X(ex), Y(ey)); ctx.rotate(hd);
    ctx.fillStyle = C.w; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, 6); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill(); ctx.restore();
    if (t - closeT < 1.6) {
      const a = (t - closeT) / 1.6; ink(ctx, 1 - a, 1.6, C.red); ctx.beginPath(); ctx.arc(X(px), Y(py), 10 + a * 46, 0, TAU); ctx.stroke();
      tag(ctx, 'LOOP CLOSURE', X(px) + 16, Y(py) - 22, C.w, { size: 9.5 });
    }

    label(ctx, 'RGB-D FOV 87°  ·  OCCUPANCY GRID', 16, 24, { size: 9.5, color: C.g3, spacing: 1.2 });
    if (w >= 640) {
      const rows = [['estimated pose', 1], ['ground truth', 0.3], ['person → masked', 0.9]];
      rows.forEach(([s, a], i) => { label(ctx, s, w - 28, 24 + i * 15, { size: 9.5, align: 'right', color: C.g4 }); ink(ctx, a, 1.6); line(ctx, w - 24, 20 + i * 15, w - 12, 20 + i * 15); });
    }
    label(ctx, `lap ${lap + 1} · rays masked ${masked}/${NR}`, w - 14, h - 14, { size: 9.5, align: 'right', color: C.g3 });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw };
}
