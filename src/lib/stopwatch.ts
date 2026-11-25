// Hitungan stopwatch berbasis jam dinding (wall clock), supaya benar saat laptop tidur atau app ditutup.
// Yang disimpan hanya `started` (epoch ms saat dinyalakan), `accumulated` (detik sebelum jeda terakhir), dan lap.
// Waktu berjalan dihitung dari jam sekarang dikurangi jam mulai, jadi tidur, hibernasi, dan pembukaan ulang app
// tidak mengubah hasilnya. Sama dengan ClockTools.swift di Mac.

export interface StopwatchState { started: number; accumulated: number; laps: number[] }

/** Detik berjalan. Jam sistem yang dimundurkan tidak menghasilkan angka negatif. */
export function elapsedSeconds(accumulated: number, started: number, now: number): number {
  return Math.max(0, accumulated + (started ? Math.max(0, now - started) / 1000 : 0));
}

/** Detik → jam, menit, detik utuh (jam tidak dibatasi 24). */
export function splitHms(seconds: number): { h: number; m: number; s: number } {
  const whole = Math.floor(Math.max(0, seconds));
  return { h: Math.floor(whole / 3600), m: Math.floor(whole / 60) % 60, s: whole % 60 };
}

/** Bacaan dari penyimpanan yang mungkin rusak atau kosong. */
export function sanitize(raw: unknown): StopwatchState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<StopwatchState>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return { started: num(r.started), accumulated: num(r.accumulated), laps: Array.isArray(r.laps) ? r.laps.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0) : [] };
}
