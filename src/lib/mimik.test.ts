import { describe, expect, it } from 'vitest';
import { MOODS, PRESETS, REACTIONS, SHAPES, contrast, defaultMimik, parseHex, randomPalette, toHex } from './mimik';

describe('katalog Mimik (sama dengan Mac)', () => {
  it('jumlah pilihan sama dengan Mac', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['default', 'inverted', 'acid', 'sky', 'paper', 'ember']);
    expect(SHAPES).toHaveLength(7);
    expect(MOODS).toHaveLength(51);
    expect(REACTIONS).toHaveLength(9);
    expect(new Set(MOODS).size).toBe(MOODS.length);
  });
  it('gaya bawaan sama dengan Mac', () => {
    expect(defaultMimik()).toMatchObject({ preset: 'default', skin: '#000000', ink: '#e9ebec', ring: '#34363a', type: 'round', mood: 'auto', follow: true, blink: true, wander: true, mouth: false });
  });
});

describe('palet acak', () => {
  it('kontras hex dikenal', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 3);
  });
  it('hex bolak-balik', () => {
    expect(toHex(parseHex('#c6ff00')!)).toBe('#c6ff00');
    expect(parseHex('zzz')).toBeNull();
  });
  it('500 palet selalu terbaca dan cincin tidak lebih mencolok dari mata', () => {
    for (let i = 0; i < 500; i++) {
      const c = randomPalette();
      expect(contrast(c.skin, c.ink), JSON.stringify(c)).toBeGreaterThanOrEqual(7);
      for (const v of [c.skin, c.ink, c.ring]) expect(v).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrast(c.skin, c.ring)).toBeLessThan(contrast(c.skin, c.ink));
    }
  });
});
