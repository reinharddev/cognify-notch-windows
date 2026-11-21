<script lang="ts">
  // Pemutar kecil: sampul, judul, dan tombol sebelumnya, putar atau jeda, berikutnya.
  import { Pause, Play, SkipBack, SkipForward, Music2 } from '@lucide/svelte';
  import { device } from '../system.svelte';
  import { cmd } from '../bridge';
  import { ticker } from '../store.svelte';
  import { livePosition, progressRatio, timeLabel } from '../mediaProgress';
  import { L } from '../i18n';

  let { w }: { w: number } = $props();
  const m = $derived(device.media);
  const pos = $derived(m ? livePosition(m.position, m.duration, m.playing, ticker.now, device.mediaAt) : 0);

  /** Klik di garis kemajuan melompat ke titik itu. */
  function seek(e: MouseEvent) {
    if (!m?.duration) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    void cmd('media_seek', { seconds: ((e.clientX - r.left) / r.width) * m.duration });
  }
</script>

<div class="dk-chip box" style:width="{w}px">
  {#if m}
    <span class="art">{#if m.thumb}<img src={m.thumb} alt="" draggable="false" />{:else}<Music2 size={15} />{/if}</span>
    <span class="dk-col txt">
      <span class="dk-fade t">{m.title}</span>
      <span class="dk-fade dk-dim a">{m.artist}</span>
      <span class="prog">
        <span class="tm">{timeLabel(pos)}</span>
        <button class="bar" aria-label={L('Posisi lagu', 'Song position')} onclick={seek}><i style:width="{progressRatio(pos, m.duration) * 100}%"></i></button>
        <span class="tm">{m.duration ? timeLabel(m.duration) : '–:––'}</span>
      </span>
    </span>
    <span class="ctl">
      <button class="dk-btn" aria-label={L('Sebelumnya', 'Previous')} onclick={() => cmd('media_cmd', { action: 'prev' })}><SkipBack size={13} /></button>
      <button class="dk-btn main" aria-label={m.playing ? L('Jeda', 'Pause') : L('Putar', 'Play')} onclick={() => cmd('media_cmd', { action: 'toggle' })}>
        {#if m.playing}<Pause size={14} />{:else}<Play size={14} />{/if}
      </button>
      <button class="dk-btn" aria-label={L('Berikutnya', 'Next')} onclick={() => cmd('media_cmd', { action: 'next' })}><SkipForward size={13} /></button>
    </span>
  {:else}
    <span class="art empty"><Music2 size={15} /></span><span class="dk-dim dk-ell">{L('Tidak ada lagu', 'No music')}</span>
  {/if}
</div>

<style>
  .box { gap: 9px; padding: 0 2px; }
  .art { display: grid; place-items: center; flex: none; width: calc(var(--cellh) - 12px); height: calc(var(--cellh) - 12px); border-radius: var(--rt, 10px); overflow: hidden; background: rgb(var(--ink, 255 255 255) / .1); }
  .art.empty { background: rgb(var(--ink, 255 255 255) / .06); color: rgb(var(--ink, 255 255 255) / .55); }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .txt { flex: 1; }
  .t { font-weight: 650; font-size: 12.5px; }
  .a { font-size: 10.5px; }
  .prog { display: flex; align-items: center; gap: 5px; height: 12px; margin-top: 1px; }
  .tm { flex: none; font-size: 9.5px; font-variant-numeric: tabular-nums; color: rgb(var(--ink, 255 255 255) / .6); min-width: 24px; }
  .tm:last-child { text-align: right; }
  .bar { position: relative; flex: 1; height: 12px; padding: 0; border: 0; background: transparent; cursor: default; }
  .bar::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 3px; margin-top: -1.5px; border-radius: 99px; background: rgb(var(--ink, 255 255 255) / .16); }
  .bar i { position: absolute; left: 0; top: 50%; height: 3px; margin-top: -1.5px; border-radius: 99px; background: var(--accent); }
  .ctl { display: flex; align-items: center; gap: 1px; margin-left: auto; flex: none; }
  .dk-btn { width: 24px; height: 24px; }
  .main { width: 28px; height: 28px; background: rgb(var(--ink, 255 255 255) / .14); }
</style>
