// Jembatan ke sisi Rust. Di browser biasa (npm run dev) tidak ada Tauri, jadi semuanya
// dilewati dan hover memakai peristiwa pointer biasa; ini memudahkan merancang tampilan.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const inTauri = '__TAURI_INTERNALS__' in window;

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
