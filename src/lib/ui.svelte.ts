import { load, save } from './store.svelte';
import { PAGES } from './pages';
import { features } from './system.svelte';

// Pilihan tampilan dan perilaku, sama dengan Pengaturan di Mac. Di Windows tidak ada poni, jadi lebar notch saat
// tertutup bisa diatur supaya tidak menutupi tab browser atau judul jendela. Panel terbuka tidak ikut berubah.
export const CLOSED_MIN = 70, CLOSED_MAX = 200, CLOSED_DEFAULT = 130;

export type EyesMode = 'blink' | 'follow';
export type Display = 'main' | 'active';
export type Lang = 'auto' | 'id' | 'en';
export type Style = 'notch' | 'pill';
/** Jarak aman bentuk dari tepi layar, supaya tidak terpotong. */
export const EDGE_MARGIN = 12;

class Ui {
  closedWidth = $state(clampW(load('ui.closedWidth', CLOSED_DEFAULT)));
  /** 'blink': hanya berkedip (bawaan). 'follow': mata ikut melihat ke arah kursor. */
  eyesMode = $state<EyesMode>(load<string>('ui.eyesMode', 'blink') === 'follow' ? 'follow' : 'blink');
  /** Notch dibuka dengan klik, bukan saat kursor diarahkan. */
  openOnClick = $state(load('ui.openOnClick', false));
  /** Jeda sebelum terbuka dan sebelum menutup (milidetik). */
  hoverDelay = $state(load('ui.hoverDelay', 90));
  closeDelay = $state(load('ui.closeDelay', 350));
  /** Ukuran panel terbuka: 1 = normal, 1.12 = besar. */
  scale = $state(load('ui.scale', 1));
  display = $state<Display>(load<string>('ui.display', 'main') === 'active' ? 'active' : 'main');
  /** 'notch': menempel di tengah atas. 'pill': mengambang bulat penuh, posisinya diatur di Pengaturan. */
  style = $state<Style>(load<string>('ui.style', 'notch') === 'pill' ? 'pill' : 'notch');
  /** Pusat pill sebagai pecahan lebar dan tinggi layar (0 sampai 1). */
  pillX = $state(Number(load('ui.pillX', 0.5)));
  pillY = $state(Number(load('ui.pillY', 0.06)));
  /** Lebar pill saat tertutup (sama dengan lebar notch, dengan rentang yang sama). */
  pillWidth = $state(clampW(load('ui.pillWidth', CLOSED_DEFAULT)));
  /** Sembunyi otomatis: bentuk menghilang saat tidak dipakai dan muncul lagi saat kursor menyentuh tepi layar. */
  autoHide = $state(load('ui.autoHide', false));
  tabOrder = $state<string[]>(load('ui.tabOrder', PAGES.map((p) => p.id as string)));
  lang = $state<Lang>(((v) => (v === 'id' || v === 'en' ? v : 'auto'))(load<string | null>('lang', null)));

  persist() {
    save('ui.closedWidth', this.closedWidth); save('ui.eyesMode', this.eyesMode); save('ui.openOnClick', this.openOnClick);
    save('ui.hoverDelay', this.hoverDelay); save('ui.closeDelay', this.closeDelay); save('ui.scale', this.scale);
    save('ui.display', this.display); save('ui.tabOrder', this.tabOrder);
    save('ui.style', this.style); save('ui.pillX', this.pillX); save('ui.pillY', this.pillY); save('ui.pillWidth', this.pillWidth); save('ui.autoHide', this.autoHide);
    save('lang', this.lang === 'auto' ? null : this.lang);
  }
  reload() {
    this.closedWidth = clampW(load('ui.closedWidth', CLOSED_DEFAULT));
    this.eyesMode = load<string>('ui.eyesMode', 'blink') === 'follow' ? 'follow' : 'blink';
    this.openOnClick = load('ui.openOnClick', false);
    this.hoverDelay = load('ui.hoverDelay', 90);
    this.closeDelay = load('ui.closeDelay', 350);
    this.scale = load('ui.scale', 1);
    this.display = load<string>('ui.display', 'main') === 'active' ? 'active' : 'main';
    this.tabOrder = load('ui.tabOrder', PAGES.map((p) => p.id as string));
    this.style = load<string>('ui.style', 'notch') === 'pill' ? 'pill' : 'notch';
    this.pillX = Number(load('ui.pillX', 0.5));
    this.pillY = Number(load('ui.pillY', 0.06));
    this.pillWidth = clampW(load('ui.pillWidth', CLOSED_DEFAULT));
    this.autoHide = load('ui.autoHide', false);
  }

  /** Halaman yang terlihat menurut fitur yang menyala, dalam urutan pilihan pengguna (halaman baru di belakang). */
  get pages() {
    const on = (id: string) => {
      switch (id) {
        case 'mirror': return features.camera;
        case 'shortcuts': return features.shortcuts;
        case 'clipboard': return features.clipboard;
        case 'music': return features.media;
        case 'water': return features.water;
        case 'todo': return features.todo;
        case 'clock': return features.clockTools;
        default: return true;
      }
    };
    const rank = (id: string) => { const i = this.tabOrder.indexOf(id); return i < 0 ? 99 : i; };
    return PAGES.filter((p) => on(p.id)).sort((a, b) => rank(a.id) - rank(b.id));
  }
  /** Urutan semua halaman (untuk daftar di Pengaturan), tanpa menyaring fitur. */
  get allOrdered() {
    const rank = (id: string) => { const i = this.tabOrder.indexOf(id); return i < 0 ? 99 : i; };
    return [...PAGES].sort((a, b) => rank(a.id) - rank(b.id));
  }
  move(id: string, by: number) {
    const order = this.allOrdered.map((p) => p.id as string);
    const i = order.indexOf(id), j = i + by;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this.tabOrder = order;
  }
}
function clampW(w: number) { return Math.min(CLOSED_MAX, Math.max(CLOSED_MIN, Math.round(Number(w) || CLOSED_DEFAULT))); }
export const ui = new Ui();
