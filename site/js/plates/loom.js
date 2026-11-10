/* PLATE III — a Jacquard loom: a chain of punched cards, twelve hooks, and the cloth they weave.
   A hole lifts a warp thread; the cloth is the card chain made visible. Click holes to reprogram it. */
import { C, rgba, clamp, lerp, rng, label, ink, line, corners, out } from '../core.js';

const COLS = 12, ROWS = 18;
const ART = {
  rv: [
    '............', '.####..#...#', '.#...#.#...#', '.#...#.#...#', '.####...#.#.', '.#.#....#.#.', '.#..#...#.#.', '.#...#...#..',
    '............', '............', '.####..#...#', '.#...#.#...#', '.#...#.#...#', '.####...#.#.', '.#.#....#.#.', '.#..#...#.#.', '.#...#...#..', '............',
  ],
  eye: [
    '............', '............', '............', '...######...', '.##......##.', '#...####...#', '#..######..#', '#..##..##..#', '#..######..#', '#...####...#',
    '.##......##.', '...######...', '............', '............', '............', '............', '............', '............',
  ],
};
const fromArt = (a) => Array.from({ length: ROWS }, (_, k) => Uint8Array.from([...a[ROWS - 1 - k]].map((c) => (c === '#' ? 1 : 0)))); // card k = image row (bottom first)

export default function loom(env) {
  let cards = fromArt(ART.rv), abs = 6, tick = 0, scroll = 6, sh = 1, dir = 1;
  const r = rng(5);
  const api = {
    preset(n) {
      if (n === 'rv' || n === 'eye') cards = fromArt(ART[n]);
      else if (n === 'clear') cards = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
      else cards = Array.from({ length: ROWS }, () => Uint8Array.from({ length: COLS }, () => (r() < 0.38 ? 1 : 0)));
    },
  };
  const lay = () => {
    const { w, h } = env, narrow = w < 640;
    const chainW = narrow ? w * 0.54 : w * 0.4, cardH = Math.min(25, (h - 78) / 14);
    const clothX = chainW + (narrow ? 24 : 54), clothW = w - clothX - 18;
    return { narrow, chainX: 14, chainW, cardH, clothX, clothW, cw: clothW / COLS, shedY: h * 0.34, cy: h * 0.5 };
  };

  function draw(ctx, t, dt) {
    const { w, h, ptr } = env;
    const L = lay();
    tick += dt;
    if (tick > 1.1) { tick = 0; abs++; sh = 0; dir = -dir; }
    sh = Math.min(1, sh + dt / 0.6);
    scroll = lerp(scroll, abs, clamp(dt * 7));
    const cur = abs % ROWS;

    /* click: punch / fill a hole on any visible card */
    if (ptr.click) {
      const k = Math.round((ptr.y - L.cy) / L.cardH + scroll);
      const hc = (L.chainW - 12) / COLS, c = Math.floor((ptr.x - L.chainX - 6) / hc);
      if (c >= 0 && c < COLS && ptr.x < L.chainX + L.chainW) { const card = cards[((k % ROWS) + ROWS) % ROWS]; card[c] ^= 1; }
    }

    /* card chain */
    label(ctx, 'CARD CHAIN', L.chainX, 24, { size: 10, color: C.g3, spacing: 2 });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 34, L.chainX + L.chainW + 4, h - 44); ctx.clip();
    const hc = (L.chainW - 12) / COLS;
    for (let k = Math.floor(scroll) - 8; k <= Math.floor(scroll) + 8; k++) {
      const y = L.cy + (k - scroll) * L.cardH - L.cardH / 2;
      const fade = clamp(1 - Math.abs(k - scroll) / 8.5), card = cards[((k % ROWS) + ROWS) % ROWS], isCur = k === abs;
      ctx.fillStyle = rgba('#d8d8d8', 0.25 + 0.7 * fade); ctx.fillRect(L.chainX + 6, y + 1, L.chainW - 12, L.cardH - 3);
      for (let c = 0; c < COLS; c++) {
        if (!card[c]) { ctx.fillStyle = rgba('#000', 0.1); ctx.fillRect(L.chainX + 6 + c * hc + hc / 2 - 1, y + L.cardH / 2 - 1, 2, 2); continue; }
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(L.chainX + 6 + c * hc + hc / 2, y + L.cardH / 2 - 0.5, Math.min(hc, L.cardH) * 0.3, 0, 6.3); ctx.fill();
      }
      if (isCur) { ink(ctx, 1, 2, C.w); ctx.strokeRect(L.chainX + 3, y - 1, L.chainW - 6, L.cardH + 1); }
    }
    ctx.restore();
    ctx.fillStyle = C.w; ctx.beginPath(); ctx.moveTo(L.chainX + L.chainW + 8, L.cy); ctx.lineTo(L.chainX + L.chainW + 20, L.cy - 6); ctx.lineTo(L.chainX + L.chainW + 20, L.cy + 6); ctx.fill();
    label(ctx, `READING CARD ${cur + 1}/${ROWS}`, L.chainX, h - 12, { size: 9.5, color: C.w });

    /* hooks + warp */
    const { clothX, clothW, cw, shedY } = L, active = cards[cur];
    label(ctx, 'HOOKS · WARP', clothX, 24, { size: 10, color: C.g3, spacing: 2 });
    ink(ctx, 0.6, 1, C.g4); line(ctx, clothX - 4, 44, clothX + clothW + 4, 44);
    for (let c = 0; c < COLS; c++) {
      const x = clothX + (c + 0.5) * cw, lifted = active[c] === 1, lift = lifted ? 16 : 0;
      ink(ctx, lifted ? 1 : 0.5, lifted ? 1.8 : 1, lifted ? C.w : C.w);
      line(ctx, x, 44, x, shedY - lift);
      ctx.beginPath(); ctx.arc(x, shedY - lift, 2.5, 0, 6.3); ctx.fillStyle = lifted ? C.w : C.w; ctx.fill();
      ink(ctx, 0.25, 1, C.g4); line(ctx, x, shedY - lift, x, h - 18);       // warp continues through the cloth
    }
    /* shuttle */
    const sx = dir > 0 ? lerp(clothX - 10, clothX + clothW + 10, sh) : lerp(clothX + clothW + 10, clothX - 10, sh);
    ctx.fillStyle = C.red; ctx.fillRect(sx - 14, shedY - 2, 28, 5); ctx.fillStyle = '#000'; ctx.fillRect(sx - 3, shedY - 1, 6, 3);

    /* cloth: newest row at the shed, older rows pushed down; image reads upright */
    const cs = cw, rowsVis = Math.max(1, Math.floor((h - shedY - 24) / cs));
    for (let j = 0; j < rowsVis; j++) {
      const row = cards[(((abs - j) % ROWS) + ROWS) % ROWS], y = shedY + 4 + j * cs;
      for (let c = 0; c < COLS; c++) {
        const x = clothX + c * cw, seen = j > 0 || (dir > 0 ? x + cw / 2 < sx : x + cw / 2 > sx);
        if (!seen) continue;
        ctx.fillStyle = row[c] ? rgba(C.w, 0.92) : '#161616'; ctx.fillRect(x + 1, y + 1, cw - 2, cs - 2);
      }
    }
    label(ctx, 'CLOTH', clothX, h - 6, { size: 9.5, color: C.g3, spacing: 2 });
    label(ctx, 'CLICK A HOLE TO REPROGRAM', w - 14, h - 6, { size: 9.5, color: C.g3, align: 'right' });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
