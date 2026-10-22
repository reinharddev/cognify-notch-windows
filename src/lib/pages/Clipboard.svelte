<script lang="ts">
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
    <p style="margin:0 0 8px">{L('Riwayat clipboard mati. Teks yang kamu salin tetap di PC ini dan tidak dikirim ke mana pun.', 'Clipboard history is off. What you copy stays on this PC and is never sent anywhere.')}</p>
    <button class="btn on" onclick={() => { features.clipboard = true; features.persist(); }}>{L('Nyalakan', 'Turn on')}</button>
  </div></div>
{:else if clipboard.items.length === 0}
  <div class="empty">{L('Salin sesuatu, nanti muncul di sini.', 'Copy something and it shows up here.')}</div>
{:else}
  <div class="col" style="height:100%">
    <div class="row"><span class="label">{L('Riwayat', 'History')}</span><input class="find grow" bind:value={query} placeholder={L('Cari…', 'Search…')} aria-label={L('Cari di clipboard', 'Search clipboard')} spellcheck="false" /><button class="btn" onclick={() => clipboard.clear()}>{L('Bersihkan', 'Clear')}</button></div>
    <div class="grid">
      {#each shown as i (i.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="tile" class:pin={i.pinned} onclick={() => pick(i)}>
          {#if i.kind === 'image' && i.image}<img src={i.image} alt="" />{:else}<span class="t" class:link={i.kind === 'link'}>{i.text}</span>{/if}
          <div class="meta"><span>{copied === i.id ? L('Tersalin', 'Copied') : (i.app ?? ago(i.t))}</span>
            <span>
              <button class="x" aria-label="Pin" onclick={(e) => { e.stopPropagation(); clipboard.pin(i.id); }}>{i.pinned ? '★' : '☆'}</button>
              <button class="x" aria-label={L('Hapus', 'Delete')} onclick={(e) => { e.stopPropagation(); clipboard.remove(i.id); }}>×</button>
            </span></div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .find { min-width: 0; padding: 3px 9px; border: 0; border-radius: 99px; background: rgba(255, 255, 255, .08); color: #fff; font-size: 11px; outline: none; }
  .find:focus { background: rgba(255, 255, 255, .14); }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; overflow-y: auto; align-content: start; min-height: 0; }
  .grid::-webkit-scrollbar { width: 0; }
  .tile { height: 78px; border-radius: 10px; background: rgba(255, 255, 255, .07); padding: 7px 8px 4px; display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; overflow: hidden; }
  .tile:hover { background: rgba(255, 255, 255, .13); }
  .tile.pin { outline: 1px solid var(--accent); }
  .t { font-size: 10.5px; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; word-break: break-word; }
  .t.link { color: var(--accent); }
  img { max-width: 100%; max-height: 46px; object-fit: contain; border-radius: 4px; align-self: flex-start; }
  .meta { display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: rgba(255, 255, 255, .4); }
</style>
