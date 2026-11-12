/** Aturan kapan alarm berbunyi; sama dengan AlarmSchedule.swift di Notch Mac. Murni, tanpa tampilan. */
export interface Alarm { id: string; hour: number; minute: number; days: number[]; label: string; enabled: boolean; firedOn: string }

/** Jendela toleransi (menit) untuk alarm yang terlambat, mis. komputer baru bangun dari tidur. */
export const ALARM_GRACE = 10;

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `days` memakai Date.getDay() + 1 (1 Minggu sampai 7 Sabtu), sama dengan Calendar.weekday di Mac; kosong = sekali. */
export function isDue(a: Alarm, now: Date, grace = ALARM_GRACE): boolean {
  if (!a.enabled || a.firedOn === dayKey(now)) return false;
  if (a.days.length && !a.days.includes(now.getDay() + 1)) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const at = a.hour * 60 + a.minute;
  return nowMin >= at && nowMin < at + grace;
}
