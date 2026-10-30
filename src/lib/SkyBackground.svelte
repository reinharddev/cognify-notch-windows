<script lang="ts">
  import { weather } from './weather.svelte';
  import { skyColors, skyPosition, weatherBlend, drawSky } from './sky';
  import { sightAt } from './astro';

  // Latar langit di belakang isi notch saat halaman Langit terbuka: gradien menurut jam dan cuaca
  // (berubah pelan) dengan awan, hujan, salju, bintang, atau kilat di atasnya. Penuh sampai ke atas.
  let canvas: HTMLCanvasElement | undefined = $state();
  let top = $state('#000'), bottom = $state('#000');

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, last = 0;
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (ts - last < 1000 / 24) return;
      last = ts;
      const now = weather.clockOverride ?? Date.now();
      const pos = skyPosition(now, weather.now?.sun ?? null);
      const bl = weatherBlend(weather.now ? weather.now.code : null, weather.kindShift, Date.now());
      const c = skyColors(pos.horizon, bl.from, bl.to, bl.t);
      top = c.top; bottom = c.bottom;
      const dpr = window.devicePixelRatio || 1, w = canvas!.clientWidth, h = canvas!.clientHeight;
      if (canvas!.width !== Math.round(w * dpr)) { canvas!.width = Math.round(w * dpr); canvas!.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const sec = performance.now() / 1000;
      const ob = weather.observer, sight = ob ? sightAt(ob.lat, ob.lon, now) : null;
      // Cuaca baru muncul pelan: lapisan cuaca lama memudar sambil yang baru menguat.
      if (bl.t < 1 && bl.from !== bl.to) { ctx.globalAlpha = 1 - bl.t; drawSky(ctx, w, h, sec, pos.horizon, c.day, bl.from, sight); }
      ctx.globalAlpha = bl.from === bl.to ? 1 : bl.t;
      drawSky(ctx, w, h, sec, pos.horizon, c.day, bl.to, sight);
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="sky" style:background="linear-gradient(to bottom, {top}, {bottom})"><canvas bind:this={canvas}></canvas></div>

<style>
  .sky { position: absolute; inset: 0; transition: opacity .4s; }
  canvas { width: 100%; height: 100%; display: block; }
</style>
