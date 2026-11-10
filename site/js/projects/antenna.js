/* Multi-band antenna — illustrative model. A printed patch on its substrate (top and side), its radiation pattern,
   and a return-loss sweep with dips at GPS L1, Wi-Fi / Bluetooth and 5G. The curves are drawn, not measured. */
import { C, TAU, D2R, clamp, rgba, label, ink, line, corners, grid, hatch, dim } from '../core.js';

const BANDS = [{ f: 1.575, depth: 20, wd: 0.07, name: 'GPS L1' }, { f: 2.44, depth: 25, wd: 0.08, name: 'Wi-Fi · BT' }, { f: 3.5, depth: 21, wd: 0.16, name: '5G' }];
const s11 = (f) => { let v = -1.4 + 0.25 * Math.sin(f * 9); for (const b of BANDS) v -= b.depth * Math.exp(-(((f - b.f) / b.wd) ** 2)); return Math.max(-31, v); };

export default function antenna(env) {
  function patchView(ctx, R, t) {
    const { x, y, w, h } = R;
    label(ctx, 'PRINTED PATCH', x, y - 10, { size: 9.5, color: C.g3, spacing: 1.5 });
    const s = Math.min(w, h * 0.5) * 0.92, cx = x + w / 2, cy = y + s / 2 + 6;
    ink(ctx, 0.5, 1); ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);                    // substrate outline
    const pw = s * 0.66, ph = s * 0.5, px = cx - pw / 2, py = cy - ph / 2 - s * 0.04;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py); ctx.lineTo(px + pw, py + ph); ctx.lineTo(px + pw * 0.58, py + ph); ctx.lineTo(px + pw * 0.58, py + ph * 0.55); ctx.lineTo(px + pw * 0.42, py + ph * 0.55); ctx.lineTo(px + pw * 0.42, py + ph); ctx.lineTo(px, py + ph); ctx.closePath();
    ctx.fillStyle = rgba(C.w, 0.07); ctx.fill(); ink(ctx, 1, 1.5); ctx.stroke();       // patch with a notch → a second resonance
    hatch(ctx, px, py, pw, ph * 0.5, 6, 0.12);
    ink(ctx, 1, 1.4); line(ctx, cx, py + ph, cx, cy + s / 2 - 2);                         // inset feed line
    ctx.fillStyle = C.w; ctx.beginPath(); ctx.arc(cx, cy + s / 2 - 8, 2.6, 0, TAU); ctx.fill();
    label(ctx, 'feed', cx + 8, cy + s / 2 - 5, { size: 9, color: C.g4 });
    // side view
    const sy = cy + s / 2 + 36, sw = s * 0.95, sx = cx - sw / 2, sh = Math.min(26, h * 0.1);
    ink(ctx, 1, 2.4); line(ctx, sx, sy + sh, sx + sw, sy + sh);                           // ground plane
    ctx.fillStyle = rgba(C.w, 0.06); ctx.fillRect(sx, sy, sw, sh); hatch(ctx, sx, sy, sw, sh, 5, 0.3); ink(ctx, 0.7, 1); ctx.strokeRect(sx, sy, sw, sh);
    ink(ctx, 1, 2.4); line(ctx, sx + sw * 0.15, sy, sx + sw * 0.85, sy);                  // patch
    ink(ctx, 1, 1.4); line(ctx, cx, sy, cx, sy + sh + 8);                                 // feed pin
    label(ctx, '3D-PRINTED SUBSTRATE', cx, sy + sh + 24, { size: 8.5, color: C.g4, align: 'center' });
    label(ctx, 'ground plane', sx, sy + sh + 38, { size: 8.5, color: C.g3 });
  }
  function polar(ctx, R, t) {
    const { x, y, w, h } = R, cx = x + w / 2, cy = y + h / 2 + 4, pr = Math.min(w, h) * 0.4;
    label(ctx, 'RADIATION PATTERN', x, y - 10, { size: 9.5, color: C.g3, spacing: 1.5 });
    ink(ctx, 0.14, 1); for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, (pr * k) / 3, 0, TAU); ctx.stroke(); }
    for (let a = 0; a < 360; a += 30) line(ctx, cx, cy, cx + Math.sin(a * D2R) * pr, cy - Math.cos(a * D2R) * pr);
    const steer = Math.sin(t * 0.55) * 26 * D2R;
    const gain = (th) => { const a = th - steer, c = Math.cos(a); return clamp((c > 0 ? Math.pow(c, 2.6) : 0) + 0.1 * Math.abs(Math.sin(4 * a)) * (1 - Math.max(0, c)) + 0.05, 0, 1); };
    ctx.beginPath(); for (let i = 0; i <= 360; i++) { const th = i * D2R, g = gain(th) * pr, px = cx + Math.sin(th) * g, py = cy - Math.cos(th) * g; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fillStyle = rgba(C.w, 0.1); ctx.fill(); ink(ctx, 1, 1.6); ctx.stroke();
    label(ctx, '0°', cx, cy - pr - 7, { size: 9, align: 'center' });
  }
  function sweep(ctx, R, t) {
    const { x, y, w, h } = R, x0 = x + 30, x1 = x + w - 6, y0 = y + 4, y1 = y + h - 30;
    const X = (f) => x0 + ((f - 1) / 3) * (x1 - x0), Y = (db) => y0 + (-db / 32) * (y1 - y0);
    label(ctx, 'RETURN LOSS S11 (dB) · ILLUSTRATIVE', x, y - 10, { size: 9.5, color: C.g3, spacing: 1 });
    for (const db of [0, -10, -20, -30]) { ink(ctx, 0.12, 1); line(ctx, x0, Y(db), x1, Y(db)); label(ctx, String(db), x0 - 6, Y(db) + 3, { size: 9, align: 'right', color: C.g3 }); }
    for (const f of [1, 2, 3, 4]) { ink(ctx, 0.12, 1); line(ctx, X(f), y0, X(f), y1); label(ctx, f + ' GHz', X(f), y1 + 15, { size: 9, align: 'center', color: C.g3 }); }
    ctx.beginPath(); for (let i = 0; i <= 160; i++) { const f = 1 + (i / 160) * 3; i ? ctx.lineTo(X(f), Y(s11(f))) : ctx.moveTo(X(f), Y(s11(f))); }
    ink(ctx, 1, 1.8); ctx.stroke();
    ctx.lineTo(x1, y0); ctx.lineTo(x0, y0); ctx.closePath(); ctx.fillStyle = rgba(C.w, 0.05); ctx.fill();
    for (const b of BANDS) { ctx.save(); ctx.setLineDash([2, 4]); ink(ctx, 0.3, 1); line(ctx, X(b.f), Y(s11(b.f)) + 4, X(b.f), y1); ctx.restore(); label(ctx, b.name, X(b.f), y1 - 6, { size: 9, align: 'center', color: C.g4 }); }
    const m = 1 + 3 * ((t / 7) % 1), mx = X(m), my = Y(s11(m));
    ink(ctx, 0.4, 1); line(ctx, mx, y0, mx, y1);
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(mx, my, 3.6, 0, TAU); ctx.fill();
    label(ctx, env.w < 640 ? `f = ${m.toFixed(2)} GHz` : `VNA marker  f = ${m.toFixed(2)} GHz`, x1, y0 + 14, { size: 9.5, align: 'right', color: C.w });
  }
  function draw(ctx, t) {
    const { w, h } = env, narrow = w < 640;
    grid(ctx, w, h, 28, 0.03);
    if (!narrow) { patchView(ctx, { x: 18, y: 52, w: w * 0.25, h: h - 80 }, t); polar(ctx, { x: w * 0.31, y: 52, w: w * 0.25, h: h - 90 }, t); sweep(ctx, { x: w * 0.59, y: 52, w: w * 0.4 - 14, h: h - 84 }, t); }
    else { sweep(ctx, { x: 14, y: 40, w: w - 24, h: h * 0.4 }, t); patchView(ctx, { x: 14, y: h * 0.58, w: w * 0.46, h: h * 0.38 }, t); polar(ctx, { x: w * 0.54, y: h * 0.6, w: w * 0.42, h: h * 0.32 }, t); }
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw };
}
