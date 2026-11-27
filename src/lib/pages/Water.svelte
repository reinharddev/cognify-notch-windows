<script lang="ts">
  import { Droplet, Minus, Plus, SlidersHorizontal, Undo2 } from '@lucide/svelte';
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

<div class="water">
  <div class="left">
    <div class="num">{liters(w.total)} <span>/ {liters(w.goal)} L</span></div>
    <div class="today"><span>{L('Hari ini', 'Today')}</span> <b>{Math.round(w.progress * 100)}%</b>{#if w.total >= w.goal} <span class="done">{L('Target tercapai', 'Goal reached')}</span>{/if}</div>
    <div class="prog"><i style:width="{w.progress * 100}%"></i></div>
    <div class="acts">
      <button class="btn on" onclick={() => w.drink()}><Droplet size={13} fill="currentColor" /> {L(`Minum ${w.glass} ml`, `Drink ${w.glass} ml`)}</button>
      <button class="btn sq" class:on={editing} aria-label={L('Atur', 'Settings')} aria-pressed={editing} onclick={() => (editing = !editing)}><SlidersHorizontal size={14} /></button>
      {#if w.today.length}<button class="btn sq" aria-label={L('Batalkan minum terakhir', 'Undo last drink')} onclick={() => w.undo()}><Undo2 size={14} /></button>{/if}
    </div>
    <label class="rem">
      <input type="checkbox" role="switch" bind:checked={w.reminders} onchange={() => w.persist()} />
      <span>{L(`Ingatkan tiap ${w.interval} menit, ${w.startHour}.00-${w.endHour}.00`, `Every ${w.interval} min, ${w.startHour}:00-${w.endHour}:00`)}</span>
    </label>
  </div>
  {#if editing}
    <div class="card scroll edit">
      {#each [
        [L('Target harian (ml)', 'Daily goal (ml)'), 'goal', 250, 500, 6000],
        [L('Sekali minum (ml)', 'Per drink (ml)'), 'glass', 50, 50, 1000],
        [L('Jeda pengingat (menit)', 'Reminder gap (min)'), 'interval', 15, 15, 240],
        [L('Mulai jam', 'From hour'), 'startHour', 1, 0, 23],
        [L('Sampai jam', 'Until hour'), 'endHour', 1, 1, 24],
      ] as const as [name, key, d, lo, hi]}
        <div class="li"><small class="grow">{name}</small>
          <button class="icon" aria-label={L('Kurangi', 'Decrease') + ' ' + name} onclick={() => step(key, -d, lo, hi)}><Minus size={12} /></button>
          <b>{w[key]}</b>
          <button class="icon" aria-label={L('Tambah', 'Increase') + ' ' + name} onclick={() => step(key, d, lo, hi)}><Plus size={12} /></button></div>
      {/each}
    </div>
  {:else}
    <div class="card chart">
      <div class="bars">
        {#each w.hourly as h}<i style:height={h.ml ? `${(h.ml / max) * 100}%` : '6px'} class:z={h.ml === 0} title="{h.hour}.00: {h.ml} ml"></i>{/each}
      </div>
      <div class="ax">{#each w.hourly.filter((_, i) => i % 3 === 0) as h}<span>{String(h.hour).padStart(2, '0')}</span>{/each}</div>
    </div>
  {/if}
</div>

<style>
  .water { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 12px; height: 164px; padding-left: 8px; }
  .left { display: flex; flex-direction: column; min-width: 0; }
  .num { font-size: 36px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .num span { font-size: 13px; color: var(--muted); }
  .today { font-size: 12px; color: var(--muted); }
  .today b { color: var(--ink, #fff); }
  .done { color: #30d158; }
  .prog { height: 6px; flex: none; border-radius: 3px; background: rgba(255, 255, 255, .09); margin: 8px 0 10px; }
  .prog i { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, #0a84ff, #64d2ff); transition: width .3s; }
  .acts { display: flex; gap: 6px; }
  .acts .btn { height: 30px; padding: 0 12px; }
  .acts .sq { min-width: 34px; padding: 0; }
  .rem { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 11px; color: var(--muted); cursor: pointer; }
  .rem input { appearance: none; -webkit-appearance: none; position: relative; flex: none; width: 30px; height: 18px; margin: 0; border: 0; border-radius: 9px; background: rgba(255, 255, 255, .18); cursor: pointer; }
  .rem input::after { content: ''; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px; border: 0; border-radius: 50%; background: #fff; transform: none; transition: left .15s; }
  .rem input:checked { background: var(--accent); }
  .rem input:checked::after { content: ''; left: 14px; width: 14px; height: 14px; margin: 0; border: 0; transform: none; }
  .chart { gap: 6px; padding: 12px 12px 8px; }
  .bars { flex: 1; display: flex; align-items: flex-end; gap: 5px; min-height: 0; }
  .bars i { flex: 1; border-radius: 99px; background: linear-gradient(#64d2ff, #0a84ff); transition: height .3s; }
  .bars i.z { background: rgba(255, 255, 255, .08); }
  .ax { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); }
  .edit { gap: 4px; font-variant-numeric: tabular-nums; }
  .edit b { min-width: 40px; text-align: center; }
</style>
