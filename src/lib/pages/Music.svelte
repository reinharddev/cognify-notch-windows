<script lang="ts">
  import Select from '../ui/Select.svelte';
  import { onMount } from 'svelte';
  import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, VolumeX } from '@lucide/svelte';
  import { device, features } from '../system.svelte';
  import { lyrics } from '../lyrics.svelte';
  import { ui } from '../ui.svelte';
  import { artColors } from '../artColor.svelte';
  import { cmd, cmdTry } from '../bridge';
  import { clock, ticker } from '../store.svelte';
  import { L } from '../i18n';

  const m = $derived(device.media);
  type AudioOutput = { id: string; name: string; is_default: boolean };
  let audioOutputs = $state<AudioOutput[]>([]);
  let outputBusy = $state(false);
  let audioError = $state('');
  const currentOutputId = $derived(audioOutputs.find((output) => output.is_default)?.id ?? '');

  async function refreshAudioOutputs() {
    audioOutputs = (await cmd<AudioOutput[]>('audio_outputs')) ?? [];
  }

  async function chooseAudioOutput(id: string) {
    if (!id || outputBusy) return;
    outputBusy = true;
    audioError = '';
    const result = await cmdTry<void>('set_audio_output', { id });
    if (result.ok) await refreshAudioOutputs();
    else audioError = L('Output suara gagal diganti.', 'Couldn\'t switch the sound output.');
    outputBusy = false;
  }

  onMount(() => { void refreshAudioOutputs(); });
  const pos = $derived(m ? Math.min(m.duration || Infinity, m.position + (m.playing ? (ticker.now - device.mediaAt) / 1000 : 0)) : 0);

  $effect(() => { if (features.lyrics) lyrics.loadFor(m); else lyrics.loadFor(null); });

  const ls = $derived(lyrics.state);
  const current = $derived(ls.kind === 'synced' ? ls.lines.findLastIndex((l) => l.time <= pos + 0.25) : -1);
  let box: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (current < 0 || !box) return;
    const el = box.querySelectorAll<HTMLElement>('[data-lyric-line]')[current];
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
  <div class="empty empty-music">
    <span>{L('Putar musik di Spotify, browser, atau pemutar lain. Judulnya bakal muncul di sini.', 'Play something in Spotify, your browser, or any player and it\'ll show up here.')}</span>
    {#if audioOutputs.length}
      <div class="empty-output">
        <span>{L('Output suara', 'Sound output')}</span>
        <Select size="sm" width="108px" value={currentOutputId} onchange={(v) => chooseAudioOutput(v)} disabled={outputBusy} label={L('Pilih perangkat output suara', 'Choose where sound plays')}
          options={audioOutputs.map((o) => ({ value: o.id, label: o.name }))} />
      </div>
    {:else}
      <button class="btn" title={L('Buka pengaturan suara Windows', 'Open Windows sound settings')} onclick={() => cmd('open_target', { target: 'ms-settings:sound' })}>{L('Pilih output suara', 'Choose sound output')}</button>
    {/if}
    {#if audioError}<span class="audio-error">{audioError}</span>{/if}
  </div>
{:else}
  {#if m.thumb}
    <div class="wash-tint" style:--wash-color={artColors.on || undefined} aria-hidden="true"></div>
    <img class="wash" src={m.thumb} alt="" aria-hidden="true" />
  {/if}
  <div class="music">
    <div class="card player">
      <div class="row" style="gap:8px">
        <div class="art">{#if m.thumb}<img src={m.thumb} alt="" />{:else}<span>♪</span>{/if}</div>
        <span class="grow"><b class="one">{m.title}</b><small class="one">{m.artist || m.app}</small></span>
      </div>
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="track seek" onclick={seek}><i style:width="{m.duration ? (pos / m.duration) * 100 : 0}%"></i></div>
      <div class="times"><small>{clock(pos)}</small><small>{m.duration ? '-' + clock(Math.max(0, m.duration - pos)) : ''}</small></div>
      <div class="ctrls">
        <button class="icon" class:on={m.shuffle === true} aria-label={L('Acak', 'Shuffle')} title={L('Acak', 'Shuffle')} disabled={m.shuffle == null} onclick={() => cmd('media_cmd', { action: 'shuffle' })}><Shuffle size={14} /></button>
        <button class="icon" aria-label={L('Sebelumnya', 'Previous')} onclick={() => cmd('media_cmd', { action: 'prev' })}><SkipBack size={15} fill="currentColor" /></button>
        <button class="round big" aria-label={m.playing ? L('Jeda', 'Pause') : L('Putar', 'Play')} onclick={() => cmd('media_cmd', { action: 'toggle' })}>{#if m.playing}<Pause size={14} fill="currentColor" strokeWidth={0} />{:else}<Play size={14} fill="currentColor" strokeWidth={0} />{/if}</button>
        <button class="icon" aria-label={L('Berikutnya', 'Next')} onclick={() => cmd('media_cmd', { action: 'next' })}><SkipForward size={15} fill="currentColor" /></button>
        <button class="icon" class:on={(m.repeat ?? 0) > 0} aria-label={L('Ulangi', 'Repeat')} title={L('Ulangi', 'Repeat')} disabled={m.repeat == null} onclick={() => cmd('media_cmd', { action: 'repeat' })}>{#if m.repeat === 2}<Repeat1 size={14} />{:else}<Repeat size={14} />{/if}</button>
      </div>
      <div class="row vol">
        {#if device.muted}<VolumeX size={14} />{:else}<Volume1 size={14} />{/if}
        <input type="range" min="0" max="100" value={Math.round(device.volume * 100)} oninput={setVolume} aria-label={L('Volume', 'Volume')} />
        {#if audioOutputs.length}
          <Select size="sm" width="84px" value={currentOutputId} onchange={(v) => chooseAudioOutput(v)} disabled={outputBusy} label={L('Pilih perangkat output suara', 'Choose where sound plays')}
            options={audioOutputs.map((o) => ({ value: o.id, label: o.name }))} />
        {:else}
          <button class="btn" title={L('Buka pengaturan suara Windows', 'Open Windows sound settings')} onclick={() => cmd('open_target', { target: 'ms-settings:sound' })}>{L('Output', 'Output')}</button>
        {/if}
      </div>
      {#if audioError}<span class="audio-error">{audioError}</span>{/if}
    </div>
    <div class="lyr grow" bind:this={box} style:--on={(ui.lyricAuto ? artColors.on : null) || ui.lyricActive || undefined} style:--off={(ui.lyricAuto ? artColors.off : null) || ui.lyricIdle || undefined}>
      {#if !features.lyrics}
        <span class="dim">{L('Lirik lagi dimatikan di pengaturan.', 'Lyrics are turned off in settings.')}</span>
      {:else if ls.kind === 'loading'}<span class="dim">{L('Lagi cari lirik…', 'Looking for lyrics…')}</span>
      {:else if ls.kind === 'synced'}
        {#each ls.lines as line, i}
          <div class="lyric-line" data-lyric-line>
            <button type="button" class="ln" class:now={i === current} onclick={() => cmd('media_seek', { seconds: line.time })}>{line.text || '♪'}</button>
            {#if line.reading}<div class="reading" class:now={i === current}>{line.reading}</div>{/if}
          </div>
        {/each}
      {:else if ls.kind === 'plain'}
        {#each ls.lines as line}
          <div class="lyric-line plain-line" data-lyric-line>
            <div class="plain-text">{line.text}</div>
            {#if line.reading}<div class="reading">{line.reading}</div>{/if}
          </div>
        {/each}
      {:else if ls.kind === 'instrumental'}<span class="dim">{L('Lagu instrumental.', 'Instrumental.')}</span>
      {:else if ls.kind === 'failed'}<span class="dim">{L('Lirik gagal diambil. Cek internet kamu.', 'Couldn\'t get the lyrics. Check your connection.')}</span>
      {:else}<span class="dim">{L('Liriknya tidak ketemu.', 'No lyrics found.')}</span>{/if}
    </div>
  </div>
{/if}

<style>
  .music { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 16px; height: 164px; }
  .player { gap: 4px; padding: 8px 12px; }
  .times { display: flex; justify-content: space-between; margin-top: -2px; }
  .ctrls { display: flex; justify-content: space-between; align-items: center; }
  .big { width: 30px; height: 30px; }
  .vol { gap: 6px; color: var(--muted); }
  .track { height: 4px; flex: none; border-radius: 99px; background: rgba(255, 255, 255, .13); }
  .track i { display: block; height: 100%; border-radius: 99px; background: var(--ink, #fff); }
  /* Cahaya warna sampul: memudar ke semua sisi lewat mask radial, tanpa clip-path (clip memotong blur jadi kotak). */
  .wash-tint { position: absolute; z-index: -1; right: 0; top: 0; bottom: 0; width: 380px; background: radial-gradient(ellipse closest-side at 50% 46%, color-mix(in srgb, var(--wash-color, transparent) 44%, transparent) 0%, color-mix(in srgb, var(--wash-color, transparent) 20%, transparent) 50%, color-mix(in srgb, var(--wash-color, transparent) 5%, transparent) 80%, transparent 100%); pointer-events: none; }
  .wash { position: absolute; z-index: -1; right: 0; top: 0; bottom: 0; width: 380px; object-fit: cover; filter: blur(64px); opacity: .3; -webkit-mask-image: radial-gradient(ellipse closest-side at 50% 46%, #000 0%, rgba(0, 0, 0, .55) 55%, rgba(0, 0, 0, .12) 85%, transparent 100%); mask-image: radial-gradient(ellipse closest-side at 50% 46%, #000 0%, rgba(0, 0, 0, .55) 55%, rgba(0, 0, 0, .12) 85%, transparent 100%); pointer-events: none; }
  .art { width: 36px; height: 36px; border-radius: 12px; background: rgba(255, 255, 255, .08); overflow: hidden; flex: none; display: grid; place-items: center; font-size: 16px; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .seek { cursor: pointer; }
  .lyr { overflow-y: auto; position: relative; padding: 66px 8px; scroll-padding-block: 66px; mask-image: linear-gradient(transparent, #000 18%, #000 82%, transparent); }
  .lyr::-webkit-scrollbar { width: 0; }
  .audio-error { color: #ffb4a8; font-size: 10px; }
  .empty-music { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .empty-output { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,.56); font-size: 10px; }
  .lyric-line { margin: 0 0 6px; }
  .lyr .ln { display: block; width: 100%; max-width: 100%; box-sizing: border-box; border: 0; background: none; padding: 0 8px; text-align: left; margin: 0; font-family: inherit; font-size: 13px; font-weight: 700; line-height: 1.35; white-space: normal; overflow-wrap: anywhere; color: var(--off, rgba(255, 255, 255, .32)); cursor: pointer; transition: color .25s, transform .25s; transform-origin: center; }
  .lyr .ln.now { color: var(--on, #fff); font-size: 18px; }
  .reading { padding: 1px 8px 0; color: color-mix(in srgb, var(--off, rgba(255, 255, 255, .56)) 74%, transparent); font-size: 10px; line-height: 1.3; overflow-wrap: anywhere; }
  .reading.now { color: color-mix(in srgb, var(--on, #fff) 72%, transparent); }
  .plain-line { padding: 0 8px; }
  .plain-text { color: rgba(255,255,255,.7); font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; white-space: pre-wrap; }
  input[type=range] { flex: 1; min-width: 0; height: 4px; accent-color: var(--ink, #fff); }
</style>
