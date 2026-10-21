<script lang="ts">
  const ext = (n: string) => (n.includes('.') ? n.split('.').pop()!.slice(0, 4).toUpperCase() : '▭');
  import { tray } from '../shelf.svelte';
  import { inTauri } from '../bridge';
  import { L } from '../i18n';
</script>

<div class="col" style="height:100%">
  <div class="row"><span class="label grow">{L('File sementara', 'Temporary files')}</span>
    {#if tray.items.length}<button class="btn" onclick={() => tray.clear()}>{L('Kosongkan', 'Clear')}</button>{/if}</div>
  {#if tray.items.length === 0}
    <div class="empty">{inTauri ? L('Seret file dari File Explorer ke sini. Yang disimpan hanya letaknya, bukan salinan.', 'Drag files from File Explorer here. Only their location is kept, not a copy.') : L('Seret file ke sini (hanya jalan di app).', 'Drag files here (works in the app only).')}</div>
  {:else}
    <div class="grid">
      {#each tray.items as i (i.id)}
        <div class="tile">
          <span class="ico">{ext(i.name)}</span>
          <span class="n">{i.name}</span>
          <div class="acts">
            <button class="x" title={L('Buka', 'Open')} onclick={() => tray.open(i)}>↗</button>
            <button class="x" title={L('Tampilkan di folder', 'Show in folder')} onclick={() => tray.reveal(i)}>▤</button>
            <button class="x" title={L('Buang dari tray', 'Remove')} onclick={() => tray.remove(i.id)}>×</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; overflow-y: auto; align-content: start; min-height: 0; }
  .grid::-webkit-scrollbar { width: 0; }
  .tile { height: 82px; border-radius: 10px; background: rgba(255, 255, 255, .07); padding: 7px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .ico { width: 34px; height: 34px; border-radius: 8px; background: rgba(255, 255, 255, .12); display: grid; place-items: center; font-size: 10px; font-weight: 700; }
  .n { font-size: 10px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .acts { display: flex; gap: 2px; margin-top: auto; }
</style>
