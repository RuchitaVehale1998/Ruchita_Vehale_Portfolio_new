/* A 1-bit, ordered-dither eye. Renders into an offscreen canvas (W×H):
   transparent outside the lids, opaque black inside, white / red dots for light.
   gaze ∈ [-1,1]², open ∈ [0,1] (blink), t in seconds (pupil breathes). */
const BAYER8 = (() => {
  const b2 = [[0, 2], [3, 1]];
  let m = b2;
  for (let n = 2; n < 8; n *= 2) {
    const s = m.length, o = Array.from({ length: s * 2 }, () => Array(s * 2));
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const v = m[y][x] * 4;
      o[y][x] = v; o[y][x + s] = v + 2; o[y + s][x] = v + 3; o[y + s][x + s] = v + 1;
    }
    m = o;
  }
  return m.flat().map((v) => (v + 0.5) / 64);
})();

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createEye(W = 240, H = 160, red = [255, 45, 32], white = [238, 238, 238]) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  const S = W / 2;

  function render(gx = 0, gy = 0, open = 1, t = 0) {
    const ix = gx * 0.2, iy = gy * 0.1;
    const ri = 0.31, rp = 0.112 + 0.012 * Math.sin(t * 0.9);
    for (let y = 0; y < H; y++) {
      const v = (H / 2 - (y + 0.5)) / S;
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const u = (x + 0.5 - W / 2) / S, au = Math.abs(u);
        d[o + 3] = 0;
        if (au >= 1) continue;
        const shape = Math.pow(1 - u * u, 0.85);
        const lower = -0.27 * shape;
        const upper = lower + 0.012 + (0.46 * shape - lower - 0.012) * open;
        const thr = BAYER8[(y & 7) * 8 + (x & 7)];
        let on = false, rgb = white, solid = false;

        const dTop = v - upper, dBot = v - lower;
        if (v <= upper + 0.024 && v >= lower - 0.012) {
          solid = true;                                    // lids + interior are opaque black base
          if (dTop > -0.0 && dTop < 0.024) { on = true; }  // heavy upper lash line
          else if (dBot < 0.012 && dBot > -0.012) { on = true; }
        }
        if (v < upper && v > lower) {
          solid = true;
          const dU = upper - v, dL = v - lower;
          let L = 0.74 - 0.5 * au * au;
          L *= 0.30 + 0.70 * sm(0, 0.17, dU);
          L *= 0.50 + 0.50 * sm(0, 0.11, dL);
          const du = u - ix, dv = v - iy, r = Math.hypot(du, dv);
          if (r < ri) {
            const ang = Math.atan2(dv, du);
            const fib = 0.5 + 0.5 * Math.sin(ang * 34 + 3 * Math.sin(ang * 7 + r * 22));
            let Li = 0.28 + 0.62 * fib * (1 - 0.55 * (r / ri));
            Li *= 0.30 + 0.70 * sm(ri, ri * 0.7, r);
            const k = (r - 0.5 * ri) / (0.07 * ri);
            Li += 0.28 * Math.exp(-k * k);
            Li *= 0.30 + 0.70 * sm(0, 0.14, dU);
            L = r < rp ? 0 : Li;
            rgb = red;
            const sx = u - (ix - 0.1), sy = v - (iy + 0.1);
            if (Math.hypot(sx, sy) < 0.05) { L = 1; rgb = white; }
          }
          on = L > thr;
        }
        // brow crease
        if (open > 0.3 && au < 0.8) {
          const crease = upper + 0.1 * (1 - au * au) + 0.02;
          if (Math.abs(v - crease) < 0.0075) { on = true; solid = true; rgb = white; }
        }
        if (!solid) continue;
        d[o + 3] = 255;
        if (on) { d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; }
        else { d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; }
      }
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  return { render, canvas: cv, W, H };
}
