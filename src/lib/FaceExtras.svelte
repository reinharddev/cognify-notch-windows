<script lang="ts">
  // Tambahan gaya wajah melayang, sama dengan `FaceExtras` di Mac: cincin progres, lencana aktivitas,
  // penghitung "+N", dan gelembung lirik di sampingnya.
  import { Download, Music, Sun, Volume2, VolumeX, Zap, Bell, Timer } from '@lucide/svelte';
  import { notch, HEAD, LYRIC_W } from './notch.svelte';
  import { news } from './news.svelte';
  import { device } from './system.svelte';
  import { pomodoro, clockTools } from './state.svelte';
  import { ticker } from './store.svelte';

  let { line = '' }: { line?: string } = $props();

  const ring = $derived.by((): { value: number; tint: string } | null => {
    if (notch.charging !== null) return { value: notch.charging / 100, tint: '#30d158' };
    if (news.level) return { value: news.level.muted ? 0 : news.level.value, tint: 'var(--accent)' };
    if (pomodoro.running) return { value: pomodoro.progress, tint: pomodoro.mode === 'focus' ? 'var(--accent)' : '#30d158' };
    const c = clockTools.nearest;
    if (c) return { value: 1 - (c.end - ticker.now) / 1000 / c.total, tint: '#ff9f0a' };
    return null;
  });
  const activities = $derived(notch.lives.length + (notch.wings ? 1 : 0));
  /** Sisa menit timer; cincinnya sudah menunjukkan kemajuan. */
  const minutes = $derived(pomodoro.running ? Math.ceil(pomodoro.remaining / 60) : clockTools.nearest ? Math.ceil((clockTools.nearest.end - ticker.now) / 60000) : null);
  const R = HEAD / 2 + 1.5, C = 2 * Math.PI * R;
</script>

<div class="extras" style:left="{notch.pos.x}px" style:top="{notch.pos.y}px" style:width="{HEAD}px" style:height="{HEAD}px">
  {#if ring}
    <svg viewBox="-24 -24 48 48" width="48" height="48" aria-hidden="true">
      <circle r={R} fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3" />
      <circle r={R} fill="none" stroke={ring.tint} stroke-width="3" stroke-linecap="round" stroke-dasharray={C} stroke-dashoffset={C * (1 - Math.min(1, Math.max(0, ring.value)))} transform="rotate(-90)" />
    </svg>
  {/if}
  {#if notch.charging !== null}<span class="badge" style:color="#30d158"><Zap size={10} fill="currentColor" /></span>
  {:else if news.level}<span class="badge">{#if news.level.kind === 'brightness'}<Sun size={10} />{:else if news.level.muted}<VolumeX size={10} />{:else}<Volume2 size={10} />{/if}</span>
  {:else if notch.wings}<span class="badge art">{#if device.media?.thumb}<img src={device.media.thumb} alt="" />{:else}<Music size={10} />{/if}</span>
  {:else if minutes !== null}<span class="badge">{minutes}</span>
  {:else if notch.live}<span class="badge" style:color={notch.live.tint}>{#if notch.live.icon === 'download'}<Download size={10} />{:else if notch.live.icon === 'bell'}<Bell size={10} />{:else}<Timer size={10} />{/if}</span>{/if}
  {#if activities > 2}<span class="more">+{activities - 2}</span>{/if}
  {#if notch.faceLyric}<span class="lyric" style:left="{HEAD + 12}px" style:width="{LYRIC_W}px">{line || '♪'}</span>{/if}
</div>

<style>
  .extras { position: absolute; z-index: 2; pointer-events: none; }
  svg { position: absolute; left: -3px; top: -3px; }
  .badge { position: absolute; right: -4px; bottom: -3px; display: grid; place-items: center; width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%; background: #000; border: 1px solid rgba(255, 255, 255, .25); color: #fff; font-size: 8.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .art { overflow: hidden; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .more { position: absolute; right: -6px; top: -4px; padding: 0 4px; border-radius: 99px; background: #fff; color: #000; font-size: 9px; font-weight: 700; }
  .lyric { position: absolute; top: calc(50% - 13px); height: 26px; box-sizing: border-box; padding: 0 12px; border-radius: 99px; background: #000; color: #fff; font-size: 12px; font-weight: 600; line-height: 26px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: grow .35s cubic-bezier(.32, .72, 0, 1); transform-origin: 0 50%; }
  @keyframes grow { from { opacity: 0; transform: scale(.6); } }
  @media (prefers-reduced-motion: reduce) { .lyric { animation: none; } }
</style>
