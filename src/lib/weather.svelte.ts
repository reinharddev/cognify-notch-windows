// Cuaca di header dari Open-Meteo (open-meteo.com, gratis, tanpa akun). Lokasi = nama kota yang
// diketik di Pengaturan (bukan GPS); yang dikirim hanya nama kota itu (sekali, untuk mencari
// koordinatnya) lalu koordinatnya, tiap 30 menit. Mati bawaan.
import { L } from './i18n';
import { load, save } from './store.svelte';
import { features } from './system.svelte';
import { skyWeather, type WeatherShift } from './sky';

interface Place { lat: number; lon: number; name: string }

const symbol = (code: number) => {
  const h = new Date().getHours(), night = h < 6 || h >= 18;
  if (code === 0) return night ? '🌙' : '☀';
  if (code <= 2) return night ? '☁' : '⛅';
  if (code === 3) return '☁';
  if (code === 45 || code === 48) return '🌫';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄';
  if (code >= 95) return '⛈';
  return '☁';
};

export interface SunTimes { sunrise: number; sunset: number; nextSunrise: number; offset: number } // ms epoch, offset detik dari UTC di lokasi

class Weather {
  city = $state(load('city', ''));
  /** "lat,lon" dari tombol Deteksi lokasi; kosong = pakai nama kota. */
  coords = $state(load('coords', ''));
  now = $state<{ temp: number; icon: string; place: string; code: number; sun: SunTimes | null } | null>(null);
  /** Untuk pratinjau: jam yang dipakai langit menggantikan jam sekarang (ms epoch). */
  clockOverride: number | null = $state(null);
  /** Perubahan cuaca terakhir (kelas sebelumnya dan kapan), supaya langit beralih pelan. */
  kindShift: WeatherShift | null = $state(null);
  problem = $state('');
  private place: Place | null = null;
  /** Lintang dan bujur pengamat bila sudah diketahui; dipakai untuk bintang nyata. */
  get observer() { return this.place ? { lat: this.place.lat, lon: this.place.lon } : null; }
  private timer = 0;

  /** Dipanggil jendela notch saat Pengaturan (jendela lain) mengubah kota atau saklar cuaca. */
  reload() {
    const c = load('city', ''), k = load('coords', '');
    if (c !== this.city || k !== this.coords) { this.city = c; this.coords = k; this.place = null; }
    this.restart();
  }

  setCity(city: string) {
    this.city = city.trim();
    this.coords = '';
    save('city', this.city);
    save('coords', '');
    this.place = null;
    this.restart();
  }

  /** Lokasi dari Deteksi lokasi. Koordinat disimpan di PC ini dan hanya dikirim ke Open-Meteo untuk cuaca. */
  setCoords(lat: number, lon: number) {
    this.coords = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    this.city = '';
    save('coords', this.coords);
    save('city', '');
    this.place = null;
    this.restart();
  }

  /** Minta lokasi PC ini sekali (izin Lokasi Windows). */
  detect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error(L('Lokasi tidak tersedia di perangkat ini.', 'Location is not available on this device.'))); return; }
      navigator.geolocation.getCurrentPosition(
        (p) => { this.setCoords(p.coords.latitude, p.coords.longitude); resolve(); },
        (e) => reject(new Error(e.code === 1
          ? L('Izin lokasi ditolak. Aktifkan Layanan Lokasi di Pengaturan Windows → Privasi.', 'Location permission denied. Turn on Location services in Windows Settings → Privacy.')
          : L('Lokasi tidak bisa dibaca. Coba lagi.', 'Couldn\'t read your location. Try again.'))),
        { timeout: 15000, maximumAge: 600000 },
      );
    });
  }

  restart() {
    clearInterval(this.timer);
    this.now = null;
    if (!features.weather) { this.problem = ''; return; }
    if (!this.city && !this.coords) { this.problem = L('Isi nama kota di Pengaturan', 'Enter a city in Settings'); return; }
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), 30 * 60_000);
  }

  private async refresh() {
    try {
      if (!this.place && this.coords) {
        const [lat, lon] = this.coords.split(',').map(Number);
        this.place = { lat, lon, name: '' };
      }
      if (!this.place) {
        const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: this.city, count: '1', language: L('id', 'en') })}`)).json();
        const item = g.results?.[0];
        if (!item) { this.problem = L(`Kota "${this.city}" tidak ditemukan`, `City "${this.city}" not found`); this.now = null; return; }
        this.place = { lat: item.latitude, lon: item.longitude, name: item.name };
      }
      const { lat, lon, name } = this.place;
      const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto&forecast_days=2`)).json();
      const off = Number(f.utc_offset_seconds ?? 0);
      const at = (t?: string) => (t ? Date.parse(t + ':00Z') - off * 1000 : NaN); // "2026-10-30T05:25" di zona lokasi
      const sun = f.daily?.sunrise?.length >= 2 && f.daily?.sunset?.length >= 1
        ? { sunrise: at(f.daily.sunrise[0]), sunset: at(f.daily.sunset[0]), nextSunrise: at(f.daily.sunrise[1]), offset: off } : null;
      const before = this.now ? skyWeather(this.now.code) : null;
      if (before && before !== skyWeather(f.current.weather_code)) this.kindShift = { from: before, at: Date.now() };
      this.now = { temp: Math.round(f.current.temperature_2m), icon: symbol(f.current.weather_code), place: name || String(f.timezone ?? '').split('/').pop()?.replace(/_/g, ' ') || L('Lokasi saya', 'My location'), code: f.current.weather_code, sun: sun && !Object.values(sun).some(Number.isNaN) ? sun : null };
      this.problem = '';
    } catch {
      this.problem = L('Cuaca tidak bisa dimuat', 'Couldn\'t load weather');
    }
  }
}
export const weather = new Weather();
