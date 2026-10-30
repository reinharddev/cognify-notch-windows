import { load, save } from './store.svelte';
import { PAGES } from './pages';
import { features } from './system.svelte';
import { EMOTIONS, type Emotion, type Mode } from './companion';

// Pilihan tampilan dan perilaku, sama dengan Pengaturan di Mac. Di Windows tidak ada poni, jadi lebar notch saat
// tertutup bisa diatur supaya tidak menutupi tab browser atau judul jendela. Panel terbuka tidak ikut berubah.
export const CLOSED_MIN = 70, CLOSED_MAX = 200, CLOSED_DEFAULT = 130;

const mode = (v: unknown): Mode => (v === 'custom' || v === 'fixed' ? v : 'dynamic');
const emotion = (v: unknown): Emotion => ((EMOTIONS as readonly string[]).includes(v as string) ? (v as Emotion) : 'happy');
const pickMap = (v: unknown): Record<string, string> => (v && typeof v === 'object' ? (v as Record<string, string>) : {});

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
  /** Kelengkungan sudut bawah panel terbuka (px, sebelum diskalakan). */
  roundness = $state(Number(load('ui.roundness', 30)));
  /** Warna aksen (#rrggbb): tab terpilih, tombol, progres, equalizer bawaan; kosong = ungu bawaan. */
  accentColor = $state(String(load('ui.accentColor', '')));
  /** Warna lirik (#rrggbb): baris yang sedang dinyanyikan dan baris lainnya; kosong = putih bawaan. */
  lyricAuto = $state(Boolean(load('ui.lyricAuto', false)));
  lyricActive = $state(String(load('ui.lyricActive', '')));
  lyricIdle = $state(String(load('ui.lyricIdle', '')));
  /** Warna equalizer otomatis dari sampul lagu. */
  equalizerAuto = $state(Boolean(load('ui.equalizerAuto', false)));
  /** Warna equalizer (#rrggbb); kosong = warna aksen. */
  equalizerColor = $state(String(load('ui.equalizerColor', '')));
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
  /** Wajah teman kecil: cara memilih ekspresi, ekspresi tetap, berkedip, dan ekspresi pilihan per keadaan atau kejadian. */
  companionMode = $state<Mode>(mode(load('ui.companionMode', 'dynamic')));
  companionFixed = $state<Emotion>(emotion(load('ui.companionFixed', 'happy')));
  companionBlink = $state(load('ui.companionBlink', true));
  companionMap = $state<Record<string, string>>(pickMap(load('ui.companionMap', {})));
  tabOrder = $state<string[]>(load('ui.tabOrder', PAGES.map((p) => p.id as string)));
  lang = $state<Lang>(((v) => (v === 'id' || v === 'en' ? v : 'auto'))(load<string | null>('lang', null)));

  /** Pasang warna aksen ke variabel CSS --accent (dipakai semua komponen). */
  applyAccent() {
    const root = document.documentElement;
    if (this.accentColor) root.style.setProperty('--accent', this.accentColor); else root.style.removeProperty('--accent');
  }

  persist() {
    save('ui.closedWidth', this.closedWidth); save('ui.eyesMode', this.eyesMode); save('ui.openOnClick', this.openOnClick);
    save('ui.hoverDelay', this.hoverDelay); save('ui.closeDelay', this.closeDelay); save('ui.scale', this.scale); save('ui.roundness', this.roundness); save('ui.equalizerColor', this.equalizerColor); save('ui.accentColor', this.accentColor); save('ui.lyricAuto', this.lyricAuto); save('ui.equalizerAuto', this.equalizerAuto); save('ui.lyricActive', this.lyricActive); save('ui.lyricIdle', this.lyricIdle);
    save('ui.display', this.display); save('ui.tabOrder', this.tabOrder);
    save('ui.style', this.style); save('ui.pillX', this.pillX); save('ui.pillY', this.pillY); save('ui.pillWidth', this.pillWidth); save('ui.autoHide', this.autoHide);
    save('ui.companionMode', this.companionMode); save('ui.companionFixed', this.companionFixed);
    save('ui.companionBlink', this.companionBlink); save('ui.companionMap', $state.snapshot(this.companionMap));
    save('lang', this.lang === 'auto' ? null : this.lang);
  }
  reload() {
    this.closedWidth = clampW(load('ui.closedWidth', CLOSED_DEFAULT));
    this.eyesMode = load<string>('ui.eyesMode', 'blink') === 'follow' ? 'follow' : 'blink';
    this.openOnClick = load('ui.openOnClick', false);
    this.hoverDelay = load('ui.hoverDelay', 90);
    this.closeDelay = load('ui.closeDelay', 350);
    this.scale = load('ui.scale', 1);
    this.roundness = Number(load('ui.roundness', 30));
    this.equalizerColor = String(load('ui.equalizerColor', ''));
    this.accentColor = String(load('ui.accentColor', ''));
    this.lyricAuto = Boolean(load('ui.lyricAuto', false));
    this.equalizerAuto = Boolean(load('ui.equalizerAuto', false));
    this.lyricActive = String(load('ui.lyricActive', ''));
    this.lyricIdle = String(load('ui.lyricIdle', ''));
    this.applyAccent();
    this.display = load<string>('ui.display', 'main') === 'active' ? 'active' : 'main';
    this.tabOrder = load('ui.tabOrder', PAGES.map((p) => p.id as string));
    this.style = load<string>('ui.style', 'notch') === 'pill' ? 'pill' : 'notch';
    this.pillX = Number(load('ui.pillX', 0.5));
    this.pillY = Number(load('ui.pillY', 0.06));
    this.pillWidth = clampW(load('ui.pillWidth', CLOSED_DEFAULT));
    this.autoHide = load('ui.autoHide', false);
    this.companionMode = mode(load('ui.companionMode', 'dynamic'));
    this.companionFixed = emotion(load('ui.companionFixed', 'happy'));
    this.companionBlink = load('ui.companionBlink', true);
    this.companionMap = pickMap(load('ui.companionMap', {}));
  }

  /** Halaman yang terlihat menurut fitur yang menyala, dalam urutan pilihan pengguna (halaman baru di belakang). */
  /** Urutan halaman; halaman baru yang belum ada di urutan tersimpan diletakkan setelah halaman sebelumnya di daftar bawaan. */
  rank(id: string): number {
    const i = this.tabOrder.indexOf(id);
    if (i >= 0) return i;
    const k = PAGES.findIndex((p) => p.id === id);
    for (let j = k - 1; j >= 0; j--) { const r = this.tabOrder.indexOf(PAGES[j].id); if (r >= 0) return r + 0.5; }
    return -0.5;
  }
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
    const rank = (id: string) => this.rank(id);
    return PAGES.filter((p) => on(p.id)).sort((a, b) => rank(a.id) - rank(b.id));
  }
  /** Urutan semua halaman (untuk daftar di Pengaturan), tanpa menyaring fitur. */
  get allOrdered() {
    const rank = (id: string) => this.rank(id);
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
