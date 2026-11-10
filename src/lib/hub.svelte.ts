// Ringkasan dan perintah Cognify lewat folder bersama (protokol: docs/notch/protokol-tautan.md di repo Cognify).
// Membaca cognify-hub.json, mengirim perintah ke inbox/<id>.json, dan mencari lewat results/<id>.json.
// Semua lewat perintah Rust (link_read_hub, link_send, link_take_result) dan hanya selagi Cognify terhubung.
import { cmd, inTauri, windowKind } from './bridge';
import { news } from './news.svelte';
import { L } from './i18n';

export interface Lesson { id: string; title: string; start: string; end: string; room: string | null }
export interface DocRef { id: string; title: string; kind: string }
export interface ToolRef { id: string; name: string }
export interface Hit { id: string; title: string; kind: string; snippet: string }
interface HubData { lessons: Lesson[]; pinned: DocRef[]; recent: DocRef[]; tools: ToolRef[] }

export type Command =
  | { type: 'open'; path: string }
  | { type: 'new_doc'; title?: string; text?: string }
  | { type: 'note_to_doc'; text: string; title?: string }
  | { type: 'new_sticky' }
  | { type: 'tool'; id: string }
  | { type: 'search'; id: string; q: string };

const POLL_MS = 5000;
const SEARCH_LIMIT_MS = 3000;
const SEARCH_POLL_MS = 150;

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Pelajaran yang sedang berlangsung atau berikutnya (belum selesai), dari daftar urut waktu. */
export function currentOrNext(lessons: Lesson[], now: number): { lesson: Lesson; ongoing: boolean } | null {
  for (const lesson of lessons) {
    const start = Date.parse(lesson.start), end = Date.parse(lesson.end);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= now) continue;
    return { lesson, ongoing: start <= now };
  }
  return null;
}

class CognifyHub {
  connected = $state(false);
  data = $state<HubData | null>(null);
  hits = $state<Hit[] | null>(null);
  searching = $state(false);
  private started = false;
  private searchToken = 0;

  /** Hanya jendela notch yang membaca; Pengaturan tidak. */
  start() {
    if (this.started || !inTauri || windowKind !== 'notch') return;
    this.started = true;
    void this.refresh();
    setInterval(() => void this.refresh(), POLL_MS);
  }

  async refresh() {
    const consent = await cmd<{ enabled: boolean }>('link_consent');
    this.connected = consent?.enabled === true;
    this.data = this.connected ? ((await cmd<HubData>('link_read_hub')) ?? null) : null;
    if (!this.connected) this.hits = null;
  }

  /** Tulis satu perintah ke inbox. Mengembalikan true bila berkas tertulis. */
  async send(command: Command, id = newId(command.type)): Promise<boolean> {
    if (!this.connected) return false;
    const r = await cmd('link_send', { id, json: JSON.stringify(command) }).then(() => true, () => false);
    if (!r) news.device(L('Gagal mengirim ke Cognify', 'Couldn\'t send to Cognify'), undefined, 'triangle-alert', '#ff453a');
    return r;
  }

  open(id: string) { return this.send({ type: 'open', path: `/p/${id}` }); }
  tool(id: string) { return this.send({ type: 'tool', id }); }
  newDoc() { return this.send({ type: 'new_doc' }); }
  newSticky() { return this.send({ type: 'new_sticky' }); }

  /** Catatan cepat jadi dokumen; memberi tahu pengguna bila terkirim. */
  async noteToDoc(text: string) {
    if (!text.trim() || !(await this.send({ type: 'note_to_doc', text: text.trim() }))) return false;
    news.device(L('Dikirim ke Cognify', 'Sent to Cognify'), undefined, 'circle-check', '#30d158');
    return true;
  }

  /** Cari dokumen: tulis `search`, lalu tunggu hasilnya paling lama 3 detik. */
  async search(q: string) {
    const query = q.trim().slice(0, 200);
    const token = ++this.searchToken;
    if (!query) { this.hits = null; this.searching = false; return; }
    const id = newId('search');
    this.searching = true;
    if (!(await this.send({ type: 'search', id, q: query }, id))) { this.searching = false; return; }
    const deadline = Date.now() + SEARCH_LIMIT_MS;
    let hits: Hit[] | null = null;
    while (token === this.searchToken && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, SEARCH_POLL_MS));
      hits = (await cmd<Hit[]>('link_take_result', { id })) ?? null;
      if (hits) break;
    }
    if (token !== this.searchToken) return; // pencarian lebih baru sudah berjalan
    this.hits = hits ?? [];
    this.searching = false;
  }
}

export const hub = new CognifyHub();
