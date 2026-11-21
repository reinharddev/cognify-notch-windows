<script lang="ts">
  import { Battery, BatteryCharging, BatteryLow, BatteryMedium, BatteryFull } from '@lucide/svelte';
  import { device } from '../system.svelte';
  import { L } from '../i18n';

  let { w }: { w: number } = $props();
  const p = $derived(device.power);
  const Icon = $derived(!p ? Battery : p.charging ? BatteryCharging : p.percent <= 20 ? BatteryLow : p.percent <= 60 ? BatteryMedium : BatteryFull);
</script>

{#if p}
  <div class="dk-chip box" class:low={p.percent <= 20 && !p.charging} class:chg={p.charging} style:width="{w}px" title={L(`Baterai ${p.percent}%`, `Battery ${p.percent}%`)}>
    <Icon size={18} /><b>{p.percent}%</b>
  </div>
{/if}

<style>
  .box { justify-content: center; gap: 6px; }
  b { font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .low { color: #ff6b7d; }
  .chg { color: #4cd964; }
</style>
