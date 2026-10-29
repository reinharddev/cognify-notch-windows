<script lang="ts">
  import { face, POSES, type Pose } from './face.svelte';
  import { ui } from './ui.svelte';
  import { notch } from './notch.svelte';

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
  const follow = $derived(ui.eyesMode === 'follow');
  const p = $derived<Pose>(POSES[face.emotion]);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));

  // Mulut: lengkung dan buka, sama dengan MouthShape di Mac.
  const mouth = $derived.by(() => {
    const y = 0, corner = y - p.mc * 0.3, ctl = y + p.mc * 0.7, w = p.mw;
    const top = `M${-w} ${corner}Q0 ${ctl} ${w} ${corner}`;
    return p.mo > 0.3 ? `${top}Q0 ${ctl + p.mo * 2} ${-w} ${corner}Z` : top;
  });

  const uid = Math.random().toString(36).slice(2, 7);
  const tint = 'color-mix(in srgb, var(--accent) 90%, transparent)';
</script>

{#snippet eye(right: boolean, scale: number)}
  {@const top = clamp(Math.max(p.top, face.blink, right ? face.wink : 0))}
  {@const tilt = (right ? -1 : 1) * p.tilt}
  {@const size = p.skew === 0 ? 1 : right ? 1 + p.skew : 1 - p.skew * 0.5}
  {@const hidden = p.deco === 'heart' || p.deco === 'spiral'}
  {@const gx = p.gx * 0.5 + face.glance.x + (follow ? face.look.x * 1.2 : 0)}
  {@const gy = p.gy * 0.5 + face.glance.y + (follow ? face.look.y : 0)}
  <g class="eye" style:transform="translate({gx}px, {gy}px) scale({scale})">
    <g class="shape" style:transform="scale({p.sx}, {p.sy * size})" style:opacity={hidden ? 0 : top > 0.88 ? 0 : 1}>
      <clipPath id="c{uid}{right ? 'r' : 'l'}"><rect x="-4.2" y="-6.2" width="8.4" height="12.4" rx="3.7" /></clipPath>
      <g clip-path="url(#c{uid}{right ? 'r' : 'l'})">
        <rect class="body" x="-4" y="-6" width="8" height="12" rx="3.5" />
        <rect class="lid" x="-14" y="-32" width="28" height="32" style:transform="rotate({tilt}deg) translate(0px, {-6 + 13 * top}px)" />
        <circle class="lid" r="8.4" style:transform="rotate({tilt}deg) translate(0px, {14.4 - 12 * p.bot}px)" />
      </g>
    </g>
    <!-- Mata tertutup: garis tipis. -->
    <rect class="shut" x="-4.5" y="1" width="9" height="2" rx="1" style:opacity={top > 0.88 && !hidden ? 0.75 : 0} />
    <path class="heart" d="M0 4.5C-8 -1 -6 -7 0 -3.5C6 -7 8 -1 0 4.5Z" style:opacity={p.deco === 'heart' ? 1 : 0} />
    <text class="spiral" y="4" text-anchor="middle" style:opacity={p.deco === 'spiral' ? 1 : 0}>@</text>
    {#if right}
      <text class="z" x="9" y="-3" style:opacity={p.deco === 'z' ? 0.6 : 0}>z</text>
      <text class="sym" x="8" y="-5" style:opacity={p.deco === 'question' ? 1 : 0}>?</text>
      <text class="sym" x="8" y="-5" style:opacity={p.deco === 'bang' ? 1 : 0}>!</text>
      <path class="drop" d="M8 -9C9.6 -6.6 10 -5.4 8 -4C6 -5.4 6.4 -6.6 8 -9Z" style:opacity={p.deco === 'sweat' ? 1 : 0} />
    {/if}
  </g>
{/snippet}

{#if head}
    <svg class="head" bind:this={box} viewBox="-21 -21 42 42" aria-hidden="true">
      <g transform="translate(-8.5 -4)">{@render eye(false, 0.85)}</g>
      <g transform="translate(8.5 -4)">{@render eye(true, 0.85)}</g>
      <g transform="translate(0 10)">
        <path class="mouth" style:d="path('{mouth}')" style:fill-opacity={clamp(p.mo / 2)} />
      </g>
    </svg>
  {:else}
    <span class="eyes" bind:this={box} style:gap="{gap}px">
      {#each [false, true] as right}
        <svg class="notchEye" viewBox="-7 -8 14 16" width="14" height="16" aria-hidden="true">{@render eye(right, 1)}</svg>
      {/each}
    </span>
{/if}

<style>
  .eyes { display: flex; align-items: center; justify-content: center; }
  .notchEye, .head { overflow: visible; filter: drop-shadow(0 0 4px color-mix(in srgb, var(--accent) 90%, transparent)); }
  .notchEye { margin: 0 4px; }
  .head { width: 100%; height: 100%; }
  .eye, .shape, .lid, .shut, .heart, .spiral, .z, .sym, .drop, .mouth { transition: transform .35s cubic-bezier(.34, 1.4, .5, 1), opacity .25s ease, d .35s ease, fill-opacity .25s ease; }
  .eye, .shape, .lid { transform-origin: 0 0; transform-box: view-box; }
  .body { fill: #fff; }
  .lid { fill: #000; }
  .shut { fill: #fff; }
  .heart { fill: #ff6b8b; }
  .spiral { font: 800 11px system-ui, sans-serif; fill: #fff; transform-origin: 0 0; animation: spin .7s linear infinite; }
  .z { font: 800 8px system-ui, sans-serif; fill: #fff; }
  .sym { font: 800 10px system-ui, sans-serif; fill: #fff; }
  .drop { fill: #7dd3fc; }
  .mouth { fill: #fff; stroke: #fff; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spiral { animation: none; } }
</style>
