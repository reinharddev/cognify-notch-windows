// Waktu dari teks tugas: "jam 7", "pukul 19.30", "14:00", "besok jam 9", "at 5pm".
// Port dari Todo.parseDue versi Mac.
export function parseDue(text: string, now = new Date()): Date | null {
  const lower = text.toLowerCase();
  const m = /(?:jam|pukul|at|@)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm|pagi|siang|sore|malam)?|\b(\d{1,2})[.:](\d{2})\b/.exec(lower);
  if (!m) return null;
  let hour = Number(m[1] ?? m[4]);
  const minute = Number(m[2] ?? m[5] ?? 0);
  if (!(hour < 24) || !(minute < 60)) return null;
  const part = m[3];
  if (part === 'pm' || part === 'sore' || part === 'malam') { if (hour < 12) hour += 12; }
  else if (part === 'siang') { if (hour < 11) hour += 12; }
  else if (part === 'am' || part === 'pagi') { if (hour === 12) hour = 0; }
  const tomorrow = lower.includes('besok') || lower.includes('tomorrow');
  const day = new Date(now);
  if (tomorrow) day.setDate(day.getDate() + 1);
  const at = (h: number) => { const d = new Date(day); d.setHours(h, minute, 0, 0); return d; };
  let date = at(hour);
  // "jam 7" pukul 10 pagi tanpa keterangan pagi/sore = 19.00 hari ini, bukan 07.00 besok.
  if (date < now && !part && hour < 12 && at(hour + 12) > now) date = at(hour + 12);
  if (date < now && !tomorrow) date.setDate(date.getDate() + 1); // jam yang sudah lewat = besok
  return date;
}
