<script lang="ts">
  import { device } from './system.svelte';
  // Lima batang yang tinggi-rendahnya mengikuti keras suara yang sedang keluar.
  const phase = [0, 1.7, 3.1, 4.4, 2.3];
  let t = $state(0);
  $effect(() => {
    let raf = 0;
    const loop = (ms: number) => { t = ms / 1000; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
  const h = (i: number) => 3 + (0.25 + 0.75 * device.level) * (0.4 + 0.6 * Math.abs(Math.sin(t * (3 + i * 0.9) + phase[i]))) * 11;
</script>

<span class="eq" aria-hidden="true">{#each phase as _, i}<i style:height="{h(i)}px"></i>{/each}</span>

<style>
  .eq { display: flex; align-items: center; gap: 2px; height: 14px; }
  i { width: 2.5px; border-radius: 2px; background: var(--accent); }
</style>
