<script lang="ts">
  import { cmd } from '../bridge';
  const ext = (n: string) => (n.includes('.') ? n.split('.').pop()!.slice(0, 4).toUpperCase() : '▭');
  import { tray } from '../shelf.svelte';
  import { inTauri, pickFiles } from '../bridge';
  import { L } from '../i18n';
  const paste = async () => tray.add((await cmd<string[]>('clip_files')) ?? []);
</script>

<svelte:window onkeydown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !(e.target as HTMLElement)?.matches?.('input,textarea')) void paste(); }} />
<div class="col" style="height:100%">
  <div class="row"><span class="label grow">{L('File sementara', 'Temporary files')}</span>
    {#if inTauri}<button class="btn" onclick={paste} title={L('Salin file di File Explorer (Ctrl+C), lalu klik ini', 'Copy files in File Explorer (Ctrl+C), then click this')}>{L('Tempel file', 'Paste files')}</button>
    <button class="btn on" onclick={async () => tray.add(await pickFiles())}>{L('Tambah file', 'Add files')}</button>{/if}
    {#if tray.items.length}<button class="btn" onclick={() => tray.clear()}>{L('Kosongkan', 'Clear')}</button>{/if}</div>
  {#if tray.items.length === 0}
    <div class="empty">{inTauri ? L('Klik Tambah file, atau salin file di File Explorer lalu klik Tempel file. Yang disimpan hanya letaknya, bukan salinan.', 'Click Add files, or copy files in File Explorer and click Paste files. Only their location is kept, not a copy.') : L('Seret file ke sini (hanya jalan di app).', 'Drag files here (works in the app only).')}</div>
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
