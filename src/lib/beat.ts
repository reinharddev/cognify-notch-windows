// Pelacak irama untuk wajah Mimik: dari kerasnya suara menebak kapan ketukan terjadi dan seberapa cepat temponya, lalu memberi
// fase supaya kepala mengangguk tepat di ketukan. Tanpa data suara, ketukan sintetis pada tempo sedang. Sama dengan
// BeatTracker.swift di Mac (konstanta dan algoritma dijaga sama).

export class BeatTracker {
  /** Kerasnya musik yang dihaluskan, 0..1. */
  energy = 0;
  /** Perkiraan detik per ketukan (0,3 sampai 1,1). */
  period = 0.6;
  /** Jumlah ketukan terdeteksi sejak mulai. */
  beats = 0;
  /** Waktu ketukan terakhir (detik); jangkar fase. */
  lastBeat = -100;
  private mean = 0;
  private previous = 0;
  private primed = false;
  private intervals: number[] = [];

  get audible() { return this.energy > 0.04; }

  /** Satu cuplikan kerasnya suara (0..1) pada waktu `t` (detik). True bila ini ketukan baru. */
  feed(level: number, t: number): boolean {
    level = Math.min(1, Math.max(0, level));
    if (!this.primed) { this.primed = true; this.mean = level; this.previous = level; }
    this.energy += (level - this.energy) * (level > this.energy ? 0.35 : 0.12);
    const threshold = this.mean * 1.28 + 0.04;
    let beat = false;
    if (level > threshold && level >= this.previous && t - this.lastBeat > 0.27 && this.energy > 0.05) {
      const gap = t - this.lastBeat;
      if (gap > 0.3 && gap < 1.1) {
        this.intervals.push(gap);
        if (this.intervals.length > 8) this.intervals.shift();
        const sorted = [...this.intervals].sort((a, b) => a - b);
        this.period = this.period * 0.65 + sorted[Math.floor(sorted.length / 2)] * 0.35;
      }
      this.lastBeat = t;
      this.beats++;
      beat = true;
    }
    this.mean += (level - this.mean) * 0.06;
    this.previous = level;
    if (t - this.lastBeat > 2.5) { this.period += (0.6 - this.period) * 0.05; this.intervals = []; }
    return beat;
  }

  /** Tanpa data suara tetapi musik diputar: ketukan sintetis pada tempo sedang. */
  feedSteady(t: number) {
    this.energy += (0.55 - this.energy) * 0.1;
    if (t - this.lastBeat >= this.period - 0.001) { this.lastBeat = t; this.beats++; }
  }

  /** Fase dalam satu ketukan: 0 tepat di ketukan, mendekati 1 sebelum ketukan berikutnya. */
  phase(t: number): number { const p = (t - this.lastBeat) / this.period; return p - Math.floor(p); }
  /** Seberapa dalam anggukan: 1 tepat di ketukan, 0 di antara ketukan. */
  depth(t: number): number { return (1 + Math.cos(2 * Math.PI * this.phase(t))) / 2; }
  /** Anggukan santai: satu siklus meliputi beberapa ketukan (2, atau 4 bila tempo cepat), jadi selalu pelan (minimal ~1,3 detik) dan
   *  tetap sejalan dengan ketukan. Fase 0 jatuh pada ketukan kelipatan siklus. */
  get slowCycle() { return this.period * 2 >= 1.3 ? 2 : 4; }
  slowPhase(t: number): number {
    const k = this.slowCycle;
    const p = ((t - this.lastBeat) / this.period + (this.beats % k)) / k;
    return p - Math.floor(p);
  }
  /** 1 saat kepala paling rendah, 0 saat tegak; melengkung halus. */
  slowDepth(t: number): number { return (1 + Math.cos(2 * Math.PI * this.slowPhase(t))) / 2; }
  /** Miring perlahan ke satu sisi lalu ke sisi lain dalam satu siklus: -1..1. */
  slowSway(t: number): number { return Math.sin(2 * Math.PI * this.slowPhase(t)); }

  /** Goyangan kiri-kanan, berganti arah tiap ketukan: -1..1. */
  sway(t: number): number { return (this.beats % 2 === 0 ? 1 : -1) * Math.sin(Math.PI * this.phase(t)); }
}
