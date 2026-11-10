/* Turing machine programs + a tiny interpreter. Pure logic, no DOM.
   rule key: "state,symbol" → [write, move, nextState].  Blank is a space.  */
export const PROGRAMS = {
  increment: {
    name: 'Binary increment', blank: ' ', start: 'q0', halt: 'H', input: '1011', hint: 'binary number',
    note: 'Scan right to the end, then carry leftwards: 1 → 0 until a 0 (or blank) becomes 1.',
    rules: {
      'q0,0': ['0', 'R', 'q0'], 'q0,1': ['1', 'R', 'q0'], 'q0, ': [' ', 'L', 'q1'],
      'q1,1': ['0', 'L', 'q1'], 'q1,0': ['1', 'L', 'H'], 'q1, ': ['1', 'L', 'H'],
    },
  },
  invert: {
    name: 'Bit inversion', blank: ' ', start: 'q0', halt: 'H', input: '10110', hint: 'binary string',
    note: 'One pass, flipping every bit, halting at the first blank.',
    rules: { 'q0,0': ['1', 'R', 'q0'], 'q0,1': ['0', 'R', 'q0'], 'q0, ': [' ', 'R', 'H'] },
  },
  add: {
    name: 'Unary addition', blank: ' ', start: 'q0', halt: 'H', input: '111+11', hint: '1s, a +, then 1s',
    note: 'Turn + into 1, run to the end, erase one surplus 1: 3 + 2 → five 1s.',
    rules: {
      'q0,1': ['1', 'R', 'q0'], 'q0,+': ['1', 'R', 'q0'], 'q0, ': [' ', 'L', 'q1'],
      'q1,1': [' ', 'L', 'H'],
    },
  },
  beaver: {
    name: '3-state busy beaver', blank: '0', start: 'A', halt: 'H', input: '', hint: 'blank tape',
    note: 'The 3-state, 2-symbol champion: from a blank tape it writes six 1s in 14 steps, then halts.',
    rules: {
      'A,0': ['1', 'R', 'B'], 'A,1': ['1', 'R', 'H'],
      'B,0': ['0', 'R', 'C'], 'B,1': ['1', 'R', 'B'],
      'C,0': ['1', 'L', 'C'], 'C,1': ['1', 'L', 'A'],
    },
  },
};

export class TM {
  constructor(prog, input = prog.input) {
    this.prog = prog;
    this.reset(input);
  }
  reset(input = this.prog.input) {
    this.cells = new Map();
    [...input].forEach((c, i) => this.cells.set(i, c));
    this.head = 0;
    this.state = this.prog.start;
    this.steps = 0;
    this.halted = false;
    this.stuck = false;
    this.last = null; // last rule key applied
    this.written = null;
  }
  read(i = this.head) { return this.cells.get(i) ?? this.prog.blank; }
  step() {
    if (this.halted || this.stuck) return false;
    const key = `${this.state},${this.read()}`;
    const r = this.prog.rules[key];
    if (!r) { this.stuck = true; return false; }
    const [w, mv, ns] = r;
    if (w === this.prog.blank) this.cells.delete(this.head); else this.cells.set(this.head, w);
    this.written = this.head;
    this.head += mv === 'R' ? 1 : -1;
    this.state = ns;
    this.last = key;
    this.steps++;
    if (ns === this.prog.halt) this.halted = true;
    return true;
  }
  /** tape contents trimmed of blanks, left to right */
  tape() {
    const idx = [...this.cells.keys()].sort((a, b) => a - b);
    if (!idx.length) return '';
    let s = '';
    for (let i = idx[0]; i <= idx[idx.length - 1]; i++) s += this.cells.get(i) ?? this.prog.blank;
    return s;
  }
  ones() { return [...this.cells.values()].filter((c) => c === '1').length; }
}

export function runToHalt(prog, input, max = 10000) {
  const m = new TM(prog, input);
  while (m.steps < max && m.step());
  return m;
}
