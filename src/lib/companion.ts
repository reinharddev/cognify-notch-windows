import { L } from './i18n';

// Daftar ekspresi, keadaan, dan kejadian teman kecil, dipakai wajah (face.svelte.ts) dan Pengaturan.
// Sama dengan Companion.swift di Mac.

export const EMOTIONS = [
  'idle', 'content', 'happy', 'joy', 'excited', 'love', 'hello',
  'surprised', 'scared', 'curious', 'confused', 'dizzy',
  'suspicious', 'smug', 'bored', 'tired', 'exhausted', 'yawn',
  'worried', 'sad', 'annoyed', 'angry', 'determined',
  'sleepy', 'sleep',
  'sing', 'proud', 'shy', 'cry', 'hot', 'wow', 'bliss',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

const NAMES: Record<Emotion, [string, string]> = {
  idle: ['Biasa', 'Neutral'], content: ['Tenang', 'Content'], happy: ['Senang', 'Happy'], joy: ['Gembira', 'Joyful'],
  excited: ['Semangat', 'Excited'], love: ['Jatuh cinta', 'In love'], hello: ['Menyapa', 'Greeting'],
  surprised: ['Kaget', 'Surprised'], scared: ['Takut', 'Scared'], curious: ['Penasaran', 'Curious'],
  confused: ['Bingung', 'Confused'], dizzy: ['Pusing', 'Dizzy'], suspicious: ['Curiga', 'Suspicious'],
  smug: ['Puas', 'Smug'], bored: ['Bosan', 'Bored'], tired: ['Lelah', 'Tired'], exhausted: ['Kehabisan tenaga', 'Exhausted'],
  yawn: ['Menguap', 'Yawning'], worried: ['Cemas', 'Worried'], sad: ['Sedih', 'Sad'], annoyed: ['Kesal', 'Annoyed'],
  angry: ['Marah', 'Angry'], determined: ['Serius', 'Determined'], sleepy: ['Mengantuk', 'Sleepy'], sleep: ['Tidur', 'Asleep'],
  sing: ['Bernyanyi', 'Singing'], proud: ['Bangga', 'Proud'], shy: ['Malu', 'Shy'], cry: ['Menangis', 'Crying'],
  hot: ['Kepanasan', 'Hot'], wow: ['Takjub', 'Amazed'], bliss: ['Menikmati', 'Enjoying'],
};
export const emotionLabel = (e: Emotion) => L(...NAMES[e]);

export type Mode = 'dynamic' | 'custom' | 'fixed';
export const MODES: { id: Mode; label: () => string; hint: () => string }[] = [
  { id: 'dynamic', label: () => L('Dinamis (acak)', 'Dynamic (random)'), hint: () => L('Mengikuti keadaan, kadang kaget atau iseng sendiri.', 'Follows what is going on, sometimes startled or playful on its own.') },
  { id: 'custom', label: () => L('Per kejadian', 'Per event'), hint: () => L('Kamu menentukan ekspresi tiap keadaan dan kejadian. Tidak ada yang acak.', 'You choose the expression for each situation and event. Nothing is random.') },
  { id: 'fixed', label: () => L('Statis', 'Static'), hint: () => L('Satu ekspresi saja, tidak berubah.', 'One expression that never changes.') },
];

export type SituationId =
  | 'normal' | 'music' | 'focus' | 'rest' | 'offline' | 'batteryLow' | 'batteryCritical' | 'lateNight' | 'morning' | 'uptimeLong' | 'uptimeVeryLong' | 'sleeping' | 'waking'
  | 'charging' | 'chargerFull' | 'unplugged' | 'lowBatteryNotice' | 'audioConnected' | 'downloadDone' | 'downloadFailed' | 'capsLock' | 'inputSource'
  | 'networkUp' | 'networkDown' | 'taskDone' | 'taskFailed' | 'alert'
  | 'volumeUp' | 'volumeDown' | 'muted' | 'brightUp' | 'brightDown';

export interface Situation { id: SituationId; event: boolean; label: [string, string]; emotion: Emotion }
const S = (id: SituationId, event: boolean, id_: string, en: string, emotion: Emotion): Situation => ({ id, event, label: [id_, en], emotion });

export const SITUATIONS: Situation[] = [
  // Keadaan (berlangsung selama kondisinya ada)
  S('normal', false, 'Keadaan biasa', 'Nothing special', 'idle'),
  S('music', false, 'Musik diputar', 'Music playing', 'happy'),
  S('focus', false, 'Pomodoro fokus berjalan', 'Focus Pomodoro running', 'determined'),
  S('rest', false, 'Pomodoro istirahat berjalan', 'Break Pomodoro running', 'content'),
  S('offline', false, 'Internet putus', 'Offline', 'sad'),
  S('batteryLow', false, 'Baterai 20% ke bawah', 'Battery 20% or less', 'tired'),
  S('batteryCritical', false, 'Baterai 10% ke bawah', 'Battery 10% or less', 'worried'),
  S('lateNight', false, 'Larut malam (00.00 sampai 05.00)', 'Late night (12 am to 5 am)', 'sleepy'),
  S('morning', false, 'Pagi (05.00 sampai 09.00)', 'Morning (5 am to 9 am)', 'content'),
  S('uptimeLong', false, 'Windows menyala 5 hari atau lebih', 'Windows on for 5 days or more', 'tired'),
  S('uptimeVeryLong', false, 'Windows menyala 10 hari atau lebih', 'Windows on for 10 days or more', 'exhausted'),
  S('sleeping', false, 'Mouse lama tidak digerakkan', 'Mouse idle for a while', 'sleep'),
  S('waking', false, 'Mouse bergerak lagi', 'Mouse moves again', 'hello'),
  // Kejadian (muncul sebentar)
  S('charging', true, 'Charger dicolok', 'Charger plugged in', 'happy'),
  S('chargerFull', true, 'Baterai penuh', 'Fully charged', 'joy'),
  S('unplugged', true, 'Charger dicabut', 'Charger unplugged', 'worried'),
  S('lowBatteryNotice', true, 'Peringatan baterai lemah', 'Low battery warning', 'scared'),
  S('audioConnected', true, 'Headphone tersambung', 'Headphones connected', 'excited'),
  S('downloadDone', true, 'Unduhan selesai', 'Download finished', 'joy'),
  S('downloadFailed', true, 'Unduhan gagal', 'Download failed', 'sad'),
  S('capsLock', true, 'Caps Lock menyala', 'Caps Lock turned on', 'surprised'),
  S('inputSource', true, 'Bahasa keyboard berganti', 'Keyboard language changed', 'curious'),
  S('networkUp', true, 'Internet kembali', 'Back online', 'happy'),
  S('networkDown', true, 'Internet terputus (kabar)', 'Connection lost (notice)', 'sad'),
  S('taskDone', true, 'Tersimpan atau selesai', 'Saved or done', 'joy'),
  S('taskFailed', true, 'Gagal', 'Failed', 'sad'),
  S('alert', true, 'Pengingat (timer, minum, tugas)', 'Reminder (timer, water, task)', 'excited'),
  S('volumeUp', true, 'Volume dinaikkan', 'Volume turned up', 'wow'),
  S('volumeDown', true, 'Volume diturunkan', 'Volume turned down', 'shy'),
  S('muted', true, 'Suara dibisukan', 'Sound muted', 'sad'),
  S('brightUp', true, 'Layar dicerahkan', 'Screen brightened', 'hot'),
  S('brightDown', true, 'Layar diredupkan', 'Screen dimmed', 'sleepy'),
];

/**
 * Kumpulan ekspresi per keadaan untuk mode Dinamis: wajah berganti-ganti di dalam satu keadaan (musik: bernyanyi,
 * senang, jatuh cinta, dan seterusnya) alih-alih satu ekspresi tetap. Mode lain tetap memakai satu ekspresi.
 * Sama dengan `Companion.pools` di Mac.
 */
export const POOLS: Partial<Record<SituationId, Emotion[]>> = {
  normal: ['idle', 'content', 'curious', 'smug', 'proud', 'idle', 'bored', 'shy'],
  music: ['bliss', 'happy', 'bliss', 'sing', 'content', 'love', 'bliss', 'joy'],
  focus: ['determined', 'suspicious', 'determined', 'content', 'proud'],
  rest: ['content', 'happy', 'sleepy', 'joy', 'yawn'],
  offline: ['sad', 'cry', 'confused', 'worried', 'bored'],
  batteryLow: ['tired', 'worried', 'sad', 'bored', 'sleepy'],
  batteryCritical: ['worried', 'scared', 'exhausted', 'cry', 'scared'],
  lateNight: ['sleepy', 'yawn', 'tired', 'sleepy', 'bored'],
  morning: ['content', 'happy', 'yawn', 'hello', 'proud'],
  uptimeLong: ['tired', 'bored', 'yawn', 'tired', 'hot'],
  uptimeVeryLong: ['exhausted', 'dizzy', 'tired', 'hot', 'cry'],
};

/** Ekspresi berikutnya untuk mode Dinamis: dipilih acak dari kumpulannya, tidak sama dengan yang sedang tampil. */
export function pickPool(cfg: CompanionConfig, id: SituationId, current: Emotion): Emotion | null {
  if (cfg.mode !== 'dynamic') return pickEmotion(cfg, id);
  const pool = POOLS[id];
  if (!pool) return pickEmotion(cfg, id);
  const options = pool.filter((e) => e !== current);
  return options[Math.floor(Math.random() * options.length)] ?? pool[0];
}
export const situationLabel = (s: Situation) => L(...s.label);
const BY_ID = new Map(SITUATIONS.map((s) => [s.id, s]));
export const situationOf = (id: SituationId) => BY_ID.get(id)!;

export interface CompanionConfig {
  mode: Mode;
  fixed: Emotion;
  blink: boolean;
  /** SituationId → 'none' (tidak bereaksi) atau nama ekspresi. Tidak ada = bawaan. */
  map: Record<string, string>;
}

/** Ekspresi untuk satu keadaan atau kejadian; null = tidak bereaksi (hanya kejadian). */
export function pickEmotion(cfg: CompanionConfig, id: SituationId): Emotion | null {
  const s = situationOf(id);
  if (cfg.mode === 'fixed') return cfg.fixed;
  if (cfg.mode === 'dynamic') return s.emotion;
  const v = cfg.map[id];
  if (v === undefined) return s.emotion;
  if (v === 'none') return s.event ? null : 'idle';
  return (EMOTIONS as readonly string[]).includes(v) ? (v as Emotion) : s.emotion;
}

/** Gerakan yang menyertai ekspresi saat muncul karena kejadian. */
export function motionOf(e: Emotion): 'none' | 'shake' | 'bounce' | 'pop' {
  if (e === 'happy' || e === 'joy' || e === 'excited' || e === 'love' || e === 'sing' || e === 'proud') return 'bounce';
  if (e === 'surprised' || e === 'scared' || e === 'angry' || e === 'hot') return 'shake';
  if (e === 'wow') return 'pop';
  if (e === 'hello') return 'pop';
  return 'none';
}
