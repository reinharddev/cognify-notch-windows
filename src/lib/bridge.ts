// Jembatan ke sisi Rust. Di browser biasa (npm run dev) tidak ada Tauri, jadi semuanya
// dilewati dan hover memakai peristiwa pointer biasa; ini memudahkan merancang tampilan.
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';

export const inTauri = '__TAURI_INTERNALS__' in window;

/** Jendela yang menjalankan kode ini: 'notch' (jendela utama) atau 'settings'. Di browser: ?w=settings. */
export const windowKind: 'notch' | 'settings' =
  ((window as unknown as { __CN_WINDOW__?: string }).__CN_WINDOW__ ?? new URLSearchParams(location.search).get('w')) === 'settings' ? 'settings' : 'notch';

/** Jendela Pengaturan terpisah. Di browser biasa dibuka sebagai tab baru. */
export function openSettings() {
  if (inTauri) void invoke('open_settings');
  else window.open('?w=settings', '_blank');
}

/** Bagian pengaturan yang berubah; jendela notch memuat ulang bagian itu dari penyimpanan bersama. */
export type PrefScope = 'features' | 'weather' | 'agenda' | 'hotkey' | 'ui';
export async function emitPrefs(scope: PrefScope) {
  if (!inTauri) return;
  void emit('prefs-changed', scope);
}

export function reportRect(x: number, y: number, w: number, h: number) {
  if (inTauri) void invoke('set_hit_rect', { rect: { x, y, w, h } });
}

export function onHover(handler: (inside: boolean) => void) {
  if (inTauri) void listen<boolean>('notch-hover', (e) => handler(e.payload));
}

/** Panggil perintah Rust; di browser biasa mengembalikan undefined. */
export async function cmd<T = void>(name: string, args?: Record<string, unknown>): Promise<T | undefined> {
  if (!inTauri) return undefined;
  try {
    return await invoke<T>(name, args);
  } catch (e) {
    console.warn(name, e);
    return undefined;
  }
}

/** Seperti `cmd`, tetapi galatnya dikembalikan (bukan ditelan) supaya bisa ditampilkan dan dicoba lagi. */
export async function cmdTry<T = void>(name: string, args?: Record<string, unknown>): Promise<{ ok: true; value: T | undefined } | { ok: false; error: string }> {
  if (!inTauri) return { ok: true, value: undefined };
  try {
    return { ok: true, value: await invoke<T>(name, args) };
  } catch (e) {
    console.warn(name, e);
    return { ok: false, error: typeof e === 'string' ? e : (e as Error)?.message ?? String(e) };
  }
}

/** Kirim peristiwa ke jendela lain. */
export function send(event: string, payload?: unknown) {
  if (inTauri) void emit(event, payload);
}

/** Dengarkan peristiwa dari Rust. */
export function on<T>(event: string, handler: (payload: T) => void) {
  if (inTauri) void listen<T>(event, (e) => handler(e.payload));
}

/** Pilih file lewat jendela Windows (cadangan bila seret file tidak jalan). */
export async function pickFiles(): Promise<string[]> {
  if (!inTauri) return [];
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const r = await open({ multiple: true });
    return Array.isArray(r) ? r : r ? [r] : [];
  } catch (e) {
    console.warn('pickFiles', e);
    return [];
  }
}
