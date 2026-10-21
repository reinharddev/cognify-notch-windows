// Agenda dari kalender ICS yang kamu pilih (tautan rahasia Google Calendar atau Outlook, atau file .ics).
// Windows tidak punya Calendar API bersama seperti macOS. Yang diminta ke internet hanya tautan yang kamu
// ketik sendiri, tiap 15 menit; tanpa tautan tidak ada permintaan sama sekali.
import { cmd, inTauri } from './bridge';
import { news } from './news.svelte';
import { L } from './i18n';
import { load, save } from './store.svelte';
import { parseIcs, type AgendaEvent } from './ics';

class Agenda {
  url = $state(load('ics.url', ''));
  file = $state(load('ics.file', ''));
  events = $state<AgendaEvent[]>([]);
  problem = $state('');
  private timer = 0;
  private remindTimer = 0;
  private warned = new Set<string>();

  get enabled() { return !!(this.url || this.file); }

  /** Dipanggil jendela notch saat Pengaturan (jendela lain) mengubah sumber kalender. */
  reload() {
    const url = load('ics.url', ''), file = load('ics.file', '');
    if (url === this.url && file === this.file) return;
    this.url = url; this.file = file;
    this.restart();
  }

  setSource(url: string, file = '') {
    this.url = url.trim(); this.file = file;
    save('ics.url', this.url); save('ics.file', this.file);
    this.restart();
  }

  restart() {
    clearInterval(this.timer);
    clearInterval(this.remindTimer);
    this.events = []; this.problem = '';
    if (!this.enabled || !inTauri) return;
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), 15 * 60_000);
    // Pengingat 5 menit sebelum acara; cek tiap 30 detik tanpa permintaan jaringan.
    this.remindTimer = window.setInterval(() => this.remind(), 30_000);
  }

  async refresh() {
    const text = this.file ? await cmd<string>('read_ics_file', { path: this.file }) : await cmd<string>('fetch_text', { url: this.url });
    if (typeof text !== 'string') { this.problem = L('Kalender tidak bisa dimuat. Periksa tautan atau file.', 'Couldn\'t load the calendar. Check the link or file.'); return; }
    const now = Date.now();
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    this.events = parseIcs(text, midnight.getTime(), midnight.getTime() + 2 * 864e5).filter((e) => (e.end ?? e.start) > now);
    this.problem = this.events.length || text.includes('BEGIN:VCALENDAR') ? '' : L('Isinya bukan kalender ICS.', 'That isn\'t an ICS calendar.');
  }

  /** Tombol Gabung tampil dari 10 menit sebelum mulai sampai acara selesai. */
  joinable(e: AgendaEvent, now = Date.now()) {
    return !!e.meeting && !e.allDay && e.start - now <= 10 * 60_000 && (e.end ?? e.start + 3600_000) > now;
  }

  private remind() {
    const now = Date.now();
    for (const e of this.events) {
      if (e.allDay || this.warned.has(e.id)) continue;
      const left = e.start - now;
      if (left > 0 && left <= 5 * 60_000) { this.warned.add(e.id); news.announce(e.title, L(`mulai ${Math.ceil(left / 60000)} menit lagi`, `starts in ${Math.ceil(left / 60000)} min`)); }
    }
  }
}
export const agenda = new Agenda();
