// Nama, keterangan, dan ikon tiap modul dock untuk Pengaturan. Lebar dan aturan muat ada di dockLayout.ts.
import { AppWindow, BatteryFull, ClipboardList, Clock, CloudSun, LayoutGrid, Link as LinkIcon, Music, Music2, SlidersHorizontal, Timer, Volume2, ChevronUp } from '@lucide/svelte';
import type { Component } from 'svelte';
import { L } from './i18n';
import type { ModuleId } from './dockLayout';

export interface ModuleInfo {
  label: () => string;
  desc: () => string;
  icon: Component<any>;
}

export const MODULE_INFO: Record<ModuleId, ModuleInfo> = {
  start: { icon: LayoutGrid, label: () => L('Tombol Start', 'Start button'), desc: () => L('Membuka menu Start Windows.', 'Opens the Windows Start menu.') },
  apps: { icon: AppWindow, label: () => L('Aplikasi', 'Apps'), desc: () => L('Aplikasi yang disematkan dan yang lagi terbuka. Kalau kebanyakan, sisanya masuk menu "+N".', 'Your pinned and open apps. If there are too many, the extras go into a "+N" menu.') },
  media: { icon: Music, label: () => L('Pemutar musik', 'Music player'), desc: () => L('Sampul, judul, dan tombol sebelumnya, putar, berikutnya.', 'Cover, title, and previous, play, next buttons.') },
  lyrics: { icon: Music2, label: () => L('Lirik', 'Lyrics'), desc: () => L('Baris lirik yang lagi dinyanyikan. Butuh fitur Lirik.', 'The line being sung right now. Needs Lyrics turned on.') },
  weather: { icon: CloudSun, label: () => L('Cuaca', 'Weather'), desc: () => L('Suhu dan ikon cuaca. Butuh fitur Cuaca dan nama kota.', 'Temperature and a weather icon. Needs Weather on and a city set.') },
  timer: { icon: Timer, label: () => L('Timer cepat', 'Quick timer'), desc: () => L('Tombol menit buat mulai hitung mundur; begitu habis, ada bunyi dan kartu.', 'One-tap countdowns by the minute. You get a chime and a card when time\'s up.') },
  clipboard: { icon: ClipboardList, label: () => L('3 salinan terakhir', 'Last 3 copies'), desc: () => L('Klik buat salin lagi. Butuh fitur Clipboard.', 'Click to copy again. Needs Clipboard turned on.') },
  links: { icon: LinkIcon, label: () => L('Pintasan tautan', 'Link shortcuts'), desc: () => L('Ikon buat buka situs favorit.', 'Icons for your favorite sites.') },
  battery: { icon: BatteryFull, label: () => L('Baterai', 'Battery'), desc: () => L('Persen baterai (hanya laptop).', 'Battery percentage (laptops only).') },
  volume: { icon: Volume2, label: () => L('Volume', 'Volume'), desc: () => L('Slider volume dan tombol bisu.', 'Volume slider and a mute button.') },
  quick: { icon: SlidersHorizontal, label: () => L('Pengaturan cepat Windows', 'Windows quick settings'), desc: () => L('Membuka panel Wi-Fi, kecerahan, dan lainnya (Win+A).', 'Opens the Wi-Fi, brightness and more panel (Win+A).') },
  tray: { icon: ChevronUp, label: () => L('Ikon tersembunyi', 'Hidden icons'), desc: () => L('Munculkan taskbar Windows sebentar. Cuma ada kalau taskbar Windows disembunyikan.', 'Peek at the Windows taskbar. Only shows while the taskbar is hidden.') },
  clock: { icon: Clock, label: () => L('Jam dan tanggal', 'Clock and date'), desc: () => L('Klik buat buka notifikasi dan kalender Windows.', 'Click to open Windows notifications and calendar.') },
};
