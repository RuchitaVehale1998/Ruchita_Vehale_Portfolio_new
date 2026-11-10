/* PLATE X — an Antikythera-style dial. A gear train turns the pointer through 2016 – 2026;
   each concentric arc is a role or a degree, lit red while the pointer is inside it. */
import { C, D2R, TAU, clamp, lerp, rgba, label, ink, line, corners, out } from '../core.js';

const Y0 = 2016, Y1 = 2027, A0 = -90, SWEEP = 330;
const RINGS = [
  { name: 'BE Electronics', org: 'AISSMS, Pune', a: 2016.37, b: 2020.9 },
  { name: 'MTech Electronics & Elec.', org: 'SPPU, Pune', a: 2020.42, b: 2022.7 },
  { name: 'Technology Intern', org: 'HEMRL, DRDO, Pune', a: 2021.85, b: 2022.65 },
  { name: 'Research Fellow', org: 'CMET, Pune', a: 2023.25, b: 2024.65 },
  { name: 'MSc Robotics', org: 'University of Bristol', a: 2024.6, b: 2025.7 },
  { name: 'Drone systems engineer', org: 'HVN Labs, Bristol', a: 2025.25, b: 2025.65 },
  { name: 'Software Engineer (R&D)', org: 'DeGould Ltd, Bristol', a: 2025.75, b: 2026.41 },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ang = (y) => (A0 + ((y - Y0) / (Y1 - Y0)) * SWEEP) * D2R;

function gearPath(ctx, x, y, r, n, rot) {
  const root = r * 0.84, step = TAU / n;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + i * step;
    const pts = [[root, 0], [r, 0.16], [r, 0.4], [root, 0.56]];
    pts.forEach(([rr, f], k) => { const an = a + f * step, px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr; (i === 0 && k === 0) ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
  }
  ctx.closePath();
}

export default function gears(env) {
  const plate = env.canvas.closest('.plate');
  let year = 2025.8, idle = 0, dragging = false;
  const slider = () => plate.querySelector('input[data-call="year"]');
  const api = { year(v) { year = clamp(+v, Y0, Y1 - 0.1); idle = 0; } };

  function draw(ctx, t, dt) {
    const { w, h, ptr } = env;
    const narrow = w < 640;
    const R = narrow ? Math.min((w / 2 - 22) / 1.17, h * 0.33) : Math.min(h * 0.45, w * 0.32);   // narrow: the year labels sit at 1.17 R and must stay on the canvas
    const cx = narrow ? w / 2 : w * 0.38, cy = narrow ? Math.max(h * 0.4, R * 1.17 + 14) : h * 0.5;

    /* interaction: drag the pointer round the dial; otherwise run by itself */
    if (ptr.down) {
      const a = Math.atan2(ptr.y - cy, ptr.x - cx) / D2R, rel = ((a - A0 + 540) % 360) - 180 + 180;   // 0..360 from the start angle
      const r = Math.hypot(ptr.x - cx, ptr.y - cy);
      if (r > R * 0.3 && r < R * 1.15 && rel <= SWEEP + 12) { year = clamp(Y0 + (Math.min(rel, SWEEP) / SWEEP) * (Y1 - Y0), Y0, Y1 - 0.1); idle = 0; dragging = true; const s = slider(); if (s) s.value = year.toFixed(2); }
    } else dragging = false;
    idle += dt;
    if (idle > 5 && !dragging && !env.reduced) { year += dt * 0.45; if (year > Y1 - 0.1) year = Y0 + 0.2; const s = slider(); if (s) s.value = year.toFixed(2); }
    const th = ang(year);

    /* scale ring */
    ink(ctx, 0.9, 1.2); ctx.beginPath(); ctx.arc(cx, cy, R, ang(Y0), ang(Y1)); ctx.stroke();
    ink(ctx, 0.5, 1); ctx.beginPath(); ctx.arc(cx, cy, R * 0.97, ang(Y0), ang(Y1)); ctx.stroke();
    for (let m = 0; m <= (Y1 - Y0) * 12; m++) {
      const y = Y0 + m / 12, a = ang(y), yr = m % 12 === 0, rr = yr ? R * 1.07 : R * 1.025;
      ink(ctx, yr ? 0.9 : 0.35, 1); line(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      if (yr && y < Y1) label(ctx, String(y), cx + Math.cos(a) * (R * 1.17), cy + Math.sin(a) * (R * 1.17) + 3.5, { size: 10, color: C.g4, align: 'center' });
    }

    /* role arcs */
    const active = [];
    RINGS.forEach((rg, i) => {
      const rr = R * (0.9 - i * 0.056), on = year >= rg.a && year <= rg.b;
      if (on) active.push(rg);
      ctx.save(); ctx.lineCap = 'butt';
      ink(ctx, on ? 1 : 0.5, on ? 6 : 4, on ? C.red : C.w);
      ctx.beginPath(); ctx.arc(cx, cy, rr, ang(rg.a), ang(rg.b)); ctx.stroke();
      ink(ctx, 0.12, 1); ctx.beginPath(); ctx.arc(cx, cy, rr, ang(Y0), ang(Y1)); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = on ? C.red : C.w; for (const y of [rg.a, rg.b]) { const a = ang(y); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.5, 0, TAU); ctx.fill(); }
    });

    /* gear train (turns with the year) */
    const k = (year - Y0) * 2.1, gr = R * 0.42;
    const r1 = gr * 0.5, r2 = gr * 0.36, r3 = gr * 0.3, n1 = 30, n2 = 22, n3 = 18;
    const g1 = [cx - gr * 0.12, cy + gr * 0.08];
    const place = (g, r, rb, deg) => [g[0] + Math.cos(deg * D2R) * (r + rb), g[1] + Math.sin(deg * D2R) * (r + rb)];
    const g2 = place(g1, r1, r2 * 0.96, -35), g3 = place(g1, r1, r3 * 0.96, 75);
    const rot1 = k, rot2 = -k * (n1 / n2) + Math.PI / n2, rot3 = -k * (n1 / n3) + Math.PI / n3;
    [[g1, r1, n1, rot1, true], [g2, r2, n2, rot2, false], [g3, r3, n3, rot3, false]].forEach(([g, r, n, rot, hot]) => {
      gearPath(ctx, g[0], g[1], r, n, rot); ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fill(); ink(ctx, 0.95, 1.3, hot ? C.red : C.w); ctx.stroke();
      for (let s = 0; s < 4; s++) { const a = rot + (s * TAU) / 4 + 0.3; ink(ctx, 0.5, 1); line(ctx, g[0] + Math.cos(a) * r * 0.2, g[1] + Math.sin(a) * r * 0.2, g[0] + Math.cos(a) * r * 0.78, g[1] + Math.sin(a) * r * 0.78); }
      ctx.beginPath(); ctx.arc(g[0], g[1], r * 0.14, 0, TAU); ctx.fillStyle = hot ? C.red : C.w; ctx.fill();
    });

    /* pointer */
    ctx.save(); ctx.shadowColor = C.red; ctx.shadowBlur = 8; ink(ctx, 1, 2, C.red);
    line(ctx, cx + Math.cos(th) * R * 0.3, cy + Math.sin(th) * R * 0.3, cx + Math.cos(th) * R * 1.0, cy + Math.sin(th) * R * 1.0);
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(cx + Math.cos(th) * R * 1.0, cy + Math.sin(th) * R * 1.0);
    ctx.lineTo(cx + Math.cos(th - 0.05) * R * 0.9, cy + Math.sin(th - 0.05) * R * 0.9); ctx.lineTo(cx + Math.cos(th + 0.05) * R * 0.9, cy + Math.sin(th + 0.05) * R * 0.9); ctx.fill(); ctx.restore();

    /* readout */
    const mon = MONTHS[Math.floor((year % 1) * 12)], ys = `${mon} ${Math.floor(year)}`;
    const yy = narrow ? cy + R * 1.17 + 30 : h * 0.2;                // narrow: the readout hangs below the dial instead of at a fixed fraction of the height
    label(ctx, ys.toUpperCase(), narrow ? cx : w * 0.745, yy, { size: 22, color: C.w, align: narrow ? 'center' : 'left', font: '"Bodoni Moda", serif' });
    const tx = narrow ? 16 : w * 0.745, ty0 = narrow ? yy + 22 : h * 0.2 + 28, pitch = narrow ? 28 : 34;
    if (!active.length) label(ctx, 'between roles', tx, ty0, { size: 10.5, color: C.g3, align: narrow ? 'left' : 'left' });
    active.slice(-4).forEach((rg, i) => {
      label(ctx, rg.name, tx, ty0 + i * pitch, { size: 10.5, color: C.red });
      label(ctx, rg.org, tx, ty0 + i * pitch + (narrow ? 12 : 14), { size: 10, color: C.g4 });
    });
    out(env, 'gears-read', `<b>${ys}</b> · ${active.length ? active.map((r) => r.org).join(' · ') : 'between roles'}`);
    if (!narrow) label(ctx, 'DRAG THE POINTER ROUND THE DIAL', 14, h - 12, { size: 9.5, color: C.g3 });   // phone: the line under the figure says it, and there is no room here
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
