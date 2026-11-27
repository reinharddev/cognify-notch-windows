import { describe, expect, it, vi } from 'vitest';

const box = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) });
const { save, takeChanges, applyChanges, load } = await import('./store.svelte');

describe('perubahan yang dikirim ke jendela lain', () => {
  it('hanya membawa nilai yang berubah, sekali', () => {
    save('ui.face', true);
    expect(takeChanges()).toEqual({ 'cn.ui.face': 'true' });
    save('ui.face', true);
    expect(takeChanges()).toEqual({});
  });
  it('nilai kiriman dipakai dan tidak dikirim balik', () => {
    save('ui.style', 'notch');
    applyChanges({ 'cn.ui.style': '"pill"' });
    expect(load('ui.style', '')).toBe('pill');
    expect(takeChanges()).toEqual({});
  });
});
