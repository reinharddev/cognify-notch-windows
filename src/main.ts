import { mount } from 'svelte';
import './app.css';
import { windowKind } from './lib/bridge';

// Satu bundel untuk tiga jendela: notch (transparan), Pengaturan (jendela biasa), dan dock (transparan, di tepi bawah).
// Tiap jendela hanya memuat bagiannya sendiri: dock tidak perlu isi notch (halaman, clipboard, agenda, dan seterusnya).
const target = document.getElementById('app')!;
if (windowKind === 'taskdock') {
  document.body.classList.add('taskdock-window');
  void import('./Dock.svelte').then((m) => mount(m.default, { target }));
} else if (windowKind === 'settings') {
  document.body.classList.add('settings-window');
  void import('./SettingsWindow.svelte').then((m) => mount(m.default, { target }));
} else {
  void import('./App.svelte').then((m) => mount(m.default, { target }));
}
