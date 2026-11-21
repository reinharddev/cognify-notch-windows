// Susunan dock: modul apa saja, urutannya, dan batas lebarnya. Murni (tanpa Tauri atau Svelte), supaya aturan
// "satu baris, tidak boleh melewati layar" bisa diuji. Lebar tiap modul dibuat PASTI (tidak bergantung isi
// seperti panjang judul lagu), jadi lebar dock bisa dihitung sebelum digambar.

export type ModuleId =
  | 'start' | 'apps' | 'media' | 'lyrics' | 'weather' | 'timer' | 'clipboard' | 'links' | 'battery' | 'volume' | 'quick' | 'tray' | 'clock';

/** Urutan di daftar "Tambah modul". */
export const MODULE_IDS: ModuleId[] = ['start', 'apps', 'media', 'lyrics', 'weather', 'timer', 'clipboard', 'links', 'battery', 'volume', 'quick', 'tray', 'clock'];

export const DEFAULT_LAYOUT: ModuleId[] = ['start', 'apps', 'quick', 'clock'];

export type DockMode = 'floating' | 'attached';

/** Bagian pengaturan yang memengaruhi lebar modul. */
export interface LayoutCfg {
  iconSize: number;
  /** Jumlah tombol timer cepat. */
  presets: number;
  /** Jumlah pintasan tautan. */
  links: number;
  /** Tombol "ikon tersembunyi" hanya ada (dan hanya memakai tempat) saat taskbar Windows disembunyikan. */
  hideTaskbar: boolean;
}

export const PAD = 10;
export const GAP = 6;
/** Jarak antar ikon (aplikasi, tautan). Tiap ikon sudah punya 6 px ruang di sekelilingnya, jadi jaraknya kecil supaya
 *  jarak antar gambar ikon (padding + jarak + padding) sepadan dengan jarak antar widget. */
export const CELL_GAP = 2;
/** Jarak minimal dock dari tepi kiri dan kanan layar. */
export const EDGE = 16;
/** Dock yang punya modul Aplikasi harus menyisakan tempat untuk sekian ikon; selebihnya tidak boleh ditambah. */
export const MIN_APP_SLOTS = 4;

export const cell = (iconSize: number) => iconSize + 12;
/** Lebar tombol preset timer (tetap, supaya lebar modul pasti; cukup untuk "180m"). Sama dengan `.dk-pill` di dock.css. */
export const PILL = 46;

/** Tinggi tombol preset (kapsul) dan tombol ikon bulat di dalam dock. Sama dengan CSS (`.dk-pill`, `.tool`). */
export const PILL_H = 28;
export const TOOL_SIZE = 32;

/**
 * Radius yang konsentris dengan dock (aturan proyek: radius luar = radius dalam + jarak).
 *
 * Tiap elemen punya jarak nyata ke tepi dock (`d`, dari padding dan posisi vertikalnya), jadi radiusnya
 *   r = R - d,  dijepit antara 0 dan setengah sisi terpendeknya (setengah = kapsul atau lingkaran penuh).
 * R dihitung dari tinggi dock: `round` 100 membuat dock kapsul penuh (R = tinggi / 2). Pada kapsul penuh
 * semua yang di dalamnya otomatis kapsul atau lingkaran yang sebangun: sel jadi lingkaran, tombol preset
 * kapsul, ikon bulat. Makin kecil `round`, makin siku, dan semuanya ikut mengecil dengan rumus yang sama.
 *
 *   cell : sel ikon dan jam (tinggi = cellH, jarak ke tepi = PAD)
 *   tile : ikon huruf, tautan, dan sampul (sisi = iconSize, ada di dalam sel: jarak = PAD + (cellH - iconSize) / 2)
 *   pill : tombol preset dan salinan (tinggi PILL_H, di tengah vertikal)
 *   tool : tombol ikon (TOOL_SIZE, di tengah vertikal)
 */
export function dockRadii(round: number, cellH: number, iconSize: number): { outer: number; cell: number; tile: number; pill: number; tool: number } {
  const t = Math.min(100, Math.max(0, Number.isFinite(round) ? round : 100));
  const half = (cellH + PAD * 2) / 2;
  const outer = Math.round(half * (0.2 + 0.8 * (t / 100)));
  const at = (distance: number, side: number) => Math.max(0, Math.min(side / 2, outer - distance));
  return {
    outer,
    cell: at(PAD, cellH),
    tile: at(PAD + (cellH - iconSize) / 2, iconSize),
    pill: at(PAD + (cellH - PILL_H) / 2, PILL_H),
    tool: at(PAD + (cellH - TOOL_SIZE) / 2, TOOL_SIZE),
  };
}

/** Lebar tetap modul yang isinya tidak bergantung pada pengaturan lain. */
export const FIXED_WIDTH: Partial<Record<ModuleId, number>> = {
  media: 288,
  lyrics: 240,
  weather: 76,
  clipboard: 228,
  battery: 60,
  volume: 104,
  quick: 32,
  clock: 92,
};

/** Lebar satu modul. `apps` = jumlah ikon aplikasi yang digambar (hanya untuk modul Aplikasi). */
export function moduleWidth(id: ModuleId, cfg: LayoutCfg, apps = 0): number {
  const c = cell(cfg.iconSize);
  switch (id) {
    case 'start': return c;
    case 'apps': return apps > 0 ? apps * c + (apps - 1) * CELL_GAP : 0;
    case 'timer': return Math.max(112, 27 + cfg.presets * PILL + Math.max(0, cfg.presets - 1) * 4); // padding 4 + ikon 15 + jarak 8, lalu tombol
    case 'links': return Math.max(1, cfg.links) * c + (Math.max(1, cfg.links) - 1) * CELL_GAP;
    case 'tray': return cfg.hideTaskbar ? 32 : 0;
    default: return FIXED_WIDTH[id] ?? 0;
  }
}

/** Lebar seluruh dock: padding, modul (yang punya lebar), dan jarak antar modul. */
export function layoutWidth(layout: ModuleId[], cfg: LayoutCfg, apps = 0): number {
  const widths = layout.map((id) => moduleWidth(id, cfg, apps)).filter((w) => w > 0);
  return PAD * 2 + widths.reduce((a, b) => a + b, 0) + GAP * Math.max(0, widths.length - 1);
}

/** Lebar terbesar yang boleh dipakai dock di layar selebar `screenW` (piksel CSS). */
export const maxWidth = (screenW: number) => Math.max(240, Math.floor(screenW) - EDGE * 2);

/** Berapa ikon aplikasi muat di susunan ini. 0 bila modul Aplikasi tidak ada. */
export function appSlots(layout: ModuleId[], cfg: LayoutCfg, screenW: number): number {
  if (!layout.includes('apps')) return 0;
  const others = layoutWidth(layout, cfg, 0);
  const hasOthers = layout.filter((id) => id !== 'apps' && moduleWidth(id, cfg) > 0).length > 0;
  const free = maxWidth(screenW) - others - (hasOthers ? GAP : 0);
  const c = cell(cfg.iconSize);
  return Math.max(0, Math.floor((free + CELL_GAP) / (c + CELL_GAP)));
}

/** Apakah susunan ini muat: dengan modul Aplikasi, harus ada tempat untuk `MIN_APP_SLOTS` ikon. */
export function fits(layout: ModuleId[], cfg: LayoutCfg, screenW: number): boolean {
  return layout.includes('apps') ? appSlots(layout, cfg, screenW) >= MIN_APP_SLOTS : layoutWidth(layout, cfg, 0) <= maxWidth(screenW);
}

export type AddCheck = { ok: true } | { ok: false; reason: 'exists' | 'full' };

/** Boleh menambah modul `id`? Tidak bila sudah ada, atau bila dock jadi tidak muat. */
export function canAdd(layout: ModuleId[], id: ModuleId, cfg: LayoutCfg, screenW: number): AddCheck {
  if (layout.includes(id)) return { ok: false, reason: 'exists' };
  return fits([...layout, id], cfg, screenW) ? { ok: true } : { ok: false, reason: 'full' };
}

/**
 * Susunan yang pasti muat: modul dari ujung kanan dibuang sampai muat (Start dan Aplikasi dipertahankan).
 * Dipakai saat menggambar, jadi dock tidak pernah melewati layar walau pengaturan tersimpan sudah tidak cocok
 * (ukuran ikon dibesarkan, layar lebih kecil, dan sebagainya).
 */
export function fitLayout(layout: ModuleId[], cfg: LayoutCfg, screenW: number): ModuleId[] {
  const out = [...layout];
  while (!fits(out, cfg, screenW)) {
    let drop = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i] !== 'start' && out[i] !== 'apps') { drop = i; break; }
    }
    if (drop < 0) break;
    out.splice(drop, 1);
  }
  return out;
}

/** Susunan dari data tersimpan: id tak dikenal dan duplikat dibuang; kosong menjadi bawaan. */
export function normalizeLayout(raw: unknown): ModuleId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_LAYOUT];
  const seen = new Set<ModuleId>();
  const out: ModuleId[] = [];
  for (const id of raw) {
    if (typeof id === 'string' && (MODULE_IDS as string[]).includes(id) && !seen.has(id as ModuleId)) {
      seen.add(id as ModuleId);
      out.push(id as ModuleId);
    }
  }
  return out.length ? out : [...DEFAULT_LAYOUT];
}

export const removeModule = (layout: ModuleId[], id: ModuleId): ModuleId[] => layout.filter((m) => m !== id);

/** Geser modul `id` satu tempat ke kiri (-1) atau kanan (+1). */
export function moveModule(layout: ModuleId[], id: ModuleId, by: -1 | 1): ModuleId[] {
  const from = layout.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= layout.length) return layout;
  const next = [...layout];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Ikon aplikasi yang digambar dan sisanya (masuk menu "+N"). Satu tempat dipakai tombol "+N" bila ada sisa. */
export function splitApps<T>(items: T[], slots: number): { shown: T[]; rest: T[] } {
  if (items.length <= slots) return { shown: items, rest: [] };
  const keep = Math.max(0, slots - 1);
  return { shown: items.slice(0, keep), rest: items.slice(keep) };
}

/**
 * Seperti `splitApps`, tapi yang sedang terbuka didahulukan tampil: bila tidak semua muat, yang disematkan tapi belum terbuka
 * masuk "+N" lebih dulu (dari ujung kanan), baru yang terbuka. Urutan yang tampil tidak berubah.
 */
export function splitAppsByUse<T>(items: T[], slots: number, running: (item: T) => boolean): { shown: T[]; rest: T[] } {
  if (items.length <= slots) return { shown: items, rest: [] };
  const keep = Math.max(0, slots - 1);
  const hide = new Set<number>();
  const need = items.length - keep;
  for (const wantRunning of [false, true]) {
    for (let i = items.length - 1; i >= 0 && hide.size < need; i--) {
      if (running(items[i]) === wantRunning) hide.add(i);
    }
  }
  return { shown: items.filter((_, i) => !hide.has(i)), rest: items.filter((_, i) => hide.has(i)) };
}

/** Ukuran pemakaian untuk meteran di Pengaturan: lebar yang sudah dipakai (dengan tempat minimal untuk aplikasi) dan batasnya. */
export function usage(layout: ModuleId[], cfg: LayoutCfg, screenW: number): { used: number; max: number; ratio: number } {
  const used = layoutWidth(layout, cfg, layout.includes('apps') ? MIN_APP_SLOTS : 0);
  const max = maxWidth(screenW);
  return { used, max, ratio: Math.min(1, used / max) };
}

/** Timer cepat: menit yang valid (1 sampai 180). */
export const validMinutes = (n: number) => Number.isInteger(n) && n >= 1 && n <= 180;

/** Pintasan tautan hanya untuk http dan https (dibuka lewat shell Windows, jadi skema lain ditolak). */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Efek pembesaran ala Dock macOS: ikon di bawah kursor membesar banyak, tetangganya ikut membesar menurun halus (kurva kosinus),
 * ikon tumbuh ke atas, dan dock melebar mengikutinya. `Pembesaran` di pengaturan (0 sampai 100) menentukan puncaknya.
 * Sama dengan DockMagnify di notch/Sources/NotchDock (Mac).
 */
export const MAG_MAX = 1.3;
/** Berapa sel di kiri dan kanan kursor yang ikut membesar. */
export const REACH_CELLS = 2.4;

export function magnify(distance: number, reach: number, max = MAG_MAX): number {
  if (!(reach > 0) || !Number.isFinite(distance)) return 1;
  const d = Math.min(1, Math.abs(distance) / reach);
  return 1 + (max - 1) * (Math.cos(d * Math.PI) + 1) / 2;
}

/** Skala puncak dari pengaturan: 0 = tanpa pembesaran (1), 100 = 2,2 kali. */
export const magnifyPeak = (percent: number) => 1 + 1.2 * (Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0) / 100;

/** Skala tiap ikon untuk kursor di `pointer` (satu sumbu dengan `restCenters`, pusat saat diam); semua 1 bila kursor null. */
export function magnifyScales(restCenters: number[], pointer: number | null, cell: number, peak: number): number[] {
  if (pointer === null || !(peak > 1.0001)) return restCenters.map(() => 1);
  return restCenters.map((c) => magnify(pointer - c, cell * REACH_CELLS, peak));
}

/** Ruang di atas dock untuk ikon yang tumbuh ke atas dan label namanya. */
export const magnifyHeadroom = (icon: number, peak: number) => Math.ceil(icon * (peak - 1)) + 34;

/** Lebar tambahan dock saat ikon membesar (jumlah pertumbuhan lebar paling banyak), dengan sedikit cadangan. */
export const magnifyExtraWidth = (cell: number, peak: number) => Math.ceil((peak - 1) * REACH_CELLS * cell) + 12;

/** Indeks sel terdekat dengan `x` (untuk menjatuhkan ikon yang diseret). -1 bila tidak ada sel. */
export function dropIndex(x: number, centers: number[]): number {
  let best = -1;
  for (let i = 0; i < centers.length; i++) if (best < 0 || Math.abs(centers[i] - x) < Math.abs(centers[best] - x)) best = i;
  return best;
}
