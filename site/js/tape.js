/* The fixed paper tape on the left edge: 5-hole ITA2 punched with the engineer's name, fed by scrolling.
   The red read-head row is decoded live. (Pattern shown left-to-right as bits 1–5; E and T are single-hole.) */
import { ita2 } from './lib/codes.js';
import { C, MONO } from './core.js';

const MSG = 'RUCHITA VEHALE   R AND D ENGINEER   COMPUTER VISION   ROBOTICS   EMBEDDED   RF   ML   BRISTOL   ';
const ROW = 13;

export function initTape(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0;
  const rows = [...MSG].map((ch) => ({ ch, bits: ita2(ch) }));
  const L = rows.length;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    draw();
  }
  function draw() {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const narrow = W < 44, x0 = narrow ? 3 : 7, tw = narrow ? W - 8 : 40;
    const off = scrollY * 0.6, headY = Math.round(H * 0.5);
    // paper
    ctx.fillStyle = '#161616'; ctx.fillRect(x0, 0, tw, H);
    ctx.fillStyle = '#222'; ctx.fillRect(x0, 0, 1, H); ctx.fillRect(x0 + tw - 1, 0, 1, H);
    const cols = [0.12, 0.28, 0.44, 0.6, 0.76, 0.92]; // b1 b2 feed b3 b4 b5
    const r0 = Math.floor(off / ROW) - 1, r1 = r0 + Math.ceil(H / ROW) + 3;
    let headRow = null;
    for (let r = r0; r <= r1; r++) {
      const y = r * ROW - off, row = rows[((r % L) + L) % L];
      const isHead = headY >= y && headY < y + ROW;
      if (isHead) { headRow = row; ctx.fillStyle = 'rgba(241,241,241,0.16)'; ctx.fillRect(x0, y, tw, ROW); }
      // feed hole
      ctx.fillStyle = isHead ? C.w : '#000';
      ctx.beginPath(); ctx.arc(x0 + tw * cols[2], y + ROW / 2, narrow ? 0.9 : 1.3, 0, Math.PI * 2); ctx.fill();
      [0, 1, 3, 4, 5].forEach((ci, bi) => {
        if (row.bits[bi] !== '1') return;
        ctx.fillStyle = isHead ? C.w : '#000';
        ctx.beginPath(); ctx.arc(x0 + tw * cols[ci], y + ROW / 2, narrow ? 1.7 : 2.7, 0, Math.PI * 2); ctx.fill();
        if (!isHead) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.6; ctx.stroke(); }
      });
    }
    // read head
    ctx.strokeStyle = C.red; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, headY + 0.5); ctx.lineTo(x0 + tw + 2, headY + 0.5); ctx.stroke();
    if (!narrow && headRow) {
      ctx.fillStyle = C.w; ctx.fillRect(x0 + tw + 3, headY - 8, 14, 16);
      ctx.fillStyle = '#000'; ctx.font = `500 11px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(headRow.ch === ' ' ? '·' : headRow.ch, x0 + tw + 10, headY + 1);
    }
    // ruler ticks
    ctx.fillStyle = '#2d2d2d';
    for (let y = -((off * 1) % 40); y < H; y += 40) ctx.fillRect(0, Math.round(y), 4, 1);
  }
  const req = () => { if (!raf) raf = requestAnimationFrame(draw); };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', size);
  size();
}
