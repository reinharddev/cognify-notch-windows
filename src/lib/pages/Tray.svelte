<script lang="ts">
  import { cmd } from '../bridge';
  import { ExternalLink, File as FileIcon, FolderOpen, Image as ImageIcon, X } from '@lucide/svelte';
  import { tray } from '../shelf.svelte';
  import { inTauri, pickFiles } from '../bridge';
  import { L } from '../i18n';
  const paste = async () => tray.add((await cmd<string[]>('clip_files')) ?? []);
</script>

<svelte:window onkeydown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !(e.target as HTMLElement)?.matches?.('input,textarea')) void paste(); }} />
<div class="tray">
  <div class="top"><span class="lb">{L('Rak', 'Tray')}{tray.items.length ? ` · ${tray.items.length} ${L('file', tray.items.length === 1 ? 'file' : 'files')}` : ''}</span>
    {#if inTauri}<button class="btn" onclick={paste} title={L('Salin file di File Explorer (Ctrl+C), lalu klik ini', 'Copy files in File Explorer (Ctrl+C), then click here')}>{L('Tempel file', 'Paste files')}</button>
    <button class="btn" onclick={async () => tray.add(await pickFiles())}>{L('Tambah file', 'Add files')}</button>{/if}
    {#if tray.items.length}<button class="btn" onclick={() => tray.clear()}>{L('Kosongkan', 'Clear')}</button>{/if}</div>
  {#if tray.items.length === 0}
    <div class="empty">{inTauri ? L('Klik Tambah file, atau salin file di File Explorer lalu klik Tempel file. Yang disimpan cuma lokasinya, bukan salinannya.', 'Click Add files, or copy files in File Explorer and click Paste files. Only their location is saved, not a copy.') : L('Seret file ke sini (cuma bisa di app).', 'Drag files here (only works in the app).')}</div>
  {:else}
    <div class="files scroll">
      {#each tray.items as i (i.id)}
        <div class="file">
          {#if /\.(png|jpe?g|gif|webp|bmp|svg|heic)$/i.test(i.name)}<ImageIcon size={34} strokeWidth={1.3} />{:else}<FileIcon size={34} strokeWidth={1.3} />{/if}
          <span class="one">{i.name}</span>
          <div class="acts">
            <button class="icon" aria-label={L('Buka', 'Open')} title={L('Buka', 'Open')} onclick={() => tray.open(i)}><ExternalLink size={12} /></button>
            <button class="icon" aria-label={L('Tampilkan di folder', 'Show in folder')} title={L('Tampilkan di folder', 'Show in folder')} onclick={() => tray.reveal(i)}><FolderOpen size={12} /></button>
            <button class="icon" aria-label={L('Buang dari rak', 'Remove')} title={L('Buang dari rak', 'Remove')} onclick={() => tray.remove(i.id)}><X size={12} /></button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tray { display: flex; flex-direction: column; height: 164px; }
  .files { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-content: start; min-height: 0; padding: 0 4px; }
  .file { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 108px; padding: 0 8px; border-radius: 20px; background: var(--card); box-shadow: inset 0 1px rgba(255, 255, 255, .08); font-size: 11px; font-weight: 600; }
  .file .one { max-width: 100%; }
  .acts { position: absolute; top: 6px; right: 8px; display: flex; gap: 2px; opacity: 0; }
  .file:hover .acts, .file:focus-within .acts { opacity: 1; }
</style>
