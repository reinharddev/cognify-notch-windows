<script lang="ts">
  import { House, Music, Timer, AlarmClock, Droplet, ListChecks, NotebookPen, ClipboardList, Inbox, ScanFace, Zap } from '@lucide/svelte';
  import { PAGES } from './pages';
  import { notch } from './notch.svelte';
  import { L } from './i18n';

  // Titik halaman. Saat kursor masuk, titik berubah jadi deretan kotak ikon seperti Dock macOS:
  // yang paling dekat kursor membesar paling besar dan namanya muncul di atasnya. Klik untuk lompat.
  // Gerakannya meniru versi Mac: titik dan kotak saling memudar dengan pegas (skala 0,6 ke 1),
  // dan pembesaran mengikuti kursor dengan penghalusan pendek.
  const ICONS: Record<string, typeof House> = {
    home: House, music: Music, timer: Timer, clock: AlarmClock, water: Droplet, todo: ListChecks,
    notes: NotebookPen, clipboard: ClipboardList, tray: Inbox, mirror: ScanFace, shortcuts: Zap,
  };
  const BASE = 20, PEAK = 34, REACH = 64, GAP = 4, N = PAGES.length;
  const ENTER = { response: 0.28, damping: 0.8 }, LEAVE = { response: 0.3, damping: 0.85 };

  let nav: HTMLElement | undefined = $state();
  let target: number | null = $state(null); // x kursor dari tengah nav; null = tidak diarahkan
  let px = $state(0);                       // x kursor yang sudah dihaluskan
  let hv = $state(0);                       // kemajuan titik ke kotak ikon (pegas, 0 sampai 1)
  let hvv = 0, raf = 0, last = 0;

  const restCenter = (i: number) => (i - (N - 1) / 2) * (BASE + GAP);
  const sizeOf = (i: number) => {
    const d = Math.min(1, Math.abs(px - restCenter(i)) / REACH);
    return BASE + (PEAK - BASE) * (Math.cos(d * Math.PI) + 1) / 2;
  };
  const sizes = $derived(PAGES.map((_, i) => sizeOf(i)));
  const nearest = $derived(PAGES.reduce((best, _, i) => (Math.abs(restCenter(i) - px) < Math.abs(restCenter(best) - px) ? i : best), 0));
  const show = $derived(Math.min(1, Math.max(0, hv)));
  const active = $derived(target !== null || hv > 0.01);

  function tick(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const goal = target === null ? 0 : 1;
    const { response, damping } = goal ? ENTER : LEAVE;
    const w = (2 * Math.PI) / response;
    const sub = Math.max(1, Math.ceil(dt / 0.004)), h = dt / sub;
    for (let i = 0; i < sub; i++) {
      hvv += (-w * w * (hv - goal) - 2 * damping * w * hvv) * h;
      hv += hvv * h;
    }
    if (target !== null) px += (target - px) * (1 - Math.exp(-dt / 0.045)); // easeOut ±0,09 detik seperti di Mac
    const settled = Math.abs(hv - goal) < 0.002 && Math.abs(hvv) < 0.02 && (target === null || Math.abs(target - px) < 0.05);
    if (settled) { hv = goal; hvv = 0; raf = 0; return; }
    raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const local = (e: PointerEvent) => { const r = nav!.getBoundingClientRect(); return e.clientX - r.left - r.width / 2; };
  const enter = (e: PointerEvent) => { const x = local(e); if (target === null) px = x; target = x; kick(); };
  const move = (e: PointerEvent) => { target = local(e); kick(); };
  const leave = () => { target = null; kick(); };
</script>

<nav bind:this={nav} class:active aria-label={L('Halaman', 'Pages')} onpointerenter={enter} onpointermove={move} onpointerleave={leave}>
  <div class="pips" style:opacity={1 - show} style:pointer-events={show > 0.4 ? 'none' : 'auto'}>
    {#each PAGES as p, i}
      <button class="pip" class:on={i === notch.page} aria-label={p.title()} onclick={() => notch.select(i)}></button>
    {/each}
  </div>
  <div class="tiles" style:opacity={show} style:transform="translateX(-50%) scale({0.6 + 0.4 * hv})" style:pointer-events={show > 0.4 ? 'auto' : 'none'}>
    {#each PAGES as p, i}
      {@const Icon = ICONS[p.id]}
      {@const size = sizes[i]}
      <button class="tile" class:on={i === notch.page} aria-label={p.title()} onclick={() => notch.select(i)}
        style:width="{size}px" style:height="{size}px" style:border-radius="{size * 0.28}px">
        <Icon size={size * 0.5} strokeWidth={2.2} />
        {#if i === nearest}<span class="tip" style:opacity={Math.min(1, Math.max(0, (hv - 0.5) * 2))}>{p.title()}</span>{/if}
      </button>
    {/each}
  </div>
</nav>

<style>
  nav { position: relative; height: 22px; width: 340px; margin: 0 auto; flex: none; z-index: 3; }
  /* Saat diarahkan, area sambut setinggi kotak terbesar supaya kursor tidak "jatuh" saat kotak membesar. */
  nav.active::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 48px; }
  button { border: 0; padding: 0; cursor: pointer; flex: none; position: relative; }
  .pips, .tiles { position: absolute; bottom: 2px; left: 50%; display: flex; align-items: flex-end; }
  .pips { gap: 6px; transform: translateX(-50%); }
  .tiles { gap: 4px; transform-origin: 50% 100%; }
  .pip { width: 6px; height: 6px; border-radius: 99px; background: rgba(255, 255, 255, .3); }
  .pip.on { width: 16px; background: #fff; }
  .tile { display: grid; place-items: center; background: rgba(255, 255, 255, .16); color: #fff; }
  .tile.on { background: var(--accent); color: #fff; }
  .tip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); padding: 3px 10px; border-radius: 99px; background: rgba(255, 255, 255, .18); font-size: 11px; font-weight: 600; white-space: nowrap; pointer-events: none; }
</style>
