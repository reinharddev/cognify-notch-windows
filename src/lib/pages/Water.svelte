<script lang="ts">
  import { water as w } from '../state.svelte';
  import { L } from '../i18n';
  let editing = $state(false);
  const liters = (ml: number) => (ml / 1000).toFixed(2).replace(/\.?0+$/, '') || '0';
  const max = $derived(Math.max(1, ...w.hourly.map((h) => h.ml)));
  const step = (key: 'goal' | 'glass' | 'interval' | 'startHour' | 'endHour', d: number, lo: number, hi: number) => {
    w[key] = Math.max(lo, Math.min(hi, w[key] + d));
    w.persist();
  };
</script>

<div class="cols">
  <div class="col" style="width:250px">
    <div class="row" style="align-items:baseline;gap:5px">
      <span class="big">{liters(w.total)}</span><span class="dim" style="font-weight:600">/ {liters(w.goal)} L</span>
    </div>
    <div class="row dim"><span>{L('Hari ini', 'Today')}</span><b style="color:#fff">{Math.round(w.progress * 100)}%</b>
      {#if w.total >= w.goal}<span style="color:#5fd38d">{L('Target tercapai', 'Goal reached')}</span>{/if}</div>
    <div class="bar" style="width:190px;--tint:#4fd1e8"><i style:width="{w.progress * 100}%"></i></div>
    <div class="row">
      <button class="btn on" onclick={() => w.drink()}>{L(`Minum ${w.glass} ml`, `Drink ${w.glass} ml`)}</button>
      <button class="btn" aria-label={L('Atur', 'Settings')} onclick={() => (editing = !editing)}>{editing ? '▮▮' : '⚙'}</button>
      {#if w.today.length}<button class="btn" aria-label={L('Batalkan minum terakhir', 'Undo last drink')} onclick={() => w.undo()}>↶</button>{/if}
    </div>
    <label class="row dim" style="font-size:10.5px;cursor:pointer">
      <input type="checkbox" bind:checked={w.reminders} onchange={() => w.persist()} />
      {L(`Ingatkan tiap ${w.interval} menit, ${w.startHour}.00-${w.endHour}.00`, `Every ${w.interval} min, ${w.startHour}:00-${w.endHour}:00`)}
    </label>
  </div>
  <div class="sep"></div>
  {#if editing}
    <div class="col grow" style="font-size:11.5px">
      {#each [
        [L('Target harian (ml)', 'Daily goal (ml)'), 'goal', 250, 500, 6000],
        [L('Sekali minum (ml)', 'Per drink (ml)'), 'glass', 50, 50, 1000],
        [L('Jeda pengingat (menit)', 'Reminder gap (min)'), 'interval', 15, 15, 240],
        [L('Mulai jam', 'From hour'), 'startHour', 1, 0, 23],
        [L('Sampai jam', 'Until hour'), 'endHour', 1, 1, 24],
      ] as const as [name, key, d, lo, hi]}
        <div class="row"><span class="dim grow">{name}</span>
          <button class="btn" onclick={() => step(key, -d, lo, hi)}>-</button>
          <b style="min-width:44px;text-align:center">{w[key]}</b>
          <button class="btn" onclick={() => step(key, d, lo, hi)}>+</button></div>
      {/each}
    </div>
  {:else}
    <div class="col grow">
      <span class="label">{L('Per jam', 'By hour')}</span>
      <div class="chart">
        {#each w.hourly as h}
          <div class="barwrap" title="{h.hour}.00: {h.ml} ml">
            <i style:height="{(h.ml / max) * 100}%" class:zero={h.ml === 0}></i>
            <small>{h.hour}</small>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .chart { flex: 1; display: flex; align-items: flex-end; gap: 3px; min-height: 0; padding-bottom: 2px; }
  .barwrap { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 3px; }
  .barwrap i { width: 100%; max-width: 18px; min-height: 3px; border-radius: 4px 4px 2px 2px; background: #4fd1e8; transition: height .3s; }
  .barwrap i.zero { background: rgba(255, 255, 255, .1); height: 3px !important; }
  small { font-size: 8.5px; color: rgba(255, 255, 255, .4); }
</style>
