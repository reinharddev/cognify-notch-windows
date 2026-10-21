import { cmd } from './bridge';
import { load, save } from './store.svelte';

export const HOTKEYS = [
  ['ctrl_alt_n', 'Ctrl+Alt+N'], ['ctrl_alt_space', 'Ctrl+Alt+Space'], ['alt_space', 'Alt+Space'], ['ctrl_shift_n', 'Ctrl+Shift+N'], ['off', '-'],
] as const;

// Pintasan keyboard global yang membuka notch; tekan lagi atau Esc untuk menutup.
class Hotkey {
  choice = $state(load('hotkey', 'ctrl_alt_n'));
  apply() { save('hotkey', this.choice); void cmd('set_hotkey', { choice: this.choice }); }
}
export const hotkey = new Hotkey();
