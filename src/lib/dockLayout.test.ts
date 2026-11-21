import { describe, expect, it } from 'vitest';
import {
  CELL_GAP, DEFAULT_LAYOUT, EDGE, GAP, MIN_APP_SLOTS, PAD, appSlots, canAdd, cell, fitLayout, fits, layoutWidth, maxWidth, moduleWidth,
  moveModule, splitAppsByUse, magnify, dropIndex, MAG_MAX, magnifyPeak, magnifyScales, magnifyHeadroom, magnifyExtraWidth, normalizeLayout, dockRadii, PILL_H, TOOL_SIZE, normalizeUrl, removeModule, splitApps, usage, validMinutes, type LayoutCfg, type ModuleId,
} from './dockLayout';

const cfg: LayoutCfg = { iconSize: 40, presets: 3, links: 3, hideTaskbar: false };
const C = cell(40);

describe('widths', () => {
  it('start is one cell and apps grow by one cell plus the small icon gap', () => {
    expect(moduleWidth('start', cfg)).toBe(C);
    expect(moduleWidth('apps', cfg, 0)).toBe(0);
    expect(moduleWidth('apps', cfg, 1)).toBe(C);
    expect(moduleWidth('apps', cfg, 4)).toBe(4 * C + 3 * CELL_GAP);
  });

  it('the tray button only takes room when the Windows taskbar is hidden', () => {
    expect(moduleWidth('tray', cfg)).toBe(0);
    expect(moduleWidth('tray', { ...cfg, hideTaskbar: true })).toBe(32);
  });

  it('the timer and the links follow their settings, and never collapse to nothing', () => {
    expect(moduleWidth('timer', { ...cfg, presets: 4 })).toBeGreaterThan(moduleWidth('timer', { ...cfg, presets: 1 }));
    expect(moduleWidth('timer', { ...cfg, presets: 0 })).toBeGreaterThanOrEqual(112);
    expect(moduleWidth('links', { ...cfg, links: 0 })).toBe(C);
    expect(moduleWidth('links', { ...cfg, links: 3 })).toBe(3 * C + 2 * CELL_GAP);
  });

  it('the whole width is padding, modules and the gaps between them', () => {
    const layout: ModuleId[] = ['start', 'quick', 'clock'];
    expect(layoutWidth(layout, cfg)).toBe(PAD * 2 + C + 32 + 92 + GAP * 2);
  });

  it('a module with no width leaves no gap behind', () => {
    expect(layoutWidth(['start', 'tray'], cfg)).toBe(layoutWidth(['start'], cfg));
  });
});

describe('the screen limit (one row, never past the screen)', () => {
  it('leaves an edge margin on both sides', () => {
    expect(maxWidth(1920)).toBe(1920 - EDGE * 2);
    expect(maxWidth(100)).toBe(240);
  });

  it('counts how many app icons still fit', () => {
    const slots = appSlots(['start', 'apps', 'clock'], cfg, 1920);
    const used = layoutWidth(['start', 'apps', 'clock'], cfg, slots);
    expect(used).toBeLessThanOrEqual(maxWidth(1920));
    // one more icon would not fit
    expect(layoutWidth(['start', 'apps', 'clock'], cfg, slots + 1)).toBeGreaterThan(maxWidth(1920));
  });

  it('is zero app slots when there is no apps module', () => {
    expect(appSlots(['start', 'clock'], cfg, 1920)).toBe(0);
  });

  it('a normal layout fits a 1920 screen', () => {
    expect(fits(DEFAULT_LAYOUT, cfg, 1920)).toBe(true);
  });

  it('refuses to add a widget once the apps would have less than the minimum room', () => {
    const screen = 900;
    let layout: ModuleId[] = ['start', 'apps'];
    const order: ModuleId[] = ['media', 'lyrics', 'weather', 'timer', 'clipboard', 'links', 'battery', 'volume', 'quick', 'clock'];
    let refused: ModuleId | null = null;
    for (const id of order) {
      const check = canAdd(layout, id, cfg, screen);
      if (!check.ok) { refused = id; expect(check.reason).toBe('full'); break; }
      layout = [...layout, id];
      expect(appSlots(layout, cfg, screen)).toBeGreaterThanOrEqual(MIN_APP_SLOTS);
    }
    expect(refused).not.toBeNull();
    expect(layoutWidth(layout, cfg, MIN_APP_SLOTS)).toBeLessThanOrEqual(maxWidth(screen));
  });

  it('refuses a module that is already there', () => {
    expect(canAdd(DEFAULT_LAYOUT, 'clock', cfg, 1920)).toEqual({ ok: false, reason: 'exists' });
  });

  it('without an apps module the whole row must still fit', () => {
    expect(canAdd(['start'], 'clipboard', cfg, 300)).toEqual({ ok: false, reason: 'full' });
    expect(canAdd(['start'], 'clipboard', cfg, 1920)).toEqual({ ok: true });
  });

  it('fitLayout drops widgets from the right end until it fits, and keeps Start and Apps', () => {
    const layout: ModuleId[] = ['start', 'apps', 'media', 'lyrics', 'weather', 'timer', 'clipboard', 'clock'];
    const fitted = fitLayout(layout, cfg, 1000);
    expect(fits(fitted, cfg, 1000)).toBe(true);
    expect(fitted.slice(0, 2)).toEqual(['start', 'apps']);
    // what is kept is a prefix of what was asked for: the right end goes first
    expect(layout.slice(0, fitted.length)).toEqual(fitted);
    expect(fitted.length).toBeLessThan(layout.length);
  });

  it('fitLayout leaves a layout alone when it already fits', () => {
    expect(fitLayout(DEFAULT_LAYOUT, cfg, 1920)).toEqual(DEFAULT_LAYOUT);
  });

  it('bigger icons can push a saved layout out of its screen, and fitLayout brings it back', () => {
    const layout: ModuleId[] = ['start', 'apps', 'weather', 'clipboard', 'clock'];
    const big = { ...cfg, iconSize: 56 };
    const screen = 760;
    const fitted = fitLayout(layout, big, screen);
    expect(fits(fitted, big, screen)).toBe(true);
  });

  it('never loops forever, even on a tiny screen', () => {
    const out = fitLayout(['start', 'apps', 'clock', 'weather'], { ...cfg, iconSize: 56 }, 50);
    expect(out).toEqual(['start', 'apps']);
  });

  it('reports usage for the meter', () => {
    const u = usage(DEFAULT_LAYOUT, cfg, 1920);
    expect(u.max).toBe(maxWidth(1920));
    expect(u.ratio).toBeGreaterThan(0);
    expect(u.ratio).toBeLessThanOrEqual(1);
  });
});

describe('dockRadii (concentric, from each element\'s real distance to the edge)', () => {
  const cellH = 52, icon = 40, H = cellH + PAD * 2;

  it('is a full capsule at 100, and everything inside is a matching capsule or circle', () => {
    const r = dockRadii(100, cellH, icon);
    expect(r.outer).toBe(H / 2);
    expect(r.cell).toBe(cellH / 2); // lingkaran
    expect(r.tile).toBe(icon / 2); // lingkaran
    expect(r.pill).toBe(PILL_H / 2); // kapsul
    expect(r.tool).toBe(TOOL_SIZE / 2); // lingkaran
  });

  it('each radius is the outer radius minus the distance, unless it hit a limit', () => {
    const items = (r: ReturnType<typeof dockRadii>) => [
      { r: r.cell, d: PAD, side: cellH },
      { r: r.tile, d: PAD + (cellH - icon) / 2, side: icon },
      { r: r.pill, d: PAD + (cellH - PILL_H) / 2, side: PILL_H },
      { r: r.tool, d: PAD + (cellH - TOOL_SIZE) / 2, side: TOOL_SIZE },
    ];
    for (const round of [0, 15, 35, 50, 75, 100]) {
      const r = dockRadii(round, cellH, icon);
      for (const it of items(r)) {
        const clamped = it.r === 0 || it.r === it.side / 2;
        if (!clamped) expect(r.outer - it.r).toBeCloseTo(it.d, 5);
        expect(it.r).toBeGreaterThanOrEqual(0);
        expect(it.r).toBeLessThanOrEqual(it.side / 2);
      }
      expect(r.outer).toBeGreaterThan(0);
      expect(r.outer).toBeLessThanOrEqual(H / 2);
    }
  });

  it('gets squarer as the roundness goes down, all together', () => {
    const hi = dockRadii(100, cellH, icon), mid = dockRadii(50, cellH, icon), lo = dockRadii(0, cellH, icon);
    for (const k of ['outer', 'cell', 'tile', 'pill', 'tool'] as const) {
      expect(hi[k]).toBeGreaterThanOrEqual(mid[k]);
      expect(mid[k]).toBeGreaterThanOrEqual(lo[k]);
    }
    expect(lo.outer).toBeGreaterThan(0);
  });

  it('scales with the icon size (a taller dock is rounder at the same setting)', () => {
    expect(dockRadii(60, 68, 56).outer).toBeGreaterThan(dockRadii(60, 44, 32).outer);
  });

  it('survives nonsense input', () => {
    for (const v of [-5, NaN, Infinity, 500]) {
      const r = dockRadii(v, cellH, icon);
      expect(r.outer).toBeGreaterThan(0);
      expect(r.outer).toBeLessThanOrEqual(H / 2);
    }
  });
});

describe('apps overflow', () => {
  it('shows everything when it fits', () => {
    expect(splitApps([1, 2, 3], 5)).toEqual({ shown: [1, 2, 3], rest: [] });
    expect(splitApps([1, 2, 3], 3)).toEqual({ shown: [1, 2, 3], rest: [] });
  });

  it('keeps one slot for the "+N" button when some do not fit', () => {
    expect(splitApps([1, 2, 3, 4, 5], 3)).toEqual({ shown: [1, 2], rest: [3, 4, 5] });
    expect(splitApps([1, 2, 3], 0)).toEqual({ shown: [], rest: [1, 2, 3] });
  });
});

describe('apps overflow keeps what is open', () => {
  const app = (n: string, open: boolean) => ({ n, open });
  const run = (a: { open: boolean }) => a.open;

  it('shows everything when it fits', () => {
    const items = [app('a', false), app('b', true)];
    expect(splitAppsByUse(items, 2, run)).toEqual({ shown: items, rest: [] });
  });

  it('hides pinned apps that are not open before any open app, and keeps the order', () => {
    const items = [app('a', false), app('b', true), app('c', false), app('d', true), app('e', true)];
    const r = splitAppsByUse(items, 4, run); // 3 tempat + tombol +N
    expect(r.shown.map((x) => x.n)).toEqual(['b', 'd', 'e']);
    expect(r.rest.map((x) => x.n)).toEqual(['a', 'c']);
  });

  it('only hides open apps once nothing idle is left to hide', () => {
    const items = [app('a', true), app('b', true), app('c', true), app('d', false)];
    const r = splitAppsByUse(items, 3, run);
    expect(r.shown.map((x) => x.n)).toEqual(['a', 'b']);
    expect(r.rest.map((x) => x.n)).toEqual(['c', 'd']);
  });

  it('never loses an app: shown plus rest is everything', () => {
    const items = Array.from({ length: 9 }, (_, i) => app(String(i), i % 3 === 0));
    for (let slots = 0; slots <= 10; slots++) {
      const r = splitAppsByUse(items, slots, run);
      expect(r.shown.length + r.rest.length).toBe(9);
    }
  });
});

describe('editing the layout', () => {
  it('moves a module within the bounds only', () => {
    const l: ModuleId[] = ['start', 'apps', 'clock'];
    expect(moveModule(l, 'clock', -1)).toEqual(['start', 'clock', 'apps']);
    expect(moveModule(l, 'start', -1)).toBe(l);
    expect(moveModule(l, 'clock', 1)).toBe(l);
    expect(moveModule(l, 'weather', 1)).toBe(l);
  });

  it('removes a module', () => {
    expect(removeModule(['start', 'apps', 'clock'], 'apps')).toEqual(['start', 'clock']);
  });

  it('cleans saved data', () => {
    expect(normalizeLayout(['clock', 'nope', 'clock', 5, 'apps'])).toEqual(['clock', 'apps']);
    expect(normalizeLayout([])).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout('x')).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout(undefined)).not.toBe(DEFAULT_LAYOUT);
  });
});

describe('input checks', () => {
  it('accepts whole-minute timer presets from 1 to 180', () => {
    expect(validMinutes(1)).toBe(true);
    expect(validMinutes(180)).toBe(true);
    expect(validMinutes(0)).toBe(false);
    expect(validMinutes(181)).toBe(false);
    expect(validMinutes(2.5)).toBe(false);
    expect(validMinutes(NaN)).toBe(false);
  });

  it('turns a typed address into a web link and refuses anything else', () => {
    expect(normalizeUrl('youtube.com')).toBe('https://youtube.com/');
    expect(normalizeUrl(' https://github.com/x ')).toBe('https://github.com/x');
    expect(normalizeUrl('http://localhost:3000')).toBe('http://localhost:3000/');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('file:///C:/Windows/System32/calc.exe')).toBeNull();
    expect(normalizeUrl('calc.exe')).toBe('https://calc.exe/');
    expect(normalizeUrl('ms-settings:sound')).toBeNull();
    expect(normalizeUrl('a b.com')).toBeNull();
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('nodot')).toBeNull();
  });
});

describe('magnify (neighbour effect)', () => {
  it('is biggest under the pointer and fades to nothing at the reach', () => {
    expect(magnify(0, 80)).toBeCloseTo(MAG_MAX, 5);
    expect(magnify(80, 80)).toBeCloseTo(1, 5);
    expect(magnify(500, 80)).toBe(1);
    expect(magnify(-40, 80)).toBeCloseTo(magnify(40, 80), 8);
    let last = 2;
    for (let d = 0; d <= 80; d += 10) { const v = magnify(d, 80); expect(v).toBeLessThanOrEqual(last); last = v; }
  });
  it('survives nonsense', () => {
    expect(magnify(10, 0)).toBe(1);
    expect(magnify(NaN, 80)).toBe(1);
  });
});

describe('dropIndex', () => {
  it('picks the nearest cell', () => {
    expect(dropIndex(10, [30, 90, 150])).toBe(0);
    expect(dropIndex(100, [30, 90, 150])).toBe(1);
    expect(dropIndex(999, [30, 90, 150])).toBe(2);
    expect(dropIndex(5, [])).toBe(-1);
  });
});

describe('macOS-style magnification', () => {
  it('maps the setting to a peak scale', () => {
    expect(magnifyPeak(0)).toBe(1);
    expect(magnifyPeak(100)).toBeCloseTo(2.2, 6);
    expect(magnifyPeak(500)).toBeCloseTo(2.2, 6);
    expect(magnifyPeak(NaN)).toBe(1);
  });

  it('scales icons around the pointer, and nothing when there is no pointer or no magnification', () => {
    const centers = [30, 90, 150, 210, 270];
    expect(magnifyScales(centers, null, 52, 2)).toEqual([1, 1, 1, 1, 1]);
    expect(magnifyScales(centers, 150, 52, 1)).toEqual([1, 1, 1, 1, 1]);
    const on = magnifyScales(centers, 150, 52, 2);
    expect(on[2]).toBeCloseTo(2, 5);
    expect(on[1]).toBeGreaterThan(1);
    expect(on[1]).toBeCloseTo(on[3], 8);
    expect(on[1]).toBeGreaterThan(on[0]);
  });

  it('asks for room for the grown icons and label', () => {
    expect(magnifyHeadroom(40, 1)).toBe(34);
    expect(magnifyHeadroom(40, 2)).toBe(74);
  });

  it('never grows wider than the extra width it asks for, anywhere along a long row', () => {
    const cell = 52, peak = 2.2;
    const many = Array.from({ length: 30 }, (_, i) => i * (cell + 2) + cell / 2);
    const allowed = magnifyExtraWidth(cell, peak);
    for (let p = 0; p <= 1700; p += 13) {
      const growth = magnifyScales(many, p, cell, peak).reduce((a, s) => a + (s - 1) * cell, 0);
      expect(growth).toBeLessThanOrEqual(allowed);
    }
  });
});
