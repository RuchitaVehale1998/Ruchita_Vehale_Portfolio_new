/* Precision landing — illustrative model. A pad camera sees the drone (YOLO box), a Kalman filter tracks it through
   noisy detections, and corrective LANDING_TARGET packets stream back at 10 Hz until it settles. No GPS anywhere. */
import { C, TAU, clamp, lerp, rgba, rng, gauss, label, ink, line, corners, grid, tag } from '../core.js';

class KF {
  constructor(x) { this.x = x; this.v = 0; this.p00 = 900; this.p01 = 0; this.p11 = 900; }
  predict(dt, q = 900) {
    this.x += this.v * dt;
    const p00 = this.p00 + dt * (2 * this.p01 + dt * this.p11) + (q * dt ** 4) / 4, p01 = this.p01 + dt * this.p11 + (q * dt ** 3) / 2;
    this.p00 = p00; this.p01 = p01; this.p11 += q * dt * dt;
  }
  update(z, R) {
    const S = this.p00 + R, k0 = this.p00 / S, k1 = this.p01 / S, y = z - this.x;
    this.x += k0 * y; this.v += k1 * y;
    const p00 = (1 - k0) * this.p00, p01 = (1 - k0) * this.p01, p11 = this.p11 - k1 * this.p01;
    this.p00 = p00; this.p01 = p01; this.p11 = p11;
  }
}

export default function landing(env) {
  const r = rng(12);
  let d, kx, ky, tMeas = 0, holdT = 0, packets = [], meas = [], trail = [], waves = [], lastMsg = { ax: 0 };
  const G = () => env.h - 64, PX = () => env.w * 0.5;
  function reset() {
    const w = env.w;
    d = { x: PX() + (r() < 0.5 ? -1 : 1) * (w * (0.16 + r() * 0.12)), y: env.h * 0.14, vx: 0, vy: 0, landed: false };
    kx = new KF(d.x); ky = new KF(d.y); trail = []; meas = []; packets = []; holdT = 0; tMeas = 0;
  }
  reset();

  function draw(ctx, t, dt) {
    const { w, h } = env, narrow = w < 720, g = G(), px = PX();
    if (!d.landed) {
      kx.predict(dt); ky.predict(dt); tMeas += dt;
      if (tMeas >= 0.1) {
        tMeas -= 0.1;
        const zx = d.x + gauss(r) * 5, zy = d.y + gauss(r) * 5; kx.update(zx, 25); ky.update(zy, 25);
        meas.push({ x: zx, y: zy, a: 1 }); if (meas.length > 14) meas.shift();
        trail.push({ x: kx.x, y: ky.x }); if (trail.length > 160) trail.shift();
        lastMsg = { ax: Math.atan2(kx.x - px, Math.max(1, g - ky.x - 16)) };
        packets.push({ t0: t }); waves.push({ t0: t });
      }
      const alt = g - d.y - 16, align = clamp(1 - Math.abs(kx.x - px) / 90);
      const cmdVx = clamp(-1.5 * (kx.x - px), -95, 95), cmdVy = (alt > 90 ? 44 : alt > 30 ? 26 : 14) * align + 3;
      const wind = 38 * Math.sin(t * 0.9) + 22 * Math.sin(t * 2.3 + 1);
      d.vx += (cmdVx - d.vx) * dt * 2.6 + wind * dt; d.vy += (cmdVy - d.vy) * dt * 3; d.x += d.vx * dt; d.y += d.vy * dt;
      if (g - d.y - 16 < 2.5 && Math.abs(d.x - px) < 40) { d.landed = true; d.y = g - 16; holdT = 0; }
    } else { holdT += dt; if (holdT > 2.2) reset(); }
    meas.forEach((m) => (m.a = Math.max(0, m.a - dt * 0.7)));
    packets = packets.filter((p) => t - p.t0 < 0.45); waves = waves.filter((p) => t - p.t0 < 0.9);

    grid(ctx, w, h, 28, 0.03);
    /* ground + pad */
    ink(ctx, 0.5, 1); line(ctx, 0, g + 0.5, w, g + 0.5);
    for (let x = 0; x < w; x += 9) line(ctx, x, g, x - 5, g + 6);
    const camY = g - 20, half = (42 * Math.PI) / 180;
    ctx.beginPath(); ctx.moveTo(px, camY); ctx.lineTo(px - Math.tan(half) * camY, 0); ctx.lineTo(px + Math.tan(half) * camY, 0); ctx.closePath();
    ctx.fillStyle = rgba(C.w, 0.04); ctx.fill(); ctx.save(); ctx.setLineDash([4, 5]); ink(ctx, 0.3, 1); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(px - 70, g - 6, 140, 6); ink(ctx, 0.9, 1.2); ctx.strokeRect(px - 70, g - 6, 140, 6);
    ink(ctx, 0.7, 1.2); ctx.beginPath(); ctx.arc(px, g - 6, 22, Math.PI, TAU); ctx.stroke();
    ink(ctx, 0.9, 2); line(ctx, px, g - 6, px, g - 22);
    for (const s of [-9, 9]) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px + s, g - 24, 4.5, 0, TAU); ctx.fill(); ink(ctx, 1, 1.4); ctx.stroke(); }
    label(ctx, 'stereo pair · Raspberry Pi', px, g + 18, { size: 9.5, color: C.g3, align: 'center' });
    for (const wv of waves) { const a = (t - wv.t0) / 0.9; ink(ctx, (1 - a) * 0.5, 1.2); ctx.beginPath(); ctx.arc(px, g - 36, 6 + a * 60, -Math.PI * 0.82, -Math.PI * 0.18); ctx.stroke(); }

    /* Kalman track */
    ink(ctx, 0.95, 1.5); ctx.beginPath(); trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    meas.forEach((m) => { ctx.fillStyle = rgba(C.w, m.a * 0.55); ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, TAU); ctx.fill(); });
    const ur = 6 + Math.sqrt(Math.max(0, kx.p00)) * 0.9;
    ctx.save(); ctx.setLineDash([3, 3]); ink(ctx, 0.6, 1); ctx.beginPath(); ctx.ellipse(kx.x, ky.x, ur, ur * 0.7, 0, 0, TAU); ctx.stroke(); ctx.restore();

    /* coaxial drone */
    ctx.save(); ctx.translate(d.x, d.y);
    ctx.fillStyle = '#000'; ctx.fillRect(-11, -6, 22, 12); ink(ctx, 1, 1.4); ctx.strokeRect(-11, -6, 22, 12);
    for (const [oy, wd] of [[-10, 20 + 6 * Math.sin(t * 40)], [-14, 20 + 6 * Math.cos(t * 40)]]) line(ctx, -wd, oy, wd, oy);
    line(ctx, 0, -6, 0, -14); line(ctx, -9, 6, -12, 12); line(ctx, 9, 6, 12, 12); ctx.restore();
    const lm = meas[meas.length - 1];
    if (lm) { ink(ctx, 1, 1.4); ctx.strokeRect(lm.x - 28, lm.y - 24, 56, 40); tag(ctx, 'drone', lm.x - 28, lm.y - 33, C.w, { size: 9 }); }
    for (const p of packets) { const k = (t - p.t0) / 0.45, x = lerp(px, d.x, k), y = lerp(g - 36, d.y, k); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = C.w; ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }

    /* HUD */
    const tiny = w < 340, hx = w - 16, hy = narrow ? 56 : 26;
    const ang = `angle_x ${lastMsg.ax >= 0 ? '+' : ''}${lastMsg.ax.toFixed(3)} rad (model)`;
    if (tiny) {                                                          // small phones: the HUD would collide with the GPS badge, so it moves to the bottom
      label(ctx, 'LANDING_TARGET · 10 Hz', 14, h - 26, { size: 9.5, color: C.w });
      label(ctx, ang, 14, h - 12, { size: 9, color: C.g4 });
    } else {
      label(ctx, 'LANDING_TARGET · 10 Hz', hx, hy, { size: 10.5, align: 'right', color: C.w });
      label(ctx, ang, hx, hy + 16, { size: 9.5, align: 'right', color: C.g4 });
    }
    if (!narrow) ['motion', 'brightness', 'YOLOv8', 'YOLOv8 + DeepSORT'].forEach((m, i) => label(ctx, (i === 3 ? '● ' : '○ ') + m, hx, hy + 40 + i * 15, { size: 9.5, align: 'right', color: i === 3 ? C.w : C.g3 }));
    const gx = 22, gy = narrow ? 56 : 40;
    ink(ctx, 0.8, 1.4); ctx.beginPath(); ctx.arc(gx, gy, 6, 0, TAU); ctx.stroke(); line(ctx, gx - 12, gy + 5, gx + 12, gy - 5);
    ink(ctx, 1, 2, C.red); line(ctx, gx - 13, gy - 11, gx + 13, gy + 11);
    label(ctx, 'GPS denied', gx + 20, gy + 3, { size: 10, color: C.w });
    if (!tiny) label(ctx, d.landed ? 'LANDED' : 'detect · track · correct · descend', narrow ? 14 : gx - 8, narrow ? h - 14 : gy + 24, { size: 9.5, color: C.g3 });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, resize() { if (d) { d.landed = false; reset(); } } };
}
