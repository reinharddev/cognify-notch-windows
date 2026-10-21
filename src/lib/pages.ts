import { L } from './i18n';

// Sebelas halaman, urutan dan nama sama dengan versi Mac. Ikon memakai nama Lucide.
export const PAGES = [
  { id: 'home', icon: 'house', title: () => L('Beranda', 'Home') },
  { id: 'music', icon: 'music', title: () => L('Musik', 'Music') },
  { id: 'timer', icon: 'timer', title: () => 'Pomodoro' },
  { id: 'clock', icon: 'alarm-clock', title: () => 'Stopwatch & Timer' },
  { id: 'water', icon: 'droplet', title: () => L('Pengingat Minum', 'Water Reminder') },
  { id: 'todo', icon: 'list-checks', title: () => L('Daftar Tugas', 'To-do') },
  { id: 'notes', icon: 'notebook-pen', title: () => L('Catatan', 'Notes') },
  { id: 'clipboard', icon: 'clipboard-list', title: () => 'Clipboard' },
  { id: 'tray', icon: 'inbox', title: () => 'Tray' },
  { id: 'mirror', icon: 'scan-face', title: () => L('Cermin', 'Mirror') },
  { id: 'shortcuts', icon: 'zap', title: () => L('Pintasan', 'Shortcuts') },
] as const;

export type PageId = (typeof PAGES)[number]['id'];
