<script lang="ts">
  import { clockTools as c } from '../state.svelte';
  import { clock, ticker } from '../store.svelte';
  import { L } from '../i18n';
  import { Pause, Play } from '@lucide/svelte';
  const presets = [1, 3, 5, 10, 15, 30];
  let custom = $state(20);
</script>

<div class="cols">
  <div class="col" style="width:250px">
    <span class="label">Stopwatch</span>
    <span class="mid">{clock(c.elapsed, true)}</span>
    <div class="row">
      <button class="btn on" onclick={() => c.toggle()}>{#if c.running}<Pause size={11} fill="currentColor" />{:else}<Play size={11} fill="currentColor" />{/if} {c.running ? L('Jeda', 'Pause') : c.elapsed > 0 ? L('Lanjut', 'Resume') : L('Mulai', 'Start')}</button>
      <button class="btn" onclick={() => c.lap()} disabled={!c.running}>Lap</button>
      <button class="btn" onclick={() => c.reset()} disabled={c.running || c.elapsed === 0}>{L('Ulang', 'Reset')}</button>
    </div>
    <div class="dim" style="font-size:10.5px;font-variant-numeric:tabular-nums">
      {#each c.laps.slice(0, 3) as lap, i}<div>Lap {c.laps.length - i}&nbsp;&nbsp;&nbsp;{clock(lap, true)}</div>{/each}
    </div>
  </div>
  <div class="sep"></div>
  <div class="col grow">
    <span class="label">{L('Hitung mundur', 'Countdown')}</span>
    <div class="row">
      {#each presets as m}<button class="btn" onclick={() => c.start(m)}>{m}m</button>{/each}
    </div>
    <div class="row">
      <button class="btn" onclick={() => (custom = Math.max(1, custom - 5))}>-</button>
      <span style="min-width:62px;text-align:center;font-weight:600">{custom} {L('menit', 'min')}</span>
      <button class="btn" onclick={() => (custom = Math.min(240, custom + 5))}>+</button>
      <button class="btn on" onclick={() => c.start(custom)}><Play size={11} fill="currentColor" /> {L('Mulai', 'Start')}</button>
    </div>
    <div class="list">
      {#if c.countdowns.length === 0}
        <span class="dim">{L('Pilih durasi untuk mulai menghitung mundur.', 'Pick a length to start a countdown.')}</span>
      {/if}
      {#each [...c.countdowns].sort((a, b) => a.end - b.end) as item (item.id)}
        {@const left = (item.end - ticker.now) / 1000}
        <div class="item">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2.5" />
            <circle cx="8" cy="8" r="6" fill="none" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round" stroke-dasharray={37.7}
              stroke-dashoffset={37.7 * (left / item.total)} transform="rotate(-90 8 8)" /></svg>
          <span class="dim grow">{item.label}</span>
          <b style="font-variant-numeric:tabular-nums">{clock(left)}</b>
          <button class="x" aria-label={L('Batalkan', 'Cancel')} onclick={() => c.cancel(item.id)}>×</button>
        </div>
      {/each}
    </div>
  </div>
</div>
