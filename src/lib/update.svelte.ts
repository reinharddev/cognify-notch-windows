// Pembaruan app. Bila dipasang oleh installer (Velopack), app memeriksa rilis "Latest" di GitHub, mengunduh
// pembaruan di latar belakang, lalu memasangnya dan memulai ulang saat notch sedang tidak dipakai (bisa
// dimatikan). Bila dijalankan tanpa installer, app hanya memberi tahu ada versi baru. Yang diminta ke
// internet hanya daftar versi dan paket pembaruan; tidak ada informasi tentang komputermu yang dikirim.
import { cmd } from './bridge';
import { L } from './i18n';
import { load, save } from './store.svelte';
import { news } from './news.svelte';
import { features } from './system.svelte';
import { notch } from './notch.svelte';

const REPO = 'reinharddev/cognify-notch-windows';
const num = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
const newer = (a: string, b: string) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0); return false; };

type Stage = 'idle' | 'found' | 'downloading' | 'ready';

class Update {
  current = __APP_VERSION__;
  text = $state('');
  stage = $state<Stage>('idle');
  version = $state('');
  /** Hanya bila tanpa installer: alamat unduhan versi baru. */
  url = $state('');
  /** Dipasang oleh installer, jadi bisa memperbarui dirinya sendiri. */
  selfUpdate = $state(false);
}
export const update = new Update();

async function legacyCheck(quiet: boolean) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!res.ok) throw new Error(String(res.status));
  const r = (await res.json()) as { tag_name: string; html_url: string };
  if (newer(r.tag_name, update.current)) {
    update.version = r.tag_name.replace(/^v/, '');
    update.url = r.html_url;
    update.stage = 'found';
    update.text = L(`Versi ${update.version} tersedia.`, `Version ${update.version} is available.`);
    announceOnce(quiet, L('Buka Pengaturan untuk mengunduh', 'Open Settings to download'));
  } else if (!quiet) update.text = L('Sudah versi terbaru.', 'You are up to date.');
}

function announceOnce(quiet: boolean, sub: string) {
  if (quiet && load('update.told', '') !== update.version) {
    save('update.told', update.version);
    news.announce(L(`Versi ${update.version} tersedia`, `Version ${update.version} is available`), sub);
  }
}

/** `quiet` = pemeriksaan otomatis: hanya memberi kabar bila ada versi baru. */
export async function checkUpdate(quiet = false) {
  if (update.stage === 'downloading' || update.stage === 'ready') return;
  if (!quiet) { update.text = L('Memeriksa…', 'Checking…'); update.url = ''; }
  try {
    if (update.selfUpdate) {
      const v = await cmd<string | null>('update_check');
      if (v) {
        update.version = v; update.stage = 'found';
        update.text = L(`Versi ${v} tersedia.`, `Version ${v} is available.`);
        if (features.autoInstall) void downloadInBackground();
        else announceOnce(quiet, L('Buka Pengaturan untuk memperbarui', 'Open Settings to update'));
      } else if (!quiet) update.text = L('Sudah versi terbaru.', 'You are up to date.');
    } else await legacyCheck(quiet);
  } catch {
    if (!quiet) update.text = L('Tidak bisa memeriksa sekarang.', 'Can\'t check right now.');
  }
}

async function downloadInBackground() {
  update.stage = 'downloading';
  update.text = L(`Mengunduh versi ${update.version}…`, `Downloading version ${update.version}…`);
  await cmd('update_download');
  update.stage = 'ready';
  update.text = L(`Versi ${update.version} siap dipasang.`, `Version ${update.version} is ready to install.`);
  if (features.autoInstall) waitForIdle();
  else announceOnce(true, L('Buka Pengaturan untuk memperbarui', 'Open Settings to update'));
}

// Pasang saat notch tertutup dan tidak dipakai, supaya tidak memotong apa yang sedang kamu lakukan.
function waitForIdle() {
  news.announce(L(`Versi ${update.version} siap`, `Version ${update.version} is ready`), L('Dipasang saat notch tidak dipakai', 'Installs when the notch is idle'));
  const timer = setInterval(() => {
    if (!notch.open && !notch.pinned) { clearInterval(timer); void cmd('update_apply'); }
  }, 15_000);
}

/** Tombol di Pengaturan: unduh bila perlu, lalu pasang dan mulai ulang. */
export async function installNow() {
  if (!update.selfUpdate) return;
  if (update.stage === 'found') {
    update.stage = 'downloading';
    update.text = L(`Mengunduh versi ${update.version}…`, `Downloading version ${update.version}…`);
    await cmd('update_download');
    update.stage = 'ready';
  }
  update.text = L('Memasang dan memulai ulang…', 'Installing and restarting…');
  await cmd('update_apply');
}

/** Pemeriksaan otomatis: 20 detik setelah app dibuka, lalu sekali sehari. */
export async function startAutoCheck() {
  update.selfUpdate = !!(await cmd<boolean>('update_supported'));
  const run = () => { if (features.updates) void checkUpdate(true); };
  setTimeout(run, 20_000);
  setInterval(run, 24 * 3600_000);
}
