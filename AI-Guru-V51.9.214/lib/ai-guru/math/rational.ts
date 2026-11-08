/** Exact rational arithmetic for school-level solutions (no floating point surprises). */
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export class Fr {
  readonly n: number;
  readonly d: number;
  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('Division by zero');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(Math.abs(n), d) || 1;
    this.n = n / g;
    this.d = d / g;
  }
  static of(x: number | Fr): Fr { return x instanceof Fr ? x : Fr.parse(String(x)); }
  /** "7", "-2", "7.5", "0.25", "3/4" */
  static parse(s: string): Fr {
    const t = s.trim();
    const slash = /^(-?\d+)\s*\/\s*(\d+)$/.exec(t);
    if (slash) return new Fr(Number(slash[1]), Number(slash[2]));
    const dec = /^(-?)(\d*)\.(\d+)$/.exec(t);
    if (dec) return new Fr(Number(`${dec[1]}${dec[2] || '0'}${dec[3]}`), 10 ** dec[3].length);
    if (!/^-?\d+$/.test(t)) throw new Error(`Not a number: ${s}`);
    return new Fr(Number(t));
  }
  add(o: Fr) { return new Fr(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Fr) { return new Fr(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Fr) { return new Fr(this.n * o.n, this.d * o.d); }
  div(o: Fr) { return new Fr(this.n * o.d, this.d * o.n); }
  neg() { return new Fr(-this.n, this.d); }
  abs() { return new Fr(Math.abs(this.n), this.d); }
  isZero() { return this.n === 0; }
  isInt() { return this.d === 1; }
  isNeg() { return this.n < 0; }
  eq(o: Fr) { return this.n === o.n && this.d === o.d; }
  toNumber() { return this.n / this.d; }
  pow(k: number): Fr { let r = new Fr(1); for (let i = 0; i < k; i++) r = r.mul(this); return r; }
  /** Terminating decimal ("7.5"), or null when the decimal does not terminate (e.g. 1/3). */
  decimal(): string | null {
    if (this.isInt()) return String(this.n);
    let d = this.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    if (d !== 1) return null;
    const v = Math.abs(this.n) / this.d;
    const s = String(Number(v.toFixed(8)));
    return `${this.n < 0 ? '-' : ''}${s}`;
  }
  /** ASCII text: "-7", "1/2". */
  toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
}
export const F = (n: number, d = 1) => new Fr(n, d);
