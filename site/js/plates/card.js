/* PLATE XI — an 80-column IBM card punched in Hollerith code (logic in lib/codes.js, tested).
   Type to punch your own; hover or tap a column to read its punches. */
import { hollerith, hollerithName, HOLL_ROWS } from '../lib/codes.js';
import { C, clamp, rgba, label, corners, out } from '../core.js';

const SUPPORTED = /[A-Z0-9 &\-/.,]/;

export default function card(env) {
  const plate = env.canvas.closest('.plate');
  const input = plate.querySelector('input[data-call="text"]');
  let text = '';
  const set = (v) => { text = [...String(v).toUpperCase()].map((c) => (SUPPORTED.test(c) ? c : ' ')).join('').slice(0, 80).padEnd(80, ' '); };
  set(input?.value || 'RUCHITA K VEHALE / R&D ENGINEER / BRISTOL UK');
  const api = { text: set };
  let sel = 0;

  function drawStripe(ctx, x, y, cw, ch, from, to, t) {
    const n = to - from, pad = 14, top = ch * 0.17;
    const pitch = (cw - pad * 2) / n, rp = (ch - top - 14) / 12;
    // card body with cut corner
    ctx.beginPath(); ctx.moveTo(x + 16, y); ctx.lineTo(x + cw, y); ctx.lineTo(x + cw, y + ch); ctx.lineTo(x, y + ch); ctx.lineTo(x, y + 16); ctx.closePath();
    ctx.fillStyle = '#e8e8e8'; ctx.fill();
    ctx.fillStyle = C.red; ctx.fillRect(x + 20, y + 3, cw - 24, 2);                           // the red edge stripe
    for (let k = 0; k < n; k++) {
      const col = from + k, cx = x + pad + k * pitch, ch0 = text[col];
      if (col === sel) { ctx.fillStyle = 'rgba(255,45,32,0.22)'; ctx.fillRect(cx, y + 8, pitch, ch - 14); }
      label(ctx, ch0 === ' ' ? '' : ch0, cx + pitch / 2, y + top - 6, { size: Math.min(11, pitch * 0.95), color: '#111', align: 'center' });
      const pun = hollerith(ch0);
      for (let r = 0; r < 12; r++) {
        const hy = y + top + r * rp, hw = pitch * 0.58, hh = rp * 0.52;
        if (pun.includes(r)) { ctx.fillStyle = col === sel ? C.red : '#000'; ctx.fillRect(cx + (pitch - hw) / 2, hy + (rp - hh) / 2, hw, hh); }
        else if (r >= 2 && pitch > 5) label(ctx, HOLL_ROWS[r], cx + pitch / 2, hy + rp * 0.68, { size: Math.min(8, pitch * 0.7), color: 'rgba(0,0,0,0.28)', align: 'center' });
      }
    }
    return { x, y, cw, ch, pad, pitch, from, n };
  }

  function draw(ctx, t) {
    const { w, h, ptr } = env;
    const narrow = w < 640;
    const stripes = [];
    if (narrow) {
      const ch = (h - 54) / 2;
      stripes.push(drawStripe(ctx, 12, 22, w - 24, ch, 0, 40, t), drawStripe(ctx, 12, 22 + ch + 12, w - 24, ch, 40, 80, t));
    } else {
      stripes.push(drawStripe(ctx, 14, 14, w - 28, h - 28, 0, 80, t));
    }
    // hover / tap → select column
    if (ptr.in || ptr.click) {
      for (const s of stripes) {
        if (ptr.y >= s.y && ptr.y <= s.y + s.ch && ptr.x >= s.x + s.pad && ptr.x < s.x + s.pad + s.n * s.pitch) sel = s.from + Math.floor((ptr.x - s.x - s.pad) / s.pitch);
      }
    }
    sel = clamp(sel, 0, 79);
    const chh = text[sel];
    out(env, 'card-read', `<b>COLUMN ${sel + 1}</b> = ${chh === ' ' ? 'space' : chh}<br>punches: <b>${hollerithName(chh)}</b> <span style="color:#6b6b6b">(zone 12 / 11 / 0, then digit)</span>`);
    corners(ctx, w, h, 4, 10, 0.25);
  }
  return { draw, api };
}
