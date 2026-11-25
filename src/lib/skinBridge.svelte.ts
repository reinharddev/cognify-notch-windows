import { listen } from '@tauri-apps/api/event';
import { cmd, inTauri, windowKind } from './bridge';
import { BeatTracker } from './beat';
import { agenda } from './agenda.svelte';
import { device, features } from './system.svelte';
import { lyrics } from './lyrics.svelte';
import { news } from './news.svelte';
import { notch } from './notch.svelte';
import { weather } from './weather.svelte';
import { clockTools, notes, todo, water } from './state.svelte';
import type { SkinInfo } from './skins.svelte';

// Jembatan dari jendela Notch ke skin desktop (lihat skins.rs): data (sama dengan `payload()` di Skins.swift di Mac), irama lagu,
// kursor di atas notch, dan notifikasi. Skin ada di jendela lain tanpa akses ke data ini; semuanya dikirim lewat Rust.
// Tidak ada yang berjalan selama tidak ada skin yang menyala.

class SkinBridge {
  /** Skin yang sedang menyala (diperbarui Rust lewat `skins-changed`). */
  active = $state<SkinInfo[]>([]);
  private timer = 0;
  private audioFrame = 0;

  constructor() {
    if (!inTauri || windowKind !== 'notch') return;
    void this.refresh();
    void listen('skins-changed', () => void this.refresh());
    void listen('skins-need-data', () => this.push());

    $effect.root(() => {
      // Data berubah: kirim ulang (ditunda 250 ms seperti di Mac supaya perubahan beruntun jadi satu kiriman).
      $effect(() => {
        if (!this.active.length) return;
        this.build(); // dibaca di sini supaya efek ini ikut berubah bersama datanya
        clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.push(), 250);
      });
      // Lirik untuk skin: dimuat selama ada skin dan lagu diputar (di Mac lirik dimuat model; di sini dimuat sesuai kebutuhan).
      $effect(() => {
        if (this.active.length && features.lyrics && device.media?.playing) lyrics.loadFor(device.media);
      });
      // Kursor masuk atau keluar notch, untuk skin dengan "notch": true.
      $effect(() => {
        const inside = notch.hoverState;
        if (this.active.some((s) => s.notch)) void cmd('skins_hover', { inside });
      });
      // Notifikasi: kabar perangkat, pengingat, dan notifikasi lain yang muncul di notch.
      let lastNotice = '';
      $effect(() => {
        const key = news.current ? `c${news.current.id}` : news.alert ? `a${news.alert.id}` : '';
        if (key && key !== lastNotice && this.active.some((s) => s.notch)) void cmd('skins_notice');
        lastNotice = key;
      });
      // Irama lagu ±15 kali per detik hanya selama musik diputar dan ada skin berpermintaan audio.
      $effect(() => {
        const need = this.active.some((s) => s.audio) && !!device.media?.playing && features.media;
        if (!need) { this.stopAudio(); return; }
        this.startAudio();
        return () => this.stopAudio();
      });
    });
  }

  async refresh() {
    const s = await cmd<{ skins: SkinInfo[]; enabled: string[] }>('skins_state');
    if (s) this.active = s.skins.filter((i) => s.enabled.includes(i.id));
  }

  /** Satu objek data, bentuknya sama dengan payload Mac: media, lyrics, weather, water, events, todos, timers, notes. */
  build(): Record<string, unknown> {
    const now = Date.now();
    const d: Record<string, unknown> = { now };
    const m = device.media;
    if (m) {
      d.media = {
        title: m.title, artist: m.artist ?? '', album: m.album ?? '', playing: m.playing,
        duration: m.duration || null, position: m.position + (m.playing ? (now - device.mediaAt) / 1000 : 0), rate: 1, sentAt: now,
      };
    }
    const ls = lyrics.state;
    if (ls.kind === 'synced') d.lyrics = { state: 'synced', lines: ls.lines.map((l) => ({ t: l.time, text: l.text, reading: l.reading ?? '' })) };
    else if (ls.kind === 'plain') d.lyrics = { state: 'plain', text: ls.text };
    else if (ls.kind === 'loading') d.lyrics = { state: 'loading' };
    else if (ls.kind === 'instrumental') d.lyrics = { state: 'instrumental' };
    else d.lyrics = { state: 'none' };
    const w = weather.now;
    if (w) d.weather = { tempC: w.temp, code: w.code, place: w.place };
    const start = new Date().setHours(0, 0, 0, 0);
    d.water = { goalMl: water.goal, todayMl: water.sips.filter((x) => x.t >= start).reduce((a, x) => a + x.ml, 0) };
    d.events = [...agenda.events].sort((a, b) => a.start - b.start).map((e) => ({
      title: e.title, start: e.start, end: e.end ?? null, allDay: !!e.allDay, calendar: e.calendar ?? '', isTask: false,
    }));
    d.todos = todo.items.map((t) => ({ title: t.text, done: t.done, due: t.due ?? null }));
    d.timers = clockTools.countdowns.map((c) => ({ title: c.label, end: c.end, total: c.total * 1000 }));
    d.notes = notes.items.slice(0, 8).map((n) => ({ text: n.text.slice(0, 240), date: n.t }));
    return d;
  }

  push() {
    if (!this.active.length) return;
    void cmd('skins_push', { json: JSON.stringify(this.build()) });
  }

  // ---- Irama ----

  private startAudio() {
    if (this.audioFrame) return;
    const tracker = new BeatTracker();
    let last = 0, prevLevel = -1, levelAt = 0;
    const step = (ms: number) => {
      this.audioFrame = requestAnimationFrame(step);
      const t = ms / 1000;
      if (t - last < 1 / 15 - 0.004) return;
      last = t;
      const level = device.level;
      if (level !== prevLevel) { prevLevel = level; levelAt = t; }
      if (t - levelAt < 1.5 && level > 0.01) tracker.feed(level, t); else tracker.feedSteady(t);
      void cmd('skins_audio', { energy: tracker.energy, beats: tracker.beats, period: tracker.period, on: tracker.audible });
    };
    this.audioFrame = requestAnimationFrame(step);
  }

  private stopAudio() {
    if (!this.audioFrame) return;
    cancelAnimationFrame(this.audioFrame);
    this.audioFrame = 0;
    void cmd('skins_audio', { energy: 0, beats: 0, period: 0.6, on: false });
  }
}
export const skinBridge = new SkinBridge();
