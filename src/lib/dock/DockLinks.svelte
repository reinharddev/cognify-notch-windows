<script lang="ts">
  // Pintasan tautan: ikon huruf berwarna per tautan; klik membuka di browser bawaan. Tidak mengambil favicon
  // (tidak ada permintaan jaringan dari dock).
  import { Plus } from '@lucide/svelte';
  import { cmd, openSettings } from '../bridge';
  import { dock } from '../dock.svelte';
  import { L } from '../i18n';

  const tint = (name: string) => {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h} 50% 40%)`;
  };
</script>

<div class="row" role="group" aria-label={L('Pintasan tautan', 'Link shortcuts')}>
  {#each dock.links as l (l.id)}
    <button class="cell" data-name={l.label} title="{l.label} · {l.url}" aria-label={l.label} onclick={() => cmd('open_target', { target: l.url })}>
      <span class="tile" style:background={tint(l.label)}>{l.label.slice(0, 1).toUpperCase()}</span>
    </button>
  {/each}
  {#if dock.links.length === 0}
    <button class="cell" data-name={L('Tambah tautan', 'Add a link')} title={L('Tambah tautan di Pengaturan > Dock', 'Add links in Settings > Dock')} aria-label={L('Tambah tautan', 'Add a link')} onclick={openSettings}>
      <span class="tile add"><Plus size={16} /></span>
    </button>
  {/if}
</div>

<style>
  .row { display: flex; gap: 2px; flex: none; }
  .cell { display: grid; place-items: center; box-sizing: content-box; width: calc((var(--icon) + 12px) * var(--s, 1) - 12px); height: var(--icon); padding: 6px; border: 0; border-radius: var(--rc, 12px); background: transparent; cursor: default; transition: background-color var(--t, .22s) var(--ease, ease-out), transform var(--t, .22s) var(--ease, ease-out); will-change: transform; }
  .cell > .tile { transform: scale(var(--s, 1)); transition: transform .09s ease-out; transform-origin: center bottom; }
  .cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .tile { display: grid; place-items: center; width: var(--icon); height: var(--icon); border-radius: var(--rt, 10px); color: #fff; font-weight: 700; font-size: calc(var(--icon) * .45); }
  .tile.add { background: rgb(var(--ink, 255 255 255) / .1); color: rgb(var(--ink, 255 255 255) / .7); }
  @media (prefers-reduced-motion: reduce) { .cell { transition: none; }  }
</style>
