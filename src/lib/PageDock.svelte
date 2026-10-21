<script lang="ts">
  import { House, Music, Timer, AlarmClock, Droplet, ListChecks, NotebookPen, ClipboardList, Inbox, ScanFace, Zap } from '@lucide/svelte';
  import { PAGES } from './pages';
  import { notch } from './notch.svelte';
  import { L } from './i18n';

  // Titik halaman. Saat kursor mendekat, titik berubah jadi ikon seperti Dock macOS: yang paling
  // dekat kursor membesar paling besar dan namanya muncul di atasnya. Klik untuk lompat.
  const ICONS: Record<string, typeof House> = {
    home: House, music: Music, timer: Timer, clock: AlarmClock, water: Droplet, todo: ListChecks,
    notes: NotebookPen, clipboard: ClipboardList, tray: Inbox, mirror: ScanFace, shortcuts: Zap,
  };
  let mouseX = $state<number | null>(null);
  let nav: HTMLElement | undefined = $state();
  let centers = $state<number[]>([]);

  const measure = () => {
    if (!nav) return;
    // Pusat tiap tombol saat belum membesar: dihitung dari urutan, supaya tidak ikut bergeser.
    const r = nav.getBoundingClientRect();
    const gap = 6, dot = 6, total = PAGES.length * dot + (PAGES.length - 1) * gap;
    const start = r.left + r.width / 2 - total / 2;
    centers = PAGES.map((_, i) => start + i * (dot + gap) + dot / 2);
  };
  const f = (i: number) => (mouseX === null || !centers[i] ? 0 : Math.exp(-(((mouseX - centers[i]) / 34) ** 2)));
  const nearest = $derived(mouseX === null ? -1 : centers.reduce((best, c, i) => (Math.abs(c - mouseX!) < Math.abs(centers[best] - mouseX!) ? i : best), 0));
</script>

<nav
  bind:this={nav}
  aria-label={L('Halaman', 'Pages')}
  onpointerenter={measure}
  onpointermove={(e) => { if (!centers.length) measure(); mouseX = e.clientX; }}
  onpointerleave={() => (mouseX = null)}
>
  {#if nearest >= 0 && f(nearest) > 0.35}<span class="tip" style:left="{centers[nearest] - (nav?.getBoundingClientRect().left ?? 0)}px">{PAGES[nearest].title()}</span>{/if}
  {#each PAGES as p, i}
    {@const k = f(i)}
    {@const Icon = ICONS[p.id]}
    <button
      class:on={i === notch.page && !notch.settings}
      aria-label={p.title()}
      onclick={() => notch.select(i)}
      style:width="{6 + 16 * k}px" style:height="{6 + 16 * k}px"
    >
      <span class="dot" style:opacity={1 - k}></span>
      <span class="ico" style:opacity={k}><Icon size={14 + 4 * k} strokeWidth={2.2} /></span>
    </button>
  {/each}
</nav>

<style>
  nav { position: relative; height: 26px; flex: none; display: flex; align-items: flex-end; justify-content: center; gap: 6px; padding-bottom: 3px; }
  button { position: relative; border: 0; padding: 0; background: none; cursor: pointer; display: grid; place-items: center; color: rgba(255, 255, 255, .55); }
  button.on { color: #fff; }
  .dot { position: absolute; inset: 0; border-radius: 99px; background: rgba(255, 255, 255, .3); }
  button.on .dot { background: #fff; }
  .ico { position: absolute; inset: 0; display: grid; place-items: center; }
  .tip { position: absolute; bottom: 30px; transform: translateX(-50%); padding: 3px 9px; border-radius: 99px; background: rgba(255, 255, 255, .16); font-size: 11px; font-weight: 600; white-space: nowrap; pointer-events: none; }
</style>
