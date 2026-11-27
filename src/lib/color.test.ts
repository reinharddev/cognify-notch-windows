import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex } from './color';

describe('color', () => {
  it('bolak-balik hex tetap sama', () => {
    for (const hex of ['#000000', '#ffffff', '#8f87ff', '#ff9f0a', '#30d158', '#0a84ff']) {
      const c = hexToHsv(hex);
      expect(hsvToHex(c.h, c.s, c.v)).toBe(hex);
    }
  });
});
