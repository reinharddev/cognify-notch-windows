// Pegas seperti SwiftUI `.spring(response:dampingFraction:)`, dipakai agar gerak notch di Windows
// terasa sama dengan versi Mac (response 0,42 dan damping 0,8).
export const RESPONSE = 0.42;
export const DAMPING = 0.8;

const OMEGA = (2 * Math.PI) / RESPONSE;

/** Fungsi easing berbentuk respons pegas (0 ke 1), untuk transisi Svelte. */
export function springEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const tau = t * RESPONSE * 1.2; // 1,2 kali response sudah hampir tenang
  const wd = OMEGA * Math.sqrt(1 - DAMPING * DAMPING);
  const a = DAMPING * OMEGA;
  return 1 - Math.exp(-a * tau) * (Math.cos(wd * tau) + (a / wd) * Math.sin(wd * tau));
}

type Vec = Record<string, number>;

/** Menggerakkan beberapa angka menuju target dengan pegas; `apply` dipanggil tiap frame. */
export class Spring {
  private v: Vec = {};
  private raf = 0;
  private last = 0;

  constructor(private cur: Vec, private apply: (v: Vec) => void) {
    for (const k of Object.keys(cur)) this.v[k] = 0;
    apply(cur);
  }

  to(target: Vec) {
    this.target = target;
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.step);
    }
  }

  private target: Vec = {};

  private step = (now: number) => {
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // Langkah kecil supaya stabil pada 60 Hz maupun 144 Hz.
    const sub = Math.max(1, Math.ceil(dt / 0.004));
    dt /= sub;
    let still = true;
    for (let i = 0; i < sub; i++) {
      for (const k of Object.keys(this.cur)) {
        const a = -OMEGA * OMEGA * (this.cur[k] - this.target[k]) - 2 * DAMPING * OMEGA * this.v[k];
        this.v[k] += a * dt;
        this.cur[k] += this.v[k] * dt;
      }
    }
    for (const k of Object.keys(this.cur)) {
      if (Math.abs(this.cur[k] - this.target[k]) > 0.05 || Math.abs(this.v[k]) > 0.5) still = false;
    }
    if (still) {
      for (const k of Object.keys(this.cur)) { this.cur[k] = this.target[k]; this.v[k] = 0; }
      this.apply(this.cur);
      this.raf = 0;
      return;
    }
    this.apply(this.cur);
    this.raf = requestAnimationFrame(this.step);
  };
}
