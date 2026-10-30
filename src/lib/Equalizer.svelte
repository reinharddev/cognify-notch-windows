<script lang="ts">
  import { device, features } from './system.svelte';
  import { ui } from './ui.svelte';
  import { artColors } from './artColor.svelte';
  // Lima batang. Naik-turunnya animasi CSS pada transform (dikerjakan GPU, tanpa kerja JavaScript per frame).
  // Keras suara hanya mengatur tinggi puncaknya lewat satu nilai CSS yang dibulatkan ke 1/8, jadi berubah
  // paling banyak sekitar 8 kali per detik. Tinggi = 3 + A·m px dengan m bergerak antara 0,4 dan 1.
  const periods = [1.047, 0.806, 0.654, 0.551, 0.476]; // satu putaran |sin(ωt)|, sama dengan versi sebelumnya
  const A = $derived((0.25 + 0.75 * (Math.round((features.spectrum ? device.level : 0.5) * 8) / 8)) * 11);
</script>

<span class="eq" aria-hidden="true" style:--A={A} style:--eq={(ui.equalizerAuto ? artColors.on : null) || ui.equalizerColor || undefined}>{#each periods as p, i}<i style:--d="{p}s" style:--o="{-0.21 * i}s"></i>{/each}</span>

<style>
  .eq { display: flex; align-items: center; gap: 2px; height: 14px; }
  i {
    width: 2.5px; height: 14px; border-radius: 2px; background: var(--eq, var(--accent)); transform-origin: 50% 50%;
    animation: bounce var(--d) infinite; animation-delay: var(--o); will-change: transform;
  }
  @keyframes bounce {
    0%, 100% { transform: scaleY(calc((3 + var(--A) * 0.4) / 14)); animation-timing-function: ease-out; }
    50% { transform: scaleY(calc((3 + var(--A)) / 14)); animation-timing-function: ease-in; }
  }
</style>
