<script lang="ts">
  // Pratinjau hidup notch di Pengaturan: bentuk, lebar, lengkung, warna aksen, latar, dan wajah mengikuti pilihan saat ini.
  import { ui } from '../ui.svelte';
  import { features } from '../system.svelte';
  import { L } from '../i18n';

  let { height = 150, face = true }: { height?: number; face?: boolean } = $props();
  let open = $state(false);
  const pill = $derived(ui.style === 'pill');
  const closedW = $derived(pill ? ui.pillWidth : ui.closedWidth);
  const bg = $derived(ui.bgCss);
</script>

<div class="stage" style:height="{height}px" class:open>
  <div class="bar"></div>
  <div class="notch" class:pill style:width={open ? '' : `${closedW}px`} style:border-radius={pill ? '99px' : `0 0 ${ui.roundness}px ${ui.roundness}px`}>
    {#if open && bg}<span class="bg" style:background={bg.background}></span>{/if}
    {#if face && features.companion}<i class="eye"></i><i class="eye"></i>{/if}
  </div>
  <div class="hint">{L('Pratinjau langsung', 'Live preview')} <button type="button" onclick={() => (open = !open)}>{L('Buka / tutup', 'Open / close')}</button></div>
</div>

<style>
  .stage { position: relative; overflow: hidden; border-radius: 12px; border: 1px solid var(--line); background: linear-gradient(160deg, #1a1830, #3d2a63 55%, #6f3a7e); }
  .bar { position: absolute; top: 0; left: 0; right: 0; height: 22px; background: rgba(0, 0, 0, .28); }
  .notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); background: #000; height: 32px; display: flex; align-items: center; justify-content: center; gap: 10px; overflow: hidden; transition: width .15s, border-radius .15s, top .15s; max-width: 94%; }
  .notch.pill { top: 34px; }
  .bg { position: absolute; inset: 0; opacity: .95; }
  .eye { position: relative; width: 8px; height: 13px; background: var(--accent); border-radius: 50%; animation: blink 4s infinite; }
  .stage.open .notch { width: 340px; height: 92px; align-items: flex-start; padding-top: 14px; }
  .hint { position: absolute; right: 10px; bottom: 8px; font-size: 11px; color: rgba(255, 255, 255, .7); display: flex; gap: 8px; align-items: center; }
  .hint button { border: 0; background: rgba(255, 255, 255, .18); color: #fff; font: inherit; font-size: 11px; padding: 2px 9px; border-radius: 99px; cursor: pointer; }
  @keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }
  @media (prefers-reduced-motion: reduce) { .eye { animation: none; } .notch { transition: none; } }
</style>
