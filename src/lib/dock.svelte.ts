// Dock (taskbar kustom): pengaturan, aplikasi yang disematkan, dan jendela yang sedang terbuka.
// Pengaturan disimpan di penyimpanan bersama webview, jadi jendela notch, Pengaturan, dan dock
// membacanya dari sumber yang sama. Hanya jendela notch yang membuka dan menutup dock.
import { load, save } from './store.svelte';
import { cmd, cmdTry, inTauri, on, windowKind } from './bridge';
import { buildItems, cleanPins, keyOf, movePin, togglePin, type DockItem, type DockWindow, type Pin } from './dockItems';
import { cleanStyle, type DockStyleCfg } from './dockStyle';
import {
  appSlots, canAdd, fitLayout, moveModule, normalizeLayout, normalizeUrl, removeModule, usage, validMinutes,
  type AddCheck, type DockMode, type LayoutCfg, type ModuleId,
} from './dockLayout';

export type DockLink = { id: string; label: string; url: string };
export const MAX_PRESETS = 4;
export const MAX_LINKS = 8;

export const ICON_MIN = 28;
export const ICON_MAX = 56;
export const MARGIN_MAX = 48;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

class DockStore {
  enabled = $state(Boolean(load('dock.enabled', false)));
  hideTaskbar = $state(Boolean(load('dock.hideTaskbar', false)));
  /** Modul di dock, dari kiri ke kanan. */
  layout = $state<ModuleId[]>(normalizeLayout(load('dock.layout', null)));
  /** "floating": melayang dengan jarak dari tepi; "attached": menempel di tepi bawah layar. */
  mode = $state<DockMode>(load<string>('dock.mode', 'floating') === 'attached' ? 'attached' : 'floating');
  /** Latar dock: ikuti notch, kaca, warna, atau gradien (lihat dockStyle.ts). */
  style = $state<DockStyleCfg>(cleanStyle(load('dock.style', {})));
  /** Tombol timer cepat (menit). */
  presets = $state<number[]>(cleanPresets(load('dock.presets', [5, 15, 25])));
  links = $state<DockLink[]>(cleanLinks(load('dock.links', [])));
  iconSize = $state(clamp(Number(load('dock.iconSize', 40)), ICON_MIN, ICON_MAX));
  margin = $state(clamp(Number(load('dock.margin', 10)), 0, MARGIN_MAX));
  /** Kebulatan dock, 0 sampai 100; 100 = kapsul penuh. Semua radius di dalamnya turunan dari ini (dockRadii). */
  round = $state(clamp(Number(load('dock.round', 100)), 0, 100));
  /** Pembesaran ikon saat kursor lewat, 0 (mati) sampai 100 (2,2 kali); lihat magnifyPeak. */
  magnify = $state(clamp(Number(load('dock.magnify', 65)), 0, 100));
  pins = $state<Pin[]>(cleanPins(load('dock.pins', [])));

  /** Jendela terbuka (dari Rust), susunan ikon, dan ikon yang sudah dibaca. */
  windows = $state<DockWindow[]>([]);
  items = $state<DockItem[]>([]);
  icons = $state<Record<string, string>>({});
  /** Pesan galat terakhir saat menyembunyikan taskbar, bila ada. */
  taskbarError = $state<string | null>(null);

  private seen: string[] = [];
  private asked = new Set<string>();

  persist() {
    save('dock.enabled', this.enabled);
    save('dock.hideTaskbar', this.hideTaskbar);
    save('dock.layout', this.layout);
    save('dock.mode', this.mode);
    save('dock.style', this.style);
    save('dock.presets', this.presets);
    save('dock.links', this.links);
    save('dock.iconSize', this.iconSize);
    save('dock.margin', this.margin);
    save('dock.round', this.round);
    save('dock.magnify', this.magnify);
    save('dock.pins', this.pins);
  }

  reload() {
    this.enabled = Boolean(load('dock.enabled', false));
    this.hideTaskbar = Boolean(load('dock.hideTaskbar', false));
    this.layout = normalizeLayout(load('dock.layout', null));
    this.mode = load<string>('dock.mode', 'floating') === 'attached' ? 'attached' : 'floating';
    this.style = cleanStyle(load('dock.style', {}));
    this.presets = cleanPresets(load('dock.presets', [5, 15, 25]));
    this.links = cleanLinks(load('dock.links', []));
    this.iconSize = clamp(Number(load('dock.iconSize', 40)), ICON_MIN, ICON_MAX);
    this.margin = clamp(Number(load('dock.margin', 10)), 0, MARGIN_MAX);
    this.round = clamp(Number(load('dock.round', 100)), 0, 100);
    this.magnify = clamp(Number(load('dock.magnify', 65)), 0, 100);
    this.pins = cleanPins(load('dock.pins', []));
    this.rebuild();
  }

  /** Jendela notch: buka atau tutup dock, dan sembunyikan taskbar Windows bila diminta. */
  async apply() {
    if (!inTauri || windowKind !== 'notch') return;
    this.taskbarError = null;
    if (!this.enabled) {
      // Menutup dock juga mengembalikan taskbar Windows.
      await cmd('taskdock_close');
      return;
    }
    await cmd('taskdock_open');
    const r = await cmdTry('taskbar_hide', { hidden: this.hideTaskbar });
    if (!r.ok) this.taskbarError = r.error;
  }

  rebuild() {
    const r = buildItems(this.pins, this.windows, this.seen);
    this.items = r.items;
    this.seen = r.seen;
    for (const it of r.items) void this.ensureIcon(it.exe);
  }

  /** Jendela dock: ambil daftar awal lalu ikuti perubahan dari Rust. */
  async start() {
    if (windowKind !== 'taskdock') return;
    on<DockWindow[]>('taskdock-windows', (list) => { this.windows = list; this.rebuild(); });
    on<string>('prefs-changed', (scope) => { if (scope === 'dock' || scope === 'ui') this.reload(); });
    const first = await cmd<DockWindow[]>('taskdock_snapshot');
    if (first) { this.windows = first; }
    this.rebuild();
  }

  async ensureIcon(exe: string) {
    const k = keyOf(exe);
    if (this.icons[k] || this.asked.has(k)) return;
    this.asked.add(k);
    const url = await cmd<string | null>('taskdock_icon', { exe });
    if (url) this.icons[k] = url;
  }

  iconOf(exe: string): string | undefined {
    return this.icons[keyOf(exe)];
  }

  isPinned(exe: string) {
    return this.pins.some((p) => keyOf(p.exe) === keyOf(exe));
  }

  togglePin(exe: string, name: string) {
    this.pins = togglePin(this.pins, exe, name);
    this.persist();
    this.rebuild();
  }

  /** Pindahkan sematan ke indeks `to` (saat ikon diseret). */
  movePinTo(exe: string, to: number) {
    const from = this.pins.findIndex((p) => keyOf(p.exe) === keyOf(exe));
    if (from < 0) return;
    this.pins = movePin(this.pins, from, Math.max(0, Math.min(this.pins.length - 1, to)));
    this.persist();
    this.rebuild();
  }

  /** Geser sematan satu tempat ke kiri (-1) atau kanan (+1). */
  nudgePin(exe: string, by: -1 | 1) {
    const from = this.pins.findIndex((p) => keyOf(p.exe) === keyOf(exe));
    if (from < 0) return;
    this.pins = movePin(this.pins, from, from + by);
    this.persist();
    this.rebuild();
  }

  // ---- Susunan modul ----

  /** Pengaturan yang memengaruhi lebar modul. */
  get cfg(): LayoutCfg {
    return { iconSize: this.iconSize, presets: this.presets.length, links: this.links.length, hideTaskbar: this.hideTaskbar };
  }

  /** Susunan yang pasti muat di layar selebar `screenW`: modul dari ujung kanan gugur bila tidak muat. */
  shown(screenW: number): ModuleId[] {
    return fitLayout(this.layout, this.cfg, screenW);
  }

  slots(screenW: number): number {
    return appSlots(this.shown(screenW), this.cfg, screenW);
  }

  usage(screenW: number) {
    return usage(this.layout, this.cfg, screenW);
  }

  check(id: ModuleId, screenW: number): AddCheck {
    return canAdd(this.layout, id, this.cfg, screenW);
  }

  /** Tambah modul bila muat. Mengembalikan hasil pemeriksaan. */
  add(id: ModuleId, screenW: number): AddCheck {
    const r = this.check(id, screenW);
    if (r.ok) { this.layout = [...this.layout, id]; this.persist(); }
    return r;
  }

  remove(id: ModuleId) {
    this.layout = removeModule(this.layout, id);
    this.persist();
  }

  move(id: ModuleId, by: -1 | 1) {
    this.layout = moveModule(this.layout, id, by);
    this.persist();
  }

  /** Setelah ukuran ikon atau jumlah tombol berubah: buang modul dari ujung kanan sampai muat lagi. */
  refit(screenW: number) {
    const fitted = fitLayout(this.layout, this.cfg, screenW);
    if (fitted.length !== this.layout.length) { this.layout = fitted; this.persist(); }
  }

  // ---- Timer cepat dan tautan ----

  addPreset(minutes: number): boolean {
    if (!validMinutes(minutes) || this.presets.includes(minutes) || this.presets.length >= MAX_PRESETS) return false;
    this.presets = [...this.presets, minutes].sort((a, b) => a - b);
    this.persist();
    return true;
  }

  removePreset(minutes: number) {
    if (this.presets.length <= 1) return;
    this.presets = this.presets.filter((m) => m !== minutes);
    this.persist();
  }

  /** Tambah pintasan tautan. Mengembalikan alasan gagal, atau null bila berhasil. */
  addLink(label: string, address: string): 'invalid' | 'full' | null {
    const url = normalizeUrl(address);
    if (!url) return 'invalid';
    if (this.links.length >= MAX_LINKS) return 'full';
    const name = label.trim() || new URL(url).hostname.replace(/^www\./, '');
    this.links = [...this.links, { id: crypto.randomUUID(), label: name.slice(0, 24), url }];
    this.persist();
    return null;
  }

  removeLink(id: string) {
    this.links = this.links.filter((l) => l.id !== id);
    this.persist();
  }
}

export function cleanPresets(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw.filter((m): m is number => typeof m === 'number' && validMinutes(m)) : [];
  const unique = [...new Set(list)].sort((a, b) => a - b).slice(0, MAX_PRESETS);
  return unique.length ? unique : [5, 15, 25];
}

export function cleanLinks(raw: unknown): DockLink[] {
  if (!Array.isArray(raw)) return [];
  const out: DockLink[] = [];
  for (const l of raw) {
    if (!l || typeof l.id !== 'string' || typeof l.label !== 'string' || typeof l.url !== 'string') continue;
    const url = normalizeUrl(l.url);
    if (url) out.push({ id: l.id, label: l.label.slice(0, 24), url });
  }
  return out.slice(0, MAX_LINKS);
}

export const dock = new DockStore();
