<script lang="ts">
  import { pomodoro as p, PRESETS } from '../state.svelte';
  import { clock } from '../store.svelte';
  import { L } from '../i18n';
  const R = 44, C = 2 * Math.PI * R;
</script>

<div class="cols" style="align-items:center">
  <div class="ring">
    <svg viewBox="0 0 100 100" width="120" height="120">
      <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.1)" stroke-width="6" />
      <circle cx="50" cy="50" r={R} fill="none" stroke={p.mode === 'focus' ? 'var(--accent)' : '#5fd38d'} stroke-width="6" stroke-linecap="round"
        stroke-dasharray={C} stroke-dashoffset={C * (1 - p.progress)} transform="rotate(-90 50 50)" />
    </svg>
    <div class="time">{clock(p.remaining)}</div>
  </div>
  <div class="col grow" style="gap:10px">
    <div class="row">
      <button class="btn" class:on={p.mode === 'focus'} onclick={() => p.select('focus')}>{L('Fokus', 'Focus')}</button>
      <button class="btn" class:on={p.mode === 'rest'} onclick={() => p.select('rest')}>{L('Istirahat', 'Break')}</button>
      <span class="dim" style="margin-left:auto">{L(`${p.sessions} sesi hari ini`, `${p.sessions} sessions today`)}</span>
    </div>
    <div class="row">
      <button class="btn on" onclick={() => p.toggle()}>{p.running ? L('Jeda', 'Pause') : p.idle ? L('Mulai', 'Start') : L('Lanjut', 'Resume')}</button>
      <button class="btn" onclick={() => p.reset()} disabled={p.idle}>{L('Ulang', 'Reset')}</button>
      <button class="btn" onclick={() => p.adjust(-5)} disabled={p.running}>-5</button>
      <span class="dim" style="min-width:64px;text-align:center">{p.mode === 'focus' ? p.focusMin : p.restMin} {L('menit', 'min')}</span>
      <button class="btn" onclick={() => p.adjust(5)} disabled={p.running}>+5</button>
    </div>
    <div class="row">
      {#each PRESETS as [f, r]}
        <button class="btn" onclick={() => p.setMinutes(f, r)} disabled={p.running}>{f}/{r}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .ring { position: relative; width: 120px; height: 120px; margin-left: 20px; }
  .time { position: absolute; inset: 0; display: grid; place-items: center; font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
