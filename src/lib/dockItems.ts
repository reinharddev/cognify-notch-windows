// Logika murni dock: menyusun ikon dari aplikasi yang disematkan dan jendela yang sedang terbuka.
// Tidak bergantung pada Tauri atau Svelte, supaya mudah diuji.

export type DockWindow = { id: number; title: string; exe: string; name: string; active: boolean };
export type Pin = { exe: string; name: string };

export type DockItem = {
  /** Kunci stabil (jalur program huruf kecil), untuk daftar bergilir di Svelte. */
  key: string;
  exe: string;
  name: string;
  pinned: boolean;
  /** Jendela terbuka milik aplikasi ini; kosong bila hanya disematkan. */
  windows: DockWindow[];
  active: boolean;
};

export const keyOf = (exe: string) => exe.toLowerCase();

/**
 * Susunan dock: aplikasi yang disematkan dulu (urutan sematan), lalu aplikasi lain yang sedang terbuka
 * menurut urutan pertama kali terlihat. Urutan Windows mengikuti tumpukan jendela dan berubah tiap
 * pindah fokus, jadi urutan ikon diingat di `seen` supaya ikon tidak berpindah tempat sendiri.
 *
 * Mengembalikan item dan `seen` yang diperbarui (simpan, lalu berikan lagi pada panggilan berikutnya).
 */
export function buildItems(pins: Pin[], windows: DockWindow[], seen: string[]): { items: DockItem[]; seen: string[] } {
  const pinKeys = new Set(pins.map((p) => keyOf(p.exe)));
  const byKey = new Map<string, DockWindow[]>();
  for (const w of windows) {
    const k = keyOf(w.exe);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(w);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.id - b.id);

  // Pendatang baru ditambahkan di belakang, berurutan menurut nama supaya hasilnya pasti.
  const known = new Set(seen);
  const arrivals = [...byKey.keys()].filter((k) => !known.has(k) && !pinKeys.has(k)).sort((a, b) => (byKey.get(a)![0].name.localeCompare(byKey.get(b)![0].name)));
  const nextSeen = [...seen.filter((k) => byKey.has(k) && !pinKeys.has(k)), ...arrivals];

  const items: DockItem[] = pins.map((p) => {
    const list = byKey.get(keyOf(p.exe)) ?? [];
    return { key: keyOf(p.exe), exe: p.exe, name: p.name, pinned: true, windows: list, active: list.some((w) => w.active) };
  });
  for (const k of nextSeen) {
    const list = byKey.get(k)!;
    items.push({ key: k, exe: list[0].exe, name: list[0].name, pinned: false, windows: list, active: list.some((w) => w.active) });
  }
  return { items, seen: nextSeen };
}

/** Sematkan bila belum ada, lepas bila sudah. Mengembalikan daftar baru. */
export function togglePin(pins: Pin[], exe: string, name: string): Pin[] {
  const k = keyOf(exe);
  return pins.some((p) => keyOf(p.exe) === k) ? pins.filter((p) => keyOf(p.exe) !== k) : [...pins, { exe, name }];
}

/** Pindahkan sematan dari indeks `from` ke `to`. Indeks di luar daftar tidak mengubah apa pun. */
export function movePin(pins: Pin[], from: number, to: number): Pin[] {
  if (from === to || from < 0 || to < 0 || from >= pins.length || to >= pins.length) return pins;
  const next = [...pins];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Daftar sematan dari data tersimpan: entri yang rusak dibuang. */
export function cleanPins(raw: unknown): Pin[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Pin[] = [];
  for (const p of raw) {
    if (!p || typeof p.exe !== 'string' || !p.exe || typeof p.name !== 'string') continue;
    const k = keyOf(p.exe);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ exe: p.exe, name: p.name || p.exe });
  }
  return out;
}

/** Ke jendela mana klik pada ikon mengarah: yang aktif diminimalkan, selain itu yang berikutnya diaktifkan. */
export function clickTarget(item: DockItem): { kind: 'launch' } | { kind: 'toggle'; id: number } | { kind: 'cycle'; id: number } {
  if (item.windows.length === 0) return { kind: 'launch' };
  const activeIdx = item.windows.findIndex((w) => w.active);
  if (item.windows.length === 1) return { kind: 'toggle', id: item.windows[0].id };
  // Beberapa jendela: bila salah satu aktif, lanjut ke berikutnya (berputar); bila tidak, aktifkan yang pertama.
  const next = item.windows[(activeIdx + 1) % item.windows.length];
  return { kind: 'cycle', id: next.id };
}

/** Ukuran dock (piksel CSS) dari jumlah ikon dan pengaturan. Dipakai untuk memberi tahu sisi Rust. */
export function dockSize(opts: { icons: number; iconSize: number; showClock: boolean; pad?: number; gap?: number }): { w: number; h: number } {
  const pad = opts.pad ?? 10;
  const gap = opts.gap ?? 6;
  const cell = opts.iconSize + 12; // ikon plus ruang di sekelilingnya
  const fixed = cell + gap; // tombol Start
  const clock = opts.showClock ? 92 + gap : 0;
  const sep = opts.icons > 0 ? 9 + gap : 0;
  const apps = opts.icons * (cell + gap);
  return { w: Math.round(pad * 2 + fixed + sep + apps + clock), h: Math.round(pad * 2 + cell) };
}
