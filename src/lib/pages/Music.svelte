<script lang="ts">
  import { device, features } from '../system.svelte';
  import { lyrics } from '../lyrics.svelte';
  import { cmd } from '../bridge';
  import { clock, ticker } from '../store.svelte';
  import { L } from '../i18n';

  const m = $derived(device.media);
  const pos = $derived(m ? Math.min(m.duration || Infinity, m.position + (m.playing ? (ticker.now - device.mediaAt) / 1000 : 0)) : 0);

  $effect(() => { if (features.lyrics) lyrics.loadFor(m); else lyrics.loadFor(null); });

  const ls = $derived(lyrics.state);
  const current = $derived(ls.kind === 'synced' ? ls.lines.findLastIndex((l) => l.time <= pos + 0.25) : -1);
  let box: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (current < 0 || !box) return;
    const el = box.children[current] as HTMLElement | undefined;
    if (el) box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  });

  const seek = (e: MouseEvent) => {
    if (!m?.duration) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    void cmd('media_seek', { seconds: ((e.clientX - r.left) / r.width) * m.duration });
  };
  const setVolume = (e: Event) => void cmd('set_volume', { value: Number((e.currentTarget as HTMLInputElement).value) / 100 });
</script>

{#if !m}
  <div class="empty">{L('Putar musik di Spotify, browser, atau pemutar lain. Judulnya muncul di sini.', 'Play music in Spotify, a browser, or another player. It shows up here.')}</div>
{:else}
  <div class="cols">
    <div class="col" style="width:264px">
      <div class="row" style="gap:12px">
        <div class="art">{#if m.thumb}<img src={m.thumb} alt="" />{:else}<span>♪</span>{/if}</div>
        <div class="col" style="gap:2px;min-width:0">
          <b class="one">{m.title}</b>
          <span class="dim one">{m.artist || m.app}</span>
          {#if m.album}<span class="dim one" style="font-size:10.5px">{m.album}</span>{/if}
        </div>
      </div>
      <div class="col" style="gap:3px">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="bar seek" onclick={seek}><i style:width="{m.duration ? (pos / m.duration) * 100 : 0}%"></i></div>
        <div class="row dim" style="justify-content:space-between;font-size:10px"><span>{clock(pos)}</span><span>{m.duration ? clock(m.duration) : ''}</span></div>
      </div>
      <div class="row" style="justify-content:center;gap:10px">
        <button class="btn" aria-label={L('Sebelumnya', 'Previous')} onclick={() => cmd('media_cmd', { action: 'prev' })}>⏮</button>
        <button class="btn on" style="padding:6px 16px" aria-label={m.playing ? L('Jeda', 'Pause') : L('Putar', 'Play')} onclick={() => cmd('media_cmd', { action: 'toggle' })}>{m.playing ? '⏸' : '▶'}</button>
        <button class="btn" aria-label={L('Berikutnya', 'Next')} onclick={() => cmd('media_cmd', { action: 'next' })}>⏭</button>
      </div>
      <div class="row dim">
        <span>{device.muted ? '🔇' : '🔈'}</span>
        <input type="range" min="0" max="100" value={Math.round(device.volume * 100)} oninput={setVolume} aria-label={L('Volume', 'Volume')} />
        <button class="btn" title={L('Pilih perangkat keluaran suara', 'Choose the sound output device')} onclick={() => cmd('open_target', { target: 'ms-settings:sound' })}>{L('Output', 'Output')}</button>
      </div>
    </div>
    <div class="sep"></div>
    <div class="lyr grow" bind:this={box}>
      {#if !features.lyrics}
        <span class="dim">{L('Lirik dimatikan di pengaturan.', 'Lyrics are off in settings.')}</span>
      {:else if ls.kind === 'loading'}<span class="dim">{L('Mencari lirik…', 'Looking for lyrics…')}</span>
      {:else if ls.kind === 'synced'}
        {#each ls.lines as line, i}
          <button type="button" class="ln" class:now={i === current} onclick={() => cmd('media_seek', { seconds: line.time })}>{line.text || '♪'}</button>
        {/each}
      {:else if ls.kind === 'plain'}<pre>{ls.text}</pre>
      {:else if ls.kind === 'instrumental'}<span class="dim">{L('Lagu instrumental.', 'Instrumental.')}</span>
      {:else if ls.kind === 'failed'}<span class="dim">{L('Lirik tidak bisa diambil. Periksa internet.', 'Couldn\'t fetch lyrics. Check your connection.')}</span>
      {:else}<span class="dim">{L('Lirik tidak ditemukan.', 'No lyrics found.')}</span>{/if}
    </div>
  </div>
{/if}

<style>
  .art { width: 84px; height: 84px; border-radius: 12px; background: rgba(255, 255, 255, .08); overflow: hidden; flex: none; display: grid; place-items: center; font-size: 28px; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .one { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .seek { cursor: pointer; height: 6px; }
  .lyr { overflow-y: auto; position: relative; padding: 70px 0; mask-image: linear-gradient(transparent, #000 25%, #000 75%, transparent); }
  .lyr::-webkit-scrollbar { width: 0; }
  .lyr .ln { display: block; border: 0; background: none; padding: 0; text-align: left; margin: 0 0 6px; font-family: inherit; font-size: 15px; font-weight: 700; color: rgba(255, 255, 255, .32); cursor: pointer; transition: color .25s, transform .25s; transform-origin: left; }
  .lyr .ln.now { color: #fff; transform: scale(1.06); }
  pre { margin: 0; font: inherit; white-space: pre-wrap; color: rgba(255, 255, 255, .7); }
  input[type=range] { flex: 1; accent-color: var(--accent); }
</style>
