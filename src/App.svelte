<script lang="ts">
  import { notch, WINDOW, SIZES } from './lib/notch.svelte';
  import { Spring, springEase } from './lib/spring';
  import { onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { PAGES } from './lib/pages';
  import { inTauri, on, openSettings } from './lib/bridge';
  import { ui } from './lib/ui.svelte';
  import { L } from './lib/i18n';
  import { news } from './lib/news.svelte';
  import { device, features } from './lib/system.svelte';
  import { ticker } from './lib/store.svelte';
  import Home from './lib/pages/Home.svelte';
  import Music from './lib/pages/Music.svelte';
  import Pomodoro from './lib/pages/Pomodoro.svelte';
  import Clock from './lib/pages/Clock.svelte';
  import Water from './lib/pages/Water.svelte';
  import Todo from './lib/pages/Todo.svelte';
  import Notes from './lib/pages/Notes.svelte';
  import Clipboard from './lib/pages/Clipboard.svelte';
  import Tray from './lib/pages/Tray.svelte';
  import Mirror from './lib/pages/Mirror.svelte';
  import Shortcuts from './lib/pages/Shortcuts.svelte';
  import Equalizer from './lib/Equalizer.svelte';
  import PageDock from './lib/PageDock.svelte';
  import { weather } from './lib/weather.svelte';
  import { agenda } from './lib/agenda.svelte';
  import { hotkey } from './lib/hotkey.svelte';
  import { startAutoCheck } from './lib/update.svelte';
  weather.restart();
  agenda.restart();
  hotkey.apply();
  startAutoCheck();
  // Pengaturan ada di jendela sendiri; saat ada yang berubah, bagian itu dimuat ulang dari penyimpanan bersama.
  on<string>('prefs-changed', (scope) => {
    if (scope === 'features') { features.reload(); weather.reload(); }
    else if (scope === 'weather') weather.reload();
    else if (scope === 'agenda') agenda.reload();
    else if (scope === 'hotkey') hotkey.reload();
    else if (scope === 'ui') ui.reload();
  });

  const page = $derived(PAGES[notch.page]);
  const time = $derived(new Date(ticker.now).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));

  // Geser halaman dengan panah atau roda mouse mendatar.
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') notch.unpin();
    if (!notch.open || (e.target as HTMLElement)?.matches?.('input,textarea')) return;
    if (e.key === 'ArrowRight') notch.go(1);
    if (e.key === 'ArrowLeft') notch.go(-1);
  };
  // Kedipan mata: dijalankan sesaat tiap 5 detik. Animasi CSS yang berulang tanpa henti membuat browser
  // menyiapkan frame terus-menerus walau tampilan tidak berubah.
  function blink(node: HTMLElement) {
    let timer = 0;
    const go = () => {
      node.querySelectorAll('i').forEach((eye) =>
        eye.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.1)', offset: 0.375 }, { transform: 'scaleY(1)' }], { duration: 400 }));
      timer = window.setTimeout(go, 5000);
    };
    timer = window.setTimeout(go, 4600);
    return { destroy: () => clearTimeout(timer) };
  }

  // Ukuran notch digerakkan pegas seperti di versi Mac. Isi tiap bentuk punya ukuran tetap sendiri
  // (tidak menyusut bersama notch), jadi tata letak isinya tidak dihitung ulang tiap frame.
  let shellEl: HTMLElement;
  let spring: Spring;
  onMount(() => {
    spring = new Spring({ w: notch.size.w, h: notch.size.h, r: notch.size.r }, (v) => {
      shellEl.style.width = `${v.w}px`;
      shellEl.style.height = `${v.h}px`;
      shellEl.style.borderRadius = `0 0 ${Math.max(0, v.r)}px ${Math.max(0, v.r)}px`;
    });
  });
  $effect(() => {
    const { w, h, r } = notch.size;
    spring?.to({ w, h, r });
  });
  // Isi baru muncul sedikit setelah notch mulai bergerak (skala 0,96 dari atas), isi lama memudar cepat.
  const enter = (_node: Element) => ({
    delay: 60, duration: 420, easing: springEase,
    css: (t: number) => `opacity:${Math.min(1, t * 1.6)};transform:scale(${0.96 + 0.04 * t});transform-origin:50% 0`,
  });
  const leave = (_node: Element) => ({ duration: 120, css: (t: number) => `opacity:${t}` });
  // Pindah halaman seperti di Mac: halaman lama memudar cepat, halaman baru masuk bergeser 24 poin
  // searah gerakan sambil memudar, dengan pegas yang sama. Keduanya bertumpuk sebentar.
  const pageIn = (_node: Element, { dir }: { dir: number }) => ({
    duration: 500, easing: springEase,
    css: (t: number) => `opacity:${Math.min(1, t * 1.8)};transform:translateX(${(1 - t) * 24 * dir}px)`,
  });
  const pageOut = (_node: Element) => ({ duration: 100, easing: cubicOut, css: (t: number) => `opacity:${t};pointer-events:none` });
  // Satu geseran = satu halaman, seperti di Mac. Peristiwa roda yang datang berurutan (selisih di bawah
  // 150 ms, termasuk dorongan inersia trackpad setelah jari diangkat) dianggap satu gestur: jaraknya
  // dikumpulkan, pindah sekali setelah melewati 60 piksel, sisanya diabaikan sampai gestur berikutnya.
  let swipeX = 0, swiped = false, lastWheel = 0;
  const wheel = (e: WheelEvent) => {
    if (!notch.open) return;
    const now = performance.now();
    if (now - lastWheel > 150) { swipeX = 0; swiped = false; }
    lastWheel = now;
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 2) return;
    swipeX += e.deltaX * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1);
    if (swiped || Math.abs(swipeX) < 60) return;
    swiped = true;
    notch.go(swipeX > 0 ? 1 : -1);
  };
</script>

<svelte:window onkeydown={key} onwheel={wheel} onblur={() => notch.unpin()} />

<!-- Di browser biasa hover memakai pointer; di Tauri hover datang dari Rust. -->
<main
  style:width="{WINDOW.w}px"
  style:opacity={device.hidden ? 0 : 1}
  onpointerenter={() => { if (!inTauri) notch.enter(); }}
  onpointerleave={() => { if (!inTauri) notch.leave(); }}
>
  <div class="shell" class:open={notch.open} bind:this={shellEl}>
    {#if notch.open}
      <div class="layer openl" style:--lw="{SIZES.open.w}px" style:--lh="{SIZES.open.h}px" in:enter out:leave>
        <header>
          <span class="title"><b>{page.title()}</b></span>
          <span class="right">
            {#if features.weather && weather.now}<span class="wx" title={weather.now.place}>{weather.now.icon} {weather.now.temp}°</span>{/if}
            {#if device.media?.playing}<Equalizer />{/if}
            {#if device.power}
              <span class="batt" class:chg={device.power.charging} class:low={device.power.percent <= 20 && !device.power.charging}
                title={L(`Baterai ${device.power.percent}%`, `Battery ${device.power.percent}%`)}>{device.power.charging ? '⚡' : ''}{device.power.percent}%</span>
            {/if}
            <span class="clock">{time}</span>
            <button class="gear" aria-label={L('Pengaturan', 'Settings')} onclick={openSettings}>⚙</button>
          </span>
        </header>

        <section class="page">
          {#key page.id}
            <div class="pg" in:pageIn={{ dir: notch.forward ? 1 : -1 }} out:pageOut>
              {#if page.id === 'home'}<Home />
              {:else if page.id === 'music'}<Music />
              {:else if page.id === 'timer'}<Pomodoro />
              {:else if page.id === 'clock'}<Clock />
              {:else if page.id === 'water'}<Water />
              {:else if page.id === 'todo'}<Todo />
              {:else if page.id === 'notes'}<Notes />
              {:else if page.id === 'clipboard'}<Clipboard />
              {:else if page.id === 'tray'}<Tray />
              {:else if page.id === 'mirror'}<Mirror />
              {:else if page.id === 'shortcuts'}<Shortcuts />{/if}
            </div>
          {/key}
        </section>

        <PageDock />
      </div>
    {:else if news.current}
      {#key news.current.id}
        <div class="layer center" style:--lw="{SIZES.news.w}px" style:--lh="{SIZES.news.h}px" in:enter out:leave>
          <div class="news"><b>{news.current.text}</b>{#if news.current.sub}<span>{news.current.sub}</span>{/if}</div>
        </div>
      {/key}
    {:else if notch.wings && device.media}
      <div class="layer center" style:--lw="{notch.closed.media.w}px" style:--lh="{notch.closed.media.h}px" in:enter out:leave>
        <div class="wings">
          <span class="art">{#if device.media.thumb}<img src={device.media.thumb} alt="" />{:else}♪{/if}</span>
          <span class="song">{device.media.title}</span>
          <Equalizer />
        </div>
      </div>
    {:else}
      <div class="layer center" style:--lw="{notch.closed.idle.w}px" style:--lh="{notch.closed.idle.h}px" in:enter out:leave>
        <span class="eyes" use:blink><i></i><i></i></span>
      </div>
    {/if}
  </div>
</main>

<style>
  main { height: 100vh; display: flex; justify-content: center; align-items: flex-start; transition: opacity .2s; }
  .shell { position: relative; background: #000; overflow: hidden; will-change: width, height; }
  /* Tiap bentuk punya lapisan berukuran tetap, menempel di atas tengah; notch yang membesar hanya memotongnya. */
  .layer { position: absolute; top: 0; left: 50%; width: var(--lw); height: var(--lh); margin-left: calc(var(--lw) / -2); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
  .layer.openl { flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 0 22px 10px; }
  .eyes { display: flex; gap: 9px; }
  .eyes i { width: 7px; height: 11px; background: #fff; border-radius: 50%; }
  .wings { width: 100%; display: flex; align-items: center; gap: 9px; padding: 0 12px; }
  .art { width: 22px; height: 22px; border-radius: 6px; background: rgba(255, 255, 255, .12); overflow: hidden; flex: none; display: grid; place-items: center; font-size: 12px; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .song { flex: 1; min-width: 0; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(255, 255, 255, .85); }
  .news { display: flex; gap: 10px; align-items: baseline; padding: 0 16px; max-width: 100%; white-space: nowrap; }
  .news b { overflow: hidden; text-overflow: ellipsis; }
  .news span { color: rgba(255, 255, 255, .5); font-size: 11px; }
  header { white-space: nowrap; height: 36px; flex: none; display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; }
  .title { border: 0; background: none; padding: 0; cursor: default; font-size: 13px; }
  .right { display: flex; align-items: center; gap: 10px; }
  .clock { font-weight: 600; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, .8); font-size: 11.5px; }
  .wx { font-size: 11.5px; font-weight: 600; }
  .batt { font-size: 11px; font-weight: 600; }
  .batt.chg { color: #5fd38d; }
  .batt.low { color: #ff6b63; }
  .gear { border: 0; background: none; cursor: pointer; opacity: .5; font-size: 14px; padding: 0 2px; }
  .gear:hover { opacity: 1; }
  .pg { position: absolute; left: 0; right: 0; top: 4px; bottom: 0; }
  .page { flex: 1; min-height: 0; padding-top: 4px; position: relative; overflow: hidden; }
</style>
