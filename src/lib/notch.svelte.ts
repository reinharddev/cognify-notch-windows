import { untrack } from 'svelte';
import { reportRect, onHover, on, cmd, windowKind } from './bridge';
import { ticker } from './store.svelte';
import { ui } from './ui.svelte';
import { news } from './news.svelte';
import { load, save } from './store.svelte';
import { device, features } from './system.svelte';
import { pomodoro, clockTools } from './state.svelte';
import { agenda } from './agenda.svelte';
import { clock } from './store.svelte';
import { relativeShort } from './relative';
import { anchors, hideOffset, hotZone, pillCenter, place, type AnchorX, type AnchorY, type Edge } from './geometry';
import { EDGE_MARGIN } from './ui.svelte';

// Ukuran tiap bentuk (piksel CSS). Jendela Tauri lebarnya 720 dan tingginya 300.
export const WINDOW = { w: 720, h: 300 };
export const SIZES = {
  idle: { w: 190, h: 36, r: 12 },
  news: { w: 400, h: 46, r: 18 },
  media: { w: 270, h: 36, r: 14 },
  open: { w: 680, h: 236, r: 30 },
} as const;

export const HEAD = 42;

class Notch {
  open = $state(false);
  page = $state(Math.max(0, Math.min(load('page', 0), ui.pages.length - 1)));
  private openTimer = 0;
  forward = $state(true); // arah pindah halaman terakhir, untuk arah geser animasinya
  pinned = $state(false);
  private closeTimer = 0;
  private hovering = false;
  /** Sama dengan `hovering`, tetapi reaktif (dipakai logika sembunyi otomatis). */
  hoverState = $state(false);
  /** Sembunyi otomatis: bentuk sedang disembunyikan di tepi layar. */
  autoHidden = $state(false);
  private hideTimer = 0;
  private revealTimer = 0;
  private openedByAlert = false;
  /** Lebar jendela yang sebenarnya (piksel CSS). Biasanya 720, tetapi bisa berbeda bila layar berubah. */
  viewport = $state(typeof window === 'undefined' ? WINDOW.w : window.innerWidth || WINDOW.w);
  viewportH = $state(typeof window === 'undefined' ? WINDOW.h : window.innerHeight || WINDOW.h);

  constructor() {
    // Jendela Pengaturan ikut memuat modul ini, tetapi tidak boleh mengatur jendela notch.
    if (windowKind !== 'notch') return;
    window.addEventListener('resize', () => { this.viewport = window.innerWidth || WINDOW.w; this.viewportH = window.innerHeight || WINDOW.h; });
    onHover((inside) => (inside ? this.enter() : this.leave()));
    on('hotkey', () => this.togglePinned());
    // Pengingat membuka notch sendiri dan menutupnya lagi setelah selesai, kecuali kursor sedang di atasnya.
    $effect.root(() => {
      $effect(() => {
        const a = news.alert;
        untrack(() => {
        if (a) {
          if (a.page) {
            const i = ui.pages.findIndex((p) => p.id === a.page);
            if (i >= 0) this.select(i);
          }
          if (!this.open) this.openedByAlert = true;
          clearTimeout(this.closeTimer);
          this.open = true;
        } else if (this.openedByAlert) {
          this.openedByAlert = false;
          if (!this.hovering && !this.pinned) this.open = false;
        }
        });
      });
    });
    // Sembunyi otomatis: bentuk menghilang setelah tidak dipakai sebentar, dan muncul lagi bila ada kabar atau pengingat.
    $effect.root(() => {
      $effect(() => {
        const busy = this.open || this.hoverState || !!news.current || !!news.level || !!news.alert || this.pinned;
        const on = ui.autoHide;
        untrack(() => {
          clearTimeout(this.hideTimer);
          if (!on || busy) { if (!on || this.open || news.current || news.level || news.alert) this.autoHidden = false; return; }
          this.hideTimer = window.setTimeout(() => (this.autoHidden = true), ui.closeDelay + 700);
        });
      });
    });
    // Area sentuh mengikuti bentuk yang sedang dituju.
    $effect.root(() => {
      $effect(() => ticker.setActive(this.open || !!this.live || (this.wings && features.lyrics && features.lyricsWing)));
      $effect(() => {
        const g = this.geo;
        if (this.autoHidden) {
          // Tersembunyi: hanya garis tipis di tepi layar yang peka terhadap kursor.
          const z = hotZone(g, this.hideEdge, this.viewport, this.viewportH);
          return reportRect(z.x, z.y, z.w, z.h);
        }
        // Saat diam, area sambutan sedikit lebih lebar dari pil supaya mudah dikenai kursor.
        const pad = this.open ? 0 : 28;
        if (!this.pill) return reportRect(g.x - pad, 0, g.w + pad * 2, g.h + (this.open ? 0 : 10));
        reportRect(g.x - pad, g.y - pad, g.w + pad * 2, g.h + pad * 2);
      });
    });
  }

  /** Musik sedang diputar: pil melebar, sampul di kiri dan equalizer di kanan. */
  get wings() {
    return features.media && !!device.media?.playing;
  }

  /**
   * Sayap saat tertutup, urutan prioritas sama dengan `live` di Mac: unduhan, Pomodoro berjalan, hitung mundur terdekat,
   * lalu acara yang mulai dalam satu jam. Setelah itu baru lagu (`wings`) dan mata.
   */
  get live(): { icon: 'download' | 'brain' | 'coffee' | 'hourglass' | 'bell'; tint: string; title?: string; text: string } | null {
    if (features.downloads && device.download) {
      const n = device.download.bytes;
      const text = n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.round(n / 1e6)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} KB` : '…';
      return { icon: 'download', tint: 'var(--accent)', title: device.download.name, text };
    }
    if (pomodoro.running) return { icon: pomodoro.mode === 'focus' ? 'brain' : 'coffee', tint: pomodoro.mode === 'focus' ? 'var(--accent)' : '#30d158', text: clock(pomodoro.remaining) };
    if (features.clockTools && clockTools.nearest) return { icon: 'hourglass', tint: '#ff9f0a', text: clock((clockTools.nearest.end - ticker.now) / 1000) };
    const next = agenda.events.find((e) => !e.allDay && e.start > ticker.now && e.start - ticker.now <= 3600_000);
    if (next) return { icon: 'bell', tint: '#ff9f0a', text: relativeShort(next.start, ticker.now) };
    return null;
  }

  get pill() { return ui.style === 'pill'; }

  /** Ukuran saat tertutup: lebar mengikuti pilihan di Pengaturan, sayap musik selalu 80 lebih lebar. Pill: sudut bulat penuh. */
  get closed() {
    const w = this.pill ? ui.pillWidth : ui.closedWidth;
    const full = (h: number, r: number) => (this.pill ? h / 2 : r);
    return {
      idle: { w, h: SIZES.idle.h, r: full(SIZES.idle.h, SIZES.idle.r) },
      media: { w: w + 80, h: SIZES.media.h, r: full(SIZES.media.h, SIZES.media.r) },
      // Sama dengan Mac: HUD = notch + sayap 76 di kiri dan kanan; kartu = 56 tinggi (Windows tanpa poni, jadi tanpa pita kosong di atas), lebar minimal 380.
      hud: { w: w + 152, h: SIZES.idle.h, r: full(SIZES.idle.h, SIZES.idle.r) },
      card: { w: Math.max(w + 220, 380), h: 56, r: full(56, 22) },
    };
  }

  /**
   * Kotak bentuk yang sedang dituju di dalam jendela, termasuk sisi tempat ia menempel pada pill.
   * Mode notch: tengah atas. Mode pill: menempel pada pill di posisi pilihan pengguna.
   */
  get geo(): { x: number; y: number; w: number; h: number; r: number; ax: AnchorX; ay: AnchorY } {
    const s = this.size, vw = this.viewport, vh = this.viewportH;
    if (!this.pill) return { x: (vw - s.w) / 2, y: 0, w: s.w, h: s.h, r: s.r, ax: 'center', ay: 'top' };
    const w0 = ui.pillWidth, h0 = SIZES.idle.h;
    const { cx, cy } = pillCenter(ui.pillX, ui.pillY, vw, vh, w0, h0, EDGE_MARGIN);
    const a = anchors(cx, cy, vw, vh, SIZES.open.w * ui.scale, EDGE_MARGIN);
    return { ...place(cx, cy, w0, h0, s.w, s.h, vw, vh, a, EDGE_MARGIN), r: s.r, ...a };
  }

  /** Tepi layar tempat bentuk bersembunyi (yang terdekat). */
  get hideEdge(): Edge { return hideOffset(this.geo, this.viewport, this.viewportH).edge; }

  /** Kotak tujuan sebenarnya: letak `geo`, atau di luar layar bila sedang tersembunyi. */
  get pos() {
    const g = this.geo;
    if (!this.autoHidden) return g;
    const o = hideOffset(g, this.viewport, this.viewportH);
    return { ...g, x: g.x + o.dx, y: g.y + o.dy };
  }

  /** Mode pill yang sedang diam: tampil sebagai kepala bulat (mata + mulut), bukan pil kosong. */
  get headMode() {
    return this.pill && features.companion && !this.open && !news.level && !news.current && !this.live && !this.wings;
  }

  get size() {
    if (this.headMode) return { w: HEAD, h: HEAD, r: HEAD / 2 };
    return this.open ? { w: SIZES.open.w * ui.scale, h: SIZES.open.h * ui.scale, r: SIZES.open.r * ui.scale } : news.level ? this.closed.hud : news.current ? this.closed.card : this.live || this.wings ? this.closed.media : this.closed.idle;
  }

  /** Kursor masuk: terbuka setelah jeda (lewat sekilas tidak membuka notch); dengan "buka dengan klik", hanya klik yang membuka. */
  enter() {
    this.hovering = true;
    this.hoverState = true;
    this.openedByAlert = false;
    clearTimeout(this.closeTimer);
    if (this.autoHidden) {
      // Kursor menyentuh tepi: muncul setelah tertahan sebentar, lalu terbuka seperti biasa bila kursor masih di sana.
      clearTimeout(this.revealTimer);
      this.revealTimer = window.setTimeout(() => {
        this.autoHidden = false;
        if (this.hovering && !ui.openOnClick) this.openTimer = window.setTimeout(() => this.show(), ui.hoverDelay);
      }, Math.max(ui.hoverDelay, 120));
      return;
    }
    if (this.open) return;
    if (ui.openOnClick) return;
    clearTimeout(this.openTimer);
    this.openTimer = window.setTimeout(() => this.show(), ui.hoverDelay);
  }

  /** Klik pada notch yang tertutup (mode "buka dengan klik"). */
  click() {
    if (this.open || !ui.openOnClick) return;
    this.show();
  }

  private show() {
    this.autoHidden = false;
    this.open = true;
    news.dismiss();
  }

  togglePinned() {
    if (this.pinned) return this.unpin();
    this.pinned = true;
    this.hovering = true;
    clearTimeout(this.closeTimer);
    this.show();
    void cmd('set_pinned', { on: true });
  }

  unpin() {
    if (!this.pinned) return;
    this.pinned = false;
    void cmd('set_pinned', { on: false });
    this.leave();
  }

  leave() {
    this.hovering = false;
    this.hoverState = false;
    clearTimeout(this.revealTimer);
    clearTimeout(this.openTimer);
    if (this.pinned || news.alert) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => {
      this.open = false;
    }, ui.closeDelay);
  }

  go(delta: number) { this.select((this.page + delta + ui.pages.length) % ui.pages.length, delta > 0); }

  select(i: number, forward = i > this.page) {
    this.forward = forward;
    this.page = i;
    save('page', i);
  }
}

export const notch = new Notch();
