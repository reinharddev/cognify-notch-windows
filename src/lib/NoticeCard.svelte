<script lang="ts">
  import { ICONS } from './icons';
  import type { News } from './news.svelte';
  let { card }: { card: News } = $props();
  const Icon = $derived(ICONS[card.icon]);
</script>

<!-- Susunan seperti kartu kabar di Mac, tanpa pita kosong di atas (Windows tanpa poni): ikon bulat
     berwarna, judul, keterangan, dan nilai di kanan (mis. persen baterai). -->
<div class="card" style:--tint={card.tint}>
  <span class="ic"><Icon size={14} strokeWidth={2.4} /></span>
  <span class="txt">
    <b>{card.title}</b>
    {#if card.sub}<small>{card.sub}</small>{/if}
  </span>
  {#if card.value}<span class="val">{card.value}</span>{/if}
</div>

<style>
  .card { width: 100%; height: 100%; padding: 0 14px; display: flex; align-items: center; gap: 10px; color: #fff; }
  .ic { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--tint); background: color-mix(in srgb, var(--tint) 18%, transparent); }
  .txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
  b { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  small { font-size: 10.5px; color: rgba(255, 255, 255, .55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .val { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; flex: none; }
</style>
