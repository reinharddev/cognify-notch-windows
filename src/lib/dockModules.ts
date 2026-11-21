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
  apps: { icon: AppWindow, label: () => L('Aplikasi', 'Apps'), desc: () => L('Aplikasi yang disematkan dan yang sedang terbuka. Bila terlalu banyak, sisanya masuk menu "+N".', 'Pinned and running apps. When there are too many, the rest go into a "+N" menu.') },
  media: { icon: Music, label: () => L('Pemutar musik', 'Music player'), desc: () => L('Sampul, judul, dan tombol sebelumnya, putar, berikutnya.', 'Cover, title, and previous, play, next buttons.') },
  lyrics: { icon: Music2, label: () => L('Lirik', 'Lyrics'), desc: () => L('Baris lirik yang sedang dinyanyikan. Butuh fitur Lirik menyala.', 'The line being sung right now. Needs the Lyrics feature on.') },
  weather: { icon: CloudSun, label: () => L('Cuaca', 'Weather'), desc: () => L('Suhu dan ikon cuaca. Butuh fitur Cuaca menyala dan kota diisi.', 'Temperature and weather icon. Needs the Weather feature on and a city set.') },
  timer: { icon: Timer, label: () => L('Timer cepat', 'Quick timer'), desc: () => L('Tombol menit (preset) untuk memulai hitung mundur; bunyi dan kartu saat selesai.', 'Minute presets that start a countdown; a chime and a card when done.') },
  clipboard: { icon: ClipboardList, label: () => L('3 salinan terakhir', 'Last 3 copies'), desc: () => L('Klik untuk menyalin lagi. Butuh fitur Clipboard menyala.', 'Click to copy again. Needs the Clipboard feature on.') },
  links: { icon: LinkIcon, label: () => L('Pintasan tautan', 'Link shortcuts'), desc: () => L('Ikon untuk membuka situs favorit.', 'Icons that open your favourite sites.') },
  battery: { icon: BatteryFull, label: () => L('Baterai', 'Battery'), desc: () => L('Persen baterai (hanya laptop).', 'Battery percentage (laptops only).') },
  volume: { icon: Volume2, label: () => L('Volume', 'Volume'), desc: () => L('Slider volume dan tombol bisu.', 'Volume slider and a mute button.') },
  quick: { icon: SlidersHorizontal, label: () => L('Pengaturan cepat Windows', 'Windows quick settings'), desc: () => L('Membuka panel Wi-Fi, kecerahan, dan lainnya (Win+A).', 'Opens the Wi-Fi, brightness and more panel (Win+A).') },
  tray: { icon: ChevronUp, label: () => L('Ikon tersembunyi', 'Hidden icons'), desc: () => L('Menampilkan taskbar Windows sebentar. Hanya ada saat taskbar Windows disembunyikan.', 'Shows the Windows taskbar briefly. Only there while the Windows taskbar is hidden.') },
  clock: { icon: Clock, label: () => L('Jam dan tanggal', 'Clock and date'), desc: () => L('Klik untuk membuka notifikasi dan kalender Windows.', 'Click to open Windows notifications and the calendar.') },
};
