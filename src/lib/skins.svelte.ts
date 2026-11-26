import { cmd, inTauri } from './bridge';
import { listen } from '@tauri-apps/api/event';
import { defaultMimik, type MimikPreset, type MimikStyle } from './mimik';

// Pengaturan Skin (dipakai jendela Pengaturan). Sumber kebenarannya ada di Rust (`skins.json`, lihat skins.rs): daftar skin,
// yang menyala, tingkat jendela, ukuran, gaya Mimik, dan gaya tersimpan. Sama dengan SkinManager di Skins.swift (Mac).

export interface SkinInfo {
  id: string; name: string; desc: string; width: number; height: number;
  cursor: boolean; audio: boolean; notch: boolean; anchor: string; entry: string;
}

/** Warna skin Lirik: baris yang dinyanyikan, dan judul + baris berikutnya. */
export interface LyricColors { color: string; sub: string }
export const defaultLyrics = (): LyricColors => ({ color: '#ffffff', sub: '#ffffff' });

interface StateView {
  skins: SkinInfo[]; enabled: string[]; onTop: boolean; arranging: boolean;
  scales: Record<string, number>; maxScales: Record<string, number>; lyrics: Partial<LyricColors> | null;
  mimik: Partial<MimikStyle> | null; presets: MimikPreset[] | null; folder: string;
}

class SkinsStore {
  skins = $state<SkinInfo[]>([]);
  enabled = $state<string[]>([]);
  onTop = $state(false);
  /** Ukuran per skin dan batasnya menurut layar (dari Rust). */
  scales = $state<Record<string, number>>({});
  maxScales = $state<Record<string, number>>({});
  lyrics = $state<LyricColors>(defaultLyrics());
  private lyricTimer = 0;
  arranging = $state(false);
  folder = $state('');
  mimik = $state<MimikStyle>(defaultMimik());
  presets = $state<MimikPreset[]>([]);
  /** Reaksi sesaat dari playground; `n` naik tiap permintaan supaya skin dan pratinjau memutarnya. */
  reaction = $state({ name: '', n: 0 });
  loaded = $state(false);
  private saveTimer = 0;

  constructor() {
    if (!inTauri) return;
    void this.load();
    void listen('skins-changed', () => void this.load());
  }

  async load() {
    const s = await cmd<StateView>('skins_state');
    if (!s) return;
    this.skins = s.skins;
    this.enabled = s.enabled;
    this.onTop = s.onTop;
    this.scales = s.scales ?? {};
    this.maxScales = s.maxScales ?? {};
    this.lyrics = { ...defaultLyrics(), ...(s.lyrics ?? {}) };
    this.arranging = s.arranging;
    this.folder = s.folder;
    this.mimik = { ...defaultMimik(), ...(s.mimik ?? {}) };
    this.presets = Array.isArray(s.presets) ? s.presets : [];
    this.loaded = true;
  }

  isOn(id: string) { return this.enabled.includes(id); }

  async setOn(id: string, on: boolean) {
    this.enabled = on ? [...this.enabled.filter((e) => e !== id), id] : this.enabled.filter((e) => e !== id);
    await cmd('skins_set_enabled', { id, on });
  }

  setOnTop(v: boolean) { this.onTop = v; void cmd('skins_set_option', { onTop: v }); }
  scaleOf(id: string) { return this.scales[id] ?? 1; }
  maxScaleOf(id: string) { return this.maxScales[id] ?? 2.5; }
  setScale(id: string, v: number) {
    const value = Math.min(this.maxScaleOf(id), Math.max(0.5, v));
    this.scales = { ...this.scales, [id]: value };
    void cmd('skins_set_scale', { id, scale: value });
  }
  setLyrics(partial: Partial<LyricColors>) {
    this.lyrics = { ...this.lyrics, ...partial };
    clearTimeout(this.lyricTimer);
    this.lyricTimer = window.setTimeout(() => void cmd('skins_save_lyrics', { style: $state.snapshot(this.lyrics) }), 120);
  }
  setArranging(v: boolean) { this.arranging = v; void cmd('skins_set_arranging', { on: v }); }
  resetPositions() { void cmd('skins_reset_positions'); }
  reveal() { void cmd('skins_reveal'); }
  reload() { void cmd('skins_reload'); }

  // ---- Playground Mimik ----

  /** Ubah gaya Mimik: disimpan dan dikirim ke skin di desktop (ditunda sebentar supaya geser warna tidak menulis berkas tiap piksel). */
  patch(partial: Partial<MimikStyle>) {
    this.mimik = { ...this.mimik, ...partial };
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void cmd('skins_save_mimik', { style: $state.snapshot(this.mimik) }), 120);
  }

  resetMimik() { this.patch(defaultMimik()); }

  private persistPresets() { void cmd('skins_save_presets', { presets: $state.snapshot(this.presets) }); }

  savePreset(name: string) {
    const clean = name.trim();
    if (!clean) return;
    const existing = this.presets.find((p) => p.name.toLowerCase() === clean.toLowerCase());
    const id = existing?.id ?? crypto.randomUUID();
    const style = { ...this.mimik, preset: 'saved:' + id };
    this.presets = [...this.presets.filter((p) => p.id !== id), { id, name: clean.slice(0, 24), style }];
    this.patch(style);
    this.persistPresets();
  }

  deletePreset(id: string) { this.presets = this.presets.filter((p) => p.id !== id); this.persistPresets(); }
  applyPreset(p: MimikPreset) { this.patch({ ...p.style, preset: 'saved:' + p.id }); }

  async react(name: string) {
    const n = await cmd<number>('skins_react', { name });
    this.reaction = { name, n: n ?? this.reaction.n + 1 };
  }
}
export const skins = new SkinsStore();
