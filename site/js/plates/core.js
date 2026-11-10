/* PLATE VIII — a 16 × 16 magnetic-core plane. Each bit is a ferrite ring at a wire crossing.
   A scanning read selects one X wire and one Y wire; reading a 1 flips it to 0, so it is written straight back. */
import { C, TAU, clamp, lerp, rgba, label, ink, line, corners, out, TAP } from '../core.js';

const N = 16;

export default function core(env) {
  const plate = env.canvas.closest('.plate');
  const input = plate.querySelector('input[data-call="text"]');
  const mem = new Uint8Array(32), flipT = new Float32Array(256).fill(-9);
  let scan = 0, scanAcc = 0, now = 0;
  const bit = (r, c) => (mem[r * 2 + (c >> 3)] >> (7 - (c & 7))) & 1;
  const flip = (r, c) => { mem[r * 2 + (c >> 3)] ^= 1 << (7 - (c & 7)); flipT[r * N + c] = now; };
  const decode = () => [...mem].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : b === 0 ? '\0' : '·')).join('').replace(/\0+$/, '');
  function write(text) {
    for (let i = 0; i < 32; i++) {
      const b = i < text.length ? text.charCodeAt(i) & 0x7f : 0;
      for (let k = 0; k < 8; k++) { const want = (b >> (7 - k)) & 1, r = i >> 1, c = (i & 1) * 8 + k; if (bit(r, c) !== want) flip(r, c); }
    }
  }
  write(input?.value || 'ESP32 CAN UART LUA C');
  const api = { text(v) { write(String(v).slice(0, 32)); } };

  function draw(ctx, t, dt) {
    const { w, h, ptr } = env;
    now = t;
    const narrow = w < 640;
    const S = narrow ? Math.min(w - 40, h - 70) : Math.min(h - 56, w * 0.62), pitch = S / (N + 1);
    const x0 = narrow ? (w - S) / 2 : 40, y0 = narrow ? 34 : (h - S) / 2 + 6;
    const X = (c) => x0 + (c + 1) * pitch, Y = (r) => y0 + (r + 1) * pitch;

    scanAcc += dt; while (scanAcc > 1 / 16) { scanAcc -= 1 / 16; scan = (scan + 1) % 256; }
    const sr = scan >> 4, sc = scan & 15;

    if (ptr.click) {
      const c = Math.round((ptr.x - x0) / pitch) - 1, r = Math.round((ptr.y - y0) / pitch) - 1;
      if (c >= 0 && c < N && r >= 0 && r < N) { flip(r, c); if (input) input.value = decode(); }
    }

    /* wires */
    for (let i = 0; i < N; i++) {
      const hot = i === sr, hotc = i === sc;
      ink(ctx, hot ? 1 : 0.16, hot ? 1.6 : 1, hot ? C.red : C.w); line(ctx, x0 + pitch * 0.4, Y(i), X(N - 1) + pitch * 0.6, Y(i));
      ink(ctx, hotc ? 1 : 0.16, hotc ? 1.6 : 1, hotc ? C.red : C.w); line(ctx, X(i), y0 + pitch * 0.4, X(i), Y(N - 1) + pitch * 0.6);
      if (i % 4 === 0) { label(ctx, i.toString(16).toUpperCase(), X(i), y0 + pitch * 0.2, { size: 8.5, color: C.g3, align: 'center' }); label(ctx, i.toString(16).toUpperCase(), x0 + pitch * 0.05, Y(i) + 3, { size: 8.5, color: C.g3 }); }
    }
    /* cores */
    const rx = pitch * 0.34, ry = pitch * 0.17;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = bit(r, c), age = t - flipT[r * N + c], pulse = clamp(1 - age / 0.6), reading = r === sr && c === sc;
      ctx.save(); ctx.translate(X(c), Y(r)); ctx.rotate(-Math.PI / 4);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fillStyle = v ? rgba(C.w, 0.28 + 0.4 * pulse) : '#000'; ctx.fill();
      ctx.strokeStyle = v ? C.w : rgba(C.w, reading ? 1 : 0.5); ctx.lineWidth = v ? 2 : 1.2; ctx.stroke();
      if (v) { ctx.fillStyle = C.w; ctx.beginPath(); ctx.moveTo(rx * 0.1, -ry * 0.9); ctx.lineTo(-rx * 0.28, -ry * 1.45); ctx.lineTo(-rx * 0.28, -ry * 0.35); ctx.fill(); }
      ctx.restore();
      if (reading) { ctx.strokeStyle = C.w; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(X(c), Y(r), pitch * 0.5, 0, TAU); ctx.stroke(); }
    }
    /* hex dump beside each row: two bytes, hex + ASCII */
    if (!narrow) {
      const hx = X(N - 1) + pitch * 1.6;
      label(ctx, 'ROW  HEX    ASCII', hx, y0 + pitch * 0.2, { size: 9, color: C.g3, spacing: 1 });
      for (let r = 0; r < N; r++) {
        const b0 = mem[r * 2], b1 = mem[r * 2 + 1], ch = (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·');
        const act = r === sr;
        label(ctx, r.toString(16).toUpperCase().padStart(2, '0'), hx, Y(r) + 3.5, { size: 10, color: act ? C.w : C.g3 });
        label(ctx, `${b0.toString(16).padStart(2, '0')} ${b1.toString(16).padStart(2, '0')}`.toUpperCase(), hx + 34, Y(r) + 3.5, { size: 10, color: act ? C.w : C.w });
        label(ctx, ch(b0) + ch(b1), hx + 92, Y(r) + 3.5, { size: 10.5, color: act ? C.w : C.g4 });
      }
    }
    out(env, 'core-read', `<b>256 bits</b> · reading core (${sr.toString(16).toUpperCase()},${sc.toString(16).toUpperCase()}) = ${bit(sr, sc)}<br>stored: <b>“${decode().replace(/</g, '&lt;')}”</b>`);
    label(ctx, `${TAP} A CORE TO FLIP IT`, 14, h - 12, { size: 9.5, color: C.g3 });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
