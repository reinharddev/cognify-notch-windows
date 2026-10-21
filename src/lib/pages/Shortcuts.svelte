<script lang="ts">
  import { shortcuts } from '../shelf.svelte';
  import { L } from '../i18n';
  let name = $state(''), target = $state('');
  const add = () => { shortcuts.add(name, target); name = ''; target = ''; };
</script>

<div class="col" style="height:100%">
  <div class="row">
    <input type="text" style="width:150px" bind:value={name} placeholder={L('Nama', 'Name')} />
    <input type="text" bind:value={target} placeholder={L('Tautan, folder, atau lokasi app', 'Link, folder, or app path')} onkeydown={(e) => e.key === 'Enter' && add()} />
    <button class="btn on" onclick={add}>{L('Tambah', 'Add')}</button>
  </div>
  {#if shortcuts.items.length === 0}
    <div class="empty">{L('Buat pintasan ke situs, folder, atau app yang sering kamu buka.', 'Make shortcuts to sites, folders, or apps you open often.')}</div>
  {:else}
    <div class="grid">
      {#each shortcuts.items as s (s.id)}
        <div class="tile">
          <button class="go" onclick={() => shortcuts.run(s)}>{s.name}</button>
          <button class="x" aria-label={L('Hapus', 'Delete')} onclick={() => shortcuts.remove(s.id)}>×</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; overflow-y: auto; align-content: start; min-height: 0; }
  .grid::-webkit-scrollbar { width: 0; }
  .tile { display: flex; align-items: center; border-radius: 10px; background: rgba(255, 255, 255, .07); padding-right: 4px; }
  .go { flex: 1; border: 0; background: none; padding: 11px 10px; text-align: left; cursor: pointer; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tile:hover { background: rgba(255, 255, 255, .13); }
</style>
