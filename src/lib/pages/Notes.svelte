<script lang="ts">
  import Input from '../ui/Input.svelte';
  import { Copy, FilePlus, FileText, Plus, Trash2 } from '@lucide/svelte';
  import { annotated } from '../calc';
  import { features } from '../system.svelte';
  import { notes } from '../state.svelte';
  import { noteStamp } from '../relative';
  import { news } from '../news.svelte';
  import { hub } from '../hub.svelte';
  import { L } from '../i18n';

  // Halaman Catatan seperti di Mac: kolom tambah catatan di atas, lalu daftarnya.
  let draft = $state('');
  let focused = $state(false);
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    notes.add(features.calculator ? annotated(t) : t);
    draft = '';
    news.device(L('Catatan tersimpan', 'Note saved'), undefined, 'circle-check', '#30d158');
  };
  const copy = (s: string) => {
    void navigator.clipboard?.writeText(s);
    news.device(L('Catatan disalin', 'Note copied'), undefined, 'circle-check', '#30d158');
  };
</script>

<div class="notes">
  <div class="top">
    <span class="lb">{L('Catatan', 'Notes')}{notes.items.length ? ` · ${notes.items.length}` : ''}</span>
    <label class="add" class:focus={focused}>
      <Plus size={11} />
      <Input bare bind:value={draft} placeholder={L('Tambah catatan…', 'Add a note…')} aria-label={L('Tambah catatan', 'Add a note')}
        onfocus={() => (focused = true)} onblur={() => (focused = false)} onkeydown={(e) => {
          if (e.ctrlKey || e.metaKey) e.stopPropagation(); // biarkan pintasan edit ditangani input
          if (e.key === 'Enter') add();
        }} />
    </label>
    {#if draft.trim()}<button class="btn on" onclick={add}>{L('Simpan', 'Save')}</button>{/if}
  </div>
  {#if notes.items.length === 0}
    <span class="hint"><FileText size={12} /> {L('Belum ada catatan. Tulis di kolom atas, lalu tekan Enter.', 'No notes yet. Type one above and press Enter.')}</span>
  {:else}
    <div class="list scroll">
      {#each notes.items as n (n.id)}
        <div class="item">
          <span class="badge"><FileText size={14} /></span>
          <span class="grow"><span class="one">{n.text}</span><small>{noteStamp(n.t)}</small></span>
          <span class="acts">
            <button class="icon" aria-label={L('Salin', 'Copy')} title={L('Salin', 'Copy')} onclick={() => copy(n.text)}><Copy size={12} /></button>
            {#if hub.connected}<button class="icon" aria-label={L('Jadikan dokumen', 'Make doc')} title={L('Jadikan dokumen di Cognify', 'Make a document in Cognify')} onclick={() => void hub.noteToDoc(n.text)}><FilePlus size={12} /></button>{/if}
            <button class="icon" aria-label={L('Hapus', 'Delete')} title={L('Hapus', 'Delete')} onclick={() => notes.remove(n.id)}><Trash2 size={12} /></button>
          </span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .notes { display: flex; flex-direction: column; height: 164px; }
  .add { display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 99px; background: var(--fill); color: var(--muted); border: 1px solid transparent; }
  .add.focus { border-color: var(--accent); }
  .add :global(input) { width: 160px; color: var(--ink, #fff); font-size: 11px; }
  .list { display: flex; flex-direction: column; gap: 4px; min-height: 0; padding: 2px 8px; }
  .item { font-size: 12px; }
  .item small { line-height: 1.2; }
  .acts { display: flex; gap: 4px; opacity: 0; }
  .item:hover .acts, .item:focus-within .acts { opacity: 1; }
</style>
