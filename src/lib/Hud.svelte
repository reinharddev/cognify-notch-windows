<script lang="ts">
  import { ICONS, TINT, type IconName } from './icons';
  import type { Level } from './news.svelte';
  import { notch } from './notch.svelte';
  let { level }: { level: Level } = $props();

  // Sama dengan Mac: ikon di sayap kiri (berubah menurut level), garis level 46x5 di sayap kanan.
  const WING = 76;
  const icon = $derived<IconName>(
    level.kind === 'volume'
      ? (level.muted || level.value === 0 ? 'volume-x' : level.value < 0.34 ? 'volume-1' : 'volume-2')
      : level.value < 0.5 ? 'sun-dim' : 'sun',
  );
  const tint = $derived(level.kind === 'volume' ? TINT.white : TINT.yellow);
  const shown = $derived(level.kind === 'volume' && level.muted ? 0 : Math.max(0, Math.min(1, level.value)));
  const Icon = $derived(ICONS[icon]);
</script>

<div class="hud" style:grid-template-columns="{WING - 6}px {notch.closed.idle.w}px {WING - 6}px">
  <span class="l" style:color={tint}><Icon size={15} strokeWidth={2.4} /></span>
  <span></span>
  <span class="r"><span class="bar"><i style:width="{46 * shown}px" style:background={tint}></i></span></span>
</div>

<style>
  .hud { display: grid; align-items: center; height: 100%; margin: 0 auto; width: fit-content; }
  .l, .r { display: grid; place-items: center; }
  .bar { width: 46px; height: 5px; border-radius: 99px; background: rgba(255, 255, 255, .18); overflow: hidden; display: block; }
  .bar i { display: block; height: 100%; border-radius: 99px; transition: width .25s cubic-bezier(.3, 1.2, .5, 1); }
</style>
