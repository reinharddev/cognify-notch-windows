<script lang="ts">
  import { Copy, FileText, Trash2 } from '@lucide/svelte';
  import { notes } from '../state.svelte';
  import { noteStamp } from '../relative';
  import { news } from '../news.svelte';
  import { L } from '../i18n';

  // Halaman Catatan seperti di Mac: daftar catatan; menulis dilakukan di Beranda → Catatan cepat.
  const copy = (s: string) => {
    void navigator.clipboard?.writeText(s);
    news.device(L('Catatan disalin', 'Note copied'), undefined, 'circle-check', '#30d158');
  };
</script>

<div class="col" style="height:100%">
  <span class="label">{L('Catatan', 'Notes')}{notes.items.length ? ` · ${notes.items.length}` : ''}</span>
  {#if notes.items.length === 0}
    <span class="ph"><FileText size={12} /> {L('Belum ada catatan. Tulis di Beranda → Catatan cepat.', 'No notes yet. Write one in Home → Quick note.')}</span>
  {:else}
    <div class="list">
      {#each notes.items as n (n.id)}
        <div class="row2">
          <span class="body"><span class="t">{n.text}</span><small>{noteStamp(n.t)}</small></span>
          <span class="acts">
            <button aria-label={L('Salin', 'Copy')} title={L('Salin', 'Copy')} onclick={() => copy(n.text)}><Copy size={12} /></button>
            <button aria-label={L('Hapus', 'Delete')} title={L('Hapus', 'Delete')} onclick={() => notes.remove(n.id)}><Trash2 size={12} /></button>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .label { padding-left: 6px; }
  .ph { display: inline-flex; align-items: center; gap: 8px; padding: 4px 0 0 6px; font-size: 11.5px; color: rgba(255, 255, 255, .5); }
  .list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; min-height: 0; }
  .list::-webkit-scrollbar { width: 0; }
  .row2 { display: flex; align-items: flex-start; gap: 10px; padding: 7px 10px; border-radius: 9px; background: rgba(255, 255, 255, .06); flex: none; }
  .row2:hover { background: rgba(255, 255, 255, .1); }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .t { font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; }
  small { font-size: 10px; color: rgba(255, 255, 255, .45); }
  .acts { display: none; gap: 8px; }
  .row2:hover .acts { display: flex; }
  .acts button { border: 0; background: none; color: rgba(255, 255, 255, .75); cursor: pointer; padding: 0; display: grid; }
</style>
