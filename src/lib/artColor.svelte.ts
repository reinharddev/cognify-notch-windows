// Warna lirik otomatis dari sampul lagu: rona dominan (diutamakan yang jenuh dan terang), dibuat terang agar
// terbaca di atas hitam. Sama dengan ArtworkColors di Mac. Sampul abu-abu: putih dan abu terang.
function hsvToRgb(h: number, s: number, v: number): string {
  const f = (n: number) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return `rgb(${Math.round(f(5) * 255)}, ${Math.round(f(3) * 255)}, ${Math.round(f(1) * 255)})`;
}

class ArtColors {
  /** Warna baris aktif dan baris lainnya; null = belum ada sampul atau tidak bisa dibaca. */
  on = $state<string | null>(null);
  off = $state<string | null>(null);
  private url = '';

  update(thumb?: string) {
    if (!thumb) { this.url = ''; this.on = this.off = null; return; }
    if (thumb === this.url) return;
    this.url = thumb;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (this.url !== thumb) return;
      try {
        const n = 32, c = document.createElement('canvas');
        c.width = c.height = n;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        let x = 0, y = 0, w = 0, sat = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
          let h = 0;
          if (mx !== mn) h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
          const a = (h / 6) * 2 * Math.PI, wt = s * mx + 0.001;
          x += Math.cos(a) * wt; y += Math.sin(a) * wt; w += wt; sat += s * wt;
        }
        const meanSat = w ? sat / w : 0;
        if (meanSat <= 0.12) { this.on = '#ffffff'; this.off = 'rgb(191, 191, 191)'; return; }
        let hue = Math.atan2(y, x) / (2 * Math.PI);
        if (hue < 0) hue += 1;
        const s = Math.min(0.7, Math.max(0.28, meanSat * 0.8));
        this.on = hsvToRgb(hue, s, 1);
        this.off = hsvToRgb(hue, s * 0.6, 0.8);
      } catch { this.on = this.off = null; } // gambar dari alamat lain tanpa izin baca
    };
    img.onerror = () => { this.on = this.off = null; };
    img.src = thumb;
  }
}
export const artColors = new ArtColors();
