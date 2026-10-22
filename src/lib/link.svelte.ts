// Hubungan ke Cognify utama (protokol: docs/NOTCH_LINK.md di repo Cognify).
// Notch hanya menulis salinan datanya ke %APPDATA%\Cognify Link\notch-data.json setelah pengguna
// menyetujuinya di Cognify (link.json). Tanpa persetujuan tidak ada yang ditulis, dan berkas lama dihapus.
// Tanpa jaringan: hanya berkas lokal, lewat tiga perintah Rust (link_consent, link_write, link_clear).
import { getVersion } from '@tauri-apps/api/app';
import { cmd, inTauri, windowKind } from './bridge';
import { agenda } from './agenda.svelte';
import { clipboard, tray } from './shelf.svelte';
import { clockTools, notes, todo, water } from './state.svelte';
import { weather } from './weather.svelte';

interface Consent { enabled: boolean; clipboard: boolean }

const iso = (ms: number) => new Date(ms).toISOString();
const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Susun isi notch-data.json dari keadaan Notch saat ini. Bagian clipboard hanya ada bila pengguna mengizinkan. */
export function buildPayload(consent: Consent, appVersion: string, now = Date.now()) {
  const today = water.today;
  const history = new Map<string, number>();
  for (const s of water.sips) history.set(localDay(s.t), (history.get(localDay(s.t)) ?? 0) + s.ml);
  const data: Record<string, unknown> = {
    schema: 1,
    platform: 'windows',
    appVersion,
    updatedAt: iso(now),
    todos: todo.items.map((t) => ({ id: t.id, title: t.text, done: t.done, ...(t.due ? { dueAt: iso(t.due) } : {}) })),
    notes: notes.items.slice(0, 100).map((n) => ({ id: n.id, text: n.text, createdAt: iso(n.t) })),
    tray: tray.items.map((f) => ({ id: f.id, name: f.name, path: f.path })),
    timers: clockTools.countdowns.map((c) => ({ id: c.id, title: c.label, durationSec: c.total, endsAt: iso(c.end), running: true })),
    water: {
      goalMl: water.goal,
      today: today.map((s) => ({ at: iso(s.t), ml: s.ml })),
      history: [...history.entries()].filter(([d]) => d !== localDay(now)).sort(([a], [b]) => a.localeCompare(b)).map(([date, ml]) => ({ date, ml })),
    },
    agenda: agenda.events.slice(0, 50).map((e) => ({ id: e.id, title: e.title, start: iso(e.start), ...(e.end ? { end: iso(e.end) } : {}), allDay: e.allDay })),
  };
  if (weather.now) data.now = { weather: { tempC: weather.now.temp, summary: weather.now.icon, place: weather.now.place } };
  if (consent.clipboard) {
    data.clipboard = clipboard.items
      .filter((c) => c.kind !== 'image')
      .slice(0, 40)
      .map((c) => ({ id: c.id, kind: c.kind, text: c.text, at: iso(c.t) }));
  }
  return data;
}

const POLL_MS = 5000;
const DEBOUNCE_MS = 1000;
const HEARTBEAT_MS = 60_000;

class NotchLink {
  consent = $state<Consent>({ enabled: false, clipboard: false });
  private version = '0';
  private lastSig = '';
  private timer = 0;
  private started = false;

  /** Hanya jendela notch yang menulis; Pengaturan tidak. */
  async start() {
    if (this.started || !inTauri || windowKind !== 'notch') return;
    this.started = true;
    this.version = (await getVersion().catch(() => '0')) || '0';
    await this.poll();
    setInterval(() => void this.poll(), POLL_MS);
    setInterval(() => this.consent.enabled && void this.write(true), HEARTBEAT_MS);
    // Tiap perubahan data (tugas, catatan, air, timer, agenda, tray, cuaca) dijadwalkan ditulis dalam 1 detik.
    $effect.root(() => {
      $effect(() => {
        if (!this.consent.enabled) return;
        const sig = JSON.stringify({ ...buildPayload(this.consent, this.version), updatedAt: '' });
        if (sig === this.lastSig) return;
        clearTimeout(this.timer);
        this.timer = window.setTimeout(() => void this.write(false), DEBOUNCE_MS);
      });
    });
  }

  private async poll() {
    const next = (await cmd<Consent>('link_consent')) ?? { enabled: false, clipboard: false };
    const was = this.consent;
    if (next.enabled !== was.enabled || next.clipboard !== was.clipboard || !this.lastSig) {
      this.consent = next;
      this.lastSig = '';
      if (!next.enabled) {
        clearTimeout(this.timer);
        await cmd('link_clear');
      } else await this.write(true);
    }
  }

  private async write(force: boolean) {
    if (!this.consent.enabled) return;
    const payload = buildPayload(this.consent, this.version);
    const sig = JSON.stringify({ ...payload, updatedAt: '' });
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;
    await cmd('link_write', { json: JSON.stringify(payload) });
  }
}

export const notchLink = new NotchLink();
