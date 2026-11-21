<script lang="ts">
  import { Volume1, Volume2, VolumeX } from '@lucide/svelte';
  import { device } from '../system.svelte';
  import { cmd } from '../bridge';
  import { L } from '../i18n';

  let { w }: { w: number } = $props();
  let before = 0.4;
  const level = $derived(device.muted ? 0 : device.volume);
  const Icon = $derived(level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2);
  const set = (e: Event) => void cmd('set_volume', { value: Number((e.currentTarget as HTMLInputElement).value) / 100 });
  function toggle() {
    if (level > 0) { before = device.volume; void cmd('set_volume', { value: 0 }); }
    else void cmd('set_volume', { value: before || 0.4 });
  }
</script>

<div class="dk-chip box" style:width="{w}px">
  <button class="dk-btn" aria-label={level === 0 ? L('Bunyikan', 'Unmute') : L('Bisukan', 'Mute')} onclick={toggle}><Icon size={16} /></button>
  <input type="range" min="0" max="100" value={Math.round(level * 100)} oninput={set} aria-label={L('Volume', 'Volume')} style:--p="{Math.round(level * 100)}%" />
</div>

<style>
  .box { gap: 6px; padding: 0 4px 0 0; }
  .dk-btn { width: 28px; height: 28px; }
  input { flex: 1; min-width: 0; height: 4px; margin: 0; appearance: none; -webkit-appearance: none; border-radius: 99px; background: linear-gradient(90deg, var(--accent) var(--p), rgb(var(--ink, 255 255 255) / .18) var(--p)); outline: none; cursor: default; }
  input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; border-radius: 50%; background: rgb(var(--ink, 255 255 255)); box-shadow: 0 0 0 2px rgb(0 0 0 / .25); transition: transform .15s var(--ease, ease-out); }
  input:hover::-webkit-slider-thumb { transform: scale(1.15); }
  input:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
</style>
