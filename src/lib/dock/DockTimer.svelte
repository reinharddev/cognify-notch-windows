<script lang="ts">
  // Timer cepat: tekan salah satu preset menit untuk mulai. Berjalan di dock sendiri (disimpan sebagai waktu selesai,
  // jadi tetap benar walau dock ditutup lalu dibuka lagi) dan memberi bunyi serta kartu di notch saat selesai.
  // Saat berjalan: cincin progres di sekeliling ikon, sisa waktu, dan tombol batal.
  import { onMount } from 'svelte';
  import { Check, Timer, X } from '@lucide/svelte';
  import { cmd, send } from '../bridge';
  import { load, save } from '../store.svelte';
  import { L } from '../i18n';

  let { w, presets }: { w: number; presets: number[] } = $props();
  type Run = { endsAt: number; minutes: number };

  let run = $state<Run | null>(load<Run | null>('dock.timer', null));
  let now = $state(Date.now());
  let doneUntil = $state(0);
  let tick = 0;

  const remaining = $derived(run ? Math.max(0, Math.ceil((run.endsAt - now) / 1000)) : 0);
  const ratio = $derived(run ? Math.min(1, Math.max(0, 1 - (run.endsAt - now) / (run.minutes * 60_000))) : 0);
  const label = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function start(minutes: number) {
    run = { endsAt: Date.now() + minutes * 60_000, minutes };
    save('dock.timer', run);
    now = Date.now();
    clock();
  }

  function cancel() {
    run = null;
    save('dock.timer', null);
    stop();
  }

  function finish() {
    const minutes = run?.minutes ?? 0;
    run = null;
    save('dock.timer', null);
    stop();
    doneUntil = Date.now() + 6000;
    void cmd('play_chime', { soft: false });
    send('dock-timer-done', minutes);
    setTimeout(() => (doneUntil = 0), 6200);
  }

  function clock() {
    if (tick) return;
    tick = window.setInterval(() => {
      now = Date.now();
      if (run && now >= run.endsAt) finish();
    }, 500);
  }

  function stop() { clearInterval(tick); tick = 0; }

  onMount(() => {
    // Timer yang selesai saat dock tertutup lama tidak dibunyikan lagi; yang baru lewat sebentar masih diberi tahu.
    if (run && Date.now() - run.endsAt > 60_000) { run = null; save('dock.timer', null); }
    if (run) { clock(); if (Date.now() >= run.endsAt) finish(); }
    return stop;
  });
</script>

<div class="dk-chip box" style:width="{w}px" role="group" aria-label={L('Timer cepat', 'Quick timer')}>
  {#if run}
    <svg class="ring" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <circle class="trk" cx="16" cy="16" r="13" />
      <circle class="arc" cx="16" cy="16" r="13" pathLength="100" stroke-dasharray="100" stroke-dashoffset={100 - ratio * 100} />
    </svg>
    <span class="time">{label(remaining)}</span>
    <button class="dk-btn x" aria-label={L('Batalkan timer', 'Cancel timer')} title={L('Batalkan timer', 'Cancel timer')} onclick={cancel}><X size={13} /></button>
  {:else if doneUntil > Date.now()}
    <span class="okc"><Check size={15} /></span><span class="done">{L('Selesai', 'Done')}</span>
  {:else}
    <Timer size={15} class="dk-ic" />
    <span class="presets">
      {#each presets as m (m)}
        <button class="dk-pill" title={L(`Mulai ${m} menit`, `Start ${m} minutes`)} onclick={() => start(m)}>{m}m</button>
      {/each}
    </span>
  {/if}
</div>

<style>
  .box { gap: 8px; padding: 0 2px; }
  .presets { display: flex; gap: 4px; }
  .ring { flex: none; transform: rotate(-90deg); }
  .trk { fill: none; stroke: rgb(var(--ink, 255 255 255) / .14); stroke-width: 3; }
  .arc { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset .5s linear; }
  .time { font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
  .x { width: 24px; height: 24px; margin-left: auto; }
  .okc { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: #0b0a1a; }
  .done { font-weight: 650; }
  @media (prefers-reduced-motion: reduce) { .arc { transition: none; } }
</style>
