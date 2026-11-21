<script lang="ts">
  // Cuaca di dock. Memakai penyimpanan cuaca yang sama dengan notch (Open-Meteo, hanya bila fitur Cuaca menyala).
  import { CloudSun } from '@lucide/svelte';
  import { weather } from '../weather.svelte';
  import { features } from '../system.svelte';
  import { L } from '../i18n';

  let { w }: { w: number } = $props();
  const title = $derived(
    !features.weather ? L('Nyalakan Cuaca di Pengaturan > Fitur', 'Turn on Weather in Settings > Features')
      : weather.now ? weather.now.place : weather.problem || L('Memuat cuaca…', 'Loading weather…'),
  );
</script>

<div class="dk-chip box" style:width="{w}px" {title}>
  {#if features.weather && weather.now}
    <span class="ic" aria-hidden="true">{weather.now.icon}</span><b>{weather.now.temp}°</b>
  {:else}
    <CloudSun size={18} class="dk-ic" /><span class="dk-dim">—°</span>
  {/if}
</div>

<style>
  .box { justify-content: center; gap: 7px; }
  .ic { font-size: 19px; line-height: 1; }
  b { font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
</style>
