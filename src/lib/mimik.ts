// Katalog dan palet playground Skin Mimik. Port persis dari SkinPlayground.swift dan NotchDock/MimikPalette.swift di Mac;
// daftar dan perilakunya TIDAK BOLEH berbeda. Gaya dikirim ke skin sebagai `data.config` (lihat Skins/mimik/index.html).

export interface MimikStyle {
  preset: string;
  skin: string;
  ink: string;
  ring: string;
  type: string;
  mouth: boolean;
  pupils: boolean;
  follow: boolean;
  blink: boolean;
  wander: boolean;
  /** "auto" = mengikuti harimu (musik, jam, tugas); selain itu satu ekspresi tetap. */
  mood: string;
  gloss: boolean;
  rim: boolean;
  glow: boolean;
  scan: boolean;
  hue: boolean;
}

export const defaultMimik = (): MimikStyle => ({
  preset: 'default', skin: '#000000', ink: '#e9ebec', ring: '#34363a', type: 'round',
  mouth: false, pupils: false, follow: true, blink: true, wander: true, mood: 'auto',
  gloss: false, rim: false, glow: false, scan: false, hue: false,
});

/** Gaya yang disimpan pengguna dengan nama sendiri. */
export interface MimikPreset { id: string; name: string; style: MimikStyle }

export interface BuiltinPreset { id: string; name: string; skin: string; ink: string; ring: string }
export const PRESETS: BuiltinPreset[] = [
  { id: 'default', name: 'Default', skin: '#000000', ink: '#e9ebec', ring: '#34363a' },
  { id: 'inverted', name: 'Inverted', skin: '#f2f2f2', ink: '#111111', ring: '#cfcfcf' },
  { id: 'acid', name: 'Acid', skin: '#0b0f00', ink: '#c6ff00', ring: '#4a5a00' },
  { id: 'sky', name: 'Sky', skin: '#0b2a4a', ink: '#bfe6ff', ring: '#2f6fa8' },
  { id: 'paper', name: 'Paper', skin: '#f5efe1', ink: '#2b2620', ring: '#cbbf9f' },
  { id: 'ember', name: 'Ember', skin: '#1a0a05', ink: '#ff7a2f', ring: '#6b2a10' },
];

export const SHAPES: { id: string; id_: string; en: string }[] = [
  { id: 'round', id_: 'Bulat', en: 'Round' }, { id: 'robot', id_: 'Robot', en: 'Robot' }, { id: 'cat', id_: 'Kucing', en: 'Cat' },
  { id: 'ghost', id_: 'Hantu', en: 'Ghost' }, { id: 'blob', id_: 'Gumpal', en: 'Blob' }, { id: 'alien', id_: 'Alien', en: 'Alien' },
  { id: 'bear', id_: 'Beruang', en: 'Bear' },
];

export const MOODS = ['idle', 'content', 'relieved', 'happy', 'joy', 'excited', 'love', 'pleading', 'shy', 'surprised', 'scared', 'curious',
  'confused', 'dizzy', 'thinking', 'focus', 'suspicious', 'unimpressed', 'smug', 'sly', 'bored', 'exasperated', 'worried',
  'guilty', 'sad', 'disgusted', 'annoyed', 'angry', 'sleepy', 'sleep', 'laugh', 'cry', 'sob', 'starstruck', 'dead', 'cool',
  'nervous', 'embarrassed', 'blush', 'proud', 'hopeful', 'determined', 'mischievous', 'skeptical', 'tired', 'hurt', 'grumpy',
  'dazed', 'mindblown', 'lonely', 'bliss'];

export const REACTIONS = ['blink', 'wink', 'nod', 'shake', 'bounce', 'pop', 'boing', 'spin', 'jitter'];

// ---- Palet acak: serasi dan selalu terbaca (kontras kepala dan mata minimal 7:1); sama dengan MimikPalette.swift ----

export interface Palette { skin: string; ink: string; ring: string }
type Rgb = [number, number, number];

export function hsbToRgb(hue: number, sat: number, bri: number): Rgb {
  const h = (hue - Math.floor(hue)) * 6;
  const c = bri * sat, x = c * (1 - Math.abs((h % 2) - 1)), m = bri - c;
  const [r, g, b] = ([[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c]] as Rgb[])[Math.floor(h)] ?? [c, 0, x];
  return [r + m, g + m, b + m];
}

export function toHex(c: Rgb): string {
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return '#' + c.map((v) => byte(v).toString(16).padStart(2, '0')).join('');
}

export function parseHex(hex: string): Rgb | null {
  const h = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const v = parseInt(h, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function luminance(c: Rgb): number {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

/** Rasio kontras WCAG (1..21) antara dua warna hex. */
export function contrast(a: string, b: string): number {
  const x = parseHex(a), y = parseHex(b);
  if (!x || !y) return 1;
  const la = luminance(x), lb = luminance(y);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function randomPalette(rand: () => number = Math.random): Palette {
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const hue = rand();
  const dark = rand() < 0.75;
  const shifts = [0, 0, 0.08, -0.08, 0.5, 0.33];
  const inkHue = hue + shifts[Math.floor(rand() * shifts.length)];
  const skin = dark ? hsbToRgb(hue, between(0.35, 0.8), between(0.07, 0.2)) : hsbToRgb(hue, between(0.04, 0.2), between(0.93, 0.98));
  let inkSat = dark ? between(0.2, 0.7) : between(0.5, 0.9);
  let inkBri = dark ? between(0.9, 1.0) : between(0.12, 0.3);
  const skinHex = toHex(skin);
  let inkHex = toHex(hsbToRgb(inkHue, inkSat, inkBri));
  for (let i = 0; i < 30 && contrast(skinHex, inkHex) < 7; i++) {
    inkBri = dark ? Math.min(1, inkBri + 0.03) : Math.max(0.02, inkBri - 0.03);
    inkSat = Math.max(0, inkSat - 0.03);
    inkHex = toHex(hsbToRgb(inkHue, inkSat, inkBri));
  }
  const ink = parseHex(inkHex)!;
  const ring = skin.map((v, i) => v + (ink[i] - v) * 0.28) as Rgb;
  return { skin: skinHex, ink: inkHex, ring: toHex(ring) };
}

/** Konfigurasi untuk skin: gaya ditambah reaksi terakhir (nama dan nomor urut). */
export const mimikConfig = (style: MimikStyle, react: { name: string; n: number }) => ({ ...style, react });
