import { load, save } from './store.svelte';
import { cmd, on } from './bridge';
import { features } from './system.svelte';
import type { ClipItem } from './system.svelte';

const MAX_TEXT = 40, MAX_IMAGES = 8;
const uid = () => crypto.randomUUID();

// ---------- Riwayat clipboard ----------
// Teks dan tautan disimpan di PC ini (maks. 40); gambar hanya di memori selama app berjalan (maks. 8).
// Isi yang ditandai rahasia oleh pengelola kata sandi tidak pernah dikirim Rust.
class Clipboard {
  items = $state<ClipItem[]>(load<ClipItem[]>('clip', []));

  constructor() {
    on<{ kind: 'text' | 'link' | 'image'; text: string; image?: string; app: string | null }>('clip', (c) => {
      if (!features.clipboard) return;
      const same = this.items.find((i) => i.kind === c.kind && i.text === c.text && (c.kind !== 'image' || i.image === c.image));
      const rest = this.items.filter((i) => i !== same);
      this.items = this.sort([{ id: same?.id ?? uid(), ...c, t: Date.now(), pinned: same?.pinned ?? false }, ...rest]);
      this.persist();
    });
  }
  private sort(list: ClipItem[]) {
    const pinned = list.filter((i) => i.pinned);
    const text = list.filter((i) => !i.pinned && i.kind !== 'image').slice(0, MAX_TEXT);
    const img = list.filter((i) => !i.pinned && i.kind === 'image').slice(0, MAX_IMAGES);
    return [...pinned, ...[...text, ...img].sort((a, b) => b.t - a.t)];
  }
  private persist() { save('clip', this.items.filter((i) => i.kind !== 'image')); }
  pin(id: string) { this.items = this.sort(this.items.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i))); this.persist(); }
  remove(id: string) { this.items = this.items.filter((i) => i.id !== id); this.persist(); }
  clear() { this.items = this.items.filter((i) => i.pinned); this.persist(); }
  copy(i: ClipItem) { void cmd(i.kind === 'image' ? 'clip_set_image' : 'clip_set_text', i.kind === 'image' ? { data: i.image } : { text: i.text }); }
}
export const clipboard = new Clipboard();

// ---------- Tray: tempat parkir file ----------
// Yang disimpan hanya letak file aslinya, bukan salinan, jadi file tetap di tempat asal.
export interface TrayItem { id: string; path: string; name: string }

class Tray {
  items = $state<TrayItem[]>(load<TrayItem[]>('tray', []));
  constructor() {
    on<string[]>('files-dropped', (paths) => this.add(paths));
    void this.prune();
  }
  private persist() { save('tray', this.items); }
  private async prune() {
    const alive = await cmd<string[]>('existing_paths', { paths: this.items.map((i) => i.path) });
    if (alive) { this.items = this.items.filter((i) => alive.includes(i.path)); this.persist(); }
  }
  add(paths: string[]) {
    const fresh = paths.filter(Boolean).map((p) => ({ id: uid(), path: p, name: p.split(/[\\/]/).pop() || p }));
    this.items = [...fresh, ...this.items.filter((i) => !paths.includes(i.path))].slice(0, 30);
    this.persist();
  }
  remove(id: string) { this.items = this.items.filter((i) => i.id !== id); this.persist(); }
  clear() { this.items = []; this.persist(); }
  open(i: TrayItem) { void cmd('open_target', { target: i.path }); }
  reveal(i: TrayItem) { void cmd('reveal', { path: i.path }); }
}
export const tray = new Tray();

// ---------- Pintasan ----------
// Windows tidak punya Siri Shortcuts, jadi pintasan dibuat sendiri: tautan, folder, atau app.
export interface Shortcut { id: string; name: string; target: string }

class Shortcuts {
  items = $state<Shortcut[]>(load<Shortcut[]>('shortcuts', []));
  add(name: string, target: string) {
    if (!name.trim() || !target.trim()) return;
    this.items = [...this.items, { id: uid(), name: name.trim(), target: target.trim() }];
    save('shortcuts', this.items);
  }
  remove(id: string) { this.items = this.items.filter((s) => s.id !== id); save('shortcuts', this.items); }
  run(s: Shortcut) { void cmd('open_target', { target: s.target }); }
}
export const shortcuts = new Shortcuts();
