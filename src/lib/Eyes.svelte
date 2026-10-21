<script lang="ts">
  import { ChevronUp } from '@lucide/svelte';
  import { face } from './face.svelte';
  import { ui } from './ui.svelte';
  import { notch } from './notch.svelte';

  // Mata gaya Mac: persegi panjang bulat 8x12 dengan pendar aksen; menutup jadi garis saat berkedip,
  // lengkung tidur dengan "z" di mata kanan, dan tanda panah naik saat menyapa.
  $effect(() => face.start());
  const gap = $derived(Math.round(notch.closed.idle.w * 0.42));
  const dx = $derived(ui.eyesMode === 'follow' ? face.look.x * 1.2 : 0);
  const dy = $derived(ui.eyesMode === 'follow' ? face.look.y * 1 : 0);
</script>

<span class="eyes" style:gap="{gap}px" style:transform="translate({dx}px, {dy}px)">
  {#each [false, true] as right}
    <span class="eye">
      {#if face.mood === 'awake' || face.mood === 'blink'}
        <i class="open" style:height="{face.mood === 'blink' ? 1.5 : 12}px"></i>
      {:else if face.mood === 'asleep'}
        <i class="shut"></i>
        {#if right}<b class="z">z</b>{/if}
      {:else}
        <span class="hello"><ChevronUp size={11} strokeWidth={3} /></span>
      {/if}
    </span>
  {/each}
</span>

<style>
  .eyes { display: flex; align-items: center; justify-content: center; transition: transform .16s ease-out; }
  .eye { position: relative; width: 14px; height: 16px; display: grid; place-items: center; }
  .open { display: block; width: 8px; border-radius: 3.5px; background: #fff; box-shadow: 0 0 4px color-mix(in srgb, var(--accent) 90%, transparent); transition: height .07s ease-in-out; }
  .shut { display: block; width: 9px; height: 2px; border-radius: 99px; background: rgba(255, 255, 255, .75); margin-top: 4px; }
  .z { position: absolute; right: -9px; top: -2px; font-size: 8px; font-weight: 800; color: rgba(255, 255, 255, .6); }
  .hello { color: #fff; filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 90%, transparent)); display: grid; }
</style>
