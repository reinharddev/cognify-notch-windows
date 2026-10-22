// Keadaan perangkat yang dikirim Rust: baterai, volume, internet, Caps Lock, bahasa keyboard,
// layar penuh, dan perangkat suara. Di browser biasa semuanya kosong.
import { on, cmd } from './bridge';
import { news } from './news.svelte';
import { TINT, type IconName } from './icons';
import { L } from './i18n';
import { load, save } from './store.svelte';

export interface Power { percent: number; charging: boolean; plugged: boolean }
export interface MediaInfo {
  title: string; artist: string; album: string; app: string; playing: boolean;
  position: number; duration: number; thumb: string | null;
  shuffle?: boolean | null; repeat?: number | null; // repeat: 0 mati, 1 semua, 2 satu lagu
}
export interface ClipItem { id: string; kind: 'text' | 'link' | 'image'; text: string; image?: string; app: string | null; t: number; pinned: boolean }

class Features {
  media = $state(true); lyrics = $state(true); clipboard = $state(true); weather = $state(false);
  charger = $state(true); devices = $state(true); downloads = $state(true); keys = $state(true); network = $state(true);
  hideFullscreen = $state(true);
  spectrum = $state(true); camera = $state(true); shortcuts = $state(true); hud = $state(true); hotkey = $state(true);
  water = $state(true); todo = $state(true); clockTools = $state(true); calculator = $state(true); lyricsWing = $state(true);
  companion = $state(true); // mata saat notch diam
  updates = $state(true);
  autoInstall = $state(true);
  constructor() {
    Object.assign(this, load('features', {}));
  }
  reload() { Object.assign(this, load('features', {})); }
  persist() {
    save('features', { media: this.media, lyrics: this.lyrics, clipboard: this.clipboard, weather: this.weather, charger: this.charger,
      devices: this.devices, downloads: this.downloads, keys: this.keys, network: this.network, hideFullscreen: this.hideFullscreen, spectrum: this.spectrum, camera: this.camera, shortcuts: this.shortcuts, hud: this.hud, hotkey: this.hotkey,
      water: this.water, todo: this.todo, clockTools: this.clockTools, calculator: this.calculator, lyricsWing: this.lyricsWing, companion: this.companion, updates: this.updates, autoInstall: this.autoInstall });
    void cmd('set_clipboard_watch', { on: this.clipboard });
    void cmd('set_hide_fullscreen', { on: this.hideFullscreen });
  }
}
export const features = new Features();

const batteryIcon = (p: number): IconName => (p > 62 ? 'battery-full' : p > 37 ? 'battery-medium' : p > 12 ? 'battery-low' : 'battery-warning');
/** "AirPods Pro milik Reinhard" atau "Reinhard's AirPods Pro" menjadi "AirPods Pro" (sayap notch sempit). */
function shortName(name: string) {
  let n = name;
  const i = n.indexOf(' milik '); if (i >= 0) n = n.slice(0, i);
  for (const mark of ['’s ', "'s "]) { const j = n.indexOf(mark); if (j >= 0) n = n.slice(j + mark.length); }
  n = n.trim();
  return n || name;
}

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
  /** Unduhan yang sedang berjalan (file sementara browser); `bytes` = yang sudah terunduh. */
  download = $state<{ name: string; bytes: number } | null>(null);
  online = true;
  caps = false;
  layout = '';
  outName = '';
  private warned = new Set<number>();

  constructor() {
    on<Power>('power', (p) => {
      const was = this.power;
      this.power = p;
      if (!features.charger) return;
      const pct = `${p.percent}%`;
      if (was && p.plugged !== was.plugged) {
        if (p.plugged) {
          this.warned.clear();
          const full = !p.charging && p.percent >= 95;
          news.device(full ? L('Baterai penuh', 'Fully charged') : L('Mengisi daya', 'Charging'), L('Charger tersambung', 'Charger connected'), 'zap', TINT.green, { value: pct });
        } else {
          news.device(L('Charger dicabut', 'Charger unplugged'), L('Memakai baterai', 'On battery'), batteryIcon(p.percent), TINT.white, { value: pct });
        }
      }
      // Baterai lemah: sekali pada 20% dan sekali pada 10% tiap pemakaian baterai.
      if (!p.plugged) {
        for (const level of [20, 10]) {
          if (p.percent <= level && !this.warned.has(level)) {
            this.warned.add(level);
            news.device(L('Baterai lemah', 'Low battery'), L('Colok charger sebentar lagi', 'Plug in the charger soon'), 'battery-low', TINT.red, { value: pct, seconds: 6 });
            break;
          }
        }
      }
    });
    on<{ volume: number; muted: boolean }>('volume', (v) => {
      const first = this.volumeSeen;
      const changed = Math.abs(v.volume - this.volume) > 0.005 || v.muted !== this.muted;
      this.volume = v.volume; this.muted = v.muted; this.volumeSeen = true;
      if (first && changed && features.hud) news.showLevel({ kind: 'volume', value: v.volume, muted: v.muted });
    });
    on<number>('brightness', (b) => {
      const first = this.brightness !== null;
      const changed = b !== this.brightness;
      this.brightness = b;
      if (first && changed && features.hud) news.showLevel({ kind: 'brightness', value: b / 100 });
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
      if (features.network && o !== this.online) {
        if (o) news.device(L('Internet tersambung', 'Back online'), L('Koneksi pulih', 'Connection restored'), 'wifi', TINT.green);
        else news.device(L('Internet terputus', 'Offline'), L('Periksa Wi-Fi atau kabel', 'Check Wi-Fi or cable'), 'wifi-off', TINT.orange, { seconds: 4 });
      }
      this.online = o;
    });
    on<boolean>('caps', (c) => {
      if (features.keys && c !== this.caps) {
        news.device(c ? L('Caps Lock nyala', 'Caps Lock on') : L('Caps Lock mati', 'Caps Lock off'),
          c ? L('HURUF BESAR SEMUA', 'TYPING IN CAPITALS') : L('Huruf biasa lagi', 'Back to normal'), c ? 'caps-on' : 'caps-off', c ? TINT.accent : TINT.gray);
      }
      this.caps = c;
    });
    on<string>('layout', (l) => { if (features.keys && this.layout && l !== this.layout) news.device(l, L('Bahasa keyboard', 'Keyboard language'), 'keyboard', TINT.accent); this.layout = l; });
    on<string>('output', (name) => {
      if (features.devices && this.outName && name !== this.outName) {
        news.device(shortName(name), L('Tersambung', 'Connected'), 'headphones', TINT.white, { seconds: 4 });
      }
      this.outName = name;
    });
    on<{ name: string; bytes: number } | null>('download-progress', (p) => { this.download = features.downloads ? p : null; });
    on<{ kind: 'failed' | 'canceled'; name: string }>('download-result', (r) => {
      if (!features.downloads) return;
      news.device(r.kind === 'failed' ? L('Unduhan gagal', 'Download failed') : L('Unduhan dibatalkan', 'Download canceled'), r.name, 'triangle-alert', TINT.orange);
    });
    on<string>('download', (name) => { if (features.downloads) news.device(L('Unduhan selesai', 'Download complete'), name, 'circle-check', TINT.green); });
    void cmd('set_clipboard_watch', { on: features.clipboard });
    void cmd('set_hide_fullscreen', { on: features.hideFullscreen });
  }
}
export const device = new Device();

// Hanya saat pengembangan: memudahkan mencoba tampilan dengan data tiruan di browser.
if (import.meta.env.DEV) (window as unknown as { __device: typeof device }).__device = device;
