// Pengecek versi dari GitHub Releases (build GitHub saja; build Store memakai pembaruan Store).
// Memeriksa daftar rilis, termasuk Beta, sekali sehari dan saat tombol Cek pembaruan ditekan. Yang
// diambil hanya daftar versi; tidak ada informasi tentang komputermu yang dikirim. App tidak memasang
// sendiri: kamu diberi tahu, lalu mengunduh installer baru.
import { L } from './i18n';
import { load, save } from './store.svelte';
import { news } from './news.svelte';
import { features } from './system.svelte';

const REPO = 'reinharddev/cognify-notch-windows';
const num = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
const newer = (a: string, b: string) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0); return false; };

interface Release { tag_name: string; html_url: string; draft: boolean; assets: { name: string; browser_download_url: string }[] }

class Update {
  current = __APP_VERSION__;
  text = $state('');
  /** Alamat unduhan versi baru, kosong bila sudah terbaru. */
  url = $state('');
  version = $state('');
}
export const update = new Update();

async function latest(): Promise<Release | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=5`);
  if (!res.ok) throw new Error(String(res.status));
  const list = (await res.json()) as Release[];
  return list.find((r) => !r.draft) ?? null;
}

/** `quiet` = pemeriksaan otomatis: hanya memberi kabar bila ada versi baru. */
export async function checkUpdate(quiet = false) {
  if (!quiet) { update.text = L('Memeriksa…', 'Checking…'); update.url = ''; }
  try {
    const r = await latest();
    if (r && newer(r.tag_name, update.current)) {
      const exe = r.assets.find((a) => a.name.endsWith('.exe'));
      update.version = r.tag_name.replace(/^v/, '');
      update.url = exe?.browser_download_url ?? r.html_url;
      update.text = L(`Versi ${update.version} tersedia.`, `Version ${update.version} is available.`);
      if (quiet && load('update.told', '') !== update.version) {
        save('update.told', update.version);
        news.announce(L(`Versi ${update.version} tersedia`, `Version ${update.version} is available`), L('Buka Pengaturan untuk mengunduh', 'Open Settings to download'));
      }
    } else if (!quiet) {
      update.text = L('Sudah versi terbaru.', 'You are up to date.');
    }
  } catch {
    if (!quiet) update.text = L('Tidak bisa memeriksa sekarang.', 'Can\'t check right now.');
  }
}

/** Pemeriksaan otomatis: 20 detik setelah app dibuka, lalu sekali sehari. */
export function startAutoCheck() {
  const run = () => { if (features.updates) void checkUpdate(true); };
  setTimeout(run, 20_000);
  setInterval(run, 24 * 3600_000);
}
