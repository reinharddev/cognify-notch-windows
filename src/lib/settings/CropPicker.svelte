<script lang="ts">
  // Pilih bagian gambar yang tampil di panel: seret bingkai di atas gambar utuh, atur zoom dengan penggeser.
  import { ui, PANEL_RATIO } from '../ui.svelte';
  import { L } from '../i18n';
  import { Minus, Plus, RotateCcw } from '@lucide/svelte';

  let { onchange }: { onchange: () => void } = $props();
  let box: HTMLDivElement | undefined = $state();

  const ai = $derived(ui.bgAspect > 0 ? ui.bgAspect : PANEL_RATIO);
  const z = $derived(Math.min(3, Math.max(1, ui.bgZoom)));
  // Bagian gambar yang terlihat (pecahan lebar dan tinggi gambar), sama dengan perhitungan background-size di ui.imageCss.
  const vw = $derived(Math.min(1, ai >= PANEL_RATIO ? PANEL_RATIO / (z * ai) : 1 / z));
  const vh = $derived(Math.min(1, ai >= PANEL_RATIO ? 1 / z : ai / (PANEL_RATIO * z)));
  const fx = $derived((ui.bgPosX / 100) * (1 - vw));
  const fy = $derived((ui.bgPosY / 100) * (1 - vh));

  // Rasio sebenarnya diukur dari gambar itu sendiri, supaya tidak pernah gepeng walau nilai tersimpan keliru atau belum ada.
  $effect(() => {
    const src = ui.bgImage;
    const im = new Image();
    im.onload = () => {
      const a = im.naturalWidth / Math.max(1, im.naturalHeight);
      if (src === ui.bgImage && Math.abs(a - ui.bgAspect) > 0.001) { ui.bgAspect = a; onchange(); }
    };
    im.src = src;
  });
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  function drag(e: PointerEvent) {
    if (!box || e.buttons !== 1) return;
    const r = box.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
    ui.bgPosX = 1 - vw > 0.001 ? Math.round(clamp(((mx - vw / 2) / (1 - vw)) * 100)) : 50;
    ui.bgPosY = 1 - vh > 0.001 ? Math.round(clamp(((my - vh / 2) / (1 - vh)) * 100)) : 50;
    onchange();
  }
  function key(e: KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    ui.bgPosX = clamp(ui.bgPosX + m[0]); ui.bgPosY = clamp(ui.bgPosY + m[1]);
    onchange();
  }
  const setZoom = (v: number) => { ui.bgZoom = Math.min(3, Math.max(1, Math.round(v * 100) / 100)); onchange(); };
  function wheel(e: WheelEvent) { e.preventDefault(); setZoom(z + (e.deltaY < 0 ? 0.1 : -0.1)); }
  function reset() { ui.bgPosX = 50; ui.bgPosY = 50; ui.bgZoom = 1; onchange(); }
  const dirty = $derived(ui.bgPosX !== 50 || ui.bgPosY !== 50 || ui.bgZoom !== 1);
</script>

<div class="crop">
  <div class="frame" bind:this={box} style:aspect-ratio={String(ai)} style:width="min(100%, {300 * ai}px)" role="presentation"
    onpointerdown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); drag(e); }} onpointermove={drag} onwheel={wheel}>
    <img src={ui.bgImage} alt="" draggable="false" />
    <i class="win" role="slider" tabindex="0" aria-label={L('Bagian gambar yang tampil', 'Visible part of the image')}
      aria-valuetext={`${ui.bgPosX}%, ${ui.bgPosY}%`} aria-valuenow={ui.bgPosX} aria-valuemin="0" aria-valuemax="100" onkeydown={key}
      style:left="{fx * 100}%" style:top="{fy * 100}%" style:width="{vw * 100}%" style:height="{vh * 100}%"><b></b><b></b><b></b><b></b></i>
  </div>
  <div class="zbar">
    <button type="button" class="step" onclick={() => setZoom(z - 0.25)} disabled={z <= 1} aria-label={L('Perkecil', 'Zoom out')}><Minus size={14} /></button>
    <input type="range" min="1" max="3" step="0.01" value={z} oninput={(e) => setZoom(Number(e.currentTarget.value))} aria-label={L('Zoom gambar', 'Image zoom')} />
    <button type="button" class="step" onclick={() => setZoom(z + 0.25)} disabled={z >= 3} aria-label={L('Perbesar', 'Zoom in')}><Plus size={14} /></button>
    <span class="pill">{Math.round(z * 100)}%</span>
    <button type="button" class="step" onclick={reset} disabled={!dirty} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button>
  </div>
  <p class="tip">{L('Seret di gambar untuk memilih bagian yang tampil. Gulir untuk zoom.', 'Drag on the image to pick the visible part. Scroll to zoom.')}</p>
</div>

<style>
  .crop { display: grid; gap: 10px; width: 100%; }
  .frame { position: relative; border-radius: 12px; margin-inline: auto; overflow: hidden; background: #000; cursor: grab; touch-action: none; box-shadow: 0 0 0 1px rgba(255, 255, 255, .12); }
  .frame:active { cursor: grabbing; }
  .frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: fill; pointer-events: none; }
  /* Bagian terpilih tetap terang; sisanya digelapkan. Bingkai putih tipis dengan empat sudut tebal. */
  .win { position: absolute; box-sizing: border-box; border-radius: 6px; box-shadow: 0 0 0 1px rgba(255, 255, 255, .9), 0 0 0 999px rgba(0, 0, 0, .58); outline: none; transition: box-shadow .15s; }
  .win:focus-visible { box-shadow: 0 0 0 2px var(--accent), 0 0 0 999px rgba(0, 0, 0, .58); }
  .win b { position: absolute; width: 12px; height: 12px; border: 0 solid #fff; }
  .win b:nth-child(1) { left: -1px; top: -1px; border-width: 3px 0 0 3px; border-top-left-radius: 6px; }
  .win b:nth-child(2) { right: -1px; top: -1px; border-width: 3px 3px 0 0; border-top-right-radius: 6px; }
  .win b:nth-child(3) { left: -1px; bottom: -1px; border-width: 0 0 3px 3px; border-bottom-left-radius: 6px; }
  .win b:nth-child(4) { right: -1px; bottom: -1px; border-width: 0 3px 3px 0; border-bottom-right-radius: 6px; }
  .zbar { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 99px; background: rgba(255, 255, 255, .07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08); }
  .zbar input[type=range] { flex: 1; min-width: 0; -webkit-appearance: none; appearance: none; height: 20px; background: transparent; cursor: pointer; --p: 0%; }
  .zbar input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 99px; background: linear-gradient(to right, var(--accent) var(--p), rgba(255, 255, 255, .18) var(--p)); }
  .zbar input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%; background: #f3f2f8; border: 0; box-shadow: 0 0 0 1px rgba(0, 0, 0, .35), 0 1px 2px rgba(0, 0, 0, .4); }
  .zbar input[type=range]:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
  .step { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .1); color: inherit; cursor: pointer; flex: none; }
  .step:hover:not(:disabled) { background: rgba(255, 255, 255, .2); }
  .step:disabled { opacity: .35; cursor: default; }
  .pill { min-width: 46px; text-align: center; font-variant-numeric: tabular-nums; font-weight: 600; }
  .tip { margin: 0; font-size: 11.5px; color: var(--dim); }
</style>
