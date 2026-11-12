import { load, save } from './store.svelte';
import { L } from './i18n';
import { PAGES } from './pages';
import { hub } from './hub.svelte';
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

export type BgMode = 'none' | 'color' | 'gradient' | 'image';
const bgModeOf = (v: unknown): BgMode => (v === 'color' || v === 'gradient' || v === 'image' ? v : 'none');

/** Paket tema: satu klik mengatur warna aksen dan latar sekaligus (sama dengan Cognify Notch Mac). */
export const THEME_PRESETS: { id: string; name: () => string; accent: string; mode: BgMode; c1: string; c2: string; angle: number }[] = [
  { id: 'default', name: () => L('Bawaan', 'Default'), accent: '', mode: 'none', c1: '#000000', c2: '#000000', angle: 135 },
  { id: 'dusk', name: () => L('Senja', 'Dusk'), accent: '#ff9f0a', mode: 'gradient', c1: '#2a1550', c2: '#8c2f4f', angle: 150 },
  { id: 'ocean', name: () => L('Laut', 'Ocean'), accent: '#32ade6', mode: 'gradient', c1: '#04203a', c2: '#0a5a73', angle: 160 },
  { id: 'forest', name: () => L('Hutan', 'Forest'), accent: '#30d158', mode: 'gradient', c1: '#07251a', c2: '#1b4d3a', angle: 145 },
  { id: 'sakura', name: () => L('Sakura', 'Sakura'), accent: '#ff6fa5', mode: 'gradient', c1: '#3a1530', c2: '#7a2f5a', angle: 135 },
  { id: 'neon', name: () => L('Neon', 'Neon'), accent: '#bf5af2', mode: 'gradient', c1: '#0a0a1f', c2: '#2b0f4a', angle: 120 },
  { id: 'paper', name: () => L('Kertas', 'Paper'), accent: '#0a84ff', mode: 'color', c1: '#1f1f24', c2: '#1f1f24', angle: 135 },
];

class Ui {
  closedWidth = $state(clampW(load('ui.closedWidth', CLOSED_DEFAULT)));
  /** 'follow': mata mengikuti arah kursor (bawaan). 'blink': hanya berkedip. */
  eyesMode = $state<EyesMode>(load<string>('ui.eyesMode', 'follow') === 'follow' ? 'follow' : 'blink');
  /** Notch dibuka dengan klik, bukan saat kursor diarahkan. */
  openOnClick = $state(load('ui.openOnClick', true));
  /** Jeda sebelum terbuka dan sebelum menutup (milidetik). */
  hoverDelay = $state(load('ui.hoverDelay', 90));
  closeDelay = $state(load('ui.closeDelay', 350));
  /** Ukuran panel terbuka: 1 = normal, 1.12 = besar. */
  scale = $state(load('ui.scale', 1));
  /** Kelengkungan sudut bawah panel terbuka (px, sebelum diskalakan). */
  roundness = $state(Number(load('ui.roundness', 30)));
  /** Warna aksen (#rrggbb): tab terpilih, tombol, progres, equalizer bawaan; kosong = ungu bawaan. */
  accentColor = $state(String(load('ui.accentColor', '')));
  /** Latar panel: hitam (bawaan), warna, gradien, atau gambar sendiri. Notch tertutup yang menempel tetap hitam. */
  bgMode = $state<BgMode>(bgModeOf(load('ui.bgMode', 'none')));
  bgColor = $state(String(load('ui.bgColor', '#1b1b22')));
  bgColor2 = $state(String(load('ui.bgColor2', '#3a2a6a')));
  bgAngle = $state(Number(load('ui.bgAngle', 135)));
  /** Gambar latar (data URL JPEG, diperkecil) yang disimpan di penyimpanan app ini saja. */
  bgImage = $state(String(load('ui.bgImage', '')));
  bgDim = $state(Number(load('ui.bgDim', 0.35)));
  bgBlur = $state(Number(load('ui.bgBlur', 0)));
  /** CSS latar untuk panel terbuka dan pill; null = hitam bawaan. */
  get bgCss(): { background: string; image: boolean } | null {
    const a = this.bgAngle + 90; // 0 derajat = ke kanan, seperti di Mac
    if (this.bgMode === 'color') return { background: this.bgColor, image: false };
    if (this.bgMode === 'gradient') return { background: `linear-gradient(${a}deg, ${this.bgColor}, ${this.bgColor2})`, image: false };
    if (this.bgMode === 'image' && this.bgImage) return { background: `url(${this.bgImage}) center / cover no-repeat`, image: true };
    return null;
  }
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
  autoHide = $state(load('ui.autoHide', false) && load<string>('ui.style', 'notch') !== 'pill');
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
    save('ui.bgMode', this.bgMode); save('ui.bgColor', this.bgColor); save('ui.bgColor2', this.bgColor2); save('ui.bgAngle', this.bgAngle); save('ui.bgImage', this.bgImage); save('ui.bgDim', this.bgDim); save('ui.bgBlur', this.bgBlur);
    save('ui.style', this.style); save('ui.pillX', this.pillX); save('ui.pillY', this.pillY); save('ui.pillWidth', this.pillWidth); save('ui.autoHide', this.autoHide);
    save('ui.companionMode', this.companionMode); save('ui.companionFixed', this.companionFixed);
    save('ui.companionBlink', this.companionBlink); save('ui.companionMap', $state.snapshot(this.companionMap));
    save('lang', this.lang === 'auto' ? null : this.lang);
  }
  reload() {
    this.closedWidth = clampW(load('ui.closedWidth', CLOSED_DEFAULT));
    this.eyesMode = load<string>('ui.eyesMode', 'follow') === 'follow' ? 'follow' : 'blink';
    this.openOnClick = load('ui.openOnClick', true);
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
    this.bgMode = bgModeOf(load('ui.bgMode', 'none'));
    this.bgColor = String(load('ui.bgColor', '#1b1b22'));
    this.bgColor2 = String(load('ui.bgColor2', '#3a2a6a'));
    this.bgAngle = Number(load('ui.bgAngle', 135));
    this.bgImage = String(load('ui.bgImage', ''));
    this.bgDim = Number(load('ui.bgDim', 0.35));
    this.bgBlur = Number(load('ui.bgBlur', 0));
    this.applyAccent();
    this.display = load<string>('ui.display', 'main') === 'active' ? 'active' : 'main';
    this.tabOrder = load('ui.tabOrder', PAGES.map((p) => p.id as string));
    this.style = load<string>('ui.style', 'notch') === 'pill' ? 'pill' : 'notch';
    this.pillX = Number(load('ui.pillX', 0.5));
    this.pillY = Number(load('ui.pillY', 0.06));
    this.pillWidth = clampW(load('ui.pillWidth', CLOSED_DEFAULT));
    this.autoHide = load('ui.autoHide', false) && this.style !== 'pill';
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
        case 'cognify': return hub.connected;
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
