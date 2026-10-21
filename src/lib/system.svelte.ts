// Keadaan perangkat yang dikirim Rust: baterai, volume, internet, Caps Lock, bahasa keyboard,
// layar penuh, dan perangkat suara. Di browser biasa semuanya kosong.
import { on, cmd } from './bridge';
import { news } from './news.svelte';
import { L } from './i18n';
import { load, save } from './store.svelte';

export interface Power { percent: number; charging: boolean; plugged: boolean }
export interface MediaInfo {
  title: string; artist: string; album: string; app: string; playing: boolean;
  position: number; duration: number; thumb: string | null;
}
export interface ClipItem { id: string; kind: 'text' | 'link' | 'image'; text: string; image?: string; app: string | null; t: number; pinned: boolean }

class Features {
  media = $state(true); lyrics = $state(true); clipboard = $state(false); weather = $state(false);
  charger = $state(true); devices = $state(true); downloads = $state(true); keys = $state(true); network = $state(true);
  hideFullscreen = $state(true);
  constructor() {
    Object.assign(this, load('features', {}));
  }
  persist() {
    save('features', { media: this.media, lyrics: this.lyrics, clipboard: this.clipboard, weather: this.weather, charger: this.charger,
      devices: this.devices, downloads: this.downloads, keys: this.keys, network: this.network, hideFullscreen: this.hideFullscreen });
    void cmd('set_clipboard_watch', { on: this.clipboard });
    void cmd('set_hide_fullscreen', { on: this.hideFullscreen });
  }
}
export const features = new Features();

class Device {
  power = $state<Power | null>(null);
  volume = $state(0.5);
  muted = $state(false);
  level = $state(0);        // 0..1, seberapa keras suara yang sedang keluar
  media = $state<MediaInfo | null>(null);
  mediaAt = 0;
  volumeSeen = false;
  brightness: number | null = null;
  hidden = $state(false);   // app layar penuh sedang tampil
  online = true;
  caps = false;
  layout = '';
  outName = '';

  constructor() {
    on<Power>('power', (p) => {
      const was = this.power;
      this.power = p;
      if (features.charger && was && p.plugged !== was.plugged) {
        news.announce(p.plugged ? L('Charger tersambung', 'Charger connected') : L('Charger dicabut', 'Charger unplugged'), `${p.percent}%`);
      }
    });
    on<{ volume: number; muted: boolean }>('volume', (v) => {
      const first = this.volumeSeen;
      const changed = Math.abs(v.volume - this.volume) > 0.005 || v.muted !== this.muted;
      this.volume = v.volume; this.muted = v.muted; this.volumeSeen = true;
      if (first && changed && features.devices) news.announce(v.muted ? L('Volume senyap', 'Muted') : L(`Volume ${Math.round(v.volume * 100)}%`, `Volume ${Math.round(v.volume * 100)}%`));
    });
    on<number>('brightness', (b) => {
      const first = this.brightness !== null;
      const changed = b !== this.brightness;
      this.brightness = b;
      if (first && changed && features.devices) news.announce(L(`Kecerahan ${b}%`, `Brightness ${b}%`));
    });
    on<number>('level', (v) => (this.level = v));
    on<MediaInfo | null>('media', (m) => {
      // Lagu dan jalur waktu sama: pertahankan jam sendiri supaya lirik tidak melompat karena selisih kecil.
      const old = this.media;
      if (m && old && m.title === old.title && m.artist === old.artist && m.playing && old.playing) {
        const predicted = old.position + (Date.now() - this.mediaAt) / 1000;
        if (Math.abs(m.position - predicted) < 2) { this.media = { ...m, position: old.position }; return; }
      }
      this.media = m;
      this.mediaAt = Date.now();
    });
    on<boolean>('fullscreen', (h) => (this.hidden = h));
    on<boolean>('online', (o) => {
      if (features.network && o !== this.online) news.announce(o ? L('Internet tersambung lagi', 'Back online') : L('Internet terputus', 'Offline'));
      this.online = o;
    });
    on<boolean>('caps', (c) => { if (features.keys && c !== this.caps) news.announce(c ? 'Caps Lock ON' : 'Caps Lock OFF'); this.caps = c; });
    on<string>('layout', (l) => { if (features.keys && this.layout && l !== this.layout) news.announce(L(`Keyboard: ${l}`, `Keyboard: ${l}`)); this.layout = l; });
    on<string>('output', (name) => {
      if (features.devices && this.outName && name !== this.outName) news.announce(L('Output suara', 'Sound output'), name);
      this.outName = name;
    });
    on<string>('download', (name) => { if (features.downloads) news.announce(L('Unduhan selesai', 'Download finished'), name); });
    void cmd('set_clipboard_watch', { on: features.clipboard });
    void cmd('set_hide_fullscreen', { on: features.hideFullscreen });
  }
}
export const device = new Device();

// Hanya saat pengembangan: memudahkan mencoba tampilan dengan data tiruan di browser.
if (import.meta.env.DEV) (window as unknown as { __device: typeof device }).__device = device;
