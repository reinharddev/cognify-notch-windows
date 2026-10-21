<script lang="ts">
  import { Brain, Coffee, Play, Pause, RotateCcw, Minus, Plus } from '@lucide/svelte';
  import { pomodoro as p, PRESETS } from '../state.svelte';
  import { clock, ticker } from '../store.svelte';
  import { L } from '../i18n';

  // Susunan sama dengan versi Mac: cincin di kiri; di tengah pilihan mode, durasi, preset, dan titik sesi;
  // di kanan tombol mulai/jeda bulat besar. Warna aksen hanya dipakai pada hal yang sedang aktif.
  const R = 44, C = 2 * Math.PI * R;
  const tint = $derived(p.mode === 'focus' ? 'var(--accent)' : '#5fd38d');
  const minutes = $derived(p.mode === 'focus' ? p.focusMin : p.restMin);
  const step = $derived(p.mode === 'focus' ? 5 : 1);
  const endsAt = $derived(new Date(ticker.now + p.remaining * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const dots = $derived(Math.max(4, Math.min(8, p.sessions)));
</script>

<div class="pomo">
  <div class="ring">
    <svg viewBox="0 0 100 100" width="124" height="124">
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.08)" stroke-width="7" />
      <circle cx="50" cy="50" r={R} fill="none" stroke={tint} stroke-width="7" stroke-linecap="round"
        stroke-dasharray={C} stroke-dashoffset={C * (1 - p.progress)} transform="rotate(-90 50 50)" />
    </svg>
    <div class="inside">
      <b class="time">{clock(p.remaining)}</b>
      <small style:color={p.running ? tint : 'rgba(255,255,255,.5)'}>{p.running ? L('Selesai ', 'Ends ') + endsAt : p.mode === 'focus' ? L('Fokus', 'Focus') : L('Istirahat', 'Break')}</small>
    </div>
  </div>

  <div class="mid" class:locked={p.running}>
    <div class="seg" role="group">
      <button class:sel={p.mode === 'focus'} class:focus={true} onclick={() => p.select('focus')} disabled={p.running}>
        <Brain size={12} /><span>{L('Fokus', 'Focus')}</span><small>{p.focusMin}m</small>
      </button>
      <button class:sel={p.mode === 'rest'} class:rest={true} onclick={() => p.select('rest')} disabled={p.running}>
        <Coffee size={12} /><span>{L('Istirahat', 'Break')}</span><small>{p.restMin}m</small>
      </button>
    </div>
    <div class="stepper">
      <button aria-label={L('Kurangi', 'Shorter')} onclick={() => p.adjust(-step)} disabled={p.running}><Minus size={12} strokeWidth={2.6} /></button>
      <span>{minutes} {L('menit', 'min')}</span>
      <button aria-label={L('Tambah', 'Longer')} onclick={() => p.adjust(step)} disabled={p.running}><Plus size={12} strokeWidth={2.6} /></button>
    </div>
    <div class="presets">
      {#each PRESETS as [f, r]}
        <button class:sel={p.focusMin === f && p.restMin === r} onclick={() => p.setMinutes(f, r)} disabled={p.running}>{f}/{r}</button>
      {/each}
    </div>
    <div class="sessions">
      <span class="dots">{#each Array(dots) as _, i}<i class:on={i < p.sessions}></i>{/each}</span>
      <small>{p.sessions === 0 ? L('Belum ada sesi fokus hari ini', 'No focus sessions yet today') : L(`${p.sessions} sesi fokus hari ini`, `${p.sessions} focus sessions today`)}</small>
    </div>
  </div>

  <div class="ctl">
    <button class="play" style:--tint={tint} aria-label={p.running ? L('Jeda', 'Pause') : p.idle ? L('Mulai', 'Start') : L('Lanjut', 'Resume')} onclick={() => p.toggle()}>
      {#if p.running}<Pause size={22} fill="currentColor" strokeWidth={0} />{:else}<Play size={22} fill="currentColor" strokeWidth={0} style="margin-left:3px" />{/if}
    </button>
    <button class="reset" onclick={() => p.reset()} disabled={p.idle}><RotateCcw size={11} strokeWidth={2.4} />{L('Ulang', 'Reset')}</button>
  </div>
</div>

<style>
  .pomo { display: flex; align-items: center; gap: 18px; height: 100%; padding: 0 6px; }
  .ring { position: relative; width: 124px; height: 124px; flex: none; }
  .inside { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
  .time { font-size: 27px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .inside small { font-size: 10.5px; font-weight: 500; }
  .mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 9px; align-items: flex-start; transition: opacity .2s; }
  .mid.locked { opacity: .55; }
  button { border: 0; background: none; cursor: pointer; color: inherit; padding: 0; }
  button:disabled { cursor: default; }
  .seg { display: flex; padding: 3px; border-radius: 99px; background: rgba(255, 255, 255, .08); }
  .seg button { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 99px; font-size: 11.5px; font-weight: 600; color: rgba(255, 255, 255, .6); }
  .seg button small { font-size: 10.5px; font-weight: 500; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, .45); }
  .seg button.sel { color: #fff; }
  .seg button.sel small { color: rgba(255, 255, 255, .8); }
  .seg button.sel.focus { background: var(--accent); }
  .seg button.sel.rest { background: rgba(95, 211, 141, .85); }
  .stepper { display: flex; align-items: center; border-radius: 99px; background: rgba(255, 255, 255, .08); }
  .stepper button { width: 26px; height: 24px; display: grid; place-items: center; }
  .stepper button:hover:not(:disabled) { background: rgba(255, 255, 255, .1); border-radius: 99px; }
  .stepper span { min-width: 62px; text-align: center; font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .presets { display: flex; gap: 2px; }
  .presets button { padding: 5px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 600; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, .45); box-shadow: inset 0 0 0 1px transparent; }
  .presets button.sel { color: rgba(255, 255, 255, .95); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .35); }
  .sessions { display: flex; align-items: center; gap: 7px; }
  .dots { display: flex; gap: 4px; }
  .dots i { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, .14); }
  .dots i.on { background: var(--accent); }
  .sessions small { font-size: 10.5px; color: rgba(255, 255, 255, .5); }
  .ctl { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 84px; flex: none; }
  .play { width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: var(--tint); color: #fff; box-shadow: 0 3px 10px color-mix(in srgb, var(--tint) 45%, transparent); transition: transform .1s; }
  .play:active { transform: scale(.94); }
  .reset { display: flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 600; color: rgba(255, 255, 255, .6); }
  .reset:disabled { opacity: .35; }
  .reset:hover:not(:disabled) { color: #fff; }
</style>
