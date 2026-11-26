import { describe, expect, it, vi } from 'vitest';

vi.mock('./bridge', () => ({ cmd: vi.fn(), inTauri: false, windowKind: 'settings' }));
vi.mock('./agenda.svelte', () => ({ agenda: {} }));
vi.mock('./system.svelte', () => ({ device: {}, features: {} }));
vi.mock('./lyrics.svelte', () => ({ lyrics: {} }));
vi.mock('./news.svelte', () => ({ news: {} }));
vi.mock('./notch.svelte', () => ({ notch: {} }));
vi.mock('./weather.svelte', () => ({ weather: {} }));
vi.mock('./state.svelte', () => ({ clockTools: {}, notes: {}, todo: {}, water: {} }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const { payloadSignature } = await import('./skinBridge.svelte');

const song = (now: number, position: number, playing = true) => ({ now, media: { title: 'A', playing, position, sentAt: now, rate: 1 }, todos: [] });

describe('tanda data skin (hemat daya)', () => {
  it('lagu yang maju sendiri tidak dianggap berubah', () => {
    expect(payloadSignature(song(1_000_000, 10))).toBe(payloadSignature(song(1_005_000, 15)));
  });
  it('digeser (seek) atau dijeda dianggap berubah', () => {
    expect(payloadSignature(song(1_000_000, 10))).not.toBe(payloadSignature(song(1_005_000, 60)));
    expect(payloadSignature(song(1_000_000, 10))).not.toBe(payloadSignature(song(1_000_000, 10, false)));
  });
  it('setiap sepuluh menit dikirim ulang walau tidak ada yang berubah', () => {
    const idle = (now: number) => ({ now, todos: [] });
    expect(payloadSignature(idle(1_200_000))).toBe(payloadSignature(idle(1_300_000)));
    expect(payloadSignature(idle(1_200_000))).not.toBe(payloadSignature(idle(1_900_000)));
  });
});
