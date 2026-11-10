/* Enigma I (Wehrmacht) — rotors I, II, III, reflector B. Pure logic, no DOM.
   Positions and rings are 0..25. `order` is left → right. Known test vector:
   rotors I-II-III, rings AAA, start AAA:  AAAAA → BDZGO                     */
const A = 65;
const ROTORS = {
  I:   { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II:  { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
};
export const REFLECTOR_B = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';
const inv = (w) => { const o = Array(26); for (let i = 0; i < 26; i++) o[w.charCodeAt(i) - A] = i; return o; };

export class Enigma {
  constructor({ order = ['I', 'II', 'III'], pos = [0, 0, 0], rings = [0, 0, 0] } = {}) {
    this.rot = order.map((n) => ({
      name: n, fwd: [...ROTORS[n].wiring].map((c) => c.charCodeAt(0) - A), bwd: inv(ROTORS[n].wiring),
      notch: ROTORS[n].notch.charCodeAt(0) - A,
    }));
    this.refl = [...REFLECTOR_B].map((c) => c.charCodeAt(0) - A);
    this.pos = [...pos];
    this.rings = [...rings];
  }
  /** advance rotors, including the middle-rotor double step */
  step() {
    const [l, m, r] = this.rot;
    const midAtNotch = this.pos[1] === m.notch, rightAtNotch = this.pos[2] === r.notch;
    if (midAtNotch) { this.pos[0] = (this.pos[0] + 1) % 26; this.pos[1] = (this.pos[1] + 1) % 26; }
    else if (rightAtNotch) this.pos[1] = (this.pos[1] + 1) % 26;
    this.pos[2] = (this.pos[2] + 1) % 26;
  }
  _pass(i, c, forward) {
    const s = this.pos[i] - this.rings[i];
    const idx = (c + s + 26) % 26;
    const out = forward ? this.rot[i].fwd[idx] : this.rot[i].bwd[idx];
    return (out - s + 26) % 26;
  }
  /** press one key (0..25). Returns { out, path } where path lists the contact index after each stage:
      [key, R→, M→, L→, reflector, ←L, ←M, ←R] */
  press(k) {
    this.step();
    const path = [k];
    let c = k;
    for (let i = 2; i >= 0; i--) { c = this._pass(i, c, true); path.push(c); }
    c = this.refl[c]; path.push(c);
    for (let i = 0; i <= 2; i++) { c = this._pass(i, c, false); path.push(c); }
    return { out: c, path };
  }
  encode(text) {
    return [...text.toUpperCase()].filter((c) => c >= 'A' && c <= 'Z')
      .map((c) => String.fromCharCode(A + this.press(c.charCodeAt(0) - A).out)).join('');
  }
}
