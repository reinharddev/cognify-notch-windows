<script lang="ts">
  // Tiga salinan terakhir. Dibaca dari riwayat clipboard yang disimpan notch (tidak menulis apa pun di sini);
  // klik untuk menyalin lagi. Bagian gambar dilewati. Hanya bila fitur Clipboard menyala.
  import { onMount } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import { ClipboardList } from '@lucide/svelte';
  import { cmd, inTauri } from '../bridge';
  import { load } from '../store.svelte';
  import { features } from '../system.svelte';
  import { L } from '../i18n';

  let { w }: { w: number } = $props();
  type Clip = { id: string; kind: 'text' | 'link' | 'image'; text: string; t: number };

  const read = (): Clip[] => load<Clip[]>('clip', []).filter((c) => c.kind !== 'image' && c.text.trim()).sort((a, b) => b.t - a.t).slice(0, 3);
  let items = $state<Clip[]>(read());
  let copied = $state('');

  const short = (c: Clip) => {
    const text = c.text.replace(/\s+/g, ' ').trim();
    if (c.kind === 'link') { try { return new URL(text).hostname.replace(/^www\./, ''); } catch { /* bukan tautan utuh */ } }
    return text;
  };

  function copy(c: Clip) {
    void cmd('clip_set_text', { text: c.text });
    copied = c.id;
    setTimeout(() => (copied = ''), 900);
  }

  onMount(() => {
    const refresh = () => (items = read());
    // Notch menyimpan riwayatnya sendiri tepat setelah peristiwa clip; jendela lain diberi tahu lewat `storage`.
    let unlisten: (() => void) | undefined;
    if (inTauri) void listen('clip', () => setTimeout(refresh, 350)).then((f) => (unlisten = f));
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('storage', refresh); unlisten?.(); };
  });
</script>

<div class="dk-chip box" style:width="{w}px" role="group" aria-label={L('Riwayat salinan', 'Copy history')}>
  <ClipboardList size={15} class="dk-ic" />
  {#if !features.clipboard}
    <span class="dk-dim dk-ell">{L('Riwayat clipboard mati', 'Clipboard history off')}</span>
  {:else if items.length === 0}
    <span class="dk-dim dk-ell">{L('Belum ada salinan', 'Nothing copied yet')}</span>
  {:else}
    <span class="clips">
      {#each items as c (c.id)}
        <button class="clip dk-ell" class:ok={copied === c.id} title={c.text.slice(0, 200)} onclick={() => copy(c)}>{copied === c.id ? '✓' : short(c)}</button>
      {/each}
    </span>
  {/if}
</div>

<style>
  .box { gap: 8px; padding: 0 2px; }
  .clips { display: flex; flex: 1; min-width: 0; gap: 4px; }
  .clip { flex: 1 1 0; min-width: 0; height: 28px; padding: 0 10px; border: 0; border-radius: var(--rp, 14px); line-height: 28px; background: rgb(var(--ink, 255 255 255) / .09); color: rgb(var(--ink, 255 255 255)); font: inherit; font-size: 11px; text-align: left; cursor: default; transition: background-color var(--t, .22s) var(--ease, ease-out), color var(--t, .22s) var(--ease, ease-out); }
  .clip:hover { transform: scale(1.06); }
  .clip.ok { background: var(--accent); color: #0b0a1a; text-align: center; padding: 0; }
  .clip:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  @media (prefers-reduced-motion: reduce) { .clip { transition: none; } }
</style>
