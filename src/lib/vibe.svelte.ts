import { windowKind } from './bridge';
import { BeatTracker } from './beat';
import { face } from './face.svelte';
import { device } from './system.svelte';

// Mengangguk mengikuti lagu untuk Kepala Mimik (Head.svelte) dan mata notch (Eyes.svelte). Kerasnya suara yang keluar (dari Rust,
// `device.level`, perangkat keluaran bawaan: speaker, headphone, atau Bluetooth) diumpankan ke BeatTracker ~30 kali per detik hanya
// selama `face.groove` (musik diputar, mode Dinamis). Tanpa data suara, ketukan sintetis pada tempo sedang.

export interface Note { t0: number; glyph: string; side: number; x0: number }

class Vibe {
  nodY = $state(0);
  rot = $state(0);
  hum = $state(0);
  notes = $state<Note[]>([]);
  /** Waktu bingkai terakhir (detik), supaya nada bisa dihitung umurnya saat digambar. */
  now = $state(0);

  private tracker = new BeatTracker();
  private frame = 0;
  private last = 0;
  private lastBeats = 0;
  private prevLevel = -1;
  private levelAt = 0;

  constructor() {
    if (windowKind !== 'notch') return;
    $effect.root(() => {
      $effect(() => {
        if (!face.groove || matchMedia('(prefers-reduced-motion: reduce)').matches) { this.reset(); return; }
        this.start();
        return () => this.reset();
      });
    });
  }

  private reset() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.nodY = 0; this.rot = 0; this.hum = 0; this.notes = [];
  }

  private start() {
    const step = (ms: number) => {
      this.frame = requestAnimationFrame(step);
      const t = ms / 1000;
      if (t - this.last < 1 / 30 - 0.002) return;
      this.last = t;
      const level = device.level;
      if (level !== this.prevLevel) { this.prevLevel = level; this.levelAt = t; }
      const tr = this.tracker;
      if (t - this.levelAt < 1.5 && level > 0.01) tr.feed(level, t); else tr.feedSteady(t);
      if (tr.audible) {
        const amp = 0.45 + 0.55 * Math.min(1, tr.energy * 1.4);
        const depth = tr.depth(t);
        this.nodY = amp * 4.4 * depth;
        this.rot = amp * 3 * tr.sway(t);
        this.hum = Math.min(0.5, tr.energy * 0.55 * (0.55 + 0.45 * depth));
        if (tr.beats > this.lastBeats && tr.beats % 2 === 0 && this.notes.length < 3) {
          const side = tr.beats % 4 === 0 ? 1 : -1;
          this.notes = [...this.notes, { t0: t, glyph: ['♪', '♫', '♬'][(tr.beats / 2) % 3], side, x0: side * (22 + Math.random() * 8) }];
        }
      } else { this.nodY = 0; this.rot = 0; this.hum = 0; }
      this.lastBeats = tr.beats;
      this.now = t;
      if (this.notes.length && this.notes.some((n) => t - n.t0 > 1.7)) this.notes = this.notes.filter((n) => t - n.t0 <= 1.7);
    };
    this.frame = requestAnimationFrame(step);
  }
}
export const vibe = new Vibe();
