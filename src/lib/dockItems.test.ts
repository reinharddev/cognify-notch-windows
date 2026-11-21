import { describe, expect, it } from 'vitest';
import { buildItems, cleanPins, clickTarget, dockSize, keyOf, movePin, togglePin, type DockWindow, type Pin } from './dockItems';

const win = (id: number, exe: string, active = false, name = exe.split('\\').pop()!.replace('.exe', '')): DockWindow => ({ id, title: `w${id}`, exe, name, active });
const CHROME = 'C:\\Chrome\\chrome.exe';
const CODE = 'C:\\Code\\code.exe';
const NOTES = 'C:\\Notes\\notes.exe';

describe('buildItems', () => {
  it('puts pinned apps first in pin order, running or not', () => {
    const pins: Pin[] = [{ exe: CODE, name: 'code' }, { exe: CHROME, name: 'chrome' }];
    const { items } = buildItems(pins, [win(1, CHROME)], []);
    expect(items.map((i) => [i.name, i.pinned, i.windows.length])).toEqual([['code', true, 0], ['chrome', true, 1]]);
  });

  it('lists running apps that are not pinned after the pins', () => {
    const { items } = buildItems([{ exe: CHROME, name: 'chrome' }], [win(1, CHROME), win(2, NOTES)], []);
    expect(items.map((i) => [i.name, i.pinned])).toEqual([['chrome', true], ['notes', false]]);
  });

  it('matches programs without regard to letter case', () => {
    const { items } = buildItems([{ exe: CHROME.toUpperCase(), name: 'chrome' }], [win(1, CHROME)], []);
    expect(items).toHaveLength(1);
    expect(items[0].windows).toHaveLength(1);
  });

  it('keeps unpinned icons where they were when focus (and so the window order) changes', () => {
    let r = buildItems([], [win(1, CHROME), win(2, NOTES)], []);
    const first = r.items.map((i) => i.name);
    // Windows lists the focused window first, so the order flips; the dock must not.
    r = buildItems([], [win(2, NOTES, true), win(1, CHROME)], r.seen);
    expect(r.items.map((i) => i.name)).toEqual(first);
  });

  it('appends a newly opened app at the end and forgets one that closed', () => {
    let r = buildItems([], [win(1, CHROME), win(2, NOTES)], []);
    r = buildItems([], [win(1, CHROME), win(2, NOTES), win(3, CODE)], r.seen);
    expect(r.items.map((i) => i.name)).toEqual(['chrome', 'notes', 'code']);
    r = buildItems([], [win(2, NOTES), win(3, CODE)], r.seen);
    expect(r.items.map((i) => i.name)).toEqual(['notes', 'code']);
    expect(r.seen).toEqual([keyOf(NOTES), keyOf(CODE)]);
  });

  it('does not remember a pinned app in the unpinned order', () => {
    const r = buildItems([{ exe: CHROME, name: 'chrome' }], [win(1, CHROME)], []);
    expect(r.seen).toEqual([]);
  });

  it('groups windows of one app, in a stable order, and marks the app active', () => {
    const { items } = buildItems([], [win(9, CHROME), win(4, CHROME, true), win(6, CHROME)], []);
    expect(items).toHaveLength(1);
    expect(items[0].windows.map((w) => w.id)).toEqual([4, 6, 9]);
    expect(items[0].active).toBe(true);
  });

  it('is empty when nothing is open and nothing pinned', () => {
    expect(buildItems([], [], []).items).toEqual([]);
  });
});

describe('pins', () => {
  it('toggles on and off, ignoring letter case', () => {
    const a = togglePin([], CHROME, 'chrome');
    expect(a).toEqual([{ exe: CHROME, name: 'chrome' }]);
    expect(togglePin(a, CHROME.toLowerCase(), 'chrome')).toEqual([]);
  });

  it('moves a pin and ignores impossible moves', () => {
    const pins: Pin[] = [{ exe: 'a', name: 'a' }, { exe: 'b', name: 'b' }, { exe: 'c', name: 'c' }];
    expect(movePin(pins, 0, 2).map((p) => p.exe)).toEqual(['b', 'c', 'a']);
    expect(movePin(pins, 2, 0).map((p) => p.exe)).toEqual(['c', 'a', 'b']);
    expect(movePin(pins, 1, 1)).toBe(pins);
    expect(movePin(pins, -1, 1)).toBe(pins);
    expect(movePin(pins, 0, 9)).toBe(pins);
  });

  it('drops broken and duplicate saved pins', () => {
    const raw = [{ exe: 'a', name: 'A' }, null, { exe: 5, name: 'x' }, { exe: 'A', name: 'dup' }, { exe: 'b' }, { exe: 'c', name: '' }, 'text'];
    expect(cleanPins(raw)).toEqual([{ exe: 'a', name: 'A' }, { exe: 'c', name: 'c' }]);
    expect(cleanPins(undefined)).toEqual([]);
    expect(cleanPins({})).toEqual([]);
  });
});

describe('clickTarget', () => {
  const item = (windows: DockWindow[]) => buildItems([], windows, []).items[0];

  it('launches an app that has no window', () => {
    const pinned = buildItems([{ exe: CHROME, name: 'chrome' }], [], []).items[0];
    expect(clickTarget(pinned)).toEqual({ kind: 'launch' });
  });

  it('toggles the single window (minimise if in front, else bring to front)', () => {
    expect(clickTarget(item([win(7, CHROME)]))).toEqual({ kind: 'toggle', id: 7 });
  });

  it('cycles through several windows and starts at the first when none is active', () => {
    expect(clickTarget(item([win(1, CHROME), win(2, CHROME), win(3, CHROME)]))).toEqual({ kind: 'cycle', id: 1 });
    expect(clickTarget(item([win(1, CHROME, true), win(2, CHROME), win(3, CHROME)]))).toEqual({ kind: 'cycle', id: 2 });
    expect(clickTarget(item([win(1, CHROME), win(2, CHROME), win(3, CHROME, true)]))).toEqual({ kind: 'cycle', id: 1 });
  });
});

describe('dockSize', () => {
  it('grows with the number of icons and the optional clock', () => {
    const base = { iconSize: 40, showClock: false };
    const a = dockSize({ ...base, icons: 0 });
    const b = dockSize({ ...base, icons: 3 });
    const c = dockSize({ ...base, icons: 3, showClock: true });
    expect(b.w).toBeGreaterThan(a.w);
    expect(c.w).toBeGreaterThan(b.w);
    expect(a.h).toBe(b.h);
  });

  it('is taller for bigger icons', () => {
    expect(dockSize({ icons: 1, iconSize: 56, showClock: false }).h).toBeGreaterThan(dockSize({ icons: 1, iconSize: 32, showClock: false }).h);
  });
});
