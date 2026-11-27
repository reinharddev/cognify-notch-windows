<script lang="ts">
  // Pemilih warna sendiri, sama dengan NotchColorPicker di Mac: rona, pekat, terang, dan kode hex dalam satu popover.
  // Popover bawaan browser: menutup sendiri saat klik di luar atau tekan Esc.
  import { hexToHsv, hsvToHex } from '../color';
  let { value, label, onchange }: { value: string; label: string; onchange: (hex: string) => void } = $props();

  const id = $props.id();
  let trigger: HTMLButtonElement, panel: HTMLDivElement;
  let h = $state(0), s = $state(0), v = $state(0);
  const hex = $derived(hsvToHex(h, s, v));

  function open() {
    ({ h, s, v } = hexToHsv(/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'));
    const r = trigger.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(innerWidth - 228, r.right - 220))}px`;
    panel.style.top = `${r.bottom + 190 > innerHeight ? Math.max(8, r.top - 190) : r.bottom + 6}px`;
    panel.togglePopover();
  }
  const apply = () => onchange(hsvToHex(h, s, v));
  function typed(text: string) {
    const code = (text.startsWith('#') ? text : '#' + text).toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(code)) return;
    ({ h, s, v } = hexToHsv(code));
    apply();
  }
</script>

<button bind:this={trigger} type="button" class="well" style:background={value} aria-label={label} aria-haspopup="dialog" aria-controls={id} onclick={open}></button>
<div bind:this={panel} {id} popover="auto" class="panel" role="dialog" aria-label={label}>
  <span class="show" style:background={hex}></span>
  <input class="track hue" type="range" min="0" max="360" bind:value={h} oninput={apply} aria-label="Hue" />
  <input class="track" type="range" min="0" max="100" bind:value={s} oninput={apply} aria-label="Saturation" style:background="linear-gradient(to right, {hsvToHex(h, 0, v)}, {hsvToHex(h, 100, v)})" />
  <input class="track" type="range" min="0" max="100" bind:value={v} oninput={apply} aria-label="Brightness" style:background="linear-gradient(to right, #000, {hsvToHex(h, s, 100)})" />
  <input class="hex" value={hex} maxlength="7" spellcheck="false" aria-label="Hex code" onchange={(e) => typed(e.currentTarget.value)} />
</div>

<style>
  .well { flex: none; width: 36px; height: 22px; padding: 0; border: 0; border-radius: 99px; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .25); cursor: pointer; }
  .well:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .panel { position: fixed; inset: auto; margin: 0; width: 220px; box-sizing: border-box; padding: 10px; border: 1px solid rgba(255, 255, 255, .14); border-radius: 16px; background: #1e1e1e; color: #fff; }
  .panel:popover-open { display: flex; flex-direction: column; gap: 10px; }
  .show { height: 28px; border-radius: 12px; }
  .track { -webkit-appearance: none; appearance: none; width: 100%; height: 10px; margin: 0; border-radius: 99px; cursor: pointer; }
  .track::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 1px rgba(0, 0, 0, .4); }
  .hue { background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
  .hex { height: 28px; box-sizing: border-box; padding: 0 12px; border: 1px solid rgba(255, 255, 255, .1); border-radius: 99px; background: rgba(255, 255, 255, .07); color: inherit; font: inherit; font-size: 12px; outline: none; }
  .hex:focus { border-color: var(--accent); }
</style>
