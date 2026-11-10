/* Hero art — a LiDAR point cloud being built (relates to the SLAM / mapping work).
   A street of buildings, two cars and lamp posts is held as points. A sensor sweeps left to right across its field of
   view: points flash white as they are hit, then fade to a dim memory, so the map is "built" every pass. Illustrative.
   Used by hero.js, which draws it into a box above the Turing tape. draw(ctx, t, dt, R) with R = {x, y, w, h}. */
import { C, clamp, rng, label, ink, line } from '../core.js';

const SPAN = 0.95, PERIOD = 3.8, LEVELS = 8;          // half field of view (rad), seconds per sweep

function buildScene() {
  const r = rng(11), P = [];
  const add = (x, y, z) => P.push(x, y, z);
  const box = (x0, x1, y0, y1, z0, z1, step) => {      // sample the faces that face the sensor: back, top, both sides
    for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) add(x, y, z0);
    for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) add(x, y1, z);
    for (const x of [x0, x1]) for (let y = y0; y <= y1; y += step) for (let z = z0; z <= z1; z += step) add(x, y, z);
  };
  for (let z = 1.6; z < 36; z *= 1.045) {              // ground, in scan rows that thin out with distance
    const step = 0.3 * (1 + z * 0.06);
    for (let x = -9.5; x <= 9.5; x += step) add(x + (r() - 0.5) * 0.12, 0, z + (r() - 0.5) * 0.04 * z);
  }
  for (const s of [-1, 1]) {                           // buildings along both sides
    for (let z = 4 + r() * 2; z < 34;) {
      const len = 5 + r() * 5, hgt = 3.5 + r() * 6, x = s * (5.3 + r() * 0.9);
      for (let y = 0.4; y <= hgt; y += 0.55) for (let zz = z; zz <= z + len; zz += 0.38) if (((Math.round(y / 0.55) + Math.round(zz / 0.38)) & 1) === 0 || r() < 0.25) add(x + (r() - 0.5) * 0.05, y, zz);
      for (let y = 0.4; y <= hgt; y += 0.55) for (let xx = Math.min(x, s * 9.2); xx <= Math.max(x, s * 9.2); xx += 0.4) add(xx, y, z);
      z += len + 1 + r() * 2.5;
    }
  }
  box(-0.9, 0.9, 0.25, 0.95, 9, 13.2, 0.16); box(-0.7, 0.7, 0.95, 1.5, 10, 12.2, 0.16);     // a car ahead
  box(2.4, 4.1, 0.25, 0.95, 17, 21.2, 0.2); box(2.6, 3.9, 0.95, 1.5, 18, 20.2, 0.2);        // a parked car
  for (const z of [7, 16, 26]) for (const s of [-1, 1]) { for (let y = 0; y <= 5.6; y += 0.1) add(s * 4.5, y, z); for (let a = 0; a < 1.2; a += 0.1) add(s * (4.5 - a), 5.6, z); }
  return Float32Array.from(P);
}

export default function cloud(env) {
  const P = buildScene(), n = P.length / 3;
  const buckets = Array.from({ length: LEVELS }, () => []);

  function draw(ctx, t, dt, R) {
    const f = R.w * 0.6, ccx = R.x + R.w / 2, ccy = R.y + R.h * 0.58;
    const yaw = 0.3 * Math.sin(t * 0.17), pit = 0.3, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
    const cam = [0, 3.4, -5.5];
    const u = (t / PERIOD) % 1, sweep = -SPAN + 2 * SPAN * u;
    const proj = (x, y, z) => {
      const dx = x - cam[0], dy = y - cam[1], dz = z - cam[2];
      const xr = dx * cy - dz * sy, zr = dx * sy + dz * cy, yc = dy * cp + zr * sp, zc = -dy * sp + zr * cp;
      return zc < 0.4 ? null : [ccx + (f * xr) / zc, ccy - (f * yc) / zc, zc];
    };
    for (const b of buckets) b.length = 0;
    const stride = env.small ? 2 : 1;                   // phones: draw every other point (the canvas is small, and it saves battery)
    for (let i = 0; i < n; i += stride) {
      const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2], az = Math.atan2(x, z);
      if (az < -SPAN || az > SPAN) continue;
      const p = proj(x, y, z); if (!p) continue;
      const age = (((u - (az + SPAN) / (2 * SPAN)) % 1) + 1) % 1, b = 0.1 + 0.9 * Math.exp(-age * 3.4);
      buckets[Math.min(LEVELS - 1, Math.floor(b * LEVELS))].push(p[0], p[1], clamp((f * 0.055) / p[2], 1.1, 2.8));
    }
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    buckets.forEach((arr, k) => {
      if (!arr.length) return;
      ctx.fillStyle = `rgba(241,241,241,${(0.1 + 0.9 * ((k + 1) / LEVELS)).toFixed(2)})`; ctx.beginPath();
      for (let j = 0; j < arr.length; j += 3) ctx.rect(arr[j] - arr[j + 2] / 2, arr[j + 1] - arr[j + 2] / 2, arr[j + 2], arr[j + 2]);
      ctx.fill();
    });
    const a = proj(0, 0, 0.2), b = proj(Math.sin(sweep) * 38, 0, Math.cos(sweep) * 38);   // the sweeping ray, on the ground
    if (a && b) { ink(ctx, 0.85, 1.3, C.red); line(ctx, a[0], a[1], b[0], b[1]); }
    const s0 = proj(0, 1.8, 0);
    if (s0) { ctx.fillStyle = C.w; ctx.fillRect(s0[0] - 3, s0[1] - 3, 6, 6); }
    ctx.restore();

    const deg = (sweep * 180) / Math.PI;
    label(ctx, R.w < 460 ? 'LIDAR SCAN · ILLUSTRATIVE' : 'LIDAR POINT CLOUD · MAP BUILDING · ILLUSTRATIVE', R.x + 4, R.y + 14, { size: 9.5, color: C.g4 });
    label(ctx, `SWEEP ${deg >= 0 ? '+' : '−'}${Math.abs(deg).toFixed(0)}°`, R.x + R.w - 4, R.y + 14, { size: 9.5, color: C.w, align: 'right' });
  }
  return { draw };
}
