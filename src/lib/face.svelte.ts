import { untrack } from 'svelte';
import { cmd, on, windowKind } from './bridge';
import { device, features } from './system.svelte';
import { pomodoro } from './state.svelte';
import { news } from './news.svelte';
import { ui } from './ui.svelte';
import { motionOf, pickEmotion, type CompanionConfig, type Emotion, type SituationId } from './companion';

// Teman kecil di notch, sama dengan versi Mac (Companion.swift): wajah yang ekspresinya menyesuaikan keadaan.
// Saat notch menempel di tepi layar hanya dua mata yang tampil; saat mode pill (mengambang) matanya menjadi kepala
// bulat lengkap dengan mulut. Tiga cara kerja (Pengaturan): dinamis (acak, mengikuti keadaan), per kejadian (ekspresi
// dipilih sendiri, tanpa acak), dan statis (satu ekspresi). Tidur dan bangun diketahui dari Rust (yang membaca posisi
// kursor); arah pandang "ikuti kursor" juga datang dari Rust.

export type { Emotion };
export type Deco = 'none' | 'z' | 'question' | 'bang' | 'sweat' | 'heart' | 'spiral';
export type Reaction = 'none' | 'shake' | 'bounce' | 'pop';

/** top/bot: kelopak atas/bawah menutup 0..1, tilt: kemiringan kelopak (derajat, + = ujung dalam turun), sx/sy: ukuran mata,
 *  skew: mata kanan lebih besar dari kiri, gx/gy: arah pandang, mw/mc/mo: lebar, lengkung, dan buka mulut (mode kepala). */
export interface Pose { top: number; bot: number; tilt: number; sx: number; sy: number; gx: number; gy: number; skew: number; mw: number; mc: number; mo: number; deco: Deco }

const P = (o: Partial<Pose> = {}): Pose => ({ top: 0, bot: 0, tilt: 0, sx: 1, sy: 1, gx: 0, gy: 0, skew: 0, mw: 3.6, mc: 0.9, mo: 0, deco: 'none', ...o });

export const POSES: Record<Emotion, Pose> = {
  idle: P(),
  content: P({ top: 0.35, mc: 2.2 }),
  happy: P({ bot: 0.45, mw: 5, mc: 3.6 }),
  joy: P({ top: 0.1, bot: 0.6, sy: 0.9, mw: 6, mc: 4.5, mo: 2.2 }),
  excited: P({ sx: 1.15, sy: 1.15, mw: 5.4, mc: 3.6, mo: 3.6 }),
  love: P({ mw: 4.5, mc: 3.6, deco: 'heart' }),
  hello: P({ bot: 0.6, mw: 5.5, mc: 4, mo: 1.8 }),
  surprised: P({ sx: 1.2, sy: 1.25, mw: 1.8, mc: 0, mo: 4, deco: 'bang' }),
  scared: P({ top: 0.3, tilt: -14, sx: 1.2, sy: 1.2, mw: 4, mc: -1.8, mo: 2.2, deco: 'sweat' }),
  curious: P({ gx: 2.5, skew: 0.25, mw: 2.7, mc: 0.5 }),
  confused: P({ top: 0.2, tilt: -6, skew: 0.15, mw: 3.2, mc: -1, deco: 'question' }),
  dizzy: P({ mw: 3.6, mc: 0, mo: 1.4, deco: 'spiral' }),
  suspicious: P({ top: 0.45, bot: 0.3, gx: 3, mw: 3.2, mc: -0.5 }),
  smug: P({ top: 0.35, tilt: -4, mw: 4.5, mc: 1.4 }),
  bored: P({ top: 0.55, gy: 1.5, mw: 3.6, mc: -0.5 }),
  tired: P({ top: 0.6, gy: 1.5, mw: 3.6, mc: -1 }),
  exhausted: P({ top: 0.8, tilt: -6, gy: 2, mw: 3.2, mc: -1.5, mo: 1.5, deco: 'sweat' }),
  yawn: P({ top: 0.85, mw: 4.5, mc: 0, mo: 5.5 }),
  worried: P({ top: 0.35, tilt: -14, mw: 3.6, mc: -1.8, deco: 'sweat' }),
  sad: P({ top: 0.4, tilt: -18, mw: 4, mc: -2.7 }),
  annoyed: P({ top: 0.5, tilt: 10, mw: 3.6, mc: -1 }),
  angry: P({ top: 0.45, tilt: 22, mw: 4.5, mc: -2.7, mo: 1.4 }),
  determined: P({ top: 0.4, tilt: 14, mw: 4.5, mc: -0.5 }),
  sleepy: P({ top: 0.75, mw: 2.7, mc: 0, mo: 0.9 }),
  sleep: P({ top: 1, mw: 2.2, mc: 0.9, deco: 'z' }),
};

type Step = [Emotion, number, Reaction];
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const wait = (s: number) => new Promise<void>((r) => setTimeout(r, s * 1000));

class Face {
  emotion = $state<Emotion>('idle');
  blink = $state(0);
  wink = $state(0);
  /** Sedang berkedip: kelopak menutup cepat lalu membuka pelan, tanpa pantulan. */
  blinkPhase = $state<'none' | 'close' | 'open'>('none');
  glance = $state({ x: 0, y: 0 });
  /** Arah pandang dari Rust, hanya bila "ikuti kursor" menyala. */
  look = $state({ x: 0, y: 0 });
  rx = $state<Reaction>('none');
  /** Naik tiap reaksi baru supaya animasinya diputar ulang. */
  rxKey = $state(0);

  private base: Emotion = 'idle';
  private sleeping = false;
  private holding = false;
  private seq = 0;
  private timer = 0;
  private neutral: Emotion = 'idle';
  private neutralUntil = 0;
  private uptime = 0;
  /** Reaksi pada kabar menunggu kartunya hilang: di Windows kartu menggantikan seluruh pill. */
  private pending: Step[] | null = null;

  private get cfg(): CompanionConfig {
    return { mode: ui.companionMode, fixed: ui.companionFixed, blink: ui.companionBlink, map: ui.companionMap };
  }

  constructor() {
    if (windowKind !== 'notch') return;
    on<null>('eyes-sleep', () => this.sleep());
    on<null>('eyes-wake', () => this.wake());
    on<[number, number]>('eye-look', ([x, y]) => { this.look = { x, y }; });
    void cmd<number>('uptime_days').then((d) => { this.uptime = d ?? 0; });
    $effect.root(() => {
      $effect(() => {
        const n = news.current;
        untrack(() => { if (n && features.companion) this.reactToNews(n.icon, n.title); });
      });
      $effect(() => {
        const a = news.alert;
        untrack(() => { if (a && features.companion) this.reactToSituation('alert'); });
      });
      // Kartu selesai: tampilkan reaksi yang tertunda.
      $effect(() => {
        const showing = !!news.current || !!news.alert || !!news.level;
        untrack(() => {
          if (!showing && this.pending) { const steps = this.pending; this.pending = null; void this.play(steps); }
        });
      });
      // Pilihan wajah berubah di Pengaturan: terapkan segera.
      $effect(() => {
        void [ui.companionMode, ui.companionFixed, ui.companionBlink, JSON.stringify(ui.companionMap)];
        untrack(() => this.configChanged());
      });
    });
  }

  // MARK: Perintah

  private configChanged() {
    this.seq++;
    this.holding = false;
    this.sleeping = false;
    this.pending = null;
    this.tick(false);
  }

  sleep() {
    if (this.sleeping || this.cfg.mode === 'fixed') return;
    this.seq++;
    this.holding = false;
    this.sleeping = true;
    this.base = pickEmotion(this.cfg, 'sleeping') ?? 'sleep';
    this.emotion = this.base;
  }

  /** Mouse bergerak lagi: kalau tertidur, bangun dan menyapa. */
  wake() {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.base = 'idle';
    const hello = pickEmotion(this.cfg, 'waking');
    if (hello) void this.play([[hello, 1.6, motionOf(hello)]]);
    else this.emotion = this.base;
  }

  react(kind: Reaction) {
    this.rx = kind;
    this.rxKey++;
  }

  async play(steps: Step[]) {
    const id = ++this.seq;
    this.holding = true;
    for (const [emotion, seconds, kind] of steps) {
      if (id !== this.seq) return;
      this.emotion = emotion;
      if (kind !== 'none') this.react(kind);
      await wait(seconds);
    }
    if (id !== this.seq) return;
    this.holding = false;
    this.emotion = this.base;
  }

  /** Reaksi pada kabar: bila kartu sedang tampil, ditunda sampai kartu hilang. */
  private queue(steps: Step[]) {
    if (news.current || news.alert || news.level) this.pending = steps;
    else void this.play(steps);
  }

  /** Kedip halus: menutup 110 ms, tertahan sebentar, membuka 260 ms (lihat Eyes.svelte). */
  async blinkOnce() {
    if (this.holding || this.sleeping || !this.cfg.blink || this.emotion === 'sleep') return;
    this.blinkPhase = 'close';
    this.blink = 1;
    await wait(0.17);
    this.blinkPhase = 'open';
    this.blink = 0;
    await wait(0.3);
    this.blinkPhase = 'none';
  }

  async winkOnce() {
    if (this.holding || this.sleeping || this.emotion === 'sleep') return;
    this.blinkPhase = 'close';
    this.wink = 1;
    await wait(0.42);
    this.blinkPhase = 'open';
    this.wink = 0;
    await wait(0.3);
    this.blinkPhase = 'none';
  }

  async lookAround() {
    if (this.holding || this.sleeping || this.emotion === 'sleep') return;
    this.glance = { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 3 };
    await wait(1.2 + Math.random() * 1.2);
    this.glance = { x: 0, y: 0 };
  }

  // MARK: Suasana hati

  /** Keadaan yang paling mendesak sekarang. */
  private state(): SituationId {
    const hour = new Date().getHours();
    const p = device.power;
    if (p && !p.plugged) {
      if (p.percent <= 10) return 'batteryCritical';
      if (p.percent <= 20) return 'batteryLow';
    }
    if (pomodoro.running && pomodoro.mode === 'focus') return 'focus';
    if (pomodoro.running) return 'rest';
    if (!device.online) return 'offline';
    if (device.media?.playing) return 'music';
    if (hour < 5) return 'lateNight';
    if (this.uptime >= 10) return 'uptimeVeryLong';
    if (this.uptime >= 5) return 'uptimeLong';
    if (hour >= 5 && hour < 9) return 'morning';
    return 'normal';
  }

  /** Dipanggil tiap 5 sampai 10 detik. `flavor` false: hanya menyegarkan suasana (tanpa iseng). */
  private tick(flavor = true) {
    if (!features.companion) return;
    const cfg = this.cfg;
    if (cfg.mode === 'fixed') {
      if (this.base !== cfg.fixed || this.emotion !== cfg.fixed) { this.base = cfg.fixed; this.emotion = cfg.fixed; }
      if (flavor) void this.blinkOnce();
      return;
    }
    if (this.sleeping || this.holding) return;
    const s = this.state();
    let next = pickEmotion(cfg, s) ?? 'idle';
    if (s === 'normal' && cfg.mode === 'dynamic') {
      // Tidak ada yang istimewa: ganti-ganti santai tiap satu-dua menit.
      if (Date.now() > this.neutralUntil) {
        this.neutral = pick<Emotion>(['idle', 'idle', 'content', 'curious', 'smug']);
        this.neutralUntil = Date.now() + (45 + Math.random() * 55) * 1000;
      }
      next = this.neutral;
    }
    if (next !== this.base || this.emotion !== next) { this.base = next; this.emotion = next; }
    if (!flavor) return;
    if (cfg.mode !== 'dynamic') { void this.blinkOnce(); return; }
    const hour = new Date().getHours();
    const r = Math.random();
    if (r < 0.12) void this.lookAround();
    else if (r < 0.19) { if (this.base !== 'exhausted') void this.winkOnce(); }
    else if (r < 0.23) void this.play([['surprised', 1, 'shake']]); // kaget tanpa sebab
    else if (r < 0.27 && (this.uptime >= 3 || hour < 5)) void this.play([['yawn', 2.4, 'none']]);
    else if (r < 0.31 && device.media?.playing) void this.play([['love', 2.5, 'bounce']]);
    else if (r < 0.34) void this.play([['smug', 2, 'none']]);
    else if (r < 0.355) void this.play([['dizzy', 2, 'none']]);
    else void this.blinkOnce();
  }

  // MARK: Reaksi pada kabar

  /** Kabar muncul. Dinamis: kadang kaget dulu, kadang biasa saja. Per kejadian: persis ekspresi pilihan user. */
  private reactToSituation(id: SituationId) {
    const cfg = this.cfg;
    if (cfg.mode === 'fixed') return;
    const chosen = pickEmotion(cfg, id);
    if (!chosen) return;
    const long = id === 'lowBatteryNotice' ? 4.5 : 2.6;
    const steps: Step[] = [];
    if (cfg.mode === 'dynamic') {
      if (id === 'alert') {
        this.queue(Math.random() < 0.5 ? [['surprised', 0.9, 'shake'], [chosen, 1.6, motionOf(chosen)]] : [[chosen, 2, motionOf(chosen)]]);
        return;
      }
      if (Math.random() < 0.5) steps.push(['surprised', 0.7, 'shake']);
      let e = chosen;
      if (id === 'audioConnected') e = pick<Emotion>(['excited', 'love']);
      else if (id === 'downloadFailed' || id === 'taskFailed') e = pick<Emotion>(['angry', 'sad']);
      steps.push([e, long, motionOf(e)]);
    } else {
      steps.push([chosen, long, motionOf(chosen)]);
    }
    this.queue(steps);
  }

  /** Mengenali jenis kabar dari ikon dan judulnya. */
  private reactToNews(icon: string, title: string) {
    const t = title.toLowerCase();
    const download = /unduh|download/.test(t);
    const low = /lemah|low/.test(t);
    const full = /penuh|fully/.test(t);
    let id: SituationId | null;
    if (icon === 'zap') id = full ? 'chargerFull' : 'charging';
    else if (icon === 'battery-low' || icon === 'battery-warning') id = low ? 'lowBatteryNotice' : 'unplugged';
    else if (icon.startsWith('battery')) id = 'unplugged';
    else if (icon === 'wifi') id = 'networkUp';
    else if (icon === 'wifi-off') id = 'networkDown';
    else if (icon === 'headphones') id = 'audioConnected';
    else if (icon === 'caps-on') id = 'capsLock';
    else if (icon === 'caps-off') id = null;
    else if (icon === 'keyboard') id = 'inputSource';
    else if (icon === 'circle-check') id = download ? 'downloadDone' : 'taskDone';
    else if (icon === 'circle-x' || icon === 'triangle-alert') id = download ? 'downloadFailed' : 'taskFailed';
    else id = 'alert';
    if (id) this.reactToSituation(id);
  }

  /** Mulai berkedip dan berganti suasana (dipanggil saat wajah tampil); mengembalikan fungsi untuk berhenti. */
  start() {
    const step = () => {
      this.tick();
      this.timer = window.setTimeout(step, 5000 + Math.random() * 5000);
    };
    this.timer = window.setTimeout(step, 2500 + Math.random() * 3000);
    return () => clearTimeout(this.timer);
  }
}
export const face = new Face();
