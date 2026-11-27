<script lang="ts">
  import Input from '../ui/Input.svelte';
  import { AlignLeft, Image as ImageIcon, Link as LinkIcon, Pin, X } from '@lucide/svelte';
  import { clipboard } from '../shelf.svelte';
  import { features } from '../system.svelte';
  import { L } from '../i18n';
  import { ticker } from '../store.svelte';
  let copied = $state('');
  let query = $state('');
  const shown = $derived(clipboard.items.filter((i) => !query.trim() || (i.text ?? '').toLowerCase().includes(query.trim().toLowerCase())));
  const ago = (t: number) => {
    const m = Math.floor((ticker.now - t) / 60000);
    return m < 1 ? L('baru saja', 'just now') : m < 60 ? L(`${m} mnt`, `${m} min`) : L(`${Math.floor(m / 60)} jam`, `${Math.floor(m / 60)} h`);
  };
  const pick = (i: (typeof clipboard.items)[number]) => { clipboard.copy(i); copied = i.id; setTimeout(() => (copied = ''), 1200); };
</script>

{#if !features.clipboard}
  <div class="empty"><div>
    <p style="margin:0 0 8px">{L('Riwayat clipboard mati. Yang kamu salin tetap di PC ini dan tidak dikirim ke mana pun.', 'Clipboard history is off. What you copy stays on this PC and is never sent anywhere.')}</p>
    <button class="btn on" onclick={() => { features.clipboard = true; features.persist(); }}>{L('Nyalakan', 'Turn on')}</button>
  </div></div>
{:else if clipboard.items.length === 0}
  <div class="empty">{L('Salin sesuatu, nanti muncul di sini.', 'Copy something and it\'ll show up here.')}</div>
{:else}
  <div class="clip">
    <div class="top">
      <span class="lb">{L('Clipboard', 'Clipboard')} · {clipboard.items.length}</span>
      <Input size="sm" width="130px" bind:value={query} placeholder={L('Cari…', 'Search…')} aria-label={L('Cari di clipboard', 'Search clipboard')} spellcheck="false" />
      <button class="btn" onclick={() => clipboard.clear()}>{L('Bersihkan semua', 'Clear all')}</button>
    </div>
    <div class="grid scroll">
      {#each shown as i (i.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="tile" onclick={() => pick(i)}>
          <span class="badge">{#if i.kind === 'link'}<LinkIcon size={14} />{:else if i.kind === 'image'}<ImageIcon size={14} />{:else}<AlignLeft size={14} />{/if}</span>
          <span class="grow">
            {#if i.kind === 'image' && i.image}<img src={i.image} alt="" />{:else}<span class="one">{i.text}</span>{/if}
            <small class="one">{copied === i.id ? L('Tersalin', 'Copied') : (i.app ? `${i.app} · ` : '') + ago(i.t)}</small>
          </span>
          <button class="icon pin" class:on={i.pinned} aria-label="Pin" aria-pressed={i.pinned} onclick={(e) => { e.stopPropagation(); clipboard.pin(i.id); }}><Pin size={12} /></button>
          <button class="icon del" aria-label={L('Hapus', 'Delete')} onclick={(e) => { e.stopPropagation(); clipboard.remove(i.id); }}><X size={12} /></button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .clip { display: flex; flex-direction: column; height: 164px; }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-content: start; min-height: 0; padding: 0 4px; }
  .tile { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 12px; border-radius: 20px; background: var(--card); box-shadow: inset 0 1px rgba(255, 255, 255, .08); font-size: 12px; cursor: pointer; }
  .tile:hover { background: rgba(255, 255, 255, .1); }
  img { display: block; max-width: 100%; height: 22px; object-fit: contain; border-radius: 4px; }
  .pin, .del { opacity: 0; }
  .pin.on, .tile:hover .pin, .tile:hover .del, .pin:focus-visible, .del:focus-visible { opacity: 1; }
</style>
