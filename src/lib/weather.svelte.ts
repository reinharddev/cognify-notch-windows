// Cuaca di header dari Open-Meteo (open-meteo.com, gratis, tanpa akun). Lokasi = nama kota yang
// diketik di Pengaturan (bukan GPS); yang dikirim hanya nama kota itu (sekali, untuk mencari
// koordinatnya) lalu koordinatnya, tiap 30 menit. Mati bawaan.
import { L } from './i18n';
import { load, save } from './store.svelte';
import { features } from './system.svelte';

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

class Weather {
  city = $state(load('city', ''));
  now = $state<{ temp: number; icon: string; place: string } | null>(null);
  problem = $state('');
  private place: Place | null = null;
  private timer = 0;

  setCity(city: string) {
    this.city = city.trim();
    save('city', this.city);
    this.place = null;
    this.restart();
  }

  restart() {
    clearInterval(this.timer);
    this.now = null;
    if (!features.weather) { this.problem = ''; return; }
    if (!this.city) { this.problem = L('Isi nama kota di Pengaturan', 'Enter a city in Settings'); return; }
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), 30 * 60_000);
  }

  private async refresh() {
    try {
      if (!this.place) {
        const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: this.city, count: '1', language: L('id', 'en') })}`)).json();
        const item = g.results?.[0];
        if (!item) { this.problem = L(`Kota "${this.city}" tidak ditemukan`, `City "${this.city}" not found`); this.now = null; return; }
        this.place = { lat: item.latitude, lon: item.longitude, name: item.name };
      }
      const { lat, lon, name } = this.place;
      const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code`)).json();
      this.now = { temp: Math.round(f.current.temperature_2m), icon: symbol(f.current.weather_code), place: name };
      this.problem = '';
    } catch {
      this.problem = L('Cuaca tidak bisa dimuat', 'Couldn\'t load weather');
    }
  }
}
export const weather = new Weather();
