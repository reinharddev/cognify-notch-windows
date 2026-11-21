<script lang="ts">
  // Baris lirik yang sedang dinyanyikan. Memakai penyimpanan lirik yang sama dengan halaman Musik (LRCLIB, hanya
  // bila fitur Lirik menyala); posisi lagu dari pemantau media, diteruskan dengan jam sendiri.
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { Music2 } from '@lucide/svelte';
  import { device, features } from '../system.svelte';
  import { lyrics } from '../lyrics.svelte';
  import { L } from '../i18n';

  let { w }: { w: number } = $props();
  let now = $state(Date.now());

  const m = $derived(device.media);
  $effect(() => { if (features.lyrics) lyrics.loadFor(m); else lyrics.loadFor(null); });
  const pos = $derived(m ? Math.min(m.duration || Infinity, m.position + (m.playing ? (now - device.mediaAt) / 1000 : 0)) : 0);
  const ls = $derived(lyrics.state);
  const line = $derived(ls.kind === 'synced' ? ls.lines.findLast((l) => l.time <= pos + 0.25)?.text : undefined);
  const idle = $derived(!m || !features.lyrics);
  const text = $derived(
    !m ? L('Lirik tampil saat musik diputar', 'Lyrics show while music plays')
      : !features.lyrics ? L('Lirik mati (Pengaturan > Fitur)', 'Lyrics off (Settings > Features)')
      : ls.kind === 'synced' ? (line || '♪')
      : ls.kind === 'loading' ? '…'
      : ls.kind === 'instrumental' ? '♪ Instrumental'
      : m.title,
  );

  onMount(() => {
    const id = window.setInterval(() => { if (device.media?.playing) now = Date.now(); }, 300);
    return () => clearInterval(id);
  });
</script>

<div class="dk-chip box" style:width="{w}px" title={m ? `${m.title} · ${m.artist}` : ''}>
  <Music2 size={15} class={idle ? 'dk-ic' : 'live'} />
  {#key text}<span class="dk-fade line" class:dk-dim={idle} in:fade={{ duration: 220 }}>{text}</span>{/key}
</div>

<style>
  .box { gap: 9px; padding: 0 4px; }
  .line { flex: 1; font-size: 12.5px; font-weight: 600; }
  :global(.live) { flex: none; color: var(--accent); }
</style>
