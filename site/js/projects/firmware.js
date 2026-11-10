/* HVN firmware — illustrative model. Ground station → ESP32 telemetry → ArduPilot with Lua → smart servo,
   with the signals that cross those links drawn as logic-analyser traces: UART bytes, differential CAN, PWM. */
import { C, TAU, clamp, rgba, rng, label, ink, line, corners, grid, roundRect, arrow } from '../core.js';

export default function firmware(env) {
  const r = rng(9);
  const msg = [0xfd, 0x09, 0x00, 0x00, 0x2a, 0x01, 0x01, 0xa6];       // MAVLink v2 frames start with 0xFD (bytes illustrative)
  const uart = [1, 1, 1, 1], frames = [];
  for (const b of msg) { frames.push({ i: uart.length, b }); uart.push(0); for (let k = 0; k < 8; k++) uart.push((b >> k) & 1); uart.push(1, 1); }
  const ULEN = uart.length;
  const can = [0]; let run = 1;
  for (let i = 1; i < 96; i++) { let b = r() > 0.5 ? 1 : 0; if (run >= 5) b = can[i - 1] ^ 1; run = b === can[i - 1] ? run + 1 : 1; can.push(b); }
  const CLEN = can.length, fields = [['SOF', 1], ['ID', 11], ['CTRL', 6], ['DATA', 48], ['CRC', 15], ['ACK', 3], ['EOF', 12]];

  function draw(ctx, t) {
    const { w, h } = env, narrow = w < 640;
    grid(ctx, w, h, 28, 0.03);

    /* block diagram */
    const by = 44, bh = narrow ? 46 : 54, gap = narrow ? 14 : 40, bw = (w - 32 - gap * 3) / 4;
    const blocks = [['GROUND', 'STATION'], ['ESP32', 'telemetry'], ['ArduPilot', '+ Lua'], ['SMART', 'SERVO']];
    const links = [narrow ? 'Wi-Fi' : 'Wi-Fi · UDP', 'UART', narrow ? 'CAN' : 'CAN · UART'];
    label(ctx, 'LINK ARCHITECTURE', 16, 26, { size: 9.5, color: C.g3, spacing: 1.5 });
    blocks.forEach(([a, b], i) => {
      const x = 16 + i * (bw + gap);
      roundRect(ctx, x, by, bw, bh, 6); ctx.fillStyle = i === 2 ? 'rgba(255,255,255,0.07)' : '#000'; ctx.fill(); ink(ctx, i === 2 ? 1 : 0.7, i === 2 ? 1.6 : 1.1); ctx.stroke();
      label(ctx, a, x + bw / 2, by + bh / 2 - 3, { size: narrow ? 8.5 : 10.5, align: 'center', color: C.w });
      label(ctx, b, x + bw / 2, by + bh / 2 + 11, { size: narrow ? 8 : 9.5, align: 'center', color: C.g4 });
      if (i < 3) {
        const ax = x + bw, bx = x + bw + gap, y = by + bh / 2;
        ink(ctx, 0.6, 1.2); ctx.fillStyle = ctx.strokeStyle; arrow(ctx, ax + 2, y - 5, bx - 2, y - 5, 5); arrow(ctx, bx - 2, y + 5, ax + 2, y + 5, 5);
        if (!narrow) label(ctx, links[i], (ax + bx) / 2, y - 12, { size: 8.5, align: "center", color: C.g3 });
        for (const dirn of [1, -1]) {                                   // packets: commands out, status back
          const u = ((t * 0.7 + i * 0.3 + (dirn < 0 ? 0.5 : 0)) % 1), px = dirn > 0 ? ax + 4 + u * (gap - 8) : bx - 4 - u * (gap - 8);
          ctx.fillStyle = C.w; ctx.fillRect(px - 2, y + (dirn > 0 ? -7 : 3), 4, 4);
        }
      }
    });
    // Lua fault-recovery loop above ArduPilot
    const lx = 16 + 2 * (bw + gap) + bw / 2;
    ctx.save(); ctx.setLineDash([2, 3]); ink(ctx, 0.5, 1); ctx.beginPath(); ctx.arc(lx, by - 6, 9, Math.PI * 0.1, Math.PI * 2.9); ctx.stroke(); ctx.restore();
    label(ctx, 'monitor · recover', lx + 16, by - 4, { size: 8.5, color: C.g3 });

    /* logic analyser traces */
    const x0 = 66, ppb = Math.max(9, Math.min(14, (w - x0) / 28)), off = t * ppb * 3.4;
    const top = by + bh + 44, lh = (h - top - 26) / 4, lanesN = ['UART TX', 'CAN_H', 'CAN_L', 'PWM'];
    label(ctx, 'SIGNALS · ILLUSTRATIVE', 16, top - 22, { size: 9.5, color: C.g3, spacing: 1.5 });
    const trace = (idx, a, fn, len) => {
      const yHi = top + idx * lh + 8, yLo = top + (idx + 1) * lh - 10;
      label(ctx, lanesN[idx], 12, (yHi + yLo) / 2 + 3, { size: 9, color: C.g3 });
      ink(ctx, 0.07, 1); line(ctx, x0, yLo + 5.5, w - 8, yLo + 5.5);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, top + idx * lh - 2, w - x0 - 8, lh + 4); ctx.clip(); ctx.beginPath();
      const i0 = Math.floor(off / ppb) - 1, i1 = i0 + Math.ceil((w - x0) / ppb) + 3; let prev = null;
      for (let i = i0; i <= i1; i++) { const lv = fn(((i % len) + len) % len, i), x = x0 + i * ppb - off, y = yLo - lv * (yLo - yHi); if (prev === null) ctx.moveTo(x, y); else { ctx.lineTo(x, prev); ctx.lineTo(x, y); } ctx.lineTo(x + ppb, y); prev = y; }
      ink(ctx, a, 1.5); ctx.stroke(); ctx.restore();
      return [yHi, yLo];
    };
    const [uy] = trace(0, 1, (k) => uart[k], ULEN);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, top - 18, w - x0 - 8, 24); ctx.clip();
    for (let rep = -1; rep < 5; rep++) for (const f of frames) {
      const gi = f.i + rep * ULEN, xa = x0 + gi * ppb - off, xb = xa + 10 * ppb; if (xb < x0 || xa > w) continue;
      ink(ctx, 0.5, 1); ctx.beginPath(); ctx.moveTo(xa + 1, uy - 3); ctx.lineTo(xa + 1, uy - 8); ctx.lineTo(xb - 1, uy - 8); ctx.lineTo(xb - 1, uy - 3); ctx.stroke();
      label(ctx, `0x${f.b.toString(16).toUpperCase().padStart(2, '0')}`, (xa + xb) / 2, uy - 12, { size: 8.5, align: 'center', color: C.w });
    }
    ctx.restore();
    trace(1, 0.9, (k) => (can[k] === 0 ? 1 : 0.5), CLEN);
    const [, cly] = trace(2, 0.55, (k) => (can[k] === 0 ? 0 : 0.5), CLEN);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, cly, w - x0 - 8, 22); ctx.clip();
    for (let rep = -1; rep < 5; rep++) { let acc = 0; for (const [name, n] of fields) { const xa = x0 + (acc + rep * CLEN) * ppb - off, xb = xa + n * ppb; acc += n; if (xb < x0 || xa > w) continue; ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(xa + 1, cly + 6, xb - xa - 2, 11); if (n * ppb > 22) label(ctx, name, (xa + xb) / 2, cly + 15, { size: 8, align: 'center', color: C.g4 }); } }
    ctx.restore();
    trace(3, 0.8, (k, i) => { const p = Math.floor(i / 16), ph = ((i % 16) + 16) % 16; return ph < 2.2 + 1.5 * (0.5 + 0.5 * Math.sin(p * 0.6)) ? 1 : 0; }, 100000);
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw };
}
