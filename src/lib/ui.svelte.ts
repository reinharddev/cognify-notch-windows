import { load, save } from './store.svelte';

// Pilihan tampilan. Di Windows tidak ada poni, jadi lebar notch saat tertutup bisa diatur supaya tidak menutupi
// tab browser atau judul jendela. Panel terbuka tidak ikut berubah.
export const CLOSED_MIN = 70, CLOSED_MAX = 200, CLOSED_DEFAULT = 130;

class Ui {
  closedWidth = $state(clampW(load('ui.closedWidth', CLOSED_DEFAULT)));
  persist() { save('ui.closedWidth', this.closedWidth); }
  reload() { this.closedWidth = clampW(load('ui.closedWidth', CLOSED_DEFAULT)); }
}
function clampW(w: number) { return Math.min(CLOSED_MAX, Math.max(CLOSED_MIN, Math.round(Number(w) || CLOSED_DEFAULT))); }
export const ui = new Ui();
