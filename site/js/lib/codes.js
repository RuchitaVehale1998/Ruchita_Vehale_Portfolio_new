/* Historical codes: Hollerith card punches, ITA2 (Baudot–Murray) 5-hole tape, Morse. Pure data + functions. */

/* ── Hollerith (IBM 80-column card) ─────────────────────────────
   Rows top→bottom: 12, 11, 0, 1 … 9  (indices 0..11).
   digits: single punch · A–I: 12+1..9 · J–R: 11+1..9 · S–Z: 0+2..9      */
export const HOLL_ROWS = ['12', '11', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const row = (name) => HOLL_ROWS.indexOf(String(name));
export function hollerith(ch) {
  ch = ch.toUpperCase();
  if (ch === ' ') return [];
  if (ch >= '0' && ch <= '9') return [row(ch)];
  if (ch >= 'A' && ch <= 'I') return [row('12'), row(ch.charCodeAt(0) - 64)];
  if (ch >= 'J' && ch <= 'R') return [row('11'), row(ch.charCodeAt(0) - 73)];
  if (ch >= 'S' && ch <= 'Z') return [row('0'), row(ch.charCodeAt(0) - 81)];
  const sp = { '&': ['12'], '-': ['11'], '/': ['0', '1'], '.': ['12', '3', '8'], ',': ['0', '3', '8'] }[ch];
  return sp ? sp.map(row) : [];
}
export const HOLL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 &-/.,';
export function hollerithName(ch) {
  const r = hollerith(ch);
  return r.length ? r.map((i) => HOLL_ROWS[i]).join('-') : '(no punch)';
}

/* ── ITA2 five-hole tape ─────────────────────────────────────────
   Pattern written left-to-right as bits 1..5; 1 = hole. E and T are the single-hole letters. */
export const ITA2 = {
  A: '00011', B: '11001', C: '01110', D: '01001', E: '00001', F: '01101', G: '11010', H: '10100', I: '00110',
  J: '01011', K: '01111', L: '10010', M: '11100', N: '01100', O: '11000', P: '10110', Q: '10111', R: '01010',
  S: '00101', T: '10000', U: '00111', V: '11110', W: '10011', X: '11101', Y: '10101', Z: '10001', ' ': '00100',
};
export const ITA2_DECODE = Object.fromEntries(Object.entries(ITA2).map(([k, v]) => [v, k]));
export const ita2 = (ch) => ITA2[ch.toUpperCase()] ?? ITA2[' '];

/* ── Morse ───────────────────────────────────────────────────── */
export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.',
};
/** keying schedule: array of [on(boolean), units]. dot = 1, dash = 3, gaps 1 / 3 / 7 */
export function morseSchedule(text) {
  const out = [];
  [...text.toUpperCase()].forEach((ch, ci, all) => {
    if (ch === ' ') { out.push([false, 7]); return; }
    const code = MORSE[ch];
    if (!code) return;
    [...code].forEach((s, i) => { out.push([true, s === '.' ? 1 : 3]); if (i < code.length - 1) out.push([false, 1]); });
    if (ci < all.length - 1 && all[ci + 1] !== ' ') out.push([false, 3]);
  });
  return out;
}

/* ── Difference engine: tabulate a polynomial by addition only ── */
export function differenceTable(coeffs, n0, count) {
  // coeffs: [c0, c1, c2, c3] for c0 + c1 n + c2 n² + c3 n³ (evaluated directly to seed the columns)
  const f = (n) => coeffs.reduce((s, c, i) => s + c * n ** i, 0);
  const deg = coeffs.length - 1;
  const seed = Array.from({ length: deg + 1 }, (_, k) => f(n0 + k));
  const cols = [];
  let level = seed;
  for (let d = 0; d <= deg; d++) { cols.push(level[0]); level = level.slice(1).map((v, i) => v - level[i]); }
  const rows = [];
  const c = [...cols];
  for (let i = 0; i < count; i++) {
    rows.push([n0 + i, ...c]);
    for (let d = 0; d < deg; d++) c[d] += c[d + 1];   // addition only
  }
  return rows;
}
