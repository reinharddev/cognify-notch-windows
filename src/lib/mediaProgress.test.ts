import { describe, expect, it } from 'vitest';
import { livePosition, progressRatio, timeLabel } from './mediaProgress';

describe('mediaProgress', () => {
  it('advances only while playing and never past the duration', () => {
    expect(livePosition(10, 200, true, 5000, 2000)).toBeCloseTo(13);
    expect(livePosition(10, 200, false, 5000, 2000)).toBe(10);
    expect(livePosition(198, 200, true, 9000, 0)).toBe(200);
    expect(livePosition(10, 0, true, 3000, 1000)).toBeCloseTo(12);
    expect(livePosition(NaN, 100, true, 1000, 1000)).toBe(0);
    expect(livePosition(10, 100, true, 1000, 5000)).toBe(10); // jam mundur tidak membuat posisi mundur
  });

  it('gives a 0 to 1 ratio, and 0 without a duration', () => {
    expect(progressRatio(50, 200)).toBe(0.25);
    expect(progressRatio(500, 200)).toBe(1);
    expect(progressRatio(-3, 200)).toBe(0);
    expect(progressRatio(10, 0)).toBe(0);
    expect(progressRatio(NaN, 10)).toBe(0);
  });

  it('formats time as m:ss or h:mm:ss', () => {
    expect(timeLabel(0)).toBe('0:00');
    expect(timeLabel(81)).toBe('1:21');
    expect(timeLabel(3723)).toBe('1:02:03');
    expect(timeLabel(-5)).toBe('0:00');
    expect(timeLabel(NaN)).toBe('0:00');
  });
});
