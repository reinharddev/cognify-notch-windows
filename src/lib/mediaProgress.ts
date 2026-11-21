// Posisi dan kemajuan lagu untuk pemutar di dock. Murni, supaya bisa diuji.

/** Posisi sekarang (detik): posisi terakhir yang dilaporkan ditambah waktu berjalan sejak laporan itu, dijepit ke durasi. */
export function livePosition(position: number, duration: number, playing: boolean, now: number, reportedAt: number): number {
  const base = Number.isFinite(position) && position > 0 ? position : 0;
  const value = base + (playing ? Math.max(0, now - reportedAt) / 1000 : 0);
  return duration > 0 ? Math.min(duration, value) : value;
}

/** Kemajuan 0 sampai 1; 0 bila durasi tidak diketahui. */
export function progressRatio(position: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(position)) return 0;
  return Math.min(1, Math.max(0, position / duration));
}

/** Waktu untuk label: "1:21" atau "1:02:03". */
export function timeLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}
