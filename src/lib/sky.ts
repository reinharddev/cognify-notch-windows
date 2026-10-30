// Halaman Langit: posisi matahari/bulan, warna langit menurut jam dan cuaca, dan gambar awan, hujan, salju, bintang.
// Sama dengan Sky.swift di Mac.
import { L } from './i18n';
import type { SunTimes } from './weather.svelte';
import { drawChart, type Sight } from './astro';

export type SkyWeather = 'clear' | 'partly' | 'overcast' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';

/** Kode cuaca WMO (Open-Meteo). */
export function skyWeather(code: number): SkyWeather {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'overcast';
}

export const weatherLabel = (k: SkyWeather) => ({
  clear: L('Cerah', 'Clear'), partly: L('Cerah berawan', 'Partly cloudy'), overcast: L('Berawan', 'Overcast'),
  fog: L('Berkabut', 'Foggy'), drizzle: L('Gerimis', 'Drizzle'), rain: L('Hujan', 'Rain'),
  snow: L('Salju', 'Snow'), thunder: L('Badai petir', 'Thunderstorm'),
})[k];

const GREY: Record<SkyWeather, number> = { clear: 0, partly: 0.18, overcast: 0.82, fog: 0.78, drizzle: 0.72, rain: 0.86, snow: 0.72, thunder: 0.93 };
const DARKEN: Record<SkyWeather, number> = { clear: 1, partly: 1, overcast: 1, fog: 1, drizzle: 0.9, rain: 0.8, snow: 1, thunder: 0.62 };
const CLOUDS: Record<SkyWeather, number> = { clear: 0, partly: 3, overcast: 7, fog: 0, drizzle: 8, rain: 8, snow: 7, thunder: 9 };

export interface SkyPosition { progress: number; isDay: boolean; altitude: number; horizon: number }

/** 0...1 dengan awal dan akhir yang landai (tidak ada perubahan tiba-tiba). */
export const smooth01 = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Fase bulan: 0 = bulan baru, 0,5 = purnama, kembali ke 1 = bulan baru. */
export function moonPhase(ms: number): number {
  const p = (ms / 1000 - 947_182_440) / 86_400 / 29.530588853; // bulan baru 6 Januari 2000 18.14 UTC
  return p - Math.floor(p);
}

/**
 * Posisi matahari (siang) atau bulan (malam) di sepanjang lintasan: 0 = kiri, 1 = kanan.
 * `horizon` = menit dari cakrawala (positif siang, negatif malam): warna langit mengikutinya supaya fajar dan senja
 * selalu berlangsung pelan di hari sepanjang apa pun.
 */
export function skyPosition(ms: number, sun: SunTimes | null): SkyPosition {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const make = (progress: number, isDay: boolean, horizon: number): SkyPosition => ({ progress, isDay, altitude: (isDay ? 1 : -1) * Math.sin(Math.PI * progress), horizon });
  if (sun) {
    if (ms >= sun.sunrise && ms <= sun.sunset) return make(clamp((ms - sun.sunrise) / (sun.sunset - sun.sunrise)), true, Math.min(ms - sun.sunrise, sun.sunset - ms) / 60_000);
    const [a, b] = ms > sun.sunset ? [sun.sunset, sun.nextSunrise] : [sun.sunset - 86_400_000, sun.sunrise];
    return make(clamp((ms - a) / (b - a)), false, -Math.min(ms - a, b - ms) / 60_000);
  }
  // Tanpa lokasi: anggap terbit 06.00 dan terbenam 18.00 di jam PC ini.
  const d = new Date(ms);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  if (h >= 6 && h < 18) return make((h - 6) / 12, true, Math.min(h - 6, 18 - h) * 60);
  const q = h >= 18 ? h - 18 : h + 6;
  return make(q / 12, false, -Math.min(q, 12 - q) * 60);
}

export interface WeatherShift { from: SkyWeather; at: number }
/** Cuaca asal, cuaca tujuan, dan kemajuan peralihan (0 sampai 1, 3 detik) supaya langit beralih pelan. */
export function weatherBlend(code: number | null, shift: WeatherShift | null, nowMs: number): { from: SkyWeather; to: SkyWeather; t: number } {
  const to = code === null ? 'clear' : skyWeather(code);
  if (!shift) return { from: to, to, t: 1 };
  const t = smooth01((nowMs - shift.at) / 3000);
  return t >= 1 ? { from: to, to, t: 1 } : { from: shift.from, to, t };
}

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

// Menit dari cakrawala → warna atas dan bawah. Antar kunci diinterpolasi dengan kurva landai.
const KEYS: { min: number; top: RGB; bottom: RGB }[] = [
  { min: -150, top: [0.03, 0.05, 0.14], bottom: [0.07, 0.10, 0.24] }, // malam
  { min: -80, top: [0.05, 0.08, 0.22], bottom: [0.16, 0.16, 0.36] },
  { min: -40, top: [0.11, 0.15, 0.34], bottom: [0.40, 0.28, 0.52] },  // senja ungu
  { min: -14, top: [0.20, 0.26, 0.50], bottom: [0.82, 0.45, 0.46] },  // merah muda
  { min: 0, top: [0.26, 0.36, 0.62], bottom: [0.96, 0.60, 0.36] },    // cakrawala oranye
  { min: 30, top: [0.28, 0.50, 0.80], bottom: [0.99, 0.76, 0.56] },   // hangat
  { min: 80, top: [0.22, 0.48, 0.86], bottom: [0.72, 0.82, 0.95] },
  { min: 170, top: [0.16, 0.42, 0.86], bottom: [0.55, 0.78, 0.97] },  // siang
];

/** Seberapa "siang" langitnya, 0 (malam) sampai 1 (siang), berubah landai di sekitar terbit dan terbenam. */
export const dayAmount = (minutes: number) => smooth01((minutes + 30) / 80);

/** Warna langit akhir: dasar menurut jam, ditarik ke abu-abu menurut cuaca (peralihan antar cuaca dicampur pelan). */
export function skyColors(minutes: number, from: SkyWeather, to: SkyWeather, blend: number) {
  let top = KEYS[KEYS.length - 1].top, bottom = KEYS[KEYS.length - 1].bottom;
  if (minutes <= KEYS[0].min) { top = KEYS[0].top; bottom = KEYS[0].bottom; }
  else {
    for (let i = 1; i < KEYS.length; i++) {
      if (minutes <= KEYS[i].min) {
        const a = KEYS[i - 1], b = KEYS[i], t = smooth01((minutes - a.min) / (b.min - a.min));
        top = mix(a.top, b.top, t); bottom = mix(a.bottom, b.bottom, t);
        break;
      }
    }
  }
  const day = dayAmount(minutes);
  const gTop = mix([0.06, 0.07, 0.10], [0.45, 0.50, 0.57], day), gBottom = mix([0.12, 0.13, 0.17], [0.66, 0.70, 0.75], day);
  const g = GREY[from] + (GREY[to] - GREY[from]) * blend, k = DARKEN[from] + (DARKEN[to] - DARKEN[from]) * blend;
  const dark = (c: RGB): RGB => [c[0] * k, c[1] * k, c[2] * k];
  const t = dark(mix(top, gTop, g)), b = dark(mix(bottom, gBottom, g));
  return { top: css(t), bottom: css(b), day, rgb: mix(t, b, 0.25) };
}

const rnd = (i: number, k: number) => { const v = Math.sin(i * 131 + k * 17 + 1.7) * 43758.5453; return v - Math.floor(v); };
const frac = (v: number) => v - Math.floor(v);

/** Awan, kabut, hujan (garis + tetes di kaca), salju, bintang, dan kilat di atas gradien langit. */
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, minutes: number, day: number, kind: SkyWeather, sight?: Sight | null) {
  const starAlpha = smooth01((-minutes - 10) / 70) * (kind === 'clear' ? 1 : kind === 'partly' ? 0.6 : 0);
  if (starAlpha > 0.02 && sight) drawChart(ctx, w, h, t, starAlpha, sight);
  else if (starAlpha > 0.02) {
    for (let i = 0; i < 48; i++) {
      const tw = 0.6 + 0.4 * Math.sin(t * (0.8 + rnd(i, 3)) + rnd(i, 4) * 6), r = 0.7 + rnd(i, 5) * 0.9;
      ctx.fillStyle = `rgba(255,255,255,${starAlpha * tw * 0.9})`;
      ctx.beginPath(); ctx.arc(rnd(i, 1) * w, rnd(i, 2) * h * 0.62, r / 2 + 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  const level = ({ thunder: 0.30, rain: 0.42, drizzle: 0.55, overcast: 0.78, snow: 0.86, clear: 1, partly: 1, fog: 1 } as Record<SkyWeather, number>)[kind] * (0.26 + 0.74 * day);
  const cloud = `rgba(${Math.round(level * 255)},${Math.round(level * 252)},${Math.round(Math.min(1, level * 1.03 + (1 - day) * 0.06) * 255)},${kind === 'partly' ? 0.8 : 0.9})`;
  for (let i = 0; i < CLOUDS[kind]; i++) {
    const x = frac(rnd(i, 1) + t * (0.004 + rnd(i, 6) * 0.006)) * (w + 260) - 130;
    const y = h * (0.04 + rnd(i, 2) * 0.34), r = 24 + rnd(i, 3) * 26;
    ctx.fillStyle = cloud;
    for (const [dx, dy, k] of [[0, 0, 1], [r * 0.9, r * 0.12, 0.8], [-r * 0.9, r * 0.2, 0.7], [r * 0.35, -r * 0.3, 0.75]]) {
      const rr = r * k;
      ctx.beginPath(); ctx.ellipse(x + dx, y + dy, rr * 1.2, rr * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (kind === 'fog') {
    for (let i = 0; i < 4; i++) {
      const x = Math.sin(t * 0.05 + i * 1.7) * 60;
      ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.05 * day})`;
      ctx.beginPath(); ctx.roundRect(-80 + x, h * (0.18 + i * 0.2), w + 160, h * 0.22, 40); ctx.fill();
    }
  }
  if (kind === 'rain' || kind === 'drizzle' || kind === 'thunder') {
    const n = kind === 'drizzle' ? 28 : kind === 'rain' ? 70 : 96, speed = kind === 'drizzle' ? 0.8 : 1.5, len = kind === 'drizzle' ? 7 : 12;
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const y = frac(rnd(i, 2) + t * speed * (0.8 + rnd(i, 7) * 0.5)) * (h + 30) - 15, x = rnd(i, 1) * (w + 40) - 20 + y * 0.12;
      ctx.strokeStyle = `rgba(255,255,255,${0.28 + rnd(i, 8) * 0.2})`;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.12, y + len); ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const y = frac(rnd(i, 12) + t * 0.006 * (0.4 + rnd(i, 13))) * h, x = rnd(i, 11) * w, r = 1.4 + rnd(i, 14) * 2.2;
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.arc(x - r * 0.1, y - r * 0.4, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 48; i++) {
      const y = frac(rnd(i, 2) + t * 0.07 * (0.6 + rnd(i, 7) * 0.8)) * (h + 10) - 5, x = rnd(i, 1) * w + Math.sin(t * 0.9 + i) * 8, r = 1.2 + rnd(i, 5) * 1.6;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (kind === 'thunder') {
    const c = frac(t / 7.3);
    const flash = Math.max(0, 1 - Math.abs(c - 0.5) * 40) + Math.max(0, 0.6 - Math.abs(c - 0.54) * 40);
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, flash * 0.5)})`; ctx.fillRect(0, 0, w, h); }
  }
}

/** Warna tulisan di atas langit: putih, bergeser pelan ke gelap bila langitnya terang (kabut, mendung siang). */
export function skyInk(ms: number, sun: SunTimes | null, code: number | null, shift: WeatherShift | null): string {
  const pos = skyPosition(ms, sun);
  const b = weatherBlend(code, shift, ms);
  const m = skyColors(pos.horizon, b.from, b.to, b.t).rgb;
  const dark = smooth01(((0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) - 0.53) / 0.07); // halus tapi sempit supaya tulisan tidak sempat abu-abu pucat
  const c = mix([1, 1, 1], [0.07, 0.10, 0.16], dark);
  return css(c);
}
