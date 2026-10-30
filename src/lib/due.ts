// Waktu dari teks tugas. Port dari Todo.parseDue versi Mac.
// Jam: "jam 7", "pukul 19.30", "14:00", "at 5pm". Tanggal (tanpa jam = pukul 09.00):
// 25/10/2026, 25-10-2026, 25.10.2026, 25/10 (tahun ini; 2 bagian hanya dengan garis miring), 25 oktober 2026, 25 okt,
// oct 25 2026, "tgl 25", "bulan oktober", "tahun 2027", hari ini/besok/lusa, nama hari, minggu/bulan/tahun depan.
// Tanggal D atau DD, bulan M atau MM atau nama, tahun harus 4 angka. Tanpa tahun: tahun ini, atau tahun depan bila sudah lewat.

const MONTHS: Record<string, number> = {
  januari: 1, january: 1, jan: 1, februari: 2, pebruari: 2, february: 2, feb: 2, maret: 3, march: 3, mar: 3, april: 4, apr: 4,
  mei: 5, may: 5, juni: 6, june: 6, jun: 6, juli: 7, july: 7, jul: 7, agustus: 8, august: 8, agu: 8, agt: 8, aug: 8,
  september: 9, sept: 9, sep: 9, oktober: 10, october: 10, okt: 10, oct: 10, november: 11, nopember: 11, nov: 11,
  desember: 12, december: 12, des: 12, dec: 12,
};
const WEEKDAYS: Record<string, number> = {
  minggu: 0, ahad: 0, sunday: 0, senin: 1, monday: 1, selasa: 2, tuesday: 2, rabu: 3, wednesday: 3, kamis: 4, thursday: 4,
  jumat: 5, "jum'at": 5, jumaat: 5, friday: 5, sabtu: 6, saturday: 6,
};
const alt = (o: Record<string, number>) => Object.keys(o).sort((a, b) => b.length - a.length).join('|');
const NAMES = alt(MONTHS);
const DAYS = alt(WEEKDAYS);

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Tanggal dari teks (huruf kecil); mengembalikan tanggalnya dan teks tanpa bagian yang dikenali. */
export function parseDay(text: string, now: Date): { date: Date; weekday: boolean; rest: string } | null {
  const today = startOfDay(now);
  const thisYear = now.getFullYear();
  const make = (d: number, m: number, y?: number): Date | null => {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const date = new Date(y ?? thisYear, m - 1, d);
    if (date.getDate() !== d) return null; // 31 Februari tidak ada
    if (y === undefined && date < today) { const n = new Date(thisYear + 1, m - 1, d); return n.getDate() === d ? n : null; }
    return date;
  };
  const hit = (re: RegExp, date: Date | null, m: RegExpExecArray, weekday = false) =>
    date ? { date, weekday, rest: text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length) } : null;
  const num = (s?: string) => (s === undefined ? undefined : Number(s));
  let m: RegExpExecArray | null;
  let r: ReturnType<typeof hit>;

  // 25/10/2026, 25-10-2026, 25.10.2026, 25/10 ("bab 1-2" dan "14.30" bukan tanggal)
  m = /(?<![\d/.\-:])(\d{1,2})([/\-.])(\d{1,2})(?:\2(\d{4}))?(?![\d:])/.exec(text);
  if (m && (m[4] !== undefined || m[2] === '/') && (r = hit(m as never, make(Number(m[1]), Number(m[3]), num(m[4])), m))) return r;
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${NAMES})\\b(?:\\s+(\\d{4})\\b)?`).exec(text);
  if (m && (r = hit(m as never, make(Number(m[1]), MONTHS[m[2]], num(m[3])), m))) return r;
  m = new RegExp(`\\b(${NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4})\\b)?`).exec(text);
  if (m && (r = hit(m as never, make(Number(m[2]), MONTHS[m[1]], num(m[3])), m))) return r;
  m = /\b(?:minggu depan|next week)\b/.exec(text);
  if (m) return hit(m as never, addDays(today, 7), m);
  m = /\b(?:bulan depan|next month)\b/.exec(text);
  if (m) { const d = new Date(today); d.setMonth(d.getMonth() + 1); return hit(m as never, d, m); }
  m = /\b(?:tahun depan|next year)\b/.exec(text);
  if (m) { const d = new Date(today); d.setFullYear(d.getFullYear() + 1); return hit(m as never, d, m); }
  m = /\b(?:tahun|year)\s+(\d{4})\b/.exec(text);
  if (m && Number(m[1]) >= thisYear) return hit(m as never, Number(m[1]) === thisYear ? today : new Date(Number(m[1]), 0, 1), m);
  m = new RegExp(`\\b(?:bulan|month|in)\\s+(${NAMES})\\b`).exec(text);
  if (m) {
    const mo = MONTHS[m[1]];
    if (r = hit(m as never, mo === now.getMonth() + 1 ? today : make(1, mo), m)) return r;
  }
  m = /\b(?:tgl|tanggal|date)\.?\s*(\d{1,2})\b(?![/.:\-]\d)/.exec(text);
  if (m) {
    const d = Number(m[1]);
    let date = make(d, now.getMonth() + 1, thisYear);
    if (date && date < today) { const n = new Date(thisYear, now.getMonth() + 1, d); date = n.getDate() === d ? n : null; }
    if (r = hit(m as never, date, m)) return r;
  }
  m = /\b(?:lusa|day after tomorrow)\b/.exec(text);
  if (m) return hit(m as never, addDays(today, 2), m);
  m = /\b(?:besok|tomorrow)\b/.exec(text);
  if (m) return hit(m as never, addDays(today, 1), m);
  m = /\b(?:hari ini|today)\b/.exec(text);
  if (m) return hit(m as never, today, m);
  m = new RegExp(`\\b(?:hari\\s+)?(${DAYS})\\b(?!\\s+(?:ini|lalu|depan))`).exec(text);
  if (m) return hit(m as never, addDays(today, (WEEKDAYS[m[1]] - now.getDay() + 7) % 7), m, true);
  return null;
}

export function parseDue(text: string, now = new Date()): Date | null {
  const parsed = parseDay(text.toLowerCase(), now);
  const lower = parsed ? parsed.rest : text.toLowerCase();
  const m = /(?:\b(?:jam|pukul|at)|@)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm|pagi|siang|sore|malam)?|\b(\d{1,2})[.:](\d{2})\b/.exec(lower);
  let hour = 9, minute = 0;
  let part: string | undefined;
  if (m) {
    hour = Number(m[1] ?? m[4]);
    minute = Number(m[2] ?? m[5] ?? 0);
    if (!(hour < 24) || !(minute < 60)) return null;
    part = m[3];
    if (part === 'pm' || part === 'sore' || part === 'malam') { if (hour < 12) hour += 12; }
    else if (part === 'siang') { if (hour < 11) hour += 12; }
    else if (part === 'am' || part === 'pagi') { if (hour === 12) hour = 0; }
  } else if (!parsed) return null;

  const day = parsed ? parsed.date : now;
  const at = (h: number) => { const d = new Date(day); d.setHours(h, minute, 0, 0); return d; };
  const date = at(hour);
  if (date >= now) return date;
  const isToday = startOfDay(day).getTime() === startOfDay(now).getTime();
  // "jam 7" pukul 10 pagi tanpa keterangan pagi/sore = 19.00 hari ini, bukan 07.00 besok.
  if (m && !part && hour < 12 && isToday && at(hour + 12) > now) return at(hour + 12);
  if (parsed?.weekday) return addDays(date, 7);
  if (!parsed && m) return addDays(date, 1); // hanya jam ("jam 7") yang sudah lewat = besok
  return null; // tanggal atau hari ini yang jamnya sudah lewat: tanpa pengingat
}
