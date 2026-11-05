<script lang="ts">
  import { onMount } from 'svelte';
  import { Repeat, Repeat1, Shuffle } from '@lucide/svelte';
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
    else audioError = L('Output suara tidak bisa diganti.', 'Could not change the sound output.');
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
    <span>{L('Putar musik di Spotify, browser, atau pemutar lain. Judulnya muncul di sini.', 'Play music in Spotify, a browser, or another player. It shows up here.')}</span>
    {#if audioOutputs.length}
      <label class="empty-output">
        <span>{L('Output suara', 'Sound output')}</span>
        <select class="out-select" value={currentOutputId} onchange={(event) => chooseAudioOutput(event.currentTarget.value)} disabled={outputBusy} aria-label={L('Pilih perangkat keluaran suara', 'Choose the sound output device')}>
          {#each audioOutputs as output (output.id)}<option value={output.id}>{output.name}</option>{/each}
        </select>
      </label>
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
  <div class="cols">
    <div class="col" style="width:264px">
      <div class="row" style="gap:12px">
        <div class="artw">{#if m.thumb}<img class="glow" src={m.thumb} alt="" aria-hidden="true" />{/if}<div class="art">{#if m.thumb}<img src={m.thumb} alt="" />{:else}<span>♪</span>{/if}</div></div>
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
        <button class="btn" class:on={m.shuffle === true} aria-label={L('Acak', 'Shuffle')} title={L('Acak', 'Shuffle')} disabled={m.shuffle == null} onclick={() => cmd('media_cmd', { action: 'shuffle' })}><Shuffle size={13} /></button>
        <button class="btn" aria-label={L('Sebelumnya', 'Previous')} onclick={() => cmd('media_cmd', { action: 'prev' })}>⏮</button>
        <button class="btn on" style="padding:6px 16px" aria-label={m.playing ? L('Jeda', 'Pause') : L('Putar', 'Play')} onclick={() => cmd('media_cmd', { action: 'toggle' })}>{m.playing ? '⏸' : '▶'}</button>
        <button class="btn" aria-label={L('Berikutnya', 'Next')} onclick={() => cmd('media_cmd', { action: 'next' })}>⏭</button>
        <button class="btn" class:on={(m.repeat ?? 0) > 0} aria-label={L('Ulangi', 'Repeat')} title={L('Ulangi', 'Repeat')} disabled={m.repeat == null} onclick={() => cmd('media_cmd', { action: 'repeat' })}>{#if m.repeat === 2}<Repeat1 size={13} />{:else}<Repeat size={13} />{/if}</button>
      </div>
      <div class="row dim">
        <span>{device.muted ? '🔇' : '🔈'}</span>
        <input type="range" min="0" max="100" value={Math.round(device.volume * 100)} oninput={setVolume} aria-label={L('Volume', 'Volume')} />
        {#if audioOutputs.length}
          <select class="out-select" value={currentOutputId} onchange={(event) => chooseAudioOutput(event.currentTarget.value)} disabled={outputBusy} aria-label={L('Pilih perangkat keluaran suara', 'Choose the sound output device')} title={L('Pilih perangkat keluaran suara', 'Choose the sound output device')}>
            {#each audioOutputs as output (output.id)}<option value={output.id}>{output.name}</option>{/each}
          </select>
        {:else}
          <button class="btn" title={L('Buka pengaturan suara Windows', 'Open Windows sound settings')} onclick={() => cmd('open_target', { target: 'ms-settings:sound' })}>{L('Output', 'Output')}</button>
        {/if}
      </div>
      {#if audioError}<span class="audio-error">{audioError}</span>{/if}
    </div>
    <div class="sep"></div>
    <div class="lyr grow" bind:this={box} style:--on={(ui.lyricAuto ? artColors.on : null) || ui.lyricActive || undefined} style:--off={(ui.lyricAuto ? artColors.off : null) || ui.lyricIdle || undefined}>
      {#if !features.lyrics}
        <span class="dim">{L('Lirik dimatikan di pengaturan.', 'Lyrics are off in settings.')}</span>
      {:else if ls.kind === 'loading'}<span class="dim">{L('Mencari lirik…', 'Looking for lyrics…')}</span>
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
      {:else if ls.kind === 'failed'}<span class="dim">{L('Lirik tidak bisa diambil. Periksa internet.', 'Couldn\'t fetch lyrics. Check your connection.')}</span>
      {:else}<span class="dim">{L('Lirik tidak ditemukan.', 'No lyrics found.')}</span>{/if}
    </div>
  </div>
{/if}

<style>
  /* Pendar: salinan sampul yang diburamkan di belakangnya, warnanya sama dengan foto lagu. */
  .artw { position: relative; flex: none; width: 84px; height: 84px; }
  .glow { position: absolute; left: -6px; top: -36px; width: 290px; height: 156px; object-fit: cover; border-radius: 50%; filter: blur(38px); opacity: .5; pointer-events: none; }
  /* Fade both horizontal edges so the color wash never starts or ends as a hard stripe. */
  .wash-tint { position: absolute; z-index: -1; right: -90px; top: -64px; width: 380px; height: 300px; background: radial-gradient(ellipse 82% 76% at 38% 40%, color-mix(in srgb, var(--wash-color, transparent) 46%, transparent) 0%, color-mix(in srgb, var(--wash-color, transparent) 18%, transparent) 48%, transparent 100%); filter: blur(34px); clip-path: inset(0 round 0 88px 88px 0); mask-image: linear-gradient(90deg, transparent 0%, #000 22%, #000 70%, transparent 100%); pointer-events: none; }
  .wash { position: absolute; z-index: -1; right: -90px; top: -64px; width: 380px; height: 300px; object-fit: cover; filter: blur(68px); opacity: .3; clip-path: inset(0 round 0 88px 88px 0); mask-image: linear-gradient(90deg, transparent 0%, #000 22%, #000 70%, transparent 100%); pointer-events: none; }
  .art { position: relative; width: 84px; height: 84px; border-radius: 12px; background: rgba(255, 255, 255, .08); overflow: hidden; flex: none; display: grid; place-items: center; font-size: 28px; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .one { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .seek { cursor: pointer; height: 6px; }
  .lyr { overflow-y: auto; position: relative; padding: 70px 12px; scroll-padding-block: 70px; mask-image: linear-gradient(transparent, #000 18%, #000 82%, transparent); }
  .lyr::-webkit-scrollbar { width: 0; }
  .out-select { min-width: 0; max-width: 108px; height: 28px; padding: 0 6px; border: 1px solid rgba(255,255,255,.14); border-radius: 9px; background: rgba(255,255,255,.08); color: rgba(255,255,255,.76); font: inherit; font-size: 10px; text-overflow: ellipsis; }
  .out-select option { color: #171717; }
  .audio-error { color: #ffb4a8; font-size: 10px; }
  .empty-music { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .empty-output { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,.56); font-size: 10px; }
  .lyric-line { margin: 0 0 8px; }
  .lyr .ln { display: block; width: 100%; max-width: 100%; box-sizing: border-box; border: 0; background: none; padding: 0 8px; text-align: left; margin: 0; font-family: inherit; font-size: 15px; font-weight: 700; line-height: 1.35; white-space: normal; overflow-wrap: anywhere; color: var(--off, rgba(255, 255, 255, .32)); cursor: pointer; transition: color .25s, transform .25s; transform-origin: center; }
  .lyr .ln.now { color: var(--on, #fff); transform: scale(1.04); }
  .reading { padding: 1px 8px 0; color: color-mix(in srgb, var(--off, rgba(255, 255, 255, .56)) 74%, transparent); font-size: 10px; line-height: 1.3; overflow-wrap: anywhere; }
  .reading.now { color: color-mix(in srgb, var(--on, #fff) 72%, transparent); }
  .plain-line { padding: 0 8px; }
  .plain-text { color: rgba(255,255,255,.7); font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; white-space: pre-wrap; }
  input[type=range] { flex: 1; accent-color: var(--accent); }
</style>
