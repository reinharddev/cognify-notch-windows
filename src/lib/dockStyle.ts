// Latar dock: ikuti notch, kaca, warna solid, atau gradien. Murni (tanpa Tauri atau Svelte), supaya pemilihan
// warna teks dan pembuatan CSS-nya bisa diuji.

export type DockBg = 'notch' | 'glass' | 'color' | 'gradient';
export const DOCK_BGS: DockBg[] = ['notch', 'glass', 'color', 'gradient'];

export interface DockStyleCfg {
  bgMode: DockBg;
  bgColor: string;
  bgColor2: string;
  /** Derajat, 0 sampai 360 (0 = ke kanan, seperti latar notch). */
  bgAngle: number;
  /** Kepekatan tint kaca, 0 sampai 1. */
  glassOpacity: number;
  /** Blur di balik kaca, piksel. */
  glassBlur: number;
}

export const DEFAULT_STYLE: DockStyleCfg = {
  bgMode: 'notch', bgColor: '#1b1b26', bgColor2: '#3a1c71', bgAngle: 135, glassOpacity: 0.38,
  // 0: Windows tidak memburamkan desktop di balik jendela transparan lewat CSS, jadi blur tidak ditawarkan di Pengaturan.
  glassBlur: 0,
};

export const GLASS_OPACITY_MIN = 0.12;
export const GLASS_OPACITY_MAX = 0.85;
export const GLASS_BLUR_MAX = 40;

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/** Angka dari data tersimpan: yang bukan angka (rusak) menjadi nilai bawaan, selain itu dijepit ke batasnya. */
const numOr = (v: unknown, fallback: number, lo: number, hi: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
};

/** Hanya #rrggbb: warna dari pemilih warna, dan satu-satunya bentuk yang dipakai di CSS (tidak ada teks bebas). */
export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

/** Kecerahan relatif 0 (hitam) sampai 1 (putih), menurut WCAG. */
export function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

/** Warna teks (tiga angka RGB dipisah spasi, untuk `rgb(var(--ink) / .5)`): putih di latar gelap, gelap di latar terang. */
export const INK_LIGHT = '255 255 255';
export const INK_DARK = '20 20 28';
/** Di atas luminansi ini teks gelap lebih terbaca daripada putih (titik silang kontras WCAG sekitar 0,18). */
export const LIGHT_BACKGROUND = 0.18;

export function inkFor(luma: number): string {
  return luma > LIGHT_BACKGROUND ? INK_DARK : INK_LIGHT;
}

export interface DockSurface {
  /** Nilai `background` untuk cangkang dock. */
  background: string;
  /** Nilai `backdrop-filter` (kosong bila tidak dipakai). */
  backdrop: string;
  /** Warna teks, lihat `inkFor`. */
  ink: string;
  /** Ikuti latar notch: lapisan gambar atau warna notch digambar di atas dasar hitam. */
  followsNotch: boolean;
}

/** Pembersihan data tersimpan: nilai rusak diganti bawaan. */
export function cleanStyle(raw: Partial<Record<keyof DockStyleCfg, unknown>>): DockStyleCfg {
  const d = DEFAULT_STYLE;
  return {
    bgMode: (DOCK_BGS as unknown[]).includes(raw.bgMode) ? (raw.bgMode as DockBg) : d.bgMode,
    bgColor: isHex(raw.bgColor) ? raw.bgColor : d.bgColor,
    bgColor2: isHex(raw.bgColor2) ? raw.bgColor2 : d.bgColor2,
    bgAngle: numOr(raw.bgAngle, d.bgAngle, 0, 360),
    glassOpacity: numOr(raw.glassOpacity, d.glassOpacity, GLASS_OPACITY_MIN, GLASS_OPACITY_MAX),
    glassBlur: numOr(raw.glassBlur, d.glassBlur, 0, GLASS_BLUR_MAX),
  };
}

const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;

export function surface(cfg: DockStyleCfg): DockSurface {
  const c = cleanStyle(cfg);
  switch (c.bgMode) {
    case 'glass':
      // Tint gelap tembus pandang: tulisan putih tetap terbaca, dan yang di baliknya samar terlihat.
      return {
        background: rgba('#12121a', Math.round(c.glassOpacity * 100) / 100),
        backdrop: c.glassBlur > 0 ? `blur(${Math.round(c.glassBlur)}px) saturate(1.6)` : '',
        ink: INK_LIGHT,
        followsNotch: false,
      };
    case 'color':
      return { background: c.bgColor, backdrop: '', ink: inkFor(luminance(c.bgColor)), followsNotch: false };
    case 'gradient':
      return {
        background: `linear-gradient(${Math.round(c.bgAngle) + 90}deg, ${c.bgColor}, ${c.bgColor2})`,
        backdrop: '',
        // Teks mengikuti rata-rata kedua warna; gradien yang satu ujungnya terang dan lainnya gelap tidak bisa terbaca
        // di keduanya dengan satu warna teks, jadi yang terang menang bila salah satunya terlalu terang.
        ink: inkFor(Math.max(luminance(c.bgColor), luminance(c.bgColor2)) > 0.45 ? Math.max(luminance(c.bgColor), luminance(c.bgColor2)) : (luminance(c.bgColor) + luminance(c.bgColor2)) / 2),
        followsNotch: false,
      };
    default:
      return { background: '#000', backdrop: '', ink: INK_LIGHT, followsNotch: true };
  }
}
