import { describe, expect, it } from 'vitest';
import { elapsedSeconds, sanitize, splitHms } from './stopwatch';

const at = (h: number, m = 0, s = 0) => new Date(2026, 10, 25, h, m, s).getTime();

describe('stopwatch berbasis jam dinding', () => {
  it('dinyalakan jam 17.00, laptop tidur, bangun jam 19.32.07 → 2 jam 32 menit 7 detik', () => {
    const e = elapsedSeconds(0, at(17), at(19, 32, 7));
    expect(splitHms(e)).toEqual({ h: 2, m: 32, s: 7 });
  });
  it('waktu sebelum jeda ikut dijumlahkan', () => {
    expect(elapsedSeconds(90, at(17), at(17, 0, 30))).toBe(120);
  });
  it('berhenti (started 0) memakai waktu tersimpan saja', () => {
    expect(elapsedSeconds(754, 0, at(23))).toBe(754);
  });
  it('jam sistem mundur tidak membuat angka negatif', () => {
    expect(elapsedSeconds(0, at(17), at(16))).toBe(0);
  });
  it('lewat tengah malam dan lebih dari 24 jam tetap benar', () => {
    const e = elapsedSeconds(0, at(23), new Date(2026, 10, 27, 1, 0, 5).getTime());
    expect(splitHms(e)).toEqual({ h: 26, m: 0, s: 5 });
  });
  it('data tersimpan yang rusak dibersihkan', () => {
    expect(sanitize(null)).toEqual({ started: 0, accumulated: 0, laps: [] });
    expect(sanitize({ started: 'x', accumulated: -4, laps: [1, 'a', NaN, 5] })).toEqual({ started: 0, accumulated: 0, laps: [1, 5] });
  });
});
