import { describe, expect, it } from 'vitest';
import { BeatTracker } from './beat';

function run(period: number, seconds: number, base = 0.15, peak = 0.9) {
  const t = new BeatTracker();
  for (let time = 0; time < seconds; time += 1 / 30) {
    const phase = (time % period) / period;
    t.feed(phase < 0.2 ? peak : base, time);
  }
  return t;
}

describe('pelacak irama', () => {
  it('menemukan tempo denyut teratur', () => {
    const t = run(0.5, 10);
    expect(t.period).toBeGreaterThan(0.42);
    expect(t.period).toBeLessThan(0.58);
    expect(t.beats).toBeGreaterThanOrEqual(15);
  });
  it('mengikuti tempo yang lebih lambat', () => {
    const t = run(0.8, 12);
    expect(Math.abs(t.period - 0.8)).toBeLessThan(0.1);
  });
  it('diam tidak punya ketukan dan tidak terdengar', () => {
    const t = new BeatTracker();
    for (let i = 0; i < 300; i++) t.feed(0, i / 30);
    expect(t.beats).toBe(0);
    expect(t.audible).toBe(false);
  });
  it('suara datar keras tidak dianggap banyak ketukan', () => {
    const t = new BeatTracker();
    for (let i = 0; i < 600; i++) t.feed(0.6, i / 30);
    expect(t.beats).toBeLessThan(3);
    expect(t.audible).toBe(true);
  });
  it('anggukan terdalam tepat di ketukan dan goyangan berganti arah', () => {
    const t = new BeatTracker();
    t.feedSteady(10);
    expect(t.depth(10)).toBeCloseTo(1, 3);
    expect(t.depth(10 + t.period / 2)).toBeLessThan(0.01);
    const a = t.sway(10 + t.period / 2);
    t.feedSteady(10 + t.period);
    const b = t.sway(10 + t.period * 1.5);
    expect(Math.sign(a)).not.toBe(Math.sign(b));
  });
  it('ketukan sintetis terus berjalan tanpa data suara', () => {
    const t = new BeatTracker();
    for (let i = 0; i < 300; i++) t.feedSteady(i / 30);
    expect(t.beats).toBeGreaterThanOrEqual(12);
    expect(t.audible).toBe(true);
  });
});
