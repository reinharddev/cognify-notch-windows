// Kalkulator dan konversi satuan untuk catatan cepat: "12*3", "(4+5)/2", "15% dari 200",
// "5 km ke mil", "100 f to c". Port dari Calc.swift versi Mac; semuanya dihitung di PC ini.
import { lang } from './i18n';

const normalize = (s: string) => {
  let out = s;
  if (out.includes(',') && out.includes('.')) {
    out = out.lastIndexOf(',') > out.lastIndexOf('.') ? out.replace(/\./g, '').replace(',', '.') : out.replace(/,/g, '');
  } else if (out.split('.').length > 2) {
    out = out.replace(/\./g, ''); // 1.250.000 = pemisah ribuan
  } else {
    out = out.replace(',', '.');
  }
  return out;
};

export const format = (value: number) =>
  new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: Math.abs(value) < 1 ? 6 : 4 }).format(value);

const num = (s: string) => {
  const v = Number(normalize(s));
  return Number.isFinite(v) ? v : null;
};

function percentOf(text: string): number | null {
  const m = /^([\d.,]+)\s*%\s*(?:dari|of)\s*([\d.,]+)$/.exec(text);
  if (!m) return null;
  const p = num(m[1]), base = num(m[2]);
  return p === null || base === null ? null : (p / 100) * base;
}

// Satuan dikelompokkan per jenis; nilai = faktor ke satuan dasar. Suhu ditangani terpisah.
const UNITS: Record<string, [string, number]> = {
  km: ['len', 1000], m: ['len', 1], cm: ['len', 0.01], mm: ['len', 0.001], mi: ['len', 1609.344], mil: ['len', 1609.344],
  mile: ['len', 1609.344], miles: ['len', 1609.344], ft: ['len', 0.3048], kaki: ['len', 0.3048], feet: ['len', 0.3048],
  in: ['len', 0.0254], inch: ['len', 0.0254], inci: ['len', 0.0254], yd: ['len', 0.9144],
  kg: ['mass', 1000], g: ['mass', 1], gram: ['mass', 1], mg: ['mass', 0.001], lb: ['mass', 453.59237], lbs: ['mass', 453.59237],
  pon: ['mass', 453.59237], oz: ['mass', 28.349523], ons: ['mass', 28.349523],
  l: ['vol', 1000], liter: ['vol', 1000], ml: ['vol', 1], gal: ['vol', 3785.41], cup: ['vol', 236.588], gelas: ['vol', 236.588],
  'km/h': ['spd', 1], kmh: ['spd', 1], kpj: ['spd', 1], mph: ['spd', 1.609344], 'm/s': ['spd', 3.6],
  tb: ['data', 1e12], gb: ['data', 1e9], mb: ['data', 1e6], kb: ['data', 1e3],
  jam: ['time', 3600], h: ['time', 3600], menit: ['time', 60], min: ['time', 60], detik: ['time', 1], s: ['time', 1],
  c: ['temp', 0], '°c': ['temp', 0], celsius: ['temp', 0], f: ['temp', 1], '°f': ['temp', 1], fahrenheit: ['temp', 1],
  k: ['temp', 2], kelvin: ['temp', 2],
};

function toCelsius(v: number, u: number) { return u === 0 ? v : u === 1 ? ((v - 32) * 5) / 9 : v - 273.15; }
function fromCelsius(v: number, u: number) { return u === 0 ? v : u === 1 ? (v * 9) / 5 + 32 : v + 273.15; }

function convert(text: string): string | null {
  const m = /^([\d.,]+)\s*([a-z°/]+)\s+(?:ke|to|in|=|jadi)\s+([a-z°/]+)$/.exec(text);
  if (!m) return null;
  const value = num(m[1]), from = UNITS[m[2]], to = UNITS[m[3]];
  if (value === null || !from || !to || from[0] !== to[0]) return null;
  const result = from[0] === 'temp' ? fromCelsius(toCelsius(value, from[1]), to[1]) : (value * from[1]) / to[1];
  return `${format(result)} ${m[3]}`;
}

// Pengurai rekursif: + - * / ^ %, kurung, minus di depan.
function parse(src: string): number | null {
  const s = src.replace(/ /g, '');
  let i = 0;
  const peek = () => s[i];
  const expression = (): number | null => {
    let v = term();
    while (v !== null && (peek() === '+' || peek() === '-')) {
      const op = s[i++], r = term();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const term = (): number | null => {
    let v = power();
    while (v !== null && (peek() === '*' || peek() === '/')) {
      const op = s[i++], r = power();
      if (r === null) return null;
      if (op === '/') { if (r === 0) return null; v /= r; } else v *= r;
    }
    return v;
  };
  const power = (): number | null => {
    const base = unary();
    if (base !== null && peek() === '^') {
      i++;
      const exp = power();
      return exp === null ? null : Math.pow(base, exp);
    }
    return base;
  };
  const unary = (): number | null => {
    if (peek() === '-') { i++; const v = unary(); return v === null ? null : -v; }
    if (peek() === '+') { i++; return unary(); }
    let v = atom();
    if (v !== null && peek() === '%') { i++; v /= 100; }
    return v;
  };
  const atom = (): number | null => {
    if (peek() === '(') {
      i++;
      const v = expression();
      if (v === null || peek() !== ')') return null;
      i++;
      return v;
    }
    const start = i;
    while (i < s.length && /[\d.]/.test(s[i])) i++;
    return start < i ? Number(s.slice(start, i)) : null;
  };
  const v = expression();
  return v !== null && i === s.length ? v : null;
}

/** Hasil siap tampil ("36", "3,11 mi"), atau null bila teks bukan hitungan. */
export function evaluate(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (!text || text.length >= 80) return null;
  const converted = convert(text);
  if (converted) return converted;
  const percent = percentOf(text);
  if (percent !== null) return format(percent);
  const expr = text.replace(/×/g, '*').replace(/x/g, '*').replace(/÷/g, '/').replace(/:/g, '/');
  if (!/^[0-9.,+\-*/^%() ]+$/.test(expr)) return null;
  if (!/\d\s*[+\-*/^%]\s*[\d(]/.test(expr) && !/\)\s*[+\-*/^]/.test(expr)) return null;
  const v = parse(normalize(expr));
  return v !== null && Number.isFinite(v) ? format(v) : null;
}
