<script lang="ts">
  // Tes mikrofon di halaman "Camera & Mic", sama dengan MicCard di Mac. Mikrofon hanya menyala setelah ditekan dan
  // mati saat halaman ditinggalkan. Rekaman 5 detik hanya ada di memori dan dibuang: tidak disimpan atau dikirim.
  import { onMount } from 'svelte';
  import { Mic, Square } from '@lucide/svelte';
  import Select from './ui/Select.svelte';

  const BARS = 24, LENGTH = 5;
  type State = 'idle' | 'testing' | 'recording' | 'playing' | 'played' | 'denied' | 'unavailable';

  let phase = $state<State>('idle');
  let devices = $state<{ value: string; label: string }[]>([]);
  let selected = $state(localStorage.getItem('cognify.mic.input') ?? '');
  let level = $state(0);
  let loud = $state(false);
  let elapsed = $state(0);

  let stream: MediaStream | undefined, audio: AudioContext | undefined, recorder: MediaRecorder | undefined;
  let player: HTMLAudioElement | undefined, url = '';
  let timer = 0, run = 0, started = 0, lastLoud = 0;

  const clock = (s: number) => `00:0${Math.min(LENGTH, Math.round(s))}`;
  const message = $derived.by((): [string, string] => {
    switch (phase) {
      case 'testing': return loud ? ['Your voice is coming through clearly.', '#30d158'] : ['Too quiet. Move closer to the mic.', '#ff9f0a'];
      case 'recording': return [`Recording ${clock(elapsed)} of ${clock(LENGTH)}.`, '#ff453a'];
      case 'playing': return [`Playing ${clock(elapsed)} of ${clock(LENGTH)}. Not saved.`, ''];
      case 'played': return ['Done. The recording is not saved.', ''];
      case 'denied': return ['Microphone is blocked. Check Windows Settings > Privacy > Microphone.', '#ff9f0a'];
      case 'unavailable': return ['No microphone available.', '#ff9f0a'];
      default: return ['Press Test mic, then speak.', ''];
    }
  });

  async function refresh() {
    const all = (await navigator.mediaDevices?.enumerateDevices()) ?? [];
    devices = all.filter((d) => d.kind === 'audioinput').map((d, i) => ({ value: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
    if (!devices.some((d) => d.value === selected)) selected = devices[0]?.value ?? '';
  }

  function release() {
    clearInterval(timer);
    if (recorder && recorder.state !== 'inactive') { recorder.onstop = null; recorder.stop(); }
    recorder = undefined;
    stream?.getTracks().forEach((t) => t.stop());
    stream = undefined;
    void audio?.close();
    audio = undefined;
    level = 0;
    elapsed = 0;
  }

  /** Matikan mikrofon dan buang rekaman. */
  function stop() {
    run++;
    release();
    player?.pause();
    player = undefined;
    if (url) URL.revokeObjectURL(url);
    url = '';
    if (phase !== 'denied') phase = 'idle';
  }

  async function begin(record: boolean) {
    stop();
    const mine = ++run;
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: selected ? { deviceId: { exact: selected } } : true });
      if (mine !== run) return next.getTracks().forEach((t) => t.stop());
      stream = next;
    } catch (e) {
      if (mine === run) phase = (e as Error).name === 'NotAllowedError' ? 'denied' : 'unavailable';
      return;
    }
    void refresh(); // nama perangkat baru tersedia setelah izin diberikan
    audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    if (record) {
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        if (mine !== run) return;
        release();
        url = URL.createObjectURL(new Blob(chunks));
        player = new Audio(url);
        playAgain();
      };
      recorder.start();
    }
    phase = record ? 'recording' : 'testing';
    started = performance.now();
    lastLoud = 0;
    timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
      level = Math.max(0, Math.min(1, (20 * Math.log10(rms || 1e-8) + 50) / 50));
      const now = performance.now();
      if (level > 0.35) lastLoud = now;
      loud = lastLoud > 0 && now - lastLoud < 1500;
      if (record) {
        elapsed = (now - started) / 1000;
        if (elapsed >= LENGTH && recorder?.state === 'recording') recorder.stop();
      }
    }, 60);
  }

  function playAgain() {
    if (!player) return;
    const p = player;
    p.currentTime = 0;
    p.ontimeupdate = () => (elapsed = p.currentTime);
    p.onended = () => (phase = 'played');
    phase = 'playing';
    void p.play().catch(() => (phase = 'played'));
  }

  function choose(id: string) {
    selected = id;
    localStorage.setItem('cognify.mic.input', id);
    if (phase === 'testing') void begin(false); else stop();
  }

  onMount(() => {
    void refresh().catch(() => {});
    const changed = () => void refresh();
    navigator.mediaDevices?.addEventListener('devicechange', changed);
    return () => { navigator.mediaDevices?.removeEventListener('devicechange', changed); stop(); };
  });
</script>

<div class="card mic">
  {#if devices.length}
    <Select value={selected} onchange={choose} width="100%" label="Microphone" options={devices} />
  {/if}
  <div class="bars" role="meter" aria-label="Microphone level" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(level * 100)}>
    {#each Array(BARS) as _, i}<i class:on={i < level * BARS} class:high={i >= 14}></i>{/each}
  </div>
  <p style:color={message[1] || undefined}>{#if message[1]}<b style:background={message[1]}></b>{/if}{message[0]}</p>
  <div class="acts">
    {#if phase === 'testing' || phase === 'recording'}
      <button class="btn on" onclick={stop}><Square size={10} fill="currentColor" /> Stop</button>
      <button class="btn" disabled={phase === 'recording'} onclick={() => begin(true)}>Record 5 sec</button>
    {:else if phase === 'playing' || phase === 'played'}
      <button class="btn on" onclick={playAgain}>Play again</button>
      <button class="btn" onclick={() => begin(true)}>Record again</button>
    {:else}
      <button class="btn on" onclick={() => begin(false)}><Mic size={12} /> Test mic</button>
      <button class="btn" onclick={() => begin(true)}>Record 5 sec</button>
    {/if}
  </div>
</div>

<style>
  .mic { gap: 8px; min-width: 0; }
  .bars { display: flex; gap: 3px; height: 24px; flex: none; }
  .bars i { flex: 1; border-radius: 99px; background: rgba(255, 255, 255, .09); }
  .bars i.on { background: #30d158; }
  .bars i.on.high { background: #ff9f0a; }
  p { display: flex; align-items: center; gap: 5px; margin: 0; font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  p b { flex: none; width: 6px; height: 6px; border-radius: 50%; }
  .acts { display: flex; gap: 6px; margin-top: auto; }
</style>
