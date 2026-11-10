/* Split-flap metrics board: each cell cycles through characters like a Solari board, then settles. */
import { REDUCED, rng } from './core.js';

const ALPHA = ' 0123456789.%+ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function initFlaps(root) {
  const r = rng(11);
  const boards = [...root.querySelectorAll('.fm')].map((fm) => {
    const target = [...fm.dataset.val];
    const box = fm.querySelector('.fl');
    box.innerHTML = target.map(() => '<span class="fc"> </span>').join('');
    return { fm, target, cells: [...box.children] };
  });
  root.classList.add('on');

  function roll(b, delay = 0) {
    b.cells.forEach((cell, k) => {
      const goal = b.target[k];
      if (REDUCED) { cell.textContent = goal; return; }
      let n = 0;
      const total = 7 + k * 4 + Math.floor(r() * 5);
      setTimeout(() => {
        const iv = setInterval(() => {
          n++;
          cell.textContent = n >= total ? goal : ALPHA[Math.floor(r() * ALPHA.length)];
          cell.classList.remove('flip'); void cell.offsetWidth; cell.classList.add('flip');
          if (n >= total) { clearInterval(iv); if (/[0-9]/.test(goal) === false && goal !== ' ' && goal !== '.') cell.classList.remove('red'); }
        }, 62);
      }, delay + k * 40);
    });
  }
  boards.forEach((b, i) => {
    roll(b, 300 + i * 220);
    b.fm.addEventListener('click', () => roll(b));   // click a board to re-roll it
    b.fm.style.cursor = 'pointer';
  });
}
