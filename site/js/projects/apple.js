/* Apple detection — illustrative model. The same orchard twice: colour thresholding (misses occluded fruit, flags leaf spots)
   against a learned detector. Rendered as monochrome engraving; not the paper's data. */
import { C, TAU, clamp, rgba, rng, label, ink, line, corners, roundRect } from '../core.js';

export default function apple(env) {
  const r = rng(14), apples = [];
  let tries = 0;
  while (apples.length < 16 && tries++ < 400) {
    const a = { nx: 0.08 + r() * 0.84, ny: 0.2 + r() * 0.62, rr: 0.032 + r() * 0.016, occ: false };
    if (apples.every((b) => Math.hypot(a.nx - b.nx, (a.ny - b.ny) * 0.6) > (a.rr + b.rr) * 1.5)) apples.push(a);
  }
  apples.forEach((a, i) => { a.occ = i % 5 === 2; a.miss = a.occ || i % 4 === 3; });
  const leaves = Array.from({ length: 70 }, () => ({ nx: r(), ny: r(), s: 0.04 + r() * 0.05, a: r() * TAU, g: r() }));
  const occL = apples.filter((a) => a.occ).flatMap((a) => [{ nx: a.nx + 0.01, ny: a.ny - 0.005, s: a.rr * 1.9, a: 0.6, g: 0.4 }, { nx: a.nx - 0.012, ny: a.ny + 0.012, s: a.rr * 1.6, a: -0.5, g: 0.7 }]);
  const spots = Array.from({ length: 4 }, () => ({ nx: 0.1 + r() * 0.8, ny: 0.25 + r() * 0.55, rr: 0.016 }));

  function leaf(ctx, x, y, s, a, g) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = `rgba(${150 + g * 40},${150 + g * 40},${150 + g * 40},0.18)`; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.42, 0, 0, TAU); ctx.fill();
    ink(ctx, 0.35, 1); ctx.stroke(); line(ctx, -s, 0, s, 0); ctx.restore();
  }
  function fruit(ctx, x, y, rad) {
    const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    g.addColorStop(0, '#e6e6e6'); g.addColorStop(0.55, '#8a8a8a'); g.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); ink(ctx, 0.8, 1); ctx.stroke();
    ink(ctx, 0.9, 1.4); line(ctx, x, y - rad * 0.9, x + 2, y - rad * 1.25);
  }
  function orchard(ctx, x0, y0, W, H) {
    ctx.fillStyle = '#050505'; ctx.fillRect(x0, y0, W, H);
    for (const l of leaves) leaf(ctx, x0 + l.nx * W, y0 + l.ny * H, l.s * W * 0.6, l.a, l.g);
    for (const a of apples) fruit(ctx, x0 + a.nx * W, y0 + a.ny * H, a.rr * W);
    for (const l of occL) leaf(ctx, x0 + l.nx * W, y0 + l.ny * H, l.s * W, l.a, l.g);
    for (const s of spots) { ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.beginPath(); ctx.arc(x0 + s.nx * W, y0 + s.ny * H, s.rr * W, 0, TAU); ctx.fill(); ink(ctx, 0.5, 1); ctx.stroke(); }
  }
  function draw(ctx, t) {
    const { w, h } = env, narrow = w < 560;
    const top = 40, bh = h - top - 40, half = (w - 40) / 2, xL = 14, xR = 26 + half;
    const ph = t % 7.5, scan = clamp(ph / 4.2) * 1.08;
    [[xL, 'COLOUR THRESHOLD', 0], [xR, 'LEARNED DETECTOR', 1]].forEach(([x0, name, det]) => {
      ctx.save(); roundRect(ctx, x0, top, half, bh, 10); ctx.clip(); orchard(ctx, x0, top, half, bh);
      const sx = x0 + scan * half;
      if (scan < 1.05) { const g = ctx.createLinearGradient(sx - 40, 0, sx, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.2)'); ctx.fillStyle = g; ctx.fillRect(sx - 40, top, 40, bh); ink(ctx, 0.9, 1.2); line(ctx, sx, top, sx, top + bh); }
      let found = 0;
      if (!det) {
        apples.forEach((a, i) => {
          if (a.miss || a.nx > scan) return; found++;
          const cx = x0 + a.nx * half, cy = top + a.ny * bh, rad = a.rr * half;
          ink(ctx, 0.9, 1.2); ctx.beginPath();
          for (let k = 0; k <= 22; k++) { const an = (k / 22) * TAU, rr = rad * (1.02 + 0.12 * Math.sin(an * 5 + i + t * 2)); const px = cx + Math.cos(an) * rr, py = cy + Math.sin(an) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.stroke();
        });
        spots.forEach((s) => { if (s.nx > scan) return; const cx = x0 + s.nx * half, cy = top + s.ny * bh, rad = s.rr * half * 1.5; ctx.save(); ctx.setLineDash([3, 3]); ink(ctx, 0.8, 1); ctx.strokeRect(cx - rad, cy - rad, rad * 2, rad * 2); ctx.restore(); label(ctx, 'false +', cx - rad, cy - rad - 3, { size: 8.5, color: C.g4 }); });
      } else {
        apples.forEach((a) => { if (a.nx > scan) return; found++; const cx = x0 + a.nx * half, cy = top + a.ny * bh, rad = a.rr * half * 1.22; ink(ctx, 1, 1.5); ctx.strokeRect(cx - rad, cy - rad, rad * 2, rad * 2); if (!narrow) label(ctx, 'apple', cx - rad, cy - rad - 3, { size: 8.5, color: C.w }); });
      }
      ctx.restore();
      ink(ctx, 0.3, 1); roundRect(ctx, x0, top, half, bh, 10); ctx.stroke();
      label(ctx, name, x0 + 4, top - 12, { size: narrow ? 8.5 : 9.5, color: C.g4, spacing: 1 });
      const fl = half < 126 ? '' : 'found ', fsp = half < 126 ? '/' : ' / ';        // short form on small phones so the two captions do not collide
      label(ctx, `${fl}${found}${fsp}${apples.length}${!det ? ` · ${spots.filter((s) => s.nx <= scan).length} false` : ''}`, x0 + 4, top + bh + 18, { size: 9.5, color: C.w });
    });
    corners(ctx, w, h, 4, 10, 0.25);
  }
  return { draw };
}
