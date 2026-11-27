<script lang="ts">
  import { House, Music, Timer, AlarmClock, Droplet, ListChecks, NotebookPen, ClipboardList, Inbox, ScanFace, Zap, CloudSun, BookOpen } from '@lucide/svelte';
  import { ui } from './ui.svelte';
  import { notch } from './notch.svelte';
  import { L } from './i18n';

  // Titik halaman, sama dengan Mac: saat diarahkan, titik berganti jadi bar ikon rata; halaman aktif jadi pil
  // beraksen dengan namanya, halaman lain menampilkan nama di atasnya saat disorot. Bar tumbuh ke atas.
  const ICONS: Record<string, typeof House> = {
    home: House, music: Music, timer: Timer, clock: AlarmClock, sky: CloudSun, water: Droplet, todo: ListChecks,
    notes: NotebookPen, clipboard: ClipboardList, tray: Inbox, mirror: ScanFace, shortcuts: Zap, cognify: BookOpen,
  };
  const onSky = $derived(ui.pages[notch.page]?.id === 'sky');
</script>

<nav class:sky={onSky} aria-label={L('Halaman', 'Pages')}>
  <div class="dots" aria-hidden="true">{#each ui.pages as p, i (p.id)}<i class:on={i === notch.page}></i>{/each}</div>
  <div class="pgbar">
    {#each ui.pages as p, i (p.id)}
      {@const Icon = ICONS[p.id]}
      <button class:on={i === notch.page} aria-label={p.title()} aria-current={i === notch.page ? 'page' : undefined} onclick={() => notch.select(i)}>
        <Icon size={14} strokeWidth={2.2} />
        {#if i === notch.page}<b>{p.title()}</b>{:else}<span>{p.title()}</span>{/if}
      </button>
    {/each}
  </div>
</nav>

<style>
  nav { position: relative; display: flex; justify-content: center; height: 40px; width: fit-content; min-width: 340px; margin: 0 auto; flex: none; z-index: 3; }
  /* Area sambut setinggi bar supaya kursor tidak keluar saat bar muncul. */
  nav:hover::before { content: ''; position: absolute; left: -12px; right: -12px; bottom: 0; height: 40px; }
  .dots { display: flex; align-items: center; gap: 5px; align-self: center; transition: opacity .22s ease, transform .38s cubic-bezier(.32, .72, 0, 1); }
  .dots i { width: 5px; height: 5px; border-radius: 99px; background: rgba(255, 255, 255, .22); transition: width .38s cubic-bezier(.32, .72, 0, 1), background-color .28s ease; }
  .dots i.on { width: 16px; background: var(--accent); }
  .pgbar { position: absolute; bottom: 6px; left: 50%; display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: 99px; background: #1f1f22; opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(6px) scale(.92); transform-origin: 50% 100%; transition: opacity .22s ease, transform .38s cubic-bezier(.32, .72, 0, 1); }
  nav:hover .dots, nav:focus-within .dots { opacity: 0; transform: scale(1.15); }
  nav:hover .pgbar, nav:focus-within .pgbar { opacity: 1; transform: translateX(-50%); pointer-events: auto; }
  button { position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; flex: none; min-width: 24px; height: 24px; padding: 0; border: 0; border-radius: 99px; background: transparent; color: #a1a1a6; cursor: pointer; }
  button:hover:not(.on) { background: rgba(255, 255, 255, .12); color: #fff; }
  button.on { padding: 0 11px 0 9px; background: var(--accent); color: #fff; }
  b { font-size: 11px; font-weight: 700; white-space: nowrap; }
  span { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); padding: 2px 8px; border-radius: 99px; background: #2c2c30; color: #fff; font-size: 10.5px; font-weight: 600; white-space: nowrap; opacity: 0; pointer-events: none; }
  button:hover span, button:focus-visible span { opacity: 1; }
  .sky .dots i { background: rgba(255, 255, 255, .5); }
  .sky .dots i.on, .sky button.on { background: #fff; }
  .sky button.on { color: #1d4f9c; }
  @media (prefers-reduced-motion: reduce) { .dots, .dots i, .pgbar { transition: none; } }
</style>
