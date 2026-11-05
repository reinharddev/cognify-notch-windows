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
        // Higher resolution preserves small color accents on near-monochrome covers.
        const n = 64, c = document.createElement('canvas');
        c.width = c.height = n;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        const bins = 36, hx = new Float64Array(bins), hy = new Float64Array(bins);
        const weight = new Float64Array(bins), saturationSum = new Float64Array(bins);
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
          // Keep dark chromatic pixels while excluding only near-black and near-gray noise.
          if (mx <= 0.015 || s <= 0.08) continue;
          let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
          if (h < 0) h += 6;
          const hue = h / 6, bin = Math.min(bins - 1, Math.floor(hue * bins));
          const angle = hue * 2 * Math.PI, w = s * Math.max(0.15, Math.sqrt(mx));
          hx[bin] += Math.cos(angle) * w; hy[bin] += Math.sin(angle) * w;
          weight[bin] += w; saturationSum[bin] += s * w;
        }
        let dominant = -1, best = 0;
        for (let i = 0; i < bins; i++) {
          const score = weight[(i + bins - 1) % bins] + weight[i] + weight[(i + 1) % bins];
          if (score > best) { best = score; dominant = i; }
        }
        if (dominant < 0) { this.on = '#ffffff'; this.off = 'rgb(191, 191, 191)'; return; }
        const neighbors = [(dominant + bins - 1) % bins, dominant, (dominant + 1) % bins];
        const total = neighbors.reduce((sum, i) => sum + weight[i], 0);
        const x = neighbors.reduce((sum, i) => sum + hx[i], 0);
        const y = neighbors.reduce((sum, i) => sum + hy[i], 0);
        const meanSat = neighbors.reduce((sum, i) => sum + saturationSum[i], 0) / total;
        let hue = Math.atan2(y, x) / (2 * Math.PI);
        if (hue < 0) hue += 1;
        const s = Math.min(0.86, Math.max(0.5, meanSat * 0.95));
        this.on = hsvToRgb(hue, s, 1);
        this.off = hsvToRgb(hue, s * 0.6, 0.8);
      } catch { this.on = this.off = null; } // gambar dari alamat lain tanpa izin baca
    };
    img.onerror = () => { this.on = this.off = null; };
    img.src = thumb;
  }
}
export const artColors = new ArtColors();
