/* PLATE IX — a telephone switchboard. Projects are plugs on the left; skills are jacks in five panels.
   Patch cords (red) connect a project to every skill it used — or, pick a skill to see who used it.
   Data is taken from the résumé's projects, roles and skills. */
import { C, clamp, rgba, label, ink, line, corners, out, TAU } from '../core.js';

const GROUPS = [
  ['PROGRAMMING', [['python', 'Python'], ['cpp', 'C / C++'], ['embc', 'Embedded C'], ['matlab', 'MATLAB'], ['lua', 'Lua']]],
  ['COMPUTER VISION & AI', [['opencv', 'OpenCV'], ['pytorch', 'PyTorch'], ['yolo', 'YOLOv8'], ['deepsort', 'DeepSORT'], ['midas', 'MiDaS'], ['sklearn', 'scikit-learn'], ['keras', 'Keras'], ['segformer', 'SegFormer'], ['dino', 'DINOv2'], ['faiss', 'FAISS'], ['onnx', 'ONNX Runtime'], ['rl', 'Reinforcement learning'], ['vlm', 'Vision-language models']]],
  ['ROBOTICS & EMBEDDED', [['stereo', 'Stereo vision'], ['jetson', 'Jetson'], ['slam', 'Visual SLAM'], ['orb', 'ORB · RANSAC'], ['lidar', 'LiDAR'], ['rpi', 'Raspberry Pi'], ['esp32', 'ESP32'], ['ardupilot', 'ArduPilot'], ['mavlink', 'MAVLink'], ['kalman', 'Kalman filter'], ['pid', 'PID control'], ['canuart', 'CAN · UART']]],
  ['DESIGN & SIMULATION', [['blender', 'Blender'], ['solid', 'SolidWorks'], ['cst', 'CST Microwave Studio'], ['choreo', 'Choregraphe'], ['vna', 'VNA · XRD'], ['print3d', '3D-printed RF']]],
  ['CLOUD & TOOLS', [['aws', 'AWS'], ['linux', 'Linux'], ['github', 'GitHub'], ['gcp', 'GCP Vertex AI'], ['docker', 'Docker · FastAPI']]],
];
const PROJECTS = [
  { id: 'slam', name: 'Dynamic SLAM', short: 'SLAM', uses: ['yolo', 'deepsort', 'midas', 'slam', 'orb', 'jetson', 'opencv', 'python'] },
  { id: 'landing', name: 'Precision landing', short: 'LAND', uses: ['yolo', 'deepsort', 'kalman', 'stereo', 'mavlink', 'ardupilot', 'esp32', 'rpi', 'lua', 'opencv', 'python'] },
  { id: 'drive', name: 'DriveSense', short: 'DRIV', uses: ['segformer', 'dino', 'faiss', 'vlm', 'onnx', 'docker', 'gcp', 'pytorch', 'python'] },
  { id: 'apple', name: 'Apple detection', short: 'APPL', uses: ['yolo', 'opencv', 'keras', 'python'] },
  { id: 'follow', name: 'Leader–follower', short: 'LEAD', uses: ['pid', 'embc', 'cpp'] },
  { id: 'degould', name: 'DeGould localisation', short: 'DEGO', uses: ['blender', 'python', 'opencv'] },
  { id: 'antenna', name: 'Antenna design', short: 'ANTN', uses: ['cst', 'vna', 'print3d'] },
  { id: 'drdo', name: 'DRDO velocity', short: 'DRDO', uses: ['matlab', 'kalman', 'opencv'] },
  { id: 'maze', name: 'AI Dungeon Maze', short: 'MAZE', uses: ['rl', 'sklearn', 'python'] },
];
const NAME = Object.fromEntries(GROUPS.flatMap(([, s]) => s));

export default function switchboard(env) {
  let sel = null, selT = -9, manualUntil = 0, autoIdx = 0, autoNext = 1.2, hover = null;
  let lay = null, key = '';

  function layout() {
    const { w, h } = env, narrow = w < 720, k = `${w}x${h}`;
    if (key === k && lay) return lay;
    const L = { narrow, plugs: [], jacks: {}, panels: [] };
    if (!narrow) {
      const top = 44, rowH = (h - top - 26) / PROJECTS.length, px = w * 0.285;
      PROJECTS.forEach((p, i) => L.plugs.push({ i, id: p.id, x: px, y: top + (i + 0.5) * rowH, lx: 18, rowH, align: 'left' }));
      const cols = [[1, 3], [2, 0, 4]], cx = [w * 0.4, w * 0.7], cwid = w * 0.27, rh = Math.min(18.5, (h - 70) / 24);
      cols.forEach((gs, ci) => {
        let y = top - 6;
        gs.forEach((gi) => {
          const [title, skills] = GROUPS[gi];
          L.panels.push({ title, x: cx[ci], y, w: cwid, h: 22 + skills.length * rh });
          skills.forEach(([id], si) => { L.jacks[id] = { x: cx[ci] + 14, y: y + 22 + (si + 0.5) * rh, w: cwid - 20, labelX: cx[ci] + 28, rh }; });
          y += 22 + skills.length * rh + 14;
        });
      });
    } else {
      const sx = (w - 24) / PROJECTS.length;
      PROJECTS.forEach((p, i) => L.plugs.push({ i, id: p.id, x: 12 + (i + 0.5) * sx, y: 58, lx: 12 + (i + 0.5) * sx, rowH: sx, align: 'center' }));
      const cols = [[1, 4], [2, 0, 3]], cwid = (w - 36) / 2, rh = Math.min(15, (h - 140) / 25);
      cols.forEach((gs, ci) => {
        let y = 112;
        gs.forEach((gi) => {
          const [title, skills] = GROUPS[gi], x = 12 + ci * (cwid + 12);
          L.panels.push({ title, x, y, w: cwid, h: 18 + skills.length * rh });
          skills.forEach(([id], si) => { L.jacks[id] = { x: x + 9, y: y + 18 + (si + 0.5) * rh, w: cwid - 14, labelX: x + 20, rh }; });
          y += 18 + skills.length * rh + 8;
        });
      });
    }
    key = k; lay = L; return L;
  }

  function draw(ctx, t, dt) {
    const { w, h, ptr } = env;
    const L = layout(), narrow = L.narrow;

    /* hit-testing → hover (desktop) / click (all) */
    let hit = null;
    const test = (px, py) => {
      for (const p of L.plugs) {
        if (narrow ? Math.hypot(px - p.x, py - p.y) < p.rowH * 0.55 : (px < p.x + 16 && Math.abs(py - p.y) < p.rowH / 2)) return { kind: 'p', id: p.id };
      }
      for (const [id, j] of Object.entries(L.jacks)) if (px >= j.x - 8 && px <= j.x + j.w && Math.abs(py - j.y) < j.rh / 2) return { kind: 's', id };
      return null;
    };
    if (ptr.in) hit = test(ptr.x, ptr.y);
    hover = hit;
    if (ptr.click) { const c = test(ptr.x, ptr.y); sel = c; selT = t; manualUntil = c ? t + 14 : 0; }
    if (!manualUntil || t > manualUntil) {
      if (t > autoNext) { autoIdx = (autoIdx + 1) % PROJECTS.length; autoNext = t + 3.8; sel = { kind: 'p', id: PROJECTS[autoIdx].id }; selT = t; }
    }
    const active = hover || sel;
    if (active && (!sel || sel.id !== active.id || sel.kind !== active.kind) && hover) { /* hover previews without changing sel */ }
    const cur = active || sel;
    const key2 = cur ? cur.kind + cur.id : '';
    if (key2 !== (draw.k || '')) { draw.k = key2; draw.t = t; }
    const f0 = clamp((t - (draw.t ?? t)) / 0.45);

    let lit = new Set(), srcPlugs = new Set(), pairs = [];
    if (cur?.kind === 'p') { const p = PROJECTS.find((x) => x.id === cur.id); p.uses.forEach((u) => { lit.add(u); pairs.push([p.id, u]); }); srcPlugs.add(p.id); }
    if (cur?.kind === 's') { PROJECTS.forEach((p) => { if (p.uses.includes(cur.id)) { srcPlugs.add(p.id); pairs.push([p.id, cur.id]); } }); lit.add(cur.id); }

    /* panels */
    for (const pn of L.panels) {
      ink(ctx, 0.5, 1); ctx.strokeRect(pn.x, pn.y, pn.w, pn.h);
      ctx.fillStyle = '#050505'; ctx.fillRect(pn.x + 1, pn.y + 1, pn.w - 2, narrow ? 15 : 18);
      label(ctx, pn.title, pn.x + 8, pn.y + (narrow ? 12 : 14), { size: narrow ? 8 : 9, color: C.g3, spacing: 1 });
    }
    /* jacks */
    for (const [id, j] of Object.entries(L.jacks)) {
      const on = lit.has(id), dim = cur && !on;
      ctx.beginPath(); ctx.arc(j.x, j.y, narrow ? 3.4 : 4.6, 0, TAU);
      ctx.fillStyle = on ? C.w : '#000'; ctx.fill(); ink(ctx, dim ? 0.3 : 0.9, 1.2, on ? C.w : C.w); ctx.stroke();
      label(ctx, NAME[id], j.labelX, j.y + 3.5, { size: narrow ? 8.5 : 10.5, color: on ? C.w : C.g4, alpha: dim ? 0.35 : 1 });
    }
    /* plugs */
    for (const p of L.plugs) {
      const on = srcPlugs.has(p.id), dim = cur && !on, pr = PROJECTS[p.i];
      ctx.beginPath(); ctx.arc(p.x, p.y, narrow ? 7 : 8, 0, TAU); ctx.fillStyle = on ? C.w : '#000'; ctx.fill();
      ink(ctx, dim ? 0.3 : 1, 1.6, on ? C.w : C.w); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, TAU); ctx.fillStyle = on ? '#000' : C.w; ctx.fill();
      if (!narrow) {
        label(ctx, `${String(p.i + 1).padStart(2, '0')}  ${pr.name}`, p.lx, p.y + 3.5, { size: 11.5, color: on ? C.w : C.g4, alpha: dim ? 0.4 : 1 });
        ink(ctx, dim ? 0.1 : 0.3, 1); line(ctx, 18, p.y + 13, p.x - 12, p.y + 13);
      } else label(ctx, String(p.i + 1), p.x, p.y + 22, { size: 9.5, color: on ? C.w : C.g3, align: 'center' });
    }
    if (narrow) label(ctx, cur?.kind === 'p' ? PROJECTS.find((x) => x.id === cur.id).name.toUpperCase() : cur?.kind === 's' ? NAME[cur.id].toUpperCase() : 'PROJECTS', 12, 30, { size: 10.5, color: cur ? C.w : C.g3, spacing: 1.5 });

    /* patch cords */
    pairs.forEach(([pid, sid], i) => {
      const p = L.plugs.find((q) => q.id === pid), j = L.jacks[sid];
      const f = clamp(f0 * 1.4 - i * 0.04);
      if (f <= 0) return;
      let sx, sy, ex, ey, c1, c2;
      if (!narrow) { sx = p.x + 10; sy = p.y; ex = j.x - 7; ey = j.y; const dx = ex - sx; c1 = [sx + dx * 0.45, sy + 34]; c2 = [ex - dx * 0.4, ey + 34]; }
      else { sx = p.x; sy = p.y + 9; ex = j.x; ey = j.y - 5; const dy = ey - sy; c1 = [sx, sy + dy * 0.5 + 26]; c2 = [ex, ey - dy * 0.3]; }
      ctx.save(); ctx.lineCap = 'round'; ink(ctx, 1, 1.7, C.red);
      ctx.beginPath(); ctx.moveTo(sx, sy);
      const N = 28, upto = Math.max(1, Math.floor(N * f));
      for (let s = 1; s <= upto; s++) { const u = s / N, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3; ctx.lineTo(a * sx + b * c1[0] + c * c2[0] + d * ex, a * sy + b * c1[1] + c * c2[1] + d * ey); }
      ctx.stroke(); ctx.restore();
    });

    /* readout */
    if (cur?.kind === 'p') { const p = PROJECTS.find((x) => x.id === cur.id); out(env, 'switch-read', `<b>${p.name}</b> is patched to ${p.uses.length} skills:<br>${p.uses.map((u) => NAME[u]).join(', ')}`); }
    else if (cur?.kind === 's') { const ps = PROJECTS.filter((p) => p.uses.includes(cur.id)); out(env, 'switch-read', `<b>${NAME[cur.id]}</b> is used by ${ps.length} project${ps.length === 1 ? '' : 's'}:<br>${ps.map((p) => p.name).join(', ')}`); }
    label(ctx, narrow ? '' : 'PROJECTS', 18, 28, { size: 10, color: C.g3, spacing: 2 });
    label(ctx, 'TAP A PLUG OR A JACK', w - 14, h - 10, { size: 9.5, color: C.g3, align: 'right' });
    corners(ctx, w, h, 5, 10, 0.3);
  }
  return { draw };
}
