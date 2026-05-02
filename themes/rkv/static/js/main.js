/* RKV Portfolio — main.js */
(function () {
  'use strict';

  /* ── Custom cursor ── */
  const cur  = document.getElementById('cur');
  const ring = document.getElementById('cur-ring');
  if (cur && ring) {
    let mx=0, my=0, rx=0, ry=0;
    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      cur.style.left = mx + 'px'; cur.style.top = my + 'px';
    });
    (function tick() {
      rx += (mx - rx) * 0.1; ry += (my - ry) * 0.1;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(tick);
    })();
    const hov = 'a,button,.proj-card,.ex-card,.ic,.pub-card,.clink,.nav-mark,.ach-item,.exp-company,.sk-chip';
    document.querySelectorAll(hov).forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('hovering'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('hovering'));
    });
  }

  /* ── Nav scroll style ── */
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => nav.classList.toggle('s', scrollY > 40), { passive: true });
  }

  /* ── Nav active section highlight ── */
  const secs = document.querySelectorAll('section[id]');
  const nls  = document.querySelectorAll('.nav-links a');
  window.addEventListener('scroll', () => {
    let cur = '';
    secs.forEach(s => { if (scrollY >= s.offsetTop - 220) cur = s.id; });
    nls.forEach(a => a.classList.toggle('act', a.getAttribute('href') === '#' + cur));
  }, { passive: true });

  /* ── Scroll reveal ── */
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('on');
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.rv').forEach(el => obs.observe(el));

  /* ── Project filter ── */
  window.filterProj = function (f, btn) {
    document.querySelectorAll('.pf').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    document.querySelectorAll('.proj-card').forEach(c => {
      const fs = c.dataset.filter ? c.dataset.filter.split(',') : [];
      c.style.display = (f === 'all' || fs.includes(f)) ? '' : 'none';
    });
  };

  /* ── Project modal ── */
  const overlay = document.getElementById('mo');
  window.openModal = function (card) {
    document.getElementById('mo-cat').textContent   = card.dataset.category || '';
    document.getElementById('mo-title').textContent = card.dataset.title    || '';
    document.getElementById('mo-prob').textContent  = card.dataset.problem  || '';
    document.getElementById('mo-app').textContent   = card.dataset.approach || '';
    document.getElementById('mo-res').textContent   = card.dataset.result   || '';

    const tags   = (card.dataset.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const pipeEl = document.getElementById('mo-pipe');
    if (pipeEl) {
      pipeEl.innerHTML = tags.slice(0, 6).map((t, i) =>
        `<span class="mp-node${i === 0 || i === tags.length - 1 ? ' hi' : ''}">${t}</span>` +
        (i < Math.min(tags.length - 1, 5) ? '<span class="mp-arr">›</span>' : '')
      ).join('');
    }

    let imp = [];
    try { imp = JSON.parse(card.dataset.impact || '[]'); } catch (e) {}
    document.getElementById('mo-imp').innerHTML = imp.map(x =>
      `<div class="mi"><div class="mi-v">${x.value}</div><div class="mi-k">${x.label}</div></div>`
    ).join('');

    document.getElementById('mo-tags').innerHTML = tags.map(t =>
      `<span class="mo-tag">${t}</span>`
    ).join('');

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.closeModalBg  = e => { if (e.target === overlay) _close(); };
  window.closeModalBtn = () => _close();
  function _close() { overlay.classList.remove('open'); document.body.style.overflow = ''; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _close(); });

  /* ── Contact form ── */
  window.sendContact = function () {
    const n = document.getElementById('cfn').value.trim();
    const e = document.getElementById('cfe').value.trim();
    const s = document.getElementById('cfs').value.trim();
    const m = document.getElementById('cfm').value.trim();
    if (!n || !e || !m) { alert('Please fill in name, email, and message.'); return; }
    window.location.href = `mailto:ruchita.uob.2024@gmail.com?subject=${encodeURIComponent(s || 'Enquiry from ' + n)}&body=${encodeURIComponent(m + '\n\nFrom: ' + n + '\nEmail: ' + e)}`;
    document.getElementById('cfok').style.display = 'block';
  };

  /* ── Easter egg: Konami code ── */
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let ki = 0;
  document.addEventListener('keydown', e => {
    if (e.key === KONAMI[ki]) { ki++; } else { ki = 0; }
    if (ki === KONAMI.length) {
      ki = 0;
      const flash = document.querySelector('.konami-flash');
      const msg   = document.querySelector('.konami-msg');
      if (flash && msg) {
        flash.classList.add('show'); msg.classList.add('show');
        setTimeout(() => flash.classList.remove('show'), 300);
        setTimeout(() => msg.classList.remove('show'), 3200);
      }
    }
  });

  /* ── Easter egg: triple-click initials ── */
  const mark = document.querySelector('.nav-mark');
  if (mark) {
    let clicks = 0, timer;
    mark.addEventListener('click', () => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 600);
      if (clicks >= 3) {
        clicks = 0;
        const msg = document.createElement('div');
        msg.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:9001;font-family:var(--mono);font-size:10px;color:var(--a);background:var(--bg2);border:1px solid var(--a);padding:10px 18px;letter-spacing:0.16em;opacity:0;transition:opacity 0.4s;pointer-events:none;';
        msg.textContent = '← This portfolio is itself a project.';
        document.body.appendChild(msg);
        requestAnimationFrame(() => { msg.style.opacity = '1'; });
        setTimeout(() => { msg.style.opacity = '0'; setTimeout(() => msg.remove(), 400); }, 3500);
      }
    });
  }

  /* ── Easter egg: type "slam" to highlight the SLAM project card ── */
  let typed = '';
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    typed += e.key.toLowerCase();
    if (typed.length > 8) typed = typed.slice(-8);
    if (typed.endsWith('slam')) {
      const card = document.querySelector('[data-filter*="slam"]');
      if (card) {
        document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          card.style.outline = '1px solid var(--a)';
          setTimeout(() => { card.style.outline = ''; }, 2000);
        }, 600);
      }
    }
  });

})();
