/* PLATE II — camera obscura, side elevation. One pinhole inverts the world; two pinholes turn the
   shift between their images into depth:  d = f·B / Z  →  Z = f·B / d.  (Units are relative to the box.) */
import { C, clamp, rgba, label, ink, line, circle, dim, hatch, corners, out, centerline, arrow } from '../core.js';

export default function obscura(env) {
  const plate = env.canvas.closest('.plate');
  let Y = 0.35, Z = 0.6, stereo = false;
  const slider = (call, v) => { const el = plate.querySelector(`input[data-call="${call}"]`); if (el) el.value = v; };
  const api = { y(v) { Y = +v; }, z(v) { Z = +v; }, stereo(b) { stereo = !!b; } };

  function draw(ctx, t) {
    const { w, h, ptr } = env;
    const narrow = w < 640;
    const top = h * 0.14, bot = h * 0.86, cy = h * 0.5;
    const wallX = w * (narrow ? 0.5 : 0.55), screenX = w * 0.9, f = screenX - wallX, maxD = wallX - 56;
    if (ptr.down && ptr.x < wallX - 8) {
      Z = clamp((wallX - ptr.x) / maxD, 0.3, 1); Y = clamp(-(ptr.y - cy) / (h * 0.28), -1, 1);
      slider('z', Z.toFixed(2)); slider('y', Y.toFixed(2));
    }
    const dist = Z * maxD, ox = wallX - dist;
    const yc = cy - Y * h * 0.27, hgt = h * 0.2, pTop = yc - hgt / 2, pBot = yc + hgt / 2;
    const B = h * 0.15;
    const holes = stereo ? [cy - B / 2, cy + B / 2] : [cy];

    // box interior
    ctx.fillStyle = '#050505'; ctx.fillRect(wallX, top, f, bot - top);
    hatch(ctx, wallX, top, f, bot - top, 9, 0.06);
    ink(ctx, 0.8, 1.2); line(ctx, wallX, top, screenX, top); line(ctx, wallX, bot, screenX, bot);
    // wall with pinholes
    ink(ctx, 1, 2.2);
    let y0 = top;
    for (const hy of holes) { line(ctx, wallX, y0, wallX, hy - 3); y0 = hy + 3; }
    line(ctx, wallX, y0, wallX, bot);
    // screen
    ink(ctx, 0.9, 1.2); line(ctx, screenX, top, screenX, bot);
    for (let y = top; y <= bot; y += 12) line(ctx, screenX, y, screenX + (Math.round((y - top) / 12) % 5 ? 3 : 7), y);

    centerline(ctx, 16, cy, screenX + 20, cy, 0.35);

    // object (vertical arrow) + rays
    const cols = [C.red, C.w];
    const imgs = holes.map((hy, k) => {
      const fy = (py) => hy + (hy - py) * (f / dist);
      const a = fy(pTop), b = fy(pBot);
      for (const [py, col, al] of [[pTop, cols[k], 0.9], [pBot, k ? C.g4 : C.g4, 0.7]]) {
        ctx.save(); ctx.setLineDash(k ? [4, 3] : []); ink(ctx, al * 0.5, 1, col); line(ctx, ox, py, wallX, hy);
        ink(ctx, al, 1.1, col); line(ctx, wallX, hy, screenX, fy(py)); ctx.restore();
      }
      return { a, b, col: cols[k] };
    });
    // the object
    ink(ctx, 1, 2, C.red); line(ctx, ox, pBot, ox, pTop);
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(ox, pTop - 8); ctx.lineTo(ox - 7, pTop + 5); ctx.lineTo(ox + 7, pTop + 5); ctx.fill();
    ink(ctx, 0.8, 1, C.w); line(ctx, ox - 9, pBot, ox + 9, pBot);
    label(ctx, 'object', ox, pBot + 18, { size: 10, align: 'center', color: C.g4 });
    // images
    imgs.forEach((im, k) => {
      ctx.save(); ctx.lineCap = 'round'; ink(ctx, 1, 4, im.col); line(ctx, screenX, im.a, screenX, im.b); ctx.restore();
      const s = Math.sign(im.a - im.b) || 1;            // inverted: the object's top lands on the far side
      ctx.fillStyle = im.col; ctx.beginPath();
      ctx.moveTo(screenX, im.a + s * 9); ctx.lineTo(screenX - 6, im.a - s * 2); ctx.lineTo(screenX + 6, im.a - s * 2); ctx.fill();
    });
    // pinhole labels & dims
    holes.forEach((hy, k) => { circle(ctx, wallX, hy, 3.4, '#000'); label(ctx, stereo ? `pinhole ${k + 1}` : 'pinhole', wallX - 8, hy + (k ? 16 : stereo ? -8 : -10), { size: 9.5, align: 'right', color: C.g4 }); });
    dim(ctx, wallX, bot + 18, screenX, bot + 18, 'f', { off: 0 });
    dim(ctx, ox, bot + 38, wallX, bot + 38, 'Z', { off: 0 });
    if (stereo) dim(ctx, wallX + 14, holes[0], wallX + 14, holes[1], 'B', { off: 0, size: 9 });
    label(ctx, 'inverted image', screenX - 8, top - 8, { size: 10, align: 'right', color: C.g4 });
    label(ctx, 'screen', screenX + 12, bot + 4, { size: 9.5, color: C.g3 });

    // readout
    const imgH = Math.abs(imgs[0].b - imgs[0].a);
    if (stereo) {
      const d = Math.abs(imgs[0].a - imgs[1].a) - B, zEst = (f * B) / d;
      out(env, 'obscura-read', `<b>d</b> = f·B / Z = ${d.toFixed(1)} px<br><b>Z</b> = f·B / d = ${(zEst / maxD).toFixed(2)} <span style="color:#6b6b6b">(true ${Z.toFixed(2)}, box units)</span>`);
      dim(ctx, screenX + 18, imgs[0].a, screenX + 18, imgs[1].a, 'd+B', { off: 0, size: 9 });
    } else {
      out(env, 'obscura-read', `<b>image height</b> = h·f / Z = ${imgH.toFixed(0)} px, inverted<br><span style="color:#6b6b6b">Z = ${Z.toFixed(2)} box units. Switch on the second pinhole to read depth.</span>`);
    }
    label(ctx, 'DRAG THE OBJECT', 14, 24, { size: 10, color: C.g3, spacing: 2 });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
