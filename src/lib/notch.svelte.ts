import { reportRect, onHover } from './bridge';
import { PAGES } from './pages';
import { news } from './news.svelte';
import { load, save } from './store.svelte';

// Ukuran tiap bentuk (piksel CSS). Jendela Tauri lebarnya 720 dan tingginya 300.
export const WINDOW = { w: 720, h: 300 };
export const SIZES = {
  idle: { w: 190, h: 36, r: 12 },
  news: { w: 400, h: 46, r: 18 },
  open: { w: 680, h: 256, r: 30 },
} as const;

class Notch {
  open = $state(false);
  page = $state(Math.min(load('page', 0), PAGES.length - 1));
  settings = $state(false);
  private closeTimer = 0;

  constructor() {
    onHover((inside) => (inside ? this.enter() : this.leave()));
    // Area sentuh mengikuti bentuk yang sedang dituju.
    $effect.root(() => {
      $effect(() => {
        const { w, h } = this.size;
        // Saat diam, area sambutan sedikit lebih lebar dari pil supaya mudah dikenai kursor.
        const pad = this.open ? 0 : 28;
        reportRect((WINDOW.w - w) / 2 - pad, 0, w + pad * 2, h + (this.open ? 0 : 10));
      });
    });
  }

  get size() {
    return this.open ? SIZES.open : news.current ? SIZES.news : SIZES.idle;
  }

  enter() {
    clearTimeout(this.closeTimer);
    this.open = true;
    news.dismiss();
  }

  leave() {
    clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => {
      this.open = false;
      this.settings = false;
    }, 350);
  }

  go(delta: number) { this.select((this.page + delta + PAGES.length) % PAGES.length); }

  select(i: number) {
    this.page = i;
    this.settings = false;
    save('page', i);
  }
}

export const notch = new Notch();
