/* PLATE VI — a spark-gap transmitter keyed in Morse, and a receiver whose answer follows a resonance curve.
   Reception strength is a Lorentzian resonance model (illustrative), not a measurement. */
import { morseSchedule, MORSE } from '../lib/codes.js';
import { C, TAU, clamp, lerp, rgba, label, ink, line, corners, out, dim, rng } from '../core.js';

const BANDS = [['GPS L1', 1.575], ['Wi-Fi', 2.44], ['5G', 3.5]];
const UNIT = 0.17, BW = 0.1;

export default function radio(env) {
  const plate = env.canvas.closest('.plate');
  let msg = 'RV', sched = morseSchedule(msg), total = sched.reduce((s, x) => s + x[1], 0) * UNIT + 1.6;
  let ftx = 2.44, frx = 2.44;
  const r = rng(3);
  const hist = [];   // received amplitude history for the strip chart
  const slider = () => plate.querySelector('input[data-call="tune"]');
  const api = {
    text(v) { msg = (v || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 14) || 'RV'; sched = morseSchedule(msg); total = sched.reduce((s, x) => s + x[1], 0) * UNIT + 1.6; },
    tune(v) { frx = +v; },
    band(f) { ftx = +f; frx = +f; const s = slider(); if (s) s.value = f; },
  };
  const lor = (a, b) => 1 / (1 + ((a - b) / BW) ** 2);
  function keyed(t) {
    let x = t % total;
    for (const [on, u] of sched) { const d = u * UNIT; if (x < d) return on; x -= d; }
    return false;
  }

  function draw(ctx, t, dt) {
    const { w, h } = env;
    const narrow = w < 640;
    const on = keyed(t), A = lor(frx, ftx), sig = on ? A : 0;
    hist.push(sig); if (hist.length > 240) hist.shift();

    /* ── top: transmitter → air → receiver ── */
    const gy = narrow ? h * 0.3 : h * 0.4;         // ground line
    const txX = w * 0.17, rxX = w * 0.83, mast = narrow ? h * 0.2 : h * 0.27;
    ink(ctx, 0.6, 1, C.g4); line(ctx, 14, gy, w - 14, gy);
    for (let x = 14; x < w - 14; x += 9) line(ctx, x, gy, x - 5, gy + 6);
    // mast helper
    const antenna = (x, col) => {
      ink(ctx, 1, 2, col); line(ctx, x, gy, x, gy - mast);
      ink(ctx, 1, 1.6, col); line(ctx, x - 14, gy - mast, x + 14, gy - mast); line(ctx, x - 14, gy - mast, x - 14, gy - mast + 9); line(ctx, x + 14, gy - mast, x + 14, gy - mast + 9);
    };
    antenna(txX, C.w); antenna(rxX, C.w);
    // spark gap + coil (TX)
    const sx = txX - 40, sy = gy - 18;
    ink(ctx, 0.9, 1.4); ctx.strokeRect(sx - 34, sy - 4, 22, 12);                              // battery box
    for (let k = 0; k < 6; k++) line(ctx, sx - 8 + k * 3, sy - 2, sx - 8 + k * 3 + 1.5, sy + 8);
    ink(ctx, 0.9, 1.4); line(ctx, sx + 4, sy + 2, txX - 10, sy + 2);
    ctx.fillStyle = '#000'; ctx.fillRect(txX - 10, sy - 8, 20, 20); ctx.strokeStyle = rgba(C.w, 0.9); ctx.strokeRect(txX - 10, sy - 8, 20, 20);
    ctx.fillStyle = C.w; ctx.fillRect(txX - 3, sy - 3, 6, 3); ctx.fillRect(txX - 3, sy + 3, 6, 3);
    if (on) { ctx.save(); ink(ctx, 1, 1.6, C.red); ctx.shadowColor = C.red; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(txX - 3, sy); for (let k = 1; k <= 4; k++) ctx.lineTo(txX + (k % 2 ? 3 : -3), sy - 0.5 + k * 1.5 + (r() - 0.5) * 2); ctx.stroke(); ctx.restore(); }
    label(ctx, 'SPARK GAP', txX, gy + 24, { size: 9.5, align: 'center', color: C.g3 });
    // telegraph key
    ink(ctx, 0.9, 2); line(ctx, txX - 70, gy + 40, txX - 20, gy + 40 - (on ? 0 : 7)); ctx.fillStyle = on ? C.red : C.w; ctx.beginPath(); ctx.arc(txX - 70, gy + 40, 4.5, 0, TAU); ctx.fill();
    label(ctx, 'KEY', txX - 70, gy + 60, { size: 9.5, align: 'center', color: C.g3 });

    // radiating arcs
    for (let k = 0; k < 7; k++) {
      const p = ((t * 0.45 + k / 7) % 1), rr = 12 + p * (rxX - txX) * 0.95;
      const a = on ? (1 - p) * 0.8 : (1 - p) * 0.1;
      ctx.strokeStyle = rgba(C.red, a); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(txX, gy - mast, rr, -0.55, 0.0); ctx.stroke();
    }
    // receiver: coherer + lamp
    const cx = rxX + 30, cy = gy - 18;
    ink(ctx, 0.9, 1.4); ctx.strokeRect(cx - 4, cy - 5, 36, 12);
    for (let k = 0; k < 7; k++) { ctx.fillStyle = rgba(C.w, 0.3 + (sig > 0.5 && (k + Math.floor(t * 20)) % 3 === 0 ? 0.6 : 0)); ctx.fillRect(cx + k * 4.5, cy + 1, 2, 2); }
    line(ctx, cx - 4, cy + 1, rxX, cy + 1);
    const lx = rxX + 22, ly = gy - 62, lr = 11;
    if (sig > 0.05) { const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr * 3.2); g.addColorStop(0, `rgba(255,45,32,${0.6 * sig})`); g.addColorStop(1, 'rgba(255,45,32,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, lr * 3.2, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.fillStyle = rgba(C.red, 0.12 + 0.88 * sig); ctx.fill(); ink(ctx, 0.9, 1.4); ctx.stroke();
    label(ctx, 'COHERER + LAMP', rxX, gy + 24, { size: 9.5, align: 'center', color: C.g3 });
    label(ctx, 'TRANSMITTER', txX, 22, { size: 10, align: 'center', color: C.g3, spacing: 2 });
    label(ctx, 'RECEIVER', rxX, 22, { size: 10, align: 'center', color: C.g3, spacing: 2 });

    /* ── bottom left: resonance curve ── */
    const px0 = 40, px1 = narrow ? w - 16 : w * 0.6, py0 = gy + (narrow ? 86 : 96), py1 = narrow ? h * 0.74 : h - 40;
    const X = (f) => px0 + ((f - 1) / 3) * (px1 - px0), Y = (a) => py1 - a * (py1 - py0);
    label(ctx, 'RESONANCE (MODEL)', px0, py0 - 12, { size: 9.5, color: C.g3, spacing: 2 });
    ink(ctx, 0.25, 1, C.g4);
    for (const f of [1, 2, 3, 4]) { line(ctx, X(f), py0, X(f), py1); label(ctx, f + ' GHz', X(f), py1 + 14, { size: 9, color: C.g3, align: 'center' }); }
    line(ctx, px0, py1, px1, py1);
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const f = 1 + (i / 200) * 3, x = X(f), y = Y(lor(f, ftx)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ink(ctx, 1, 1.8, C.w); ctx.stroke();
    ctx.lineTo(px1, py1); ctx.lineTo(px0, py1); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    for (const [n, f] of BANDS) { ink(ctx, 0.4, 1, C.g4); ctx.save(); ctx.setLineDash([2, 4]); line(ctx, X(f), py0, X(f), py1); ctx.restore(); label(ctx, n, X(f), py0 - 2, { size: 9, color: C.g4, align: 'center' }); }
    // receiver dial position
    ink(ctx, 1, 1.6, C.red); line(ctx, X(frx), py0 - 4, X(frx), py1);
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(X(frx), Y(A), 4, 0, TAU); ctx.fill();
    label(ctx, `RX ${frx.toFixed(2)} GHz`, clamp(X(frx), px0 + 40, px1 - 40), py1 + 28, { size: 9.5, color: C.red, align: 'center' });

    /* ── bottom right: what the receiver prints ── */
    const sx0 = narrow ? 16 : w * 0.66, sx1 = w - 16, sy0 = narrow ? py1 + 50 : py0, sy1 = narrow ? h - 28 : py1;
    label(ctx, 'RECEIVED TAPE', sx0, sy0 - 12, { size: 9.5, color: C.g3, spacing: 2 });
    ink(ctx, 0.25, 1, C.g4); line(ctx, sx0, sy1, sx1, sy1);
    ctx.beginPath();
    hist.forEach((v, i) => { const x = sx0 + (i / 240) * (sx1 - sx0), y = sy1 - (v + (0.04 * (r() - 0.5) + 0.03)) * (sy1 - sy0 - 6); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ink(ctx, 1, 1.5, C.red); ctx.stroke();

    const letters = [...msg].filter((c) => c !== ' ').map((c) => `${c} ${MORSE[c] || ''}`).join(' · ');
    out(env, 'radio-read', `<b>TX</b> ${msg} <span style="color:#6b6b6b">(${letters})</span><br><b>RX</b> tuned ${frx.toFixed(2)} GHz vs transmitter ${ftx.toFixed(3)} GHz → <b>${Math.round(A * 100)}%</b> ${A > 0.5 ? '· message received' : '· mostly noise'}`);
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
