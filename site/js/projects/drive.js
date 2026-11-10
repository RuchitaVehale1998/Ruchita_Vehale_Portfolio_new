/* DriveSense — road scene → patch features → kNN anomaly map → score distributions → hazard report.
   Illustrative model of the pipeline; no metrics are shown or implied. */
import { C, clamp, lerp, rgba, rng, gauss, label, ink, line, corners, grid, roundRect, tag } from '../core.js';

const STAGES = ['SegFormer-B2', 'DINOv2 patches', 'kNN · FAISS', 'anomaly map', 'VLM report'];
const REPORT = ['{', '  "hazard": "unknown object on lane",', '  "severity": "high",', '  "action": "slow, prepare to brake"', '}'].join('\n');
const REPORT_N = ['{"hazard": "unknown object on lane",', ' "severity": "high",', ' "action": "slow, prepare to brake"}'].join('\n');

export default function drive(env) {
  const r = rng(52), bins = 30;
  const idH = new Float32Array(bins), oodH = new Float32Array(bins);
  for (let i = 0; i < 3000; i++) { idH[clamp(Math.floor((0.24 + gauss(r) * 0.11) * bins), 0, bins - 1)]++; if (i % 5 === 0) oodH[clamp(Math.floor((0.72 + gauss(r) * 0.13) * bins), 0, bins - 1)]++; }
  const idMax = Math.max(...idH), oodMax = Math.max(...oodH);
  const bld = Array.from({ length: 10 }, () => ({ w: 0.04 + r() * 0.05, h: 0.12 + r() * 0.2, s: r() < 0.5 ? -1 : 1, d: r() }));

  function draw(ctx, t) {
    const { w, h } = env, narrow = w < 720;
    const top = narrow ? 56 : 44, x0 = 16, sw = narrow ? w - 32 : w * 0.6, sh = narrow ? Math.round((h - top - 56) * 0.4) : h - top - 56;
    const ph = (t * 0.85) % 6.6, stage = Math.min(4, Math.floor(ph)), sk = ph - Math.floor(ph);
    const hz = top + sh * 0.38, cx = x0 + sw / 2, K = Math.min(1, sh / 280);
    grid(ctx, w, h, 28, 0.03);
    label(ctx, narrow ? 'ROAD SCENE · ANOMALY MAP' : 'ROAD SCENE  ·  PATCH GRID  ·  ANOMALY SCORE', x0, 26, { size: 9.5, color: C.g3, spacing: 1.5 });

    /* scene */
    ctx.save(); roundRect(ctx, x0, top, sw, sh, 10); ctx.clip();
    ctx.fillStyle = '#04040a'; ctx.fillRect(x0, top, sw, sh);
    for (const b of bld) {
      const bx = cx + b.s * (sw * (0.08 + b.d * 0.38)), bw = sw * b.w, bh = sh * b.h;
      ink(ctx, 0.35, 1); ctx.strokeRect(bx - bw / 2, hz - bh, bw, bh);
      for (let k = 1; k < 6; k++) { ink(ctx, 0.12, 1); line(ctx, bx - bw / 2 + 3, hz - bh + k * (bh / 6), bx + bw / 2 - 3, hz - bh + k * (bh / 6)); }
    }
    ink(ctx, 0.5, 1); line(ctx, x0, hz, x0 + sw, hz);
    const rt = sw * 0.08, rb = sw * 0.96;
    ctx.beginPath(); ctx.moveTo(cx - rt, hz); ctx.lineTo(cx + rt, hz); ctx.lineTo(cx + rb / 2, top + sh); ctx.lineTo(cx - rb / 2, top + sh); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill(); ink(ctx, 0.5, 1.2); ctx.stroke();
    for (const lane of [-1 / 3, 1 / 3]) for (let k = 0; k < 9; k++) {
      const u0 = ((k + (t * 0.8) % 1) / 9) ** 1.8, u1 = ((k + 0.5 + (t * 0.8) % 1) / 9) ** 1.8; if (u1 > 1) continue;
      const f = (u) => [lerp(cx + lane * rt, cx + lane * rb / 2, u), lerp(hz, top + sh, u)], a = f(u0), b = f(u1);
      ink(ctx, 0.5, 1 + u1 * 3); line(ctx, a[0], a[1], b[0], b[1]);
    }
    const car = (u, lane) => {
      const y = lerp(hz, top + sh, u), x = lerp(cx + lane * rt, cx + lane * rb / 2, u), s = (18 + u * 90) * K;
      ink(ctx, 0.8, 1.2); roundRect(ctx, x - s / 2, y - s * 0.5, s, s * 0.5, s * 0.1); ctx.stroke();
      ctx.fillStyle = C.w; ctx.fillRect(x - s * 0.44, y - s * 0.22, s * 0.14, s * 0.07); ctx.fillRect(x + s * 0.3, y - s * 0.22, s * 0.14, s * 0.07);
    };
    car(0.28 + 0.04 * Math.sin(t * 0.4), -0.66); car(0.5 + 0.03 * Math.sin(t * 0.3 + 1), 0.66);
    // the unknown object on the lane
    const oc = (t * 0.12) % 1, ou = 0.3 + oc * 0.42, oy = lerp(hz, top + sh, ou), ox = lerp(cx, cx, ou) + 6, os = (14 + ou * 80) * K;
    ink(ctx, 1, 1.4); ctx.strokeRect(ox - os / 2, oy - os * 0.7, os * 0.9, os * 0.7); ctx.strokeRect(ox - os * 0.1, oy - os * 1.1, os * 0.7, os * 0.45);
    ink(ctx, 0.4, 1); line(ctx, ox - os / 2, oy - os * 0.7, ox + os * 0.4, oy); line(ctx, ox + os * 0.4, oy - os * 0.7, ox - os / 2, oy);
    // patch grid + anomaly heat
    const gx = 22, gy = 11, cw = sw / gx, ch = sh / gy;
    if (stage >= 1) { ink(ctx, 0.14, 1); ctx.beginPath(); for (let i = 0; i <= gx; i++) { ctx.moveTo(x0 + i * cw, top); ctx.lineTo(x0 + i * cw, top + sh); } for (let j = 0; j <= gy; j++) { ctx.moveTo(x0, top + j * ch); ctx.lineTo(x0 + sw, top + j * ch); } ctx.stroke(); }
    if (stage >= 2) { ctx.save(); ctx.setLineDash([2, 3]); ink(ctx, 0.5, 1); const qx = ox, qy = oy - os * 0.4; for (let k = 0; k < 5; k++) { const a = -2.2 + k * 0.5; line(ctx, qx, qy, qx + Math.cos(a) * 70, qy + Math.sin(a) * 50); } ctx.restore(); }
    if (stage >= 3) {
      const fade = stage === 3 ? sk : 1;
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
        const cxp = x0 + (i + 0.5) * cw, cyp = top + (j + 0.5) * ch, dd = Math.hypot((cxp - ox) / (os * 0.9), (cyp - (oy - os * 0.35)) / (os * 0.8));
        const sc = Math.exp(-dd * dd * 0.9) + 0.03 * Math.sin(i * 1.7 + j * 2.3 + t); if (sc < 0.1) continue;
        ctx.fillStyle = rgba(C.w, clamp(sc) * 0.5 * fade); ctx.fillRect(x0 + i * cw + 1, top + j * ch + 1, cw - 2, ch - 2);
      }
    }
    if (stage >= 4) { ink(ctx, 1, 1.6, C.red); ctx.strokeRect(ox - os * 0.62, oy - os * 1.2, os * 1.3, os * 1.35); label(ctx, 'OOD · unknown object', ox - os * 0.62, oy - os * 1.2 - 6, { size: 9.5, color: C.w }); }
    ctx.restore();
    ink(ctx, 0.3, 1); roundRect(ctx, x0, top, sw, sh, 10); ctx.stroke();

    /* score distributions */
    const rx = narrow ? x0 : x0 + sw + 22, rw = narrow ? w - 32 : w - rx - 16, hh = narrow ? 52 : Math.min(150, sh * 0.42), hy = narrow ? top + sh + 28 : top;
    label(ctx, 'ANOMALY SCORE · IN-DISTRIBUTION vs OOD', rx, hy - 9, { size: 9, color: C.g3 });
    const bw = rw / bins;
    for (let i = 0; i < bins; i++) {
      const a = (idH[i] / idMax) * hh * 0.95, b = (oodH[i] / oodMax) * hh * 0.7;
      ctx.fillStyle = rgba(C.w, 0.28); ctx.fillRect(rx + i * bw + 0.5, hy + hh - a, bw - 1, a);
      ctx.fillStyle = rgba(C.w, 0.85); ctx.fillRect(rx + i * bw + 0.5, hy + hh - b, bw - 1, b);
    }
    ink(ctx, 0.4, 1); line(ctx, rx, hy + hh + 0.5, rx + rw, hy + hh + 0.5);
    const tau = rx + rw * 0.49; ctx.save(); ctx.setLineDash([4, 4]); ink(ctx, 0.9, 1); line(ctx, tau, hy - 2, tau, hy + hh); ctx.restore();
    label(ctx, 'threshold', tau + 6, hy + 10, { size: 9, color: C.w });
    label(ctx, 'in-distribution', rx, hy + hh + 15, { size: 9, color: C.g4 }); label(ctx, 'OOD', rx + rw, hy + hh + 15, { size: 9, align: 'right', color: C.w });
    label(ctx, 'AUROC · AUPRC · FPR@95TPR', rx, hy + hh + 33, { size: 9, color: C.g3 });

    /* hazard report */
    const ry = hy + hh + (narrow ? 46 : 52), rh = (narrow ? h - 50 : top + sh) - ry;
    if (rh > 56) {
      roundRect(ctx, rx, ry, rw, rh, 10); ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill(); ink(ctx, 0.3, 1); ctx.stroke();
      label(ctx, 'VLM · HAZARD REPORT (illustrative)', rx + 12, ry + 18, { size: 9, color: C.g3 });
      const txt = narrow ? REPORT_N : REPORT, n = stage >= 4 ? Math.floor(clamp(sk * 1.6) * txt.length) : 0, lines = txt.slice(0, n).split('\n');
      lines.forEach((ln, i) => label(ctx, ln + (i === lines.length - 1 && stage >= 4 && n < txt.length ? '▌' : ''), rx + 12, ry + 38 + i * 14, { size: 10.5, color: C.w }));
    }

    /* pipeline chips */
    let px = x0; const cy0 = h - 34;
    (narrow ? [STAGES[stage]] : STAGES).forEach((s0, i0) => {
      const i = narrow ? stage : i0, s = narrow ? `${stage + 1}/5 · ${s0}` : s0, cur = i === stage;
      ctx.font = '10px "IBM Plex Mono", monospace'; const tw = ctx.measureText(s).width + 16;
      if (px + tw > w - 12) return;
      roundRect(ctx, px, cy0, tw, 22, 11); ctx.fillStyle = cur ? C.w : 'rgba(255,255,255,0.03)'; ctx.fill(); ink(ctx, cur ? 1 : i < stage ? 0.55 : 0.2, 1); ctx.stroke();
      label(ctx, s, px + 8, cy0 + 14.5, { size: 10, color: cur ? '#000' : i < stage ? C.g4 : C.g3 }); px += tw + 6;
      if (!narrow && i < STAGES.length - 1) { label(ctx, '›', px - 3, cy0 + 15, { size: 11, color: C.g3 }); px += 8; }
    });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw };
}
