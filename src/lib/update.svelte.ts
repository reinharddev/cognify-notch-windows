// Pengecek versi dari GitHub Releases (build GitHub saja; build Store memakai pembaruan Store).
import { L } from './i18n';

const REPO = 'reinharddev/cognify-notch-windows';
const num = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
const newer = (a: string, b: string) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0); return false; };

class Update {
  current = __APP_VERSION__;
  text = $state('');
  url = $state('');
}
export const update = new Update();

export async function checkUpdate() {
  update.text = L('Memeriksa…', 'Checking…');
  update.url = '';
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) throw new Error(String(res.status));
    const r = (await res.json()) as { tag_name: string; html_url: string };
    if (newer(r.tag_name, update.current)) { update.text = L(`Versi ${r.tag_name} tersedia.`, `Version ${r.tag_name} is available.`); update.url = r.html_url; }
    else update.text = L('Sudah versi terbaru.', 'You are up to date.');
  } catch {
    update.text = L('Tidak bisa memeriksa sekarang.', 'Can\'t check right now.');
  }
}
