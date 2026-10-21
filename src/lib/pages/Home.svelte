<script lang="ts">
  import { todo } from '../state.svelte';
  import { clockTools } from '../state.svelte';
  import { L } from '../i18n';
  import { ticker, clock } from '../store.svelte';
  import Notes from './Notes.svelte';
  const next = $derived(todo.sorted.filter((t) => !t.done).slice(0, 3));
</script>

<div class="cols">
  <div class="col" style="width:300px">
    <span class="label">{L('Berikutnya', 'Up next')}</span>
    <div class="list">
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
