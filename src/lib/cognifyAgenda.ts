// Agenda dari kalender Cognify (cognify-agenda.json, ditulis Cognify selagi terhubung ke Notch).
// Satu elemen yang rusak dilewati tanpa membuang yang lain; bentuk yang tidak dikenal menghasilkan daftar kosong.
import type { AgendaEvent } from './ics';

export function parseCognifyAgenda(json: string, from: number, to: number): AgendaEvent[] {
  let data: unknown;
  try { data = JSON.parse(json); } catch { return []; }
  const list = (data as { events?: unknown })?.events;
  if (!Array.isArray(list)) return [];
  const out: AgendaEvent[] = [];
  for (const raw of list) {
    const e = raw as Record<string, unknown> | null;
    if (!e || typeof e.id !== 'string' || typeof e.title !== 'string' || typeof e.start !== 'string') continue;
    const start = Date.parse(e.start);
    if (Number.isNaN(start)) continue;
    const end = typeof e.end === 'string' && !Number.isNaN(Date.parse(e.end)) ? Date.parse(e.end) : null;
    if ((end ?? start) < from || start > to) continue;
    out.push({ id: `cognify:${e.id}`, title: e.title, start, end, allDay: e.allDay === true, meeting: null });
  }
  return out;
}
