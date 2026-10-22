// Letak bentuk notch di dalam jendela. Mode notch menempel di tengah atas; mode pill bebas di layar, dengan
// jarak aman dari tepi dan penyesuaian arah tumbuh bila pill berada di dekat tepi.

export type AnchorX = 'left' | 'center' | 'right';
export type AnchorY = 'top' | 'bottom';
export type Edge = 'top' | 'bottom' | 'left' | 'right';
export interface Rect { x: number; y: number; w: number; h: number }

/** Pusat pill (piksel) dari pecahan layar, dijepit supaya pill tertutup selalu utuh di dalam jarak aman. */
export function pillCenter(fx: number, fy: number, vw: number, vh: number, w0: number, h0: number, margin: number) {
  const lo = (v: number, size: number, total: number) => Math.min(Math.max(v, margin + size / 2), Math.max(margin + size / 2, total - margin - size / 2));
  return { cx: lo(fx * vw, w0, vw), cy: lo(fy * vh, h0, vh) };
}

/** Rentang pecahan yang diizinkan untuk pusat pill (dipakai peta di Pengaturan). */
export function pillLimits(vw: number, vh: number, w0: number, h0: number, margin: number) {
  return { minX: (margin + w0 / 2) / vw, maxX: 1 - (margin + w0 / 2) / vw, minY: (margin + h0 / 2) / vh, maxY: 1 - (margin + h0 / 2) / vh };
}

/**
 * Sisi tempat bentuk menempel pada pill: panel selebar `openW` yang dipusatkan pada pill dan akan keluar dari
 * layar menempel di sisi kiri atau kanan pill; pill di setengah bawah layar tumbuh ke atas.
 */
export function anchors(cx: number, cy: number, vw: number, vh: number, openW: number, margin: number): { ax: AnchorX; ay: AnchorY } {
  const ax: AnchorX = cx - openW / 2 < margin ? 'left' : cx + openW / 2 > vw - margin ? 'right' : 'center';
  return { ax, ay: cy < vh / 2 ? 'top' : 'bottom' };
}

/** Kotak bentuk berukuran w x h yang menempel pada pill (pusat cx,cy; ukuran tertutup w0 x h0). */
export function place(cx: number, cy: number, w0: number, h0: number, w: number, h: number, vw: number, vh: number, a: { ax: AnchorX; ay: AnchorY }, margin: number): Rect {
  const clamp = (v: number, size: number, total: number) => Math.min(Math.max(v, margin), Math.max(margin, total - margin - size));
  const x = a.ax === 'left' ? cx - w0 / 2 : a.ax === 'right' ? cx + w0 / 2 - w : cx - w / 2;
  const y = a.ay === 'top' ? cy - h0 / 2 : cy + h0 / 2 - h;
  return { x: clamp(x, w, vw), y: clamp(y, h, vh), w, h };
}

/** Tepi layar terdekat dengan kotak, dan geseran supaya kotak keluar seluruhnya dari layar lewat tepi itu. */
export function hideOffset(r: Rect, vw: number, vh: number): { edge: Edge; dx: number; dy: number } {
  const d = { left: r.x, right: vw - (r.x + r.w), top: r.y, bottom: vh - (r.y + r.h) };
  const edge = (Object.keys(d) as Edge[]).reduce((best, k) => (d[k] < d[best] ? k : best), 'top' as Edge);
  const gap = 6;
  switch (edge) {
    case 'left': return { edge, dx: -(r.x + r.w + gap), dy: 0 };
    case 'right': return { edge, dx: vw - r.x + gap, dy: 0 };
    case 'bottom': return { edge, dx: 0, dy: vh - r.y + gap };
    default: return { edge, dx: 0, dy: -(r.y + r.h + gap) };
  }
}

/** Garis tipis di tepi layar tempat kursor memunculkan kembali bentuk yang tersembunyi. */
export function hotZone(r: Rect, edge: Edge, vw: number, vh: number, thick = 4, pad = 30): Rect {
  switch (edge) {
    case 'left': return { x: 0, y: r.y - pad, w: thick, h: r.h + pad * 2 };
    case 'right': return { x: vw - thick, y: r.y - pad, w: thick, h: r.h + pad * 2 };
    case 'bottom': return { x: r.x - pad, y: vh - thick, w: r.w + pad * 2, h: thick };
    default: return { x: r.x - pad, y: 0, w: r.w + pad * 2, h: thick };
  }
}
