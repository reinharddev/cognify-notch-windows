import { untrack } from 'svelte';
import { windowKind } from './bridge';
import { face } from './face.svelte';
import { ui } from './ui.svelte';

// Arah kursor (dari Rust: `face.look`, relatif terhadap notch) → vektor menoleh -1..1 dengan kurva ease-out bbot: dekat =
// menoleh sedikit, jauh = penuh. Dihaluskan pegas (k 150, d 19) yang hanya berjalan selama belum diam. Dipakai kepala
// melayang (Head.svelte) dan mata di notch (Eyes.svelte). Hanya bila "Arah pandang" = Ikuti kursor.
class Gaze {
  x = $state(0);
  y = $state(0);

  constructor() {
    if (windowKind !== 'notch') return;
    $effect.root(() => {
      $effect(() => {
        const follow = ui.eyesMode === 'follow';
        const dx = face.look.x * 90, dy = face.look.y * 70;
        const d = Math.hypot(dx, dy);
        let tx = 0, ty = 0;
        if (follow && d >= 0.5) {
          const g0 = Math.min(1, d / 260), f = g0 * (2 - g0);
          tx = (dx / d) * f; ty = (dy / d) * f;
        }
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { this.x = tx; this.y = ty; return; }
        let x = untrack(() => this.x), y = untrack(() => this.y);
        let vx = 0, vy = 0, prev = 0, frame = 0;
        const step = (now: number) => {
          const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 1 / 60;
          prev = now;
          const n = Math.ceil(dt / (1 / 60)), h = dt / n;
          for (let i = 0; i < n; i++) {
            vx += ((tx - x) * 150 - vx * 19) * h; x += vx * h;
            vy += ((ty - y) * 150 - vy * 19) * h; y += vy * h;
          }
          this.x = x; this.y = y;
          if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) > 0.004) frame = requestAnimationFrame(step);
          else { this.x = tx; this.y = ty; }
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
      });
    });
  }
}
export const gaze = new Gaze();
