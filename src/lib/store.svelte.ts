// Simpan data kecil di penyimpanan lokal webview (tetap di PC ini, tidak dikirim ke mana pun).
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem('cn.' + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem('cn.' + key, JSON.stringify(value));
  } catch {}
}

// Detik yang berdetak, dipakai halaman yang menampilkan jam berjalan. Hanya berdetak (4 kali per detik)
// selama panel notch terbuka; saat tertutup tidak ada yang menampilkannya, jadi tidak ada timer sama sekali.
class Ticker {
  now = $state(Date.now());
  private timer = 0;
  setActive(on: boolean) {
    if (on === !!this.timer) return;
    if (on) {
      this.now = Date.now();
      this.timer = window.setInterval(() => (this.now = Date.now()), 250);
    } else {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }
}
export const ticker = new Ticker();

export const clock = (seconds: number, tenths = false) => {
  const s = Math.max(0, seconds);
  const whole = Math.floor(s);
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = whole >= 3600
    ? `${Math.floor(whole / 3600)}:${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)}`
    : `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
  return tenths ? `${base}.${Math.floor((s - whole) * 10)}` : base;
};
