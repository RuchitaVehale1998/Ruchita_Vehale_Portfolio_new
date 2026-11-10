/* Altair-style front panel (set a plate number in binary, press EXAMINE) + the index overlay. */
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];

export function initPanel() {
  const secs = [...document.querySelectorAll('[data-n]')].sort((a, b) => +a.dataset.n - +b.dataset.n);
  const col = document.getElementById('pcol'), num = document.getElementById('pnum');
  const leds = [], sws = [];
  let pending = 0, current = 0;

  for (let b = 3; b >= 0; b--) {
    const wrap = document.createElement('div'); wrap.className = 'bit';
    const led = document.createElement('i'); led.className = 'led';
    const sw = document.createElement('button'); sw.className = 'sw'; sw.setAttribute('aria-label', `Address bit ${b}`);
    const lab = document.createElement('small'); lab.textContent = String(1 << b);
    sw.addEventListener('click', () => { pending ^= 1 << b; paintSwitches(); });
    wrap.append(led, sw, lab); col.append(wrap); leds[b] = led; sws[b] = sw;
  }
  const paintSwitches = () => sws.forEach((s, b) => s.classList.toggle('on', !!(pending & (1 << b))));
  const panelEl = document.getElementById('panel');
  const paintLeds = () => {
    leds.forEach((l, b) => l.classList.toggle('on', !!(current & (1 << b))));
    num.textContent = ROMAN[current] || String(current);
    panelEl.classList.toggle('away', current === 0);   // stay out of the way of the hero's metrics board
  };

  function go(n) {
    const el = secs.find((s) => +s.dataset.n === n);
    if (!el) return false;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    return true;
  }
  document.getElementById('examine').addEventListener('click', (e) => {
    if (!go(pending)) { const b = e.currentTarget; b.textContent = 'NO SUCH PLATE'; setTimeout(() => (b.textContent = 'EXAMINE'), 1100); }
  });

  function update() {
    let n = 0;
    for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * 0.45) n = +s.dataset.n;
    if (n !== current) { current = n; paintLeds(); }
  }
  addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update(); paintLeds(); paintSwitches();

  /* index overlay */
  const ov = document.getElementById('indexov'), list = document.getElementById('index-list');
  const plates = secs.filter((s) => +s.dataset.n > 0);
  list.innerHTML = plates.map((s) => {
    const yr = (s.querySelector('.eyebrow')?.textContent.split('·')[1] || '').trim();
    return `<li data-n="${s.dataset.n}"><span>${ROMAN[+s.dataset.n]}</span><b>${s.dataset.title}</b><i></i><time>${yr}</time></li>`;
  }).join('');
  const open = () => { ov.hidden = false; };
  const close = () => { ov.hidden = true; };
  document.getElementById('index-open').addEventListener('click', open);
  ov.addEventListener('pointerdown', (e) => { if (e.target === ov) close(); });
  list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) { close(); go(+li.dataset.n); } });
  addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if (e.key === 'Escape') close();
    else if (!typing && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'i') ov.hidden ? open() : close();
  });
}
