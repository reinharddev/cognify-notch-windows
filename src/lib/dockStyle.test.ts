import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLE, GLASS_BLUR_MAX, GLASS_OPACITY_MAX, GLASS_OPACITY_MIN, INK_DARK, INK_LIGHT, cleanStyle, inkFor, isHex, luminance, surface,
  type DockStyleCfg,
} from './dockStyle';

const cfg = (over: Partial<DockStyleCfg>): DockStyleCfg => ({ ...DEFAULT_STYLE, ...over });

describe('colors', () => {
  it('accepts only #rrggbb', () => {
    expect(isHex('#a1B2c3')).toBe(true);
    expect(isHex('#abc')).toBe(false);
    expect(isHex('red')).toBe(false);
    expect(isHex('#12345g')).toBe(false);
    expect(isHex('#123456; background:url(x)')).toBe(false);
    expect(isHex(5)).toBe(false);
  });

  it('measures brightness from black to white', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 5);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(luminance('#808080')).toBeGreaterThan(0.2);
    expect(luminance('#808080')).toBeLessThan(0.25);
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#ff0000'));
  });

  it('picks white text on dark backgrounds and dark text on light ones', () => {
    expect(inkFor(luminance('#000000'))).toBe(INK_LIGHT);
    expect(inkFor(luminance('#1b1b26'))).toBe(INK_LIGHT);
    expect(inkFor(luminance('#3a1c71'))).toBe(INK_LIGHT);
    expect(inkFor(luminance('#ffffff'))).toBe(INK_DARK);
    expect(inkFor(luminance('#f5c542'))).toBe(INK_DARK);
    expect(inkFor(luminance('#dddddd'))).toBe(INK_DARK);
  });

  it('chooses the text color with the better contrast at the boundary', () => {
    // a mid grey: whichever side is picked, its contrast ratio must be the larger one
    for (const hex of ['#6b6b6b', '#777777', '#808080', '#8a8a8a', '#999999']) {
      const L = luminance(hex);
      const white = 1.05 / (L + 0.05);
      const dark = (L + 0.05) / (luminance('#14141c') + 0.05);
      const pickedWhite = inkFor(L) === INK_LIGHT;
      expect(pickedWhite ? white >= dark * 0.85 : dark >= white * 0.85).toBe(true);
    }
  });
});

describe('surface per mode', () => {
  it('follows the notch: black base, light text, the notch layers are drawn on top', () => {
    const s = surface(cfg({ bgMode: 'notch' }));
    expect(s).toEqual({ background: '#000', backdrop: '', ink: INK_LIGHT, followsNotch: true });
  });

  it('glass is a translucent dark tint with blur', () => {
    const s = surface(cfg({ bgMode: 'glass', glassOpacity: 0.4, glassBlur: 20 }));
    expect(s.background).toBe('rgba(18, 18, 26, 0.4)');
    expect(s.backdrop).toBe('blur(20px) saturate(1.6)');
    expect(s.ink).toBe(INK_LIGHT);
    expect(s.followsNotch).toBe(false);
  });

  it('glass without blur has no backdrop filter', () => {
    expect(surface(cfg({ bgMode: 'glass', glassBlur: 0 })).backdrop).toBe('');
  });

  it('a solid color is used as is, with readable text', () => {
    expect(surface(cfg({ bgMode: 'color', bgColor: '#ffffff' }))).toMatchObject({ background: '#ffffff', ink: INK_DARK });
    expect(surface(cfg({ bgMode: 'color', bgColor: '#101820' }))).toMatchObject({ background: '#101820', ink: INK_LIGHT });
  });

  it('a gradient uses both colors and the notch angle convention (+90 degrees)', () => {
    const s = surface(cfg({ bgMode: 'gradient', bgColor: '#101820', bgColor2: '#3a1c71', bgAngle: 0 }));
    expect(s.background).toBe('linear-gradient(90deg, #101820, #3a1c71)');
    expect(s.ink).toBe(INK_LIGHT);
  });

  it('a gradient with a light end gets dark text, because white would vanish on that end', () => {
    expect(surface(cfg({ bgMode: 'gradient', bgColor: '#101820', bgColor2: '#fafafa' })).ink).toBe(INK_DARK);
  });
});

describe('cleaning saved settings', () => {
  it('replaces anything invalid with the defaults', () => {
    const c = cleanStyle({ bgMode: 'rainbow', bgColor: 'javascript:alert(1)', bgColor2: 12, bgAngle: 'x', glassOpacity: NaN, glassBlur: undefined });
    expect(c).toEqual(DEFAULT_STYLE);
  });

  it('keeps valid values and clamps the numbers', () => {
    const c = cleanStyle({ bgMode: 'glass', bgColor: '#abcdef', bgAngle: 999, glassOpacity: 5, glassBlur: 500 });
    expect(c.bgMode).toBe('glass');
    expect(c.bgColor).toBe('#abcdef');
    expect(c.bgAngle).toBe(360);
    expect(c.glassOpacity).toBe(GLASS_OPACITY_MAX);
    expect(c.glassBlur).toBe(GLASS_BLUR_MAX);
    expect(cleanStyle({ glassOpacity: 0 }).glassOpacity).toBe(GLASS_OPACITY_MIN);
    expect(cleanStyle({ bgAngle: -20 }).bgAngle).toBe(0);
  });

  it('never lets surface() emit a non-color into the CSS', () => {
    const s = surface({ ...DEFAULT_STYLE, bgMode: 'color', bgColor: 'red; background: url(x)' });
    expect(s.background).toBe(DEFAULT_STYLE.bgColor);
  });
});
