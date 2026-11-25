<script lang="ts">
  import { face } from './face.svelte';
  import { ui } from './ui.svelte';
  import { notch } from './notch.svelte';
  import { device } from './system.svelte';
  import Head from './Head.svelte';
  import { gaze } from './gaze.svelte';

  // Wajah teman kecil (lihat face.svelte.ts). Mode notch: dua mata persegi panjang bulat 8x12 dengan pendar aksen.
  // Mode kepala (pill mengambang): kepala bulat dengan mata dan mulut. Kelopak, kemiringan, ukuran, dan mulut
  // berubah mulus lewat transisi CSS, jadi tidak ada animasi yang berjalan terus saat wajah diam.
  let { head = false }: { head?: boolean } = $props();
  $effect(() => face.start());

  // Gerakan sesaat (kaget, loncat, menyapa) lewat Web Animations supaya transisi ekspresi tidak terputus.
  let box = $state<Element | undefined>();
  const MOVES: Record<string, [Keyframe[], number]> = {
    shake: [[{ transform: 'translateX(0)' }, { transform: 'translateX(-2px)', offset: .15 }, { transform: 'translateX(2px)', offset: .3 }, { transform: 'translateX(-1.5px)', offset: .45 }, { transform: 'translateX(1.5px)', offset: .6 }, { transform: 'translateX(-.5px)', offset: .8 }, { transform: 'translateX(0)' }], 600],
    bounce: [[{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)', offset: .25 }, { transform: 'translateY(0)', offset: .5 }, { transform: 'translateY(-1px)', offset: .75 }, { transform: 'translateY(0)' }], 600],
    pop: [[{ transform: 'scale(1)' }, { transform: 'scale(1.25)', offset: .5 }, { transform: 'scale(1)' }], 500],
  };
  $effect(() => {
    void face.rxKey;
    const move = MOVES[face.rx];
    if (!move || !box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    box.animate(move[0], { duration: move[1], easing: 'ease-out' });
  });

  const gap = $derived(Math.round(notch.closed.idle.w * 0.42));
  // Bergoyang mengikuti musik: seluruh wajah mengangguk pelan, mata mendenyut dan mulut membuka mengikuti kerasnya suara.
  const pulse = $derived(face.groove ? Math.min(1, device.level * 1.8) : 0);
  const p = $derived.by(() => {
    const base = face.pose;
    if (!pulse) return base;
    return { ...base, sy: base.sy * (1 + pulse * 0.14), sx: base.sx * (1 + pulse * 0.06), mo: base.mo + pulse * 2.4, mr: Math.max(base.mr, pulse * 0.7) };
  });
  const clamp = (v: number) => Math.min(1, Math.max(0, v));


  const uid = Math.random().toString(36).slice(2, 7);
  const tint = 'color-mix(in srgb, var(--accent) 90%, transparent)';
</script>

{#snippet eye(right: boolean, scale: number)}
  {@const top = clamp(Math.max(p.top, face.blink, right ? face.wink : 0))}
  {@const tilt = (right ? -1 : 1) * p.tilt}
  {@const size = p.skew === 0 ? 1 : right ? 1 + p.skew : 1 - p.skew * 0.5}
  {@const hidden = p.deco === 'heart' || p.deco === 'spiral'}
  {@const closed = clamp((top - 0.78) / 0.22)}
  {@const lt = face.blinkPhase === 'close' ? 'transform .11s ease-in, opacity .11s ease-in' : face.blinkPhase === 'open' ? 'transform .26s ease-out, opacity .26s ease-out' : undefined}
  {@const gx = p.gx * 0.5 + face.glance.x + gaze.x * 4.5}
  {@const gy = p.gy * 0.5 + face.glance.y + gaze.y * 2.6}
  {@const turnAway = (right ? 1 : -1) * gaze.x > 0 ? 1 - 0.28 * Math.min(1, Math.abs(gaze.x)) : 1}
  <g class="eye" style:transform="translate({gx}px, {gy}px) scale({scale * turnAway}, {scale})">
    <g class="shape" style:transform="scale({p.sx}, {p.sy * size})" style:opacity={hidden ? 0 : 1 - closed} style:transition={lt}>
      <defs>
        <linearGradient id="eyeFill{uid}{right ? 'r' : 'l'}" x1="0" y1="-6" x2="0" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#fff" />
          <stop offset="0.58" stop-color="#f7f8fa" />
          <stop offset="1" stop-color="#d8dbe2" />
        </linearGradient>
        <!-- Kelopak memotong bentuk mata (hitam di topeng = transparan), bukan menimpanya dengan warna hitam: tetap benar di latar gradasi atau gambar. -->
        <mask id="m{uid}{right ? 'r' : 'l'}" maskUnits="userSpaceOnUse" x="-9" y="-9" width="18" height="18">
          <rect x="-4" y="-6" width="8" height="12" rx="3.5" fill="#fff" />
          <rect class="lid" x="-14" y="-32" width="28" height="32" style:transform="rotate({tilt}deg) translate(0px, {-6 + 13 * top}px)" style:transition={lt} />
          <circle class="lid" r="8.4" style:transform="rotate({tilt}deg) translate(0px, {14.4 - 12 * p.bot}px)" style:transition={lt} />
        </mask>
      </defs>
      <rect class="body" x="-4" y="-6" width="8" height="12" rx="3.5" fill="url(#eyeFill{uid}{right ? 'r' : 'l'})" mask="url(#m{uid}{right ? 'r' : 'l'})" />
    </g>
    <!-- Mata tertutup: garis tipis. -->
    <rect class="shut" x="-4.5" y="1" width="9" height="2" rx="1" style:opacity={hidden ? 0 : 0.75 * closed} style:transition={lt} />
    <path class="heart" d="M0 4.5C-8 -1 -6 -7 0 -3.5C6 -7 8 -1 0 4.5Z" style:opacity={p.deco === 'heart' ? 1 : 0} />
    <text class="spiral" y="4" text-anchor="middle" style:opacity={p.deco === 'spiral' ? 1 : 0}>@</text>
    <ellipse class="blush" cx="0" cy="8.5" rx="5" ry="2.2" style:opacity={p.deco === 'blush' ? 0.6 : 0} />
    <path class="tear" d="M-2 7C-0.4 9.4 0 10.6 -2 12C-4 10.6 -3.6 9.4 -2 7Z" style:opacity={p.deco === 'tear' ? 1 : 0} />
    {#if right}
      <text class="z" x="9" y="-3" style:opacity={p.deco === 'z' ? 0.6 : 0}>z</text>
      <text class="note" class:on={p.deco === 'note'} x="8" y="-5" style:opacity={p.deco === 'note' ? 1 : 0}>♪</text>
      <path class="spark" class:on={p.deco === 'sparkle'} d="M9 -11L10 -8L13 -7L10 -6L9 -3L8 -6L5 -7L8 -8Z" style:opacity={p.deco === 'sparkle' ? 1 : 0} />
      <text class="sym" x="8" y="-5" style:opacity={p.deco === 'question' ? 1 : 0}>?</text>
      <text class="sym" x="8" y="-5" style:opacity={p.deco === 'bang' ? 1 : 0}>!</text>
      <path class="drop" d="M8 -9C9.6 -6.6 10 -5.4 8 -4C6 -5.4 6.4 -6.6 8 -9Z" style:opacity={p.deco === 'sweat' ? 1 : 0} />
    {/if}
  </g>
{/snippet}

{#if head}
    <div class="headbox" bind:this={box}><Head /></div>
  {:else}
    <span class="eyes" class:groove={face.groove} bind:this={box} style:gap="{gap}px">
      {#each [false, true] as right}
        <svg class="notchEye" viewBox="-7 -8 14 16" width="14" height="16" aria-hidden="true">{@render eye(right, 1)}</svg>
      {/each}
    </span>
{/if}

<style>
  .eyes { display: flex; align-items: center; justify-content: center; }
  .notchEye { overflow: visible; }
  .notchEye { margin: 0 4px; }
  .headbox { width: 100%; height: 100%; }
  .eye { transition: transform .08s linear; }
  .heart, .spiral, .z, .sym, .drop, .note, .spark, .blush, .tear { transition: opacity .2s ease; }
  .note { font: 800 9px system-ui, sans-serif; fill: #fff; }
  .note.on { animation: note 1.3s ease-in-out infinite; }
  .spark { fill: #fde68a; transform-origin: 8px -7px; }
  .spark.on { animation: twinkle 1.1s ease-in-out infinite; }
  .blush { fill: #ff7aa2; }
  .tear { fill: #7dd3fc; }
  .groove { animation: groove .54s ease-in-out infinite alternate; }
  .eye, .shape, .lid { transform-origin: 0 0; transform-box: view-box; }
  .body { fill: #fff; }
  .lid { fill: #000; stroke: none; }
  .shut { fill: #fff; }
  .heart { fill: #ff6b8b; }
  .spiral { font: 800 11px system-ui, sans-serif; fill: #fff; transform-origin: 0 0; animation: spin .7s linear infinite; }
  .z { font: 800 8px system-ui, sans-serif; fill: #fff; }
  .sym { font: 800 10px system-ui, sans-serif; fill: #fff; }
  .drop { fill: #7dd3fc; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes groove { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-1.5px) rotate(2deg); } }
  @keyframes note { 0% { transform: translate(0, 2px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(3px, -5px); opacity: 0; } }
  @keyframes twinkle { 0%, 100% { transform: scale(.6); } 50% { transform: scale(1.15); } }
  @media (prefers-reduced-motion: reduce) { .spiral, .note.on, .spark.on, .groove { animation: none; } }
</style>
