<script lang="ts">
  import { clockTools as c } from '../state.svelte';
  import { clock, ticker } from '../store.svelte';
  import { L } from '../i18n';
  import { Pause, Play } from '@lucide/svelte';
  const presets = [5, 15, 30];
  let custom = $state(20);
  let time = $state('07:00');
  let label = $state('');
  let days = $state<number[]>([]);
  const dayNames = [[2, 'Sen', 'Mon'], [3, 'Sel', 'Tue'], [4, 'Rab', 'Wed'], [5, 'Kam', 'Thu'], [6, 'Jum', 'Fri'], [7, 'Sab', 'Sat'], [1, 'Min', 'Sun']] as const;
  const pad = (n: number) => String(n).padStart(2, '0');
  function toggleDay(d: number) { days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]; }
  function add() {
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    c.addAlarm(h, m, days, label);
    label = '';
  }
  const repeat = (d: number[]) => (d.length === 0 ? L('Sekali', 'Once') : d.length === 7 ? L('Setiap hari', 'Every day') : dayNames.filter(([n]) => d.includes(n)).map(([, id, en]) => L(id, en)).join(' '));
</script>

<div class="cols">
  <div class="col" style="width:150px">
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
  <div class="col grow" style="min-width:0">
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
        <span class="dim">{L('Pilih durasi.', 'Pick a length.')}</span>
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
  <div class="sep"></div>
  <div class="col" style="width:212px">
    <span class="label">{L('Alarm', 'Alarm')}</span>
    <div class="row">
      <input class="alarm-time" type="time" bind:value={time} aria-label={L('Jam alarm', 'Alarm time')} />
      <button class="btn on" onclick={add}>{L('Tambah', 'Add')}</button>
    </div>
    <div class="row">
      {#each dayNames as [n, id, en]}
        <button class="btn day" class:on={days.includes(n)} aria-pressed={days.includes(n)} onclick={() => toggleDay(n)}>{L(id, en)}</button>
      {/each}
    </div>
    <input class="alarm-label" placeholder={L('Nama (opsional)', 'Name (optional)')} bind:value={label} maxlength="40" />
    <div class="list">
      {#if c.alarms.length === 0}
        <span class="dim">{L('Belum ada alarm. Tanpa hari dipilih, alarm berbunyi sekali.', 'No alarms yet. With no day picked, it rings once.')}</span>
      {/if}
      {#each c.alarms as a (a.id)}
        <div class="item" style:opacity={a.enabled ? 1 : 0.5}>
          <b style="font-variant-numeric:tabular-nums">{pad(a.hour)}:{pad(a.minute)}</b>
          <span class="dim grow">{a.label || repeat(a.days)}</span>
          <button class="x" aria-label={a.enabled ? L('Matikan', 'Turn off') : L('Nyalakan', 'Turn on')} onclick={() => c.toggleAlarm(a.id)}>{a.enabled ? '●' : '○'}</button>
          <button class="x" aria-label={L('Hapus', 'Delete')} onclick={() => c.removeAlarm(a.id)}>×</button>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .row { flex-wrap: wrap; gap: 4px; }
  .col { min-width: 0; }
  .day { padding: 3px 5px; font-size: 10px; min-width: 0; }
  .alarm-time, .alarm-label { background: rgba(255,255,255,.08); color: inherit; border: 0; border-radius: 8px; padding: 4px 8px; font: inherit; color-scheme: dark; }
  .alarm-label { width: 100%; box-sizing: border-box; font-size: 11px; }
</style>
