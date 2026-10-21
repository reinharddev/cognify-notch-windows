import { load, save, ticker } from './store.svelte';
import { news, doneText } from './news.svelte';
import { parseDue } from './due';
import { L } from './i18n';

const day = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

// ---------- Pomodoro ----------
export const PRESETS = [[25, 5], [50, 10], [90, 15]] as const;

class Pomodoro {
  mode = $state<'focus' | 'rest'>('focus');
  focusMin = $state(25);
  restMin = $state(5);
  running = $state(false);
  remainingAtPause = $state(25 * 60);
  private endAt = 0;
  sessions = $state(0);

  constructor() {
    const s = load('timer', { focus: 25, rest: 5, day: '', sessions: 0 });
    this.focusMin = s.focus; this.restMin = s.rest;
    this.sessions = s.day === day() ? s.sessions : 0;
    this.remainingAtPause = this.total;
  }

  private timer = 0;
  /** Pasang satu pemicu tepat saat waktu habis; tidak ada pemeriksaan berkala. */
  private arm() {
    clearTimeout(this.timer);
    if (this.running) this.timer = window.setTimeout(() => this.tick(), Math.max(0, this.endAt - Date.now()) + 30);
  }

  get total() { return (this.mode === 'focus' ? this.focusMin : this.restMin) * 60; }
  get remaining() {
    return this.running ? Math.max(0, Math.ceil((this.endAt - ticker.now) / 1000)) : this.remainingAtPause;
  }
  get progress() { return 1 - this.remaining / this.total; }
  get idle() { return !this.running && this.remainingAtPause === this.total; }

  private persist() { save('timer', { focus: this.focusMin, rest: this.restMin, day: day(), sessions: this.sessions }); }

  setMinutes(focus?: number, rest?: number) {
    if (this.running) return;
    if (focus !== undefined) this.focusMin = Math.max(5, Math.min(180, focus));
    if (rest !== undefined) this.restMin = Math.max(1, Math.min(60, rest));
    this.remainingAtPause = this.total;
    this.persist();
  }
  adjust(delta: number) { this.mode === 'focus' ? this.setMinutes(this.focusMin + delta) : this.setMinutes(undefined, this.restMin + delta); }
  select(mode: 'focus' | 'rest') { this.running = false; this.arm(); this.mode = mode; this.remainingAtPause = this.total; }
  toggle() {
    if (this.running) { this.remainingAtPause = Math.max(0, Math.ceil((this.endAt - Date.now()) / 1000)); this.running = false; }
    else { this.endAt = Date.now() + this.remainingAtPause * 1000; this.running = true; }
    this.arm();
  }
  reset() { this.running = false; this.arm(); this.remainingAtPause = this.total; }

  private tick() {
    if (!this.running) return;
    if (Date.now() < this.endAt) { this.arm(); return; }
    const finished = this.mode;
    this.running = false;
    if (finished === 'focus') { this.sessions++; this.persist(); }
    this.mode = finished === 'focus' ? 'rest' : 'focus';
    this.remainingAtPause = this.total;
    news.announce(finished === 'focus' ? L('Fokus selesai, waktunya istirahat', 'Focus done, time for a break') : L('Istirahat selesai', 'Break over'), 'Pomodoro');
  }
}
export const pomodoro = new Pomodoro();

// ---------- Stopwatch dan hitung mundur ----------
interface Countdown { id: string; label: string; end: number; total: number }

class ClockTools {
  started = $state(0);            // epoch ms saat mulai, 0 = berhenti
  accumulated = $state(0);        // detik sebelum jeda terakhir
  laps = $state<number[]>([]);
  countdowns = $state<Countdown[]>(load<Countdown[]>('countdowns', []).filter((c) => c.end > Date.now()));

  private fireTimer = 0;
  constructor() { this.arm(); }
  /** Pasang satu pemicu menjelang hitung mundur terdekat selesai; tanpa hitung mundur tidak ada timer. */
  private arm() {
    clearTimeout(this.fireTimer);
    const n = this.nearest;
    if (n) this.fireTimer = window.setTimeout(() => this.fire(), Math.max(0, n.end - Date.now() - 200));
  }

  get running() { return this.started > 0; }
  get elapsed() { return this.accumulated + (this.started ? (ticker.now - this.started) / 1000 : 0); }

  toggle() {
    if (this.started) { this.accumulated += (Date.now() - this.started) / 1000; this.started = 0; }
    else this.started = Date.now();
  }
  lap() { if (this.running) this.laps = [this.elapsed, ...this.laps]; }
  reset() { this.started = 0; this.accumulated = 0; this.laps = []; }

  start(minutes: number) {
    const total = minutes * 60;
    const label = minutes < 60 ? L(`${minutes} menit`, `${minutes} min`) : L(`${minutes / 60} jam`, `${minutes / 60} h`);
    this.countdowns = [...this.countdowns, { id: uid(), label, end: Date.now() + total * 1000, total }];
    this.persist();
    this.arm();
  }
  cancel(id: string) { this.countdowns = this.countdowns.filter((c) => c.id !== id); this.persist(); this.arm(); }
  get nearest() { return [...this.countdowns].sort((a, b) => a.end - b.end)[0]; }
  private persist() { save('countdowns', this.countdowns); }

  private fire() {
    const done = this.countdowns.filter((c) => c.end <= Date.now() + 200);
    if (!done.length) { this.arm(); return; }
    this.countdowns = this.countdowns.filter((c) => !done.includes(c));
    this.persist();
    for (const c of done) news.announce(doneText(c.label), L('Hitung mundur', 'Countdown'));
    this.arm();
  }
}
export const clockTools = new ClockTools();

// ---------- Pengingat minum ----------
interface Sip { t: number; ml: number }

class Water {
  goal = $state(2000); glass = $state(250); startHour = $state(8); endHour = $state(21);
  interval = $state(60); reminders = $state(true);
  sips = $state<Sip[]>([]);
  private lastReminder = 0;

  constructor() {
    const s = load('water', { goal: 2000, glass: 250, startHour: 8, endHour: 21, interval: 60, reminders: true, sips: [] as Sip[] });
    Object.assign(this, { goal: s.goal, glass: s.glass, startHour: s.startHour, endHour: s.endHour, interval: s.interval, reminders: s.reminders });
    this.sips = s.sips.filter((x) => x.t > Date.now() - 14 * 864e5);
    setInterval(() => this.check(), 30_000);
  }

  persist() {
    save('water', { goal: this.goal, glass: this.glass, startHour: this.startHour, endHour: this.endHour, interval: this.interval, reminders: this.reminders, sips: this.sips });
  }
  get today() { const d = new Date(); d.setHours(0, 0, 0, 0); return this.sips.filter((s) => s.t >= d.getTime()); }
  get total() { return this.today.reduce((a, s) => a + s.ml, 0); }
  get progress() { return this.goal > 0 ? Math.min(1, this.total / this.goal) : 0; }
  drink(ml = this.glass) { this.sips = [...this.sips, { t: Date.now(), ml }]; this.lastReminder = 0; this.persist(); }
  undo() { const last = this.today.at(-1); if (last) { this.sips = this.sips.filter((s) => s !== last); this.persist(); } }
  /** ml per jam aktif, untuk grafik. */
  get hourly() {
    const lo = Math.min(this.startHour, this.endHour), hi = Math.max(this.startHour, this.endHour);
    return Array.from({ length: hi - lo + 1 }, (_, i) => {
      const hour = lo + i;
      return { hour, ml: this.today.filter((s) => new Date(s.t).getHours() === hour).reduce((a, s) => a + s.ml, 0) };
    });
  }

  // Jam aktif, target belum tercapai, dan sudah lewat `interval` menit sejak minum atau pengingat terakhir.
  private check() {
    if (!this.reminders || this.total >= this.goal) return;
    const now = new Date(), hour = now.getHours();
    if (hour < this.startHour || hour >= this.endHour) return;
    const start = new Date(now); start.setHours(this.startHour, 0, 0, 0);
    const since = Math.max(this.today.at(-1)?.t ?? 0, start.getTime(), this.lastReminder);
    if (now.getTime() - since < this.interval * 60_000) return;
    this.lastReminder = now.getTime();
    news.announce(L('Waktunya minum', 'Time to drink'), `${this.total} / ${this.goal} ml`);
  }
}
export const water = new Water();

// ---------- Daftar tugas ----------
export interface Task { id: string; text: string; done: boolean; due: number | null; notified: boolean }

class Todo {
  items = $state<Task[]>(load<Task[]>('todo', []));
  constructor() { setInterval(() => this.checkDue(), 20_000); }

  private persist() { save('todo', this.items); }
  get sorted() {
    return [...this.items].sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? Infinity) - (b.due ?? Infinity));
  }
  get open() { return this.items.filter((t) => !t.done).length; }

  add(text: string, due: Date | null = parseDue(text)) {
    const clean = text.trim();
    if (!clean) return;
    this.items = [...this.items, { id: uid(), text: clean, done: false, due: due ? due.getTime() : null, notified: false }];
    this.persist();
  }
  toggle(id: string) { this.items = this.items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)); this.persist(); }
  remove(id: string) { this.items = this.items.filter((t) => t.id !== id); this.persist(); }

  private checkDue() {
    const now = Date.now();
    let changed = false;
    this.items = this.items.map((t) => {
      if (!t.done && !t.notified && t.due && t.due <= now && now - t.due < 6 * 3600_000) {
        changed = true;
        news.announce(t.text, L('Tugas', 'Task'));
        return { ...t, notified: true };
      }
      return t;
    });
    if (changed) this.persist();
  }
}
export const todo = new Todo();

// ---------- Catatan cepat ----------
export interface Note { id: string; text: string; t: number }

class Notes {
  items = $state<Note[]>(load<Note[]>('notes', []));
  add(text: string) {
    const clean = text.trim();
    if (!clean) return;
    this.items = [{ id: uid(), text: clean, t: Date.now() }, ...this.items].slice(0, 100);
    save('notes', this.items);
  }
  remove(id: string) { this.items = this.items.filter((n) => n.id !== id); save('notes', this.items); }
}
export const notes = new Notes();
