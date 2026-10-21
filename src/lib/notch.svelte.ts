import { reportRect, onHover, on, cmd, windowKind } from './bridge';
import { ui } from './ui.svelte';
import { ticker } from './store.svelte';
import { PAGES } from './pages';
import { news } from './news.svelte';
import { load, save } from './store.svelte';
import { device, features } from './system.svelte';

// Ukuran tiap bentuk (piksel CSS). Jendela Tauri lebarnya 720 dan tingginya 300.
export const WINDOW = { w: 720, h: 300 };
export const SIZES = {
  idle: { w: 190, h: 36, r: 12 },
  news: { w: 400, h: 46, r: 18 },
  media: { w: 270, h: 36, r: 14 },
  open: { w: 680, h: 256, r: 30 },
} as const;

class Notch {
  open = $state(false);
  page = $state(Math.min(load('page', 0), PAGES.length - 1));
  forward = $state(true); // arah pindah halaman terakhir, untuk arah geser animasinya
  pinned = $state(false);
  private closeTimer = 0;

  constructor() {
    // Jendela Pengaturan ikut memuat modul ini, tetapi tidak boleh mengatur jendela notch.
    if (windowKind !== 'notch') return;
    onHover((inside) => (inside ? this.enter() : this.leave()));
    on('hotkey', () => this.togglePinned());
    // Area sentuh mengikuti bentuk yang sedang dituju.
    $effect.root(() => {
      $effect(() => ticker.setActive(this.open));
      $effect(() => {
        const { w, h } = this.size;
        // Saat diam, area sambutan sedikit lebih lebar dari pil supaya mudah dikenai kursor.
        const pad = this.open ? 0 : 28;
        reportRect((WINDOW.w - w) / 2 - pad, 0, w + pad * 2, h + (this.open ? 0 : 10));
      });
    });
  }

  /** Musik sedang diputar: pil melebar, sampul di kiri dan equalizer di kanan. */
  get wings() {
    return features.media && !!device.media?.playing;
  }

  /** Ukuran saat tertutup: lebar mengikuti pilihan di Pengaturan, sayap musik selalu 80 lebih lebar. */
  get closed() {
    const w = ui.closedWidth;
    return {
      idle: { w, h: SIZES.idle.h, r: SIZES.idle.r },
      media: { w: w + 80, h: SIZES.media.h, r: SIZES.media.r },
      // Sama dengan Mac: HUD = notch + sayap 76 di kiri dan kanan; kartu = 48 di bawah pita notch, lebar minimal 380.
      hud: { w: w + 152, h: SIZES.idle.h, r: SIZES.idle.r },
      card: { w: Math.max(w + 220, 380), h: SIZES.idle.h + 48, r: 22 },
    };
  }

  get size() {
    return this.open ? SIZES.open : news.level ? this.closed.hud : news.current ? this.closed.card : this.wings ? this.closed.media : this.closed.idle;
  }

  enter() {
    clearTimeout(this.closeTimer);
    this.open = true;
    news.dismiss();
  }

  togglePinned() {
    if (this.pinned) return this.unpin();
    this.pinned = true;
    this.enter();
    void cmd('set_pinned', { on: true });
  }

  unpin() {
    if (!this.pinned) return;
    this.pinned = false;
    void cmd('set_pinned', { on: false });
    this.leave();
  }

  leave() {
    if (this.pinned) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => {
      this.open = false;
    }, 350);
  }

  go(delta: number) { this.select((this.page + delta + PAGES.length) % PAGES.length, delta > 0); }

  select(i: number, forward = i > this.page) {
    this.forward = forward;
    this.page = i;
    save('page', i);
  }
}

export const notch = new Notch();
