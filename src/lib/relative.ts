import { L, lang } from './i18n';

// Format waktu yang sama dengan Mac (`Relative` di Model.swift): "15 menit lagi", "Hari ini 14.00", "Besok", "Sen 29 Sep 10.00".
const loc = () => (lang === 'en' ? 'en-US' : 'id-ID');
const pad = (n: number) => String(n).padStart(2, '0');

export const timeText = (d: Date) => {
  if (lang === 'id') return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};
export const dayText = (d: Date) => {
  const wd = new Intl.DateTimeFormat(loc(), { weekday: 'short' }).format(d);
  const mo = new Intl.DateTimeFormat(loc(), { month: 'short' }).format(d);
  return lang === 'id' ? `${wd} ${d.getDate()} ${mo}` : `${wd} ${mo} ${d.getDate()}`;
};
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Teks jam di header: "Kam 22 Okt  19.03" (id) atau "Thu Oct 22  7:03 PM" (en). */
export const headerStamp = (ms: number) => `${dayText(new Date(ms))}  ${timeText(new Date(ms))}`;

export function relativeLong(dueMs: number, allDay: boolean, nowMs: number): string {
  const due = new Date(dueMs), now = new Date(nowMs);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  if (allDay) {
    if (sameDay(due, now)) return L('Hari ini', 'Today');
    if (sameDay(due, tomorrow)) return L('Besok', 'Tomorrow');
    return dayText(due);
  }
  const minutes = Math.trunc((dueMs - nowMs) / 60000);
  if (minutes < 1) return L('Sekarang', 'Now');
  if (minutes < 60) return L(`${minutes} menit lagi`, `in ${minutes} min`);
  if (minutes < 6 * 60) return L(`${Math.trunc(minutes / 60)} jam lagi`, `in ${Math.trunc(minutes / 60)} h`);
  if (sameDay(due, now)) return `${L('Hari ini', 'Today')} ${timeText(due)}`;
  if (sameDay(due, tomorrow)) return `${L('Besok', 'Tomorrow')} ${timeText(due)}`;
  return `${dayText(due)} ${timeText(due)}`;
}

/** Untuk sayap notch: "15m", "1j". */
export function relativeShort(dueMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.trunc((dueMs - nowMs) / 60000));
  return minutes < 60 ? `${minutes}m` : `${Math.trunc(minutes / 60)}${L('j', 'h')}`;
}

/** Tanggal catatan: "Hari ini 19.03" atau "Sen 29 Sep, 10.00". */
export function noteStamp(ms: number): string {
  const d = new Date(ms);
  return sameDay(d, new Date()) ? `${L('Hari ini', 'Today')} ${timeText(d)}` : `${dayText(d)}, ${timeText(d)}`;
}
