/* PLATE I — a Turing machine you can run: tape slides under a read/write head,
   the state diagram lights the rule just applied, the rule table is mirrored into the page. */
import { TM, PROGRAMS } from '../lib/tm.js';
import { C, MONO, TAU, clamp, lerp, rgba, label, ink, line, circle, arrow, corners, out, REDUCED } from '../core.js';

const ALLOWED = { increment: /[01]/g, invert: /[01]/g, add: /[1+]/g, beaver: /$^/g };

export default function turing(env) {
  const plate = env.canvas.closest('.plate');
  const inputEl = plate.querySelector('input[data-call="input"]');
  let key = 'increment', m, running = REDUCED ? false : false, speed = 5, acc = 0, pos = 0, flashAt = -9, flashIdx = null, lastMove = 0, hotKey = null, hotAt = -9;

  const prog = () => PROGRAMS[key];
  function sanitize(s) { const p = prog(); const keep = (s.match(ALLOWED[key]) || []).join(''); return key === 'beaver' ? '' : (keep || p.input); }
  function load(input) {
    m = new TM(prog(), input); pos = m.head; running = false; hotKey = null; flashIdx = null;
    const run = plate.querySelector('#turing-run'); if (run) run.textContent = 'Run ▸';
    rulesTable();
  }
  function rulesTable() {
    const p = prog();
    const rows = Object.entries(p.rules).map(([k, [w, mv, n]]) => {
      const [s, r] = k.split(',');
      const sh = (c) => (c === ' ' ? '␣' : c);
      return `<tr data-k="${k}"><td>${s}</td><td>${sh(r)}</td><td>${sh(w)}</td><td>${mv}</td><td>${n}</td></tr>`;
    }).join('');
    out(env, 'rules', `<p class="cap">${p.name} — rule table</p><table><tr><th>state</th><th>read</th><th>write</th><th>move</th><th>next</th></tr>${rows}</table><p class="cap" style="margin-top:8px;text-transform:none;letter-spacing:0">${p.note}</p>`);
    env.__rulesBox = plate.querySelector('[data-out="rules"]');
  }
  function mark() {
    const box = env.__rulesBox; if (!box) return;
    box.querySelectorAll('tr[data-k]').forEach((tr) => tr.classList.toggle('hot', tr.dataset.k === hotKey));
  }
  function doStep(t) {
    const before = m.head;
    if (m.step()) { hotKey = m.last; hotAt = t; lastMove = m.head - before; flashIdx = m.written; flashAt = t; mark(); }
    else { running = false; const run = plate.querySelector('#turing-run'); if (run) run.textContent = 'Run ▸'; }
    if (m.halted) { running = false; const run = plate.querySelector('#turing-run'); if (run) run.textContent = 'Run ▸'; }
  }
  load(prog().input); if (inputEl) inputEl.value = prog().input;

  const api = {
    program(k) { key = k; const p = prog(); if (inputEl) { inputEl.value = p.input; inputEl.disabled = k === 'beaver'; inputEl.placeholder = p.hint; } load(p.input); },
    input(v) { const s = sanitize(v); load(s); },
    step() { running = false; if (!m.halted) doStep(env.now()); const run = plate.querySelector('#turing-run'); if (run) run.textContent = 'Run ▸'; },
    run() {
      if (m.halted || m.stuck) load(inputEl && key !== 'beaver' ? sanitize(inputEl.value) : prog().input);
      if (REDUCED) { while (!m.halted && !m.stuck && m.steps < 2000) m.step(); hotKey = m.last; mark(); running = false; return false; }   // no animation: run to the end
      running = !running; return running;
    },
    reset() { load(key === 'beaver' ? '' : sanitize(inputEl?.value || prog().input)); },
    speed(v) { speed = +v; },
    state() { return { program: key, steps: m.steps, halted: m.halted, tape: m.tape(), ones: m.ones() }; },   // for tests
  };

  /* diagram layout helpers */
  function nodePos(states, cx, cy, R) {
    const n = states.length, pts = {};
    states.forEach((s, i) => {
      if (n <= 3) pts[s] = [cx + (i - (n - 1) / 2) * R * 1.35, cy + (n === 3 && i === 1 ? R * 0.28 : 0)];
      else { const a = -Math.PI / 2 + (i / n) * TAU + Math.PI / n; pts[s] = [cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.78]; }
    });
    return pts;
  }

  function draw(ctx, t, dt) {
    const { w, h } = env;
    const narrow = w < 640;
    if (running) { acc += dt; if (acc > 1.05 - speed * 0.095) { acc = 0; doStep(t); } }
    pos = lerp(pos, m.head, clamp(dt * 9));

    /* ── tape ── */
    const cs = Math.min(54, (w - 24) / (narrow ? 9 : 15)), ty = narrow ? 92 : 98, cx = w / 2;
    const vis = Math.ceil(w / cs / 2) + 2;
    label(ctx, 'TAPE', 14, ty - cs / 2 - 30, { size: 10, color: C.g3, spacing: 2 });
    label(ctx, `HEAD ${m.head >= 0 ? '+' : ''}${m.head}`, w - 14, ty - cs / 2 - 30, { size: 10, color: C.g3, align: 'right' });
    for (let k = -vis; k <= vis; k++) {
      const i = Math.round(pos) + k, x = cx + (i - pos) * cs;
      if (x < -cs || x > w + cs) continue;
      const s = m.read(i), isHead = i === m.head;
      const flashK = flashIdx === i ? clamp(1 - (t - flashAt) / 0.7) : 0;
      ctx.fillStyle = isHead ? 'rgba(241,241,241,0.1)' : 'rgba(255,255,255,0.025)';
      ctx.fillRect(x - cs / 2 + 1, ty - cs / 2, cs - 2, cs);
      ctx.strokeStyle = flashK > 0 ? rgba(C.w, 0.4 + 0.6 * flashK) : isHead ? C.w : rgba(C.w, 0.32); ctx.lineWidth = isHead ? 1.6 : 1;
      ctx.strokeRect(x - cs / 2 + 1, ty - cs / 2, cs - 2, cs);
      const blank = s === prog().blank;
      label(ctx, blank && prog().blank === ' ' ? '·' : s, x, ty + cs * 0.17, { size: cs * 0.5, align: 'center', color: flashK > 0.2 ? C.w : blank ? C.g3 : C.w, alpha: blank ? 0.6 : 1 });
      const fade = clamp(1 - Math.abs(x - cx) / (w * 0.55));
      if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${(1 - fade) * 0.7})`; ctx.fillRect(x - cs / 2, ty - cs / 2 - 1, cs, cs + 2); }
    }
    // head mechanism
    const hy = ty - cs / 2 - 8;
    ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.moveTo(cx - 14, hy); ctx.lineTo(cx + 14, hy); ctx.lineTo(cx + 5, hy + 12); ctx.lineTo(cx - 5, hy + 12); ctx.closePath(); ctx.fill();
    ink(ctx, 1, 1.4, C.w); line(ctx, cx, hy, cx, hy - 14);
    ctx.fillStyle = '#000'; ctx.fillRect(cx - 24, hy - 38, 48, 24); ink(ctx, 1, 1.4, C.w); ctx.strokeRect(cx - 24, hy - 38, 48, 24);
    label(ctx, m.halted ? 'HALT' : m.stuck ? 'STUCK' : m.state, cx, hy - 21.5, { size: 12, color: C.w, align: 'center' });
    if (lastMove && !m.halted) { ctx.fillStyle = rgba(C.w, 0.7); const d = lastMove > 0 ? 1 : -1; ctx.beginPath(); ctx.moveTo(cx + d * 40, hy - 26); ctx.lineTo(cx + d * 30, hy - 32); ctx.lineTo(cx + d * 30, hy - 20); ctx.fill(); }

    /* ── state diagram ── */
    const p = prog();
    const states = [...new Set([p.start, ...Object.values(p.rules).map((r) => r[2]), ...Object.keys(p.rules).map((k) => k.split(',')[0])])];
    states.sort((a, b) => (a === p.halt) - (b === p.halt));
    const dx = narrow ? w * 0.5 : w * 0.36, dy = narrow ? ty + cs / 2 + 128 : ty + cs / 2 + 112, Rr = Math.min(narrow ? 86 : 108, w * (narrow ? 0.25 : 0.14));
    const pts = nodePos(states, dx, dy, Rr);
    label(ctx, 'STATE DIAGRAM', 14, ty + cs / 2 + 34, { size: 10, color: C.g3, spacing: 2 });
    // edges
    const groups = {};
    for (const [k, [wr, mv, n]] of Object.entries(p.rules)) {
      const [s, r] = k.split(',');
      const g = `${s}>${n}`; (groups[g] ||= { s, n, items: [], keys: [] });
      groups[g].items.push(`${r === ' ' ? '␣' : r}/${wr === ' ' ? '␣' : wr}${mv}`); groups[g].keys.push(k);
    }
    for (const g of Object.values(groups)) {
      const a = pts[g.s], b = pts[g.n]; if (!a || !b) continue;
      const hot = hotKey && g.keys.includes(hotKey) && t - hotAt < 1.4;
      const col = hot ? C.w : rgba(C.w, 0.4);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = hot ? 2 : 1;
      const lbl = g.items.join('  ');
      if (g.s === g.n) {
        const ang = Math.atan2(a[1] - dy, a[0] - dx) || -Math.PI / 2, lx = a[0] + Math.cos(ang) * 30, ly = a[1] + Math.sin(ang) * 30;
        ctx.beginPath(); ctx.arc(lx, ly, 13, 0, TAU); ctx.stroke();
        label(ctx, lbl, a[0] + Math.cos(ang) * 58, a[1] + Math.sin(ang) * 46 + 3, { size: 9.5, color: hot ? C.w : C.g4, align: Math.cos(ang) > 0.3 ? 'left' : Math.cos(ang) < -0.3 ? 'right' : 'center' });
      } else {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1;
        const bend = 26, qx = mx + (nx / nl) * bend, qy = my + (ny / nl) * bend;
        const ang0 = Math.atan2(qy - a[1], qx - a[0]), ang1 = Math.atan2(b[1] - qy, b[0] - qx);
        const sx = a[0] + Math.cos(ang0) * 17, sy = a[1] + Math.sin(ang0) * 17, ex = b[0] - Math.cos(ang1) * 18, ey = b[1] - Math.sin(ang1) * 18;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(qx, qy, ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 8 * Math.cos(ang1 - 0.4), ey - 8 * Math.sin(ang1 - 0.4)); ctx.lineTo(ex - 8 * Math.cos(ang1 + 0.4), ey - 8 * Math.sin(ang1 + 0.4)); ctx.fill();
        label(ctx, lbl, (mx + qx) / 2 + (nx / nl) * 8, (my + qy) / 2 + (ny / nl) * 8 + 3, { size: 9.5, color: hot ? C.w : C.g4, align: 'center' });
      }
    }
    // nodes
    for (const s of states) {
      const [x, y] = pts[s], on = s === m.state || (m.halted && s === p.halt);
      ctx.beginPath(); ctx.arc(x, y, 17, 0, TAU);
      ctx.fillStyle = on ? C.w : '#000'; ctx.fill();
      ink(ctx, 1, on ? 2 : 1.2, on ? C.w : C.w); ctx.stroke();
      if (s === p.halt) { ink(ctx, 0.8, 1, on ? C.w : C.w); circle(ctx, x, y, 21); }
      label(ctx, s, x, y + 4, { size: 12, align: 'center', color: on ? '#000' : C.w });
    }
    // start marker
    const st = pts[p.start]; ctx.strokeStyle = C.g4; ctx.fillStyle = C.g4; ctx.lineWidth = 1; arrow(ctx, st[0] - 52, st[1] - 14, st[0] - 20, st[1] - 5, 6);

    /* ── readout ── */
    const rx = narrow ? 14 : w * 0.72, ry = narrow ? h - 74 : ty + cs / 2 + 62;
    const result = m.halted ? m.tape().trim() : '…';
    label(ctx, 'STEP', rx, ry, { size: 10, color: C.g3, spacing: 2 }); label(ctx, String(m.steps), rx + 70, ry, { size: 13 });
    label(ctx, 'STATE', rx, ry + 22, { size: 10, color: C.g3, spacing: 2 }); label(ctx, m.halted ? 'halted' : m.stuck ? 'no rule' : m.state, rx + 70, ry + 22, { size: 13, color: m.halted ? C.w : C.w });
    label(ctx, 'TAPE', rx, ry + 44, { size: 10, color: C.g3, spacing: 2 });
    label(ctx, (m.tape().replace(/ /g, '·') || '(blank)').slice(0, 22), rx + 70, ry + 44, { size: 13 });
    if (key === 'beaver') label(ctx, `ones: ${m.ones()}`, rx + 70 + (narrow ? 130 : 0), ry + (narrow ? 22 : 66), { size: 13, color: m.halted ? C.w : C.w });
    if (m.halted && key !== 'beaver') label(ctx, `→ ${result}`, rx, ry + 70, { size: 15, color: C.w });
    corners(ctx, w, h, 8, 12, 0.35);
  }
  return { draw, api };
}
