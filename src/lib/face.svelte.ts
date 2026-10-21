import { on, windowKind } from './bridge';
import { features } from './system.svelte';

// Ekspresi mata saat notch diam, sama dengan versi Mac: terbuka (berkedip acak tiap 5 sampai 10 detik),
// tidur setelah 2,5 menit tanpa gerakan mouse (mata menutup dengan "z"), dan menyapa saat mouse bergerak lagi.
// Tidur dan bangun diketahui dari Rust (yang membaca posisi kursor); arah pandang hanya datang bila
// "ikuti kursor" menyala.
export type Mood = 'awake' | 'blink' | 'asleep' | 'hello';

class Face {
  mood = $state<Mood>('awake');
  look = $state({ x: 0, y: 0 });
  private timer = 0;
  private hello = 0;

  constructor() {
    if (windowKind !== 'notch') return;
    on<null>('eyes-sleep', () => { if (this.mood !== 'hello') this.mood = 'asleep'; });
    on<null>('eyes-wake', () => {
      if (this.mood !== 'asleep') return;
      this.mood = 'hello';
      clearTimeout(this.hello);
      this.hello = window.setTimeout(() => { if (this.mood === 'hello') this.mood = 'awake'; }, 1600);
    });
    on<[number, number]>('eye-look', ([x, y]) => { this.look = { x, y }; });
  }

  /** Mulai berkedip (dipanggil saat mata tampil); mengembalikan fungsi untuk berhenti. */
  start() {
    const step = () => {
      if (features.companion && this.mood === 'awake') {
        this.mood = 'blink';
        window.setTimeout(() => { if (this.mood === 'blink') this.mood = 'awake'; }, 140);
      }
      this.timer = window.setTimeout(step, 5000 + Math.random() * 5000);
    };
    this.timer = window.setTimeout(step, 2500 + Math.random() * 3000);
    return () => clearTimeout(this.timer);
  }
}
export const face = new Face();
