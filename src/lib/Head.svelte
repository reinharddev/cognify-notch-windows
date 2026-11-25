<script lang="ts">
  import { untrack } from 'svelte';
  import { face } from './face.svelte';
  import { ui } from './ui.svelte';

  // Kepala bulat untuk mode pill (mengambang), bergaya Mimik/bbot: kepala bulat sempurna dengan cincin tipis, mata bulat
  // besar, dan mulut. Mata dan mulut menempel pada permukaan kepala yang berbentuk bola, dan bola itu diputar mengikuti
  // arah kursor, jadi mata di tepi bergeser jauh dan menyempit: wajah terasa menoleh. Rumus `project()` sama dengan
  // notch/Skins/mimik/face.js dan FaceHead.swift di Mac. Ekspresi tetap dari `face.pose` (face.svelte.ts).
  const R = 46, TURN = 0.36, EYE_R = 12, EYE_X = 19, EYE_Y = 4, MOUTH_Y = 24;
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

  // Arah kursor (dari Rust, relatif terhadap pill) → vektor menoleh -1..1 dengan kurva ease-out bbot: dekat = menoleh
  // sedikit, jauh = penuh. Lalu dihaluskan dengan pegas (k 150, d 19) yang hanya berjalan selama belum diam.
  const target = $derived.by(() => {
    if (ui.eyesMode !== 'follow') return { x: 0, y: 0 };
    const dx = face.look.x * 90, dy = face.look.y * 70;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return { x: 0, y: 0 };
    const g0 = Math.min(1, d / 260), f = g0 * (2 - g0);
    return { x: (dx / d) * f, y: (dy / d) * f };
  });
  let gaze = $state({ x: 0, y: 0 });
  $effect(() => {
    const t = target;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { gaze = { ...t }; return; }
    let { x, y } = untrack(() => gaze);
    let vx = 0, vy = 0, prev = 0, frame = 0;
    const step = (now: number) => {
      const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 1 / 60;
      prev = now;
      const n = Math.ceil(dt / (1 / 60)), h = dt / n;
      for (let i = 0; i < n; i++) {
        vx += ((t.x - x) * 150 - vx * 19) * h; x += vx * h;
        vy += ((t.y - y) * 150 - vy * 19) * h; y += vy * h;
      }
      gaze = { x, y };
      if (Math.abs(t.x - x) + Math.abs(t.y - y) + Math.abs(vx) + Math.abs(vy) > 0.004) frame = requestAnimationFrame(step);
      else gaze = { ...t };
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  });

  const look = $derived({ x: gaze.x + face.glance.x * 0.25, y: gaze.y + face.glance.y * 0.25 });
  const yaw = $derived(look.x * TURN);
  const pitch = $derived(-look.y * TURN);
  function project(x: number, y: number) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const z = Math.sqrt(Math.max(R * R - x * x - y * y, 1));
    const rx = x * cy + z * sy, rz = z * cy - x * sy;
    const py = y * cp - rz * sp, depth = y * sp + rz * cp;
    return { x: rx, y: py, sq: clamp(depth / z, 0.25, 1), phi: (Math.atan2(py, rx) * 180) / Math.PI };
  }
  const place = (s: { x: number; y: number; sq: number; phi: number }) =>
    `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) rotate(${s.phi.toFixed(2)}deg) scale(${s.sq.toFixed(3)}, 1) rotate(${(-s.phi).toFixed(2)}deg)`;

  // Pose ekspresi (satuan lama) → satuan kepala 100.
  const p = $derived(face.pose);
  const hidden = $derived(p.deco === 'heart' || p.deco === 'spiral');
  const eyeAt = (side: number) => project(side * EYE_X + p.gx * 2, EYE_Y + p.gy * 2);
  const mw = $derived(Math.max(1, p.mw * 2.2)), mc = $derived(p.mc * 2.2), mo = $derived(p.mo * 1.7);
  const mouthSpot = $derived(project(0, MOUTH_Y));
  // Satu bentuk mulut: garis lengkung; saat terbuka, sisi bawahnya melengkung ke bawah dan bidangnya terisi.
  const mouthLine = $derived(`M${-mw} ${-mc * 0.3}Q0 ${mc * 0.7} ${mw} ${-mc * 0.3}`);
  const mouthBody = $derived(`${mouthLine}Q0 ${mc * 0.7 + mo * 2} ${-mw} ${-mc * 0.3}Z`);
  const lt = $derived(face.blinkPhase === 'close' ? 'transform .11s ease-in' : face.blinkPhase === 'open' ? 'transform .26s ease-out' : undefined);
  const uid = Math.random().toString(36).slice(2, 7);
  const spiral = (() => {
    let d = 'M0 0';
    for (let a = 0.3; a < Math.PI * 4; a += 0.3) d += `L${(Math.cos(a) * a * 0.9).toFixed(2)} ${(Math.sin(a) * a * 0.9).toFixed(2)}`;
    return d;
  })();
</script>

<svg class="head" viewBox="-50 -50 100 100" aria-hidden="true">
  <defs>
    <clipPath id="eye{uid}"><circle r={EYE_R + 0.6} /></clipPath>
    <clipPath id="face{uid}"><circle r={R} /></clipPath>
  </defs>
  <circle class="skin" r={R} />
  <g clip-path="url(#face{uid})">
    {#each [-1, 1] as side}
      {@const right = side > 0}
      {@const e = eyeAt(side)}
      {@const top = clamp(Math.max(p.top, face.blink, right ? face.wink : 0), 0, 1)}
      {@const tilt = (right ? -1 : 1) * p.tilt}
      {@const size = p.skew === 0 ? 1 : right ? 1 + p.skew : 1 - p.skew * 0.5}
      <g class="place" style:transform={place(e)}>
        <g style:transform="scale({p.sx}, {p.sy * size})" style:opacity={hidden ? 0 : 1}>
          <g clip-path="url(#eye{uid})">
            <circle class="eye" r={EYE_R} />
            <rect class="lid" x="-22" y="-44" width="44" height="44" style:transform="rotate({tilt}deg) translateY({-EYE_R + (2 * EYE_R + 1) * top}px)" style:transition={lt} />
            <circle class="lid" r="16" style:transform="rotate({tilt}deg) translateY({EYE_R + 16 - 2 * EYE_R * clamp(p.bot, 0, 1)}px)" />
          </g>
        </g>
        {#if p.deco === 'heart'}<path class="heart" d="M0 8C-16 -2 -12 -13 0 -6C12 -13 16 -2 0 8Z" />{/if}
        {#if p.deco === 'spiral'}<path class="spin" d={spiral} />{/if}
      </g>
    {/each}

    <g class="place" style:transform={place(mouthSpot)}>
      {#if mo > 0.05}<path class="mouth-o" d={mouthBody} style:opacity={clamp(mo / 2, 0, 1)} />{/if}
      <path class="mouth" d={mouthLine} />
    </g>

    {#if p.deco === 'blush'}
      <ellipse class="blush" cx="-29" cy="18" rx="8.5" ry="4.5" /><ellipse class="blush" cx="29" cy="18" rx="8.5" ry="4.5" />
    {:else if p.deco === 'tear'}
      <path class="drop" d="M0 -5C4 0 5 4 0 7C-5 4 -4 0 0 -5Z" style:transform="translate({eyeAt(-1).x}px, {eyeAt(-1).y + 21}px)" />
    {/if}
  </g>
  <circle class="ring" r={R - 0.9} />

  {#if p.deco === 'z'}<text class="sym z" x="26" y="-18">z</text>
  {:else if p.deco === 'question'}<text class="sym" x="27" y="-22">?</text>
  {:else if p.deco === 'bang'}<text class="sym" x="27" y="-22">!</text>
  {:else if p.deco === 'sweat'}<path class="drop" d="M31 -34C35 -28 36 -24 31 -20C26 -24 27 -28 31 -34Z" />
  {:else if p.deco === 'note'}<text class="note" x="30" y="-16">♪</text>
  {:else if p.deco === 'sparkle'}
    <path class="spark" d="M-36 -40L-34 -34L-28 -32L-34 -30L-36 -24L-38 -30L-44 -32L-38 -34Z" />
    <path class="spark" d="M36 -40L38 -34L44 -32L38 -30L36 -24L34 -30L28 -32L34 -34Z" style="animation-delay: .4s" />
  {/if}
</svg>

<style>
  .head { display: block; width: 100%; height: 100%; overflow: visible; }
  .skin { fill: #000; }
  .ring { fill: none; stroke: #34363a; stroke-width: 2.4; }
  .eye { fill: #e9ebec; }
  .lid { fill: #000; }
  .place, .head g { transform-box: view-box; transform-origin: 0 0; }
  .heart { fill: #ff6b8b; }
  .spin { fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; animation: spin .7s linear infinite; transform-origin: 0 0; }
  .mouth { fill: none; stroke: #e9ebec; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; transition: opacity .18s ease; }
  .mouth-o { fill: #e9ebec; transition: opacity .18s ease; }
  .blush { fill: #ff7a9a; opacity: .55; }
  .drop { fill: #7dd3fc; }
  .sym { font: 800 20px system-ui, sans-serif; fill: #fff; }
  .z { fill: rgba(255, 255, 255, .65); font-size: 16px; }
  .note { font: 800 18px system-ui, sans-serif; fill: #fff; animation: note 1.3s ease-in-out infinite; }
  .spark { fill: #fde68a; transform-box: fill-box; transform-origin: center; animation: twinkle 1.1s ease-in-out infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes note { 0% { transform: translate(0, 4px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(5px, -9px); opacity: 0; } }
  @keyframes twinkle { 0%, 100% { transform: scale(.6); } 50% { transform: scale(1.15); } }
  @media (prefers-reduced-motion: reduce) { .spin, .note, .spark { animation: none; } }
</style>
