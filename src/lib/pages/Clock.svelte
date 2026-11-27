<script lang="ts">
  import Input from '../ui/Input.svelte';
  import { clockTools as c } from '../state.svelte';
  import { clock, ticker } from '../store.svelte';
  import { L } from '../i18n';
  import { Bell, BellOff, Minus, Pause, Play, Plus, X } from '@lucide/svelte';
  const presets = [1, 5, 10, 25];
  let custom = $state(15);
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

<div class="three">
  <div class="card scroll">
    <div class="lb">Stopwatch</div>
    <div class="big">{clock(c.elapsed, true).split('.')[0]}<span>{clock(c.elapsed, true).includes('.') ? '.' + clock(c.elapsed, true).split('.')[1] : ''}</span></div>
    <div class="acts">
      <button class="btn on" onclick={() => c.toggle()}>{#if c.running}<Pause size={11} fill="currentColor" />{:else}<Play size={11} fill="currentColor" />{/if} {c.running ? L('Jeda', 'Pause') : c.elapsed > 0 ? L('Lanjut', 'Resume') : L('Mulai', 'Start')}</button>
      <button class="btn" onclick={() => c.lap()} disabled={!c.running}>Lap</button>
      <button class="btn" onclick={() => c.reset()} disabled={c.running || c.elapsed === 0}>{L('Ulang', 'Reset')}</button>
    </div>
    {#each c.laps.slice(0, 3) as lap, i}<div class="li"><span class="grow">Lap {c.laps.length - i}</span><span>{clock(lap, true)}</span></div>{/each}
  </div>

  <div class="card scroll">
    <div class="lb">{L('Hitung mundur', 'Countdown')}</div>
    <div class="wrap">{#each presets as m}<button class="btn" onclick={() => c.start(m)}>{m} {L('mnt', 'min')}</button>{/each}</div>
    <div class="step">
      <button class="round" aria-label={L('Kurangi', 'Decrease')} onclick={() => (custom = Math.max(1, custom - 5))}><Minus size={12} /></button>
      <b>{custom} {L('menit', 'min')}</b>
      <button class="round" aria-label={L('Tambah', 'Add')} onclick={() => (custom = Math.min(240, custom + 5))}><Plus size={12} /></button>
    </div>
    <button class="btn on" onclick={() => c.start(custom)}><Play size={11} fill="currentColor" /> {L('Mulai', 'Start')}</button>
    {#each [...c.countdowns].sort((a, b) => a.end - b.end) as item (item.id)}
      {@const left = (item.end - ticker.now) / 1000}
      <div class="li">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2.5" />
          <circle cx="8" cy="8" r="6" fill="none" stroke="#ff9f43" stroke-width="2.5" stroke-linecap="round" stroke-dasharray={37.7} stroke-dashoffset={37.7 * (left / item.total)} transform="rotate(-90 8 8)" /></svg>
        <small class="grow one">{item.label}</small><b>{clock(left)}</b>
        <button class="icon" aria-label={L('Batalkan', 'Cancel')} onclick={() => c.cancel(item.id)}><X size={12} /></button>
      </div>
    {/each}
  </div>

  <div class="card scroll">
    <div class="lb">{L('Alarm', 'Alarm')}</div>
    <div class="step">
      <Input type="time" size="sm" width="104px" bind:value={time} aria-label={L('Jam alarm', 'Alarm time')} />
      <button class="btn on" onclick={add}><Plus size={12} /> {L('Tambah', 'Add')}</button>
    </div>
    <div class="days">
      {#each dayNames as [n, id, en]}<button class:on={days.includes(n)} aria-pressed={days.includes(n)} onclick={() => toggleDay(n)}>{L(id, en)}</button>{/each}
    </div>
    <Input size="sm" placeholder={L('Nama (opsional)', 'Name (optional)')} bind:value={label} maxlength={40} />
    {#each c.alarms as a (a.id)}
      <div class="li" style:opacity={a.enabled ? 1 : 0.5}>
        <b>{pad(a.hour)}:{pad(a.minute)}</b>
        <small class="grow one">{a.label || repeat(a.days)}</small>
        <button class="icon" aria-label={a.enabled ? L('Matikan', 'Turn off') : L('Nyalakan', 'Turn on')} onclick={() => c.toggleAlarm(a.id)}>{#if a.enabled}<Bell size={12} />{:else}<BellOff size={12} />{/if}</button>
        <button class="icon" aria-label={L('Hapus', 'Delete')} onclick={() => c.removeAlarm(a.id)}><X size={12} /></button>
      </div>
    {/each}
  </div>
</div>

<style>
  .three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; height: 164px; }
  .card { gap: 6px; }
  .lb { margin: 2px 4px 0; flex: none; }
  .big { flex: none; padding: 0 4px; font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.15; }
  .big span { font-size: 16px; color: var(--muted); }
  .acts { display: flex; gap: 4px; flex: none; }
  .acts .btn { padding: 0 8px; }
  .wrap { display: flex; flex-wrap: wrap; gap: 4px; flex: none; }
  .step { display: flex; align-items: center; justify-content: space-between; gap: 4px; flex: none; font-size: 12px; }
  .step .round { width: 24px; height: 24px; }
  .days { display: flex; gap: 2px; flex: none; }
  .days button { flex: 1; min-width: 0; padding: 4px 0; border: 0; border-radius: 99px; background: rgba(255, 255, 255, .06); color: inherit; font-size: 9px; font-weight: 600; cursor: pointer; }
  .days button.on { background: var(--accent); color: #fff; }
  .li b { font-variant-numeric: tabular-nums; }
</style>
