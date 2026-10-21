<script lang="ts">
  import { todo } from '../state.svelte';
  import { clockTools } from '../state.svelte';
  import { L } from '../i18n';
  import { ticker, clock } from '../store.svelte';
  import Notes from './Notes.svelte';
  import { agenda } from '../agenda.svelte';
  import { cmd } from '../bridge';
  const hm = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayLabel = (t: number) => { const d = new Date(t).setHours(0,0,0,0), n = new Date(ticker.now).setHours(0,0,0,0); return d === n ? '' : d - n === 864e5 ? L('Besok ', 'Tomorrow ') : new Date(t).toLocaleDateString([], { weekday: 'short' }) + ' '; };
  const next = $derived(todo.sorted.filter((t) => !t.done).slice(0, agenda.events.length ? 1 : 3));
</script>

<div class="cols">
  <div class="col" style="width:300px">
    <span class="label">{agenda.enabled ? L('Agenda', 'Agenda') : L('Berikutnya', 'Up next')}</span>
    <div class="list">
      {#each agenda.events.slice(0, 3) as e (e.id)}
        <div class="item"><span class="grow txt">{e.title}</span>
          {#if agenda.joinable(e, ticker.now)}<button class="btn on" onclick={() => cmd('open_target', { target: e.meeting })}>{L('Gabung', 'Join')}</button>
          {:else}<span class="dim">{e.allDay ? L('Seharian', 'All day') : dayLabel(e.start) + hm(e.start)}</span>{/if}</div>
      {/each}
      {#if agenda.problem}<span class="dim">{agenda.problem}</span>{/if}
      {#each next as t (t.id)}
        <div class="item"><span class="grow txt">{t.text}</span>
          {#if t.due}<span class="dim">{new Date(t.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{/if}</div>
      {:else}
        <span class="dim">{L('Tidak ada tugas yang menunggu.', 'Nothing waiting.')}</span>
      {/each}
      {#if clockTools.nearest}
        <div class="item"><span class="grow dim">{clockTools.nearest.label}</span><b>{clock((clockTools.nearest.end - ticker.now) / 1000)}</b></div>
      {/if}
    </div>
  </div>
  <div class="sep"></div>
  <div class="grow" style="min-width:0"><Notes compact /></div>
</div>

<style>.txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }</style>
