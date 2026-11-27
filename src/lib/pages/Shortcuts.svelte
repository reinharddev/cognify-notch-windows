<script lang="ts">
  import Input from '../ui/Input.svelte';
  import { X, Zap } from '@lucide/svelte';
  import { shortcuts } from '../shelf.svelte';
  import { L } from '../i18n';
  let name = $state(''), target = $state('');
  const add = () => { shortcuts.add(name, target); name = ''; target = ''; };
</script>

<div class="shortcuts">
  <div class="top">
    <span class="lb">{L('Pintasan', 'Shortcuts')}</span>
    <Input size="sm" width="110px" bind:value={name} placeholder={L('Nama', 'Name')} />
    <Input size="sm" width="210px" bind:value={target} placeholder={L('Tautan, folder, atau lokasi app', 'Link, folder, or app path')} onkeydown={(e) => e.key === 'Enter' && add()} />
    <button class="btn" onclick={add}>{L('Tambah', 'Add')}</button>
  </div>
  {#if shortcuts.items.length === 0}
    <div class="empty">{L('Bikin pintasan ke situs, folder, atau app yang sering kamu buka.', 'Make shortcuts to the sites, folders, and apps you open a lot.')}</div>
  {:else}
    <div class="grid scroll">
      {#each shortcuts.items as s (s.id)}
        <div class="tile">
          <button class="go" onclick={() => shortcuts.run(s)}><span class="badge"><Zap size={14} fill="currentColor" /></span><span class="one">{s.name}</span></button>
          <button class="icon del" aria-label={L('Hapus', 'Delete')} onclick={() => shortcuts.remove(s.id)}><X size={12} /></button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .shortcuts { display: flex; flex-direction: column; height: 164px; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-content: start; min-height: 0; padding: 0 4px; }
  .tile { position: relative; display: flex; align-items: center; height: 44px; min-width: 0; border-radius: 99px; background: var(--fill); }
  .tile:hover { background: rgba(255, 255, 255, .15); }
  .go { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; height: 100%; padding: 0 8px; border: 0; background: none; color: inherit; font: inherit; font-size: 11px; font-weight: 600; text-align: left; cursor: pointer; }
  .del { margin-right: 6px; opacity: 0; }
  .tile:hover .del, .del:focus-visible { opacity: 1; }
</style>
