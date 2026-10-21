// Lirik tersinkron dari LRCLIB (lrclib.net). Yang dikirim hanya judul, artis, album, dan durasi,
// dan hanya saat halaman Musik terbuka. Hasil disimpan di PC ini, jadi lagu yang sama tidak diminta dua kali.
import { load, save } from './store.svelte';
import type { MediaInfo } from './system.svelte';

export interface Line { time: number; text: string }
export type LyricsState =
  | { kind: 'idle' | 'loading' | 'instrumental' | 'missing' | 'failed' }
  | { kind: 'synced'; lines: Line[] }
  | { kind: 'plain'; text: string };

interface Rec { syncedLyrics?: string | null; plainLyrics?: string | null; instrumental?: boolean; duration?: number }

export function parseLrc(lrc: string): Line[] {
  const out: Line[] = [];
  for (const row of lrc.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = row.slice(stamps[stamps.length - 1].index! + stamps[stamps.length - 1][0].length).trim();
    for (const m of stamps) out.push({ time: Number(m[1]) * 60 + Number(m[2]), text });
  }
  return out.sort((a, b) => a.time - b.time);
}

function stateOf(r: Rec): LyricsState {
  if (r.instrumental) return { kind: 'instrumental' };
  if (r.syncedLyrics) { const lines = parseLrc(r.syncedLyrics); if (lines.length) return { kind: 'synced', lines }; }
  if (r.plainLyrics?.trim()) return { kind: 'plain', text: r.plainLyrics.trim() };
  return { kind: 'missing' };
}

const get = async <T>(url: string): Promise<T | null> => {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
};

async function fetchLyrics(song: MediaInfo): Promise<LyricsState> {
  const cacheKey = `lyrics.${(song.title + '|' + song.artist).toLowerCase()}`;
  const cached = load<Rec | 0 | null>(cacheKey, null);
  if (cached === 0) return { kind: 'missing' };
  if (cached) return stateOf(cached);
  try {
    const q = new URLSearchParams({ track_name: song.title, artist_name: song.artist });
    if (song.album) q.set('album_name', song.album);
    if (song.duration > 0) q.set('duration', String(Math.round(song.duration)));
    const exact = await get<Rec>(`https://lrclib.net/api/get?${q}`);
    if (exact && (exact.syncedLyrics || exact.plainLyrics || exact.instrumental)) { save(cacheKey, exact); return stateOf(exact); }
    const found = (await get<Rec[]>(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: song.title, artist_name: song.artist })}`)) ?? [];
    const target = song.duration || 0;
    const best = found.filter((r) => r.syncedLyrics || r.plainLyrics)
      .sort((a, b) => (Math.abs((a.duration ?? target) - target) + (a.syncedLyrics ? 0 : 1000)) - (Math.abs((b.duration ?? target) - target) + (b.syncedLyrics ? 0 : 1000)))[0];
    if (best && (!target || Math.abs((best.duration ?? target) - target) < 8)) { save(cacheKey, best); return stateOf(best); }
    save(cacheKey, 0);
    return { kind: 'missing' };
  } catch {
    return { kind: 'failed' };
  }
}

class Lyrics {
  state = $state<LyricsState>({ kind: 'idle' });
  private key = '';
  private token = 0;

  loadFor(song: MediaInfo | null) {
    if (!song?.title) { this.key = ''; this.token++; this.state = { kind: 'idle' }; return; }
    const next = [song.title, song.artist, song.album].join('\u001f');
    if (next === this.key) return;
    this.key = next;
    const mine = ++this.token;
    this.state = { kind: 'loading' };
    void fetchLyrics(song).then((s) => { if (mine === this.token) this.state = s; });
  }
}
export const lyrics = new Lyrics();
