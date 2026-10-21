import { L } from './i18n';

// Kabar singkat yang muncul di notch saat diam (timer selesai, pengingat minum, dan lainnya).
// Notch melebar sebentar; bila Windows mengizinkan, toast sistem ikut muncul.
export interface News { id: number; text: string; sub?: string }

class Newsroom {
  current = $state<News | null>(null);
  private n = 0;
  private timer = 0;

  announce(text: string, sub?: string) {
    this.current = { id: ++this.n, text, sub };
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => (this.current = null), 5000);
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(text, { body: sub, silent: true });
      else if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
    } catch {}
  }

  dismiss() { this.current = null; }
}

export const news = new Newsroom();
export const doneText = (what: string) => L(`${what} selesai`, `${what} finished`);

if (import.meta.env.DEV) (window as unknown as { __news: typeof news }).__news = news;
