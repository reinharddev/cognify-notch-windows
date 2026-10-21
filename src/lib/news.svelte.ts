import { L } from './i18n';
import type { IconName } from './icons';
import { TINT } from './icons';

// Kabar singkat di notch, sama dengan versi Mac: kartu (ikon, judul, keterangan, nilai) untuk charger, perangkat,
// unduhan, Caps Lock, bahasa keyboard, internet, dan pengingat; serta HUD volume dan kecerahan (ikon di kiri,
// garis level di kanan). Saat HUD tampil, kartu menunggu.
export interface News { id: number; icon: IconName; tint: string; title: string; sub?: string; value?: string }
export interface Level { kind: 'volume' | 'brightness'; value: number; muted?: boolean }
export interface Opts { icon?: IconName; tint?: string; value?: string; seconds?: number; toast?: boolean }

class Newsroom {
  current = $state<News | null>(null);
  level = $state<Level | null>(null);
  private n = 0;
  private timer = 0;
  private levelTimer = 0;

  /** Kartu kabar. `toast`: ikut mengirim notifikasi Windows (untuk pengingat; kabar perangkat tidak). */
  announce(title: string, sub?: string, o: Opts = {}) {
    this.current = { id: ++this.n, icon: o.icon ?? 'bell', tint: o.tint ?? TINT.accent, title, sub, value: o.value };
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.current = null), (o.seconds ?? 5) * 1000);
    if (o.toast === false) return;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body: sub, silent: true });
      else if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
    } catch {}
  }

  /** Kabar dari perangkat: tanpa notifikasi Windows, durasi 3 detik kecuali disebut lain (seperti di Mac). */
  device(title: string, sub: string | undefined, icon: IconName, tint: string, o: { value?: string; seconds?: number } = {}) {
    this.announce(title, sub, { icon, tint, value: o.value, seconds: o.seconds ?? 3, toast: false });
  }

  /** HUD volume atau kecerahan, tampil 1,6 detik. */
  showLevel(level: Level) {
    this.level = level;
    clearTimeout(this.levelTimer);
    this.levelTimer = window.setTimeout(() => (this.level = null), 1600);
  }

  dismiss() { this.current = null; }
}

export const news = new Newsroom();
export const doneText = (what: string) => L(`${what} selesai`, `${what} finished`);

if (import.meta.env.DEV) (window as unknown as { __news: typeof news }).__news = news;
