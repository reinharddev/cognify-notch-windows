import { load, save } from './store.svelte';

// Pilihan tampilan. Di Windows tidak ada poni, jadi lebar notch saat tertutup bisa diatur supaya tidak menutupi
// tab browser atau judul jendela. Panel terbuka tidak ikut berubah.
export const CLOSED_MIN = 70, CLOSED_MAX = 200, CLOSED_DEFAULT = 130;

export type EyesMode = 'blink' | 'follow';

class Ui {
  closedWidth = $state(clampW(load('ui.closedWidth', CLOSED_DEFAULT)));
  /** 'blink': hanya berkedip (bawaan). 'follow': mata ikut melihat ke arah kursor. */
  eyesMode = $state<EyesMode>(load<string>('ui.eyesMode', 'blink') === 'follow' ? 'follow' : 'blink');
  persist() { save('ui.closedWidth', this.closedWidth); save('ui.eyesMode', this.eyesMode); }
  reload() {
    this.closedWidth = clampW(load('ui.closedWidth', CLOSED_DEFAULT));
    this.eyesMode = load<string>('ui.eyesMode', 'blink') === 'follow' ? 'follow' : 'blink';
  }
}
function clampW(w: number) { return Math.min(CLOSED_MAX, Math.max(CLOSED_MIN, Math.round(Number(w) || CLOSED_DEFAULT))); }
export const ui = new Ui();
