<script lang="ts">
  import { House, Music, Timer, AlarmClock, Droplet, ListChecks, NotebookPen, ClipboardList, Inbox, ScanFace, Zap } from '@lucide/svelte';
  import { PAGES } from './pages';
  import { notch } from './notch.svelte';
  import { L } from './i18n';

  // Titik halaman. Saat kursor masuk, titik berubah jadi deretan kotak ikon seperti Dock macOS:
  // yang paling dekat kursor membesar paling besar dan namanya muncul di atasnya. Klik untuk lompat.
  const ICONS: Record<string, typeof House> = {
    home: House, music: Music, timer: Timer, clock: AlarmClock, water: Droplet, todo: ListChecks,
    notes: NotebookPen, clipboard: ClipboardList, tray: Inbox, mirror: ScanFace, shortcuts: Zap,
  };
  const BASE = 20, MAX = 36, GAP = 4, SIGMA = 38;
  let mouseX = $state<number | null>(null);
  let nav: HTMLElement | undefined = $state();
  let origin = $state({ left: 0, center: 0 });

  const measure = () => {
    if (!nav) return;
    const r = nav.getBoundingClientRect();
    origin = { left: r.left, center: r.left + r.width / 2 };
  };
  // Pusat tiap kotak pada ukuran dasar; dipakai tetap supaya posisi kursor tidak ikut bergeser saat kotak membesar.
  const center = (i: number) => origin.center + (i - (PAGES.length - 1) / 2) * (BASE + GAP);
  const f = (i: number) => (mouseX === null ? 0 : Math.exp(-(((mouseX - center(i)) / SIGMA) ** 2)));
  const nearest = $derived(mouseX === null ? -1 : PAGES.reduce((best, _, i) => (Math.abs(center(i) - mouseX!) < Math.abs(center(best) - mouseX!) ? i : best), 0));
  const hovering = $derived(mouseX !== null);
</script>

<nav
  bind:this={nav}
  class:hovering
  aria-label={L('Halaman', 'Pages')}
  onpointerenter={(e) => { measure(); mouseX = e.clientX; }}
  onpointermove={(e) => { mouseX = e.clientX; }}
  onpointerleave={() => (mouseX = null)}
>
  {#if hovering && nearest >= 0}
    <span class="tip" style:left="{center(nearest) - origin.left}px">{PAGES[nearest].title()}</span>
  {/if}
  {#each PAGES as p, i}
    {@const Icon = ICONS[p.id]}
    {@const size = BASE + (MAX - BASE) * f(i)}
    {#if hovering}
      <button class="tile" class:on={i === notch.page && !notch.settings} aria-label={p.title()} onclick={() => notch.select(i)}
        style:width="{size}px" style:height="{size}px" style:border-radius="{size * 0.28}px">
        <Icon size={size * 0.56} strokeWidth={2.2} />
      </button>
    {:else}
      <button class="pip" class:on={i === notch.page && !notch.settings} aria-label={p.title()} onclick={() => notch.select(i)}></button>
    {/if}
  {/each}
</nav>

<style>
  nav { position: relative; height: 22px; width: 170px; margin: 0 auto; flex: none; display: flex; align-items: flex-end; justify-content: center; gap: 6px; padding-bottom: 2px; }
  nav.hovering { width: 340px; gap: 4px; z-index: 3; }
  button { border: 0; padding: 0; cursor: pointer; flex: none; }
  .pip { width: 6px; height: 6px; border-radius: 99px; background: rgba(255, 255, 255, .3); }
  .pip.on { width: 16px; background: #fff; }
  .tile { display: grid; place-items: center; background: rgba(255, 255, 255, .16); color: #fff; }
  .tile.on { background: var(--accent); color: #fff; }
  .tip { position: absolute; bottom: 42px; transform: translateX(-50%); padding: 3px 10px; border-radius: 99px; background: rgba(255, 255, 255, .18); font-size: 11px; font-weight: 600; white-space: nowrap; pointer-events: none; }
</style>
