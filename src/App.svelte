<script lang="ts">
  import { notch, WINDOW } from './lib/notch.svelte';
  import { PAGES } from './lib/pages';
  import { inTauri } from './lib/bridge';
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
  import Settings from './lib/pages/Settings.svelte';
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

  const page = $derived(PAGES[notch.page]);
  const time = $derived(new Date(ticker.now).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));

  // Geser halaman dengan panah atau roda mouse mendatar.
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') notch.unpin();
    if (!notch.open || (e.target as HTMLElement)?.matches?.('input,textarea')) return;
    if (e.key === 'ArrowRight') notch.go(1);
    if (e.key === 'ArrowLeft') notch.go(-1);
  };
  let wheelAt = 0;
  const wheel = (e: WheelEvent) => {
    if (!notch.open || Math.abs(e.deltaX) < Math.abs(e.deltaY) || Date.now() - wheelAt < 350) return;
    wheelAt = Date.now();
    notch.go(e.deltaX > 0 ? 1 : -1);
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
  <div
    class="shell"
    class:open={notch.open}
    style:width="{notch.size.w}px"
    style:height="{notch.size.h}px"
    style:border-radius="0 0 {notch.size.r}px {notch.size.r}px"
  >
    {#if notch.open}
      <header>
        <button class="title" onclick={() => (notch.settings = false)}><b>{notch.settings ? L('Pengaturan', 'Settings') : page.title()}</b></button>
        <span class="right">
          {#if features.weather && weather.now}<span class="wx" title={weather.now.place}>{weather.now.icon} {weather.now.temp}°</span>{/if}
          {#if device.media?.playing}<Equalizer />{/if}
          {#if device.power}
            <span class="batt" class:chg={device.power.charging} class:low={device.power.percent <= 20 && !device.power.charging}
              title={L(`Baterai ${device.power.percent}%`, `Battery ${device.power.percent}%`)}>{device.power.charging ? '⚡' : ''}{device.power.percent}%</span>
          {/if}
          <span class="clock">{time}</span>
          <button class="gear" aria-label={L('Pengaturan', 'Settings')} onclick={() => (notch.settings = !notch.settings)}>⚙</button>
        </span>
      </header>

      <section class="page">
        {#if notch.settings}<Settings />
        {:else if page.id === 'home'}<Home />
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
      </section>

      <PageDock />
    {:else if news.current}
      {#key news.current.id}
        <div class="news"><b>{news.current.text}</b>{#if news.current.sub}<span>{news.current.sub}</span>{/if}</div>
      {/key}
    {:else if notch.wings && device.media}
      <div class="wings">
        <span class="art">{#if device.media.thumb}<img src={device.media.thumb} alt="" />{:else}♪{/if}</span>
        <span class="song">{device.media.title}</span>
        <Equalizer />
      </div>
    {:else}
      <span class="eyes"><i></i><i></i></span>
    {/if}
  </div>
</main>

<style>
  main { height: 100vh; display: flex; justify-content: center; align-items: flex-start; transition: opacity .2s; }
  .shell {
    background: #000; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;
    transition: width .5s cubic-bezier(.3, 1.25, .45, 1), height .5s cubic-bezier(.3, 1.2, .45, 1), border-radius .4s;
  }
  .shell.open { justify-content: flex-start; align-items: stretch; padding: 0 22px 10px; }
  .eyes { display: flex; gap: 9px; }
  .eyes i { width: 7px; height: 11px; background: #fff; border-radius: 50%; animation: blink 5s infinite; }
  @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
  .wings { width: 100%; display: flex; align-items: center; gap: 9px; padding: 0 12px; }
  .art { width: 22px; height: 22px; border-radius: 6px; background: rgba(255, 255, 255, .12); overflow: hidden; flex: none; display: grid; place-items: center; font-size: 12px; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .song { flex: 1; min-width: 0; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(255, 255, 255, .85); }
  .news { display: flex; gap: 10px; align-items: baseline; padding: 0 16px; max-width: 100%; white-space: nowrap; animation: pop .35s; }
  .news b { overflow: hidden; text-overflow: ellipsis; }
  .news span { color: rgba(255, 255, 255, .5); font-size: 11px; }
  @keyframes pop { from { opacity: 0; transform: translateY(-6px); } }
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
  .page { flex: 1; min-height: 0; padding-top: 4px; position: relative; overflow: hidden; }
  @media (prefers-reduced-motion: reduce) { .shell, .eyes i { transition: none; animation: none; } }
</style>
