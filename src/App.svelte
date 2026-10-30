<script lang="ts">
  import { notch, SIZES, HEAD } from './lib/notch.svelte';
  import { Spring, springEase } from './lib/spring';
  import { onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { Bell, Brain, Coffee, Download, Hourglass } from '@lucide/svelte';
  const LIVE_ICONS = { download: Download, brain: Brain, coffee: Coffee, hourglass: Hourglass, bell: Bell } as const;
  import { cmd, inTauri, on, openSettings } from './lib/bridge';
  import { ui } from './lib/ui.svelte';
  import { L } from './lib/i18n';
  import { news } from './lib/news.svelte';
  import { device, features } from './lib/system.svelte';
  import { ticker } from './lib/store.svelte';
  import { notchLink } from './lib/link.svelte';
  import Home from './lib/pages/Home.svelte';
  import Music from './lib/pages/Music.svelte';
  import Pomodoro from './lib/pages/Pomodoro.svelte';
  import Clock from './lib/pages/Clock.svelte';
  import Sky from './lib/pages/Sky.svelte';
  import SkyBackground from './lib/SkyBackground.svelte';
  import Water from './lib/pages/Water.svelte';
  import Todo from './lib/pages/Todo.svelte';
  import Notes from './lib/pages/Notes.svelte';
  import Clipboard from './lib/pages/Clipboard.svelte';
  import Tray from './lib/pages/Tray.svelte';
  import Mirror from './lib/pages/Mirror.svelte';
  import Shortcuts from './lib/pages/Shortcuts.svelte';
  import Equalizer from './lib/Equalizer.svelte';
  import NoticeCard from './lib/NoticeCard.svelte';
  import Hud from './lib/Hud.svelte';
  import Eyes from './lib/Eyes.svelte';
  import PageDock from './lib/PageDock.svelte';
  import { weather } from './lib/weather.svelte';
  import { skyInk } from './lib/sky';
  import { artColors } from './lib/artColor.svelte';
  import { ICONS } from './lib/icons';
  import { headerStamp } from './lib/relative';
  import { lyrics } from './lib/lyrics.svelte';
  import { agenda } from './lib/agenda.svelte';
  import { hotkey } from './lib/hotkey.svelte';
  import { startAutoCheck } from './lib/update.svelte';
  weather.restart();
  agenda.restart();
  hotkey.apply();
  startAutoCheck();
  // Pengaturan ada di jendela sendiri; saat ada yang berubah, bagian itu dimuat ulang dari penyimpanan bersama.
  const syncEyes = () => void cmd('set_eyes_follow', { on: features.companion && ui.eyesMode === 'follow' });
  syncEyes();
  $effect.root(() => { $effect(() => { void cmd('set_layout', { mode: ui.style }); }); });
  void cmd('set_display', { mode: ui.display });
  on<string>('prefs-changed', (scope) => {
    if (scope === 'features') { features.reload(); weather.reload(); syncEyes(); hotkey.apply(); }
    else if (scope === 'weather') weather.reload();
    else if (scope === 'agenda') agenda.reload();
    else if (scope === 'hotkey') hotkey.reload();
    else if (scope === 'ui') { const r = ui.roundness; ui.reload(); syncEyes(); if (ui.roundness !== r) notch.previewShape(); }
    else if (scope === 'reload') location.reload();
  });

  // Baris lirik di sayap saat lagu diputar (seperti di Mac); tanpa lirik tersinkron, judul lagu.
  $effect(() => { if (features.lyrics && features.lyricsWing && notch.wings) lyrics.loadFor(device.media); });
  const wingLine = $derived.by(() => {
    const m = device.media, ls = lyrics.state;
    if (!features.lyrics || !features.lyricsWing || !m || ls.kind !== 'synced') return '';
    const pos = m.position + (m.playing ? (ticker.now - device.mediaAt) / 1000 : 0);
    const i = ls.lines.findLastIndex((l) => l.time <= pos + 0.25);
    return i >= 0 ? ls.lines[i].text : '';
  });
    const pages = $derived(ui.pages);
  const page = $derived(pages[Math.min(notch.page, pages.length - 1)]);
  const time = $derived(headerStamp(ticker.now));
  $effect(() => { artColors.update(((ui.lyricAuto || ui.equalizerAuto) ? device.media?.thumb : undefined) ?? undefined); });
  // Halaman Langit: warna tulisan menyesuaikan terang gelapnya langit.
  const ink = $derived(page.id === 'sky' ? skyInk(weather.clockOverride ?? ticker.now, weather.now?.sun ?? null, weather.now?.code ?? null, weather.kindShift) : undefined);

  // Geser halaman dengan panah atau roda mouse mendatar.
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') notch.unpin();
    if (!notch.open || (e.target as HTMLElement)?.matches?.('input,textarea')) return;
    if (e.key === 'ArrowRight') notch.go(1);
    if (e.key === 'ArrowLeft') notch.go(-1);
    // Angka 1-9 langsung ke halaman itu (seperti di Mac).
    if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey && Number(e.key) <= pages.length) notch.select(Number(e.key) - 1);
  };
  // Ukuran notch digerakkan pegas seperti di versi Mac. Isi tiap bentuk punya ukuran tetap sendiri
  // (tidak menyusut bersama notch), jadi tata letak isinya tidak dihitung ulang tiap frame.
  let shellEl: HTMLElement;
  let spring: Spring;
  onMount(() => {
    ui.applyAccent();
    void notchLink.start();
    const p0 = notch.pos;
    spring = new Spring({ x: p0.x, y: p0.y, w: p0.w, h: p0.h, r: p0.r }, (v) => {
      shellEl.style.left = `${v.x}px`;
      shellEl.style.top = `${v.y}px`;
      shellEl.style.width = `${v.w}px`;
      shellEl.style.height = `${v.h}px`;
      const r = Math.max(0, v.r);
      shellEl.style.borderRadius = notch.pill ? `${r}px` : `0 0 ${r}px ${r}px`;
    });
  });
  $effect(() => {
    const { x, y, w, h, r } = notch.pos;
    spring?.to({ x, y, w, h, r });
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
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<main
  style:width="100%"
  style:opacity={device.hidden ? 0 : 1}
  onclick={() => notch.click()}
  onpointerenter={() => { if (!inTauri) notch.enter(); }}
  onpointerleave={() => { if (!inTauri) notch.leave(); }}
>
  <div class="shell" class:open={notch.open} class:pillmode={notch.pill} class:ax-left={notch.geo.ax === 'left'} class:ax-right={notch.geo.ax === 'right'} bind:this={shellEl}>
    {#if notch.open && page.id === 'sky'}<SkyBackground />{/if}
    {#if notch.open}
      <div class="layer openl" style:--lw="{SIZES.open.w}px" style:--lh="{SIZES.open.h}px" style:--sc={ui.scale} style:--ink={ink} style:color={ink} in:enter out:leave>
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

        {#if news.alert}
          {@const al = news.alert}
          {@const AIcon = ICONS[al.icon]}
          <section class="page banner" in:fly={{ y: 8, duration: 260 }}>
            <span class="bico"><AIcon size={22} strokeWidth={2.4} /></span>
            <span class="btxt"><b>{al.title}</b><small>{al.detail}</small></span>
            {#if al.action}
              {@const act = al.action}
              <button class="bact" onclick={() => { act.run(); news.clearAlert(); }}>{act.label}</button>
            {/if}
          </section>
        {:else}
        <section class="page">
          {#key page.id}
            <div class="pg" in:pageIn={{ dir: notch.forward ? 1 : -1 }} out:pageOut>
              {#if page.id === 'home'}<Home />
              {:else if page.id === 'music'}<Music />
              {:else if page.id === 'timer'}<Pomodoro />
              {:else if page.id === 'clock'}<Clock />
              {:else if page.id === 'sky'}<Sky />
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
        {/if}

      </div>
    {:else if news.level}
      <div class="layer hudl" style:--lw="{notch.closed.hud.w}px" style:--lh="{notch.closed.hud.h}px" in:enter out:leave>
        <Hud level={news.level} />
      </div>
    {:else if news.current}
      {#key news.current.id}
        <div class="layer" style:--lw="{notch.closed.card.w}px" style:--lh="{notch.closed.card.h}px" in:enter out:leave>
          <NoticeCard card={news.current} />
        </div>
      {/key}
    {:else if notch.live}
      {@const lv = notch.live}
      {@const LIcon = LIVE_ICONS[lv.icon]}
      <div class="layer center" style:--lw="{notch.closed.media.w}px" style:--lh="{notch.closed.media.h}px" in:enter out:leave>
        <div class="wings live" style:--tint={lv.tint}>
          <span class="lic"><LIcon size={13} strokeWidth={2.4} /></span>
          {#if lv.title}<span class="song">{lv.title || L('Mengunduh', 'Downloading')}</span>{:else}<span class="grow"></span>{/if}
          <span class="dlb">{lv.text}</span>
        </div>
      </div>
    {:else if notch.wings && device.media}
      <div class="layer center" style:--lw="{notch.closed.media.w}px" style:--lh="{notch.closed.media.h}px" in:enter out:leave>
        <div class="wings">
          <span class="art">{#if device.media.thumb}<img src={device.media.thumb} alt="" />{:else}♪{/if}</span>
          <span class="song" style:color={wingLine ? (ui.lyricAuto ? artColors.on : null) || ui.lyricActive || undefined : undefined}>{wingLine || device.media.title}</span>
          <Equalizer />
        </div>
      </div>
    {:else}
      <div class="layer center" style:--lw="{notch.headMode ? HEAD : notch.closed.idle.w}px" style:--lh="{notch.headMode ? HEAD : notch.closed.idle.h}px" in:enter out:leave>
        {#if features.companion}<Eyes head={notch.headMode} />{/if}
      </div>
    {/if}
  </div>
</main>

<style>
  main { position: relative; height: 100vh; transition: opacity .2s; overflow: hidden; }
  .shell { position: absolute; background: #000; overflow: hidden; will-change: left, top, width, height; box-sizing: border-box; }
  /* Mode pill: mengambang, jadi diberi garis tipis dan bayangan supaya terlihat di atas jendela lain. */
  .shell.pillmode { box-shadow: 0 8px 28px rgba(0, 0, 0, .5), 0 0 0 1px rgba(255, 255, 255, .09); }
  /* Pill di dekat tepi: isi menempel ke sisi pill, bukan ke tengah, supaya bentuk tumbuh ke sisi yang masih punya ruang. */
  .shell.ax-left .layer { left: 0; margin-left: 0; }
  .shell.ax-right .layer { left: auto; right: 0; margin-left: 0; }
  .shell.ax-left .layer.openl { transform-origin: 0 0; }
  .shell.ax-right .layer.openl { transform-origin: 100% 0; }
  /* Tiap bentuk punya lapisan berukuran tetap, menempel di atas tengah; notch yang membesar hanya memotongnya. */
  .layer { position: absolute; top: 0; left: 50%; width: var(--lw); height: var(--lh); margin-left: calc(var(--lw) / -2); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
  .layer.openl { transform: scale(var(--sc, 1)); transform-origin: 50% 0; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 0 22px 10px; }
  .wings { width: 100%; display: flex; align-items: center; gap: 9px; padding: 0 12px; }
  .art { width: 22px; height: 22px; border-radius: 6px; background: rgba(255, 255, 255, .12); overflow: hidden; flex: none; display: grid; place-items: center; font-size: 12px; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .wings.live { gap: 8px; }
  .lic { display: grid; place-items: center; flex: none; color: var(--tint); }
  .grow { flex: 1; }
  .dlb { font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, .75); flex: none; }
  .song { flex: 1; min-width: 0; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(255, 255, 255, .85); }
  header { white-space: nowrap; height: 36px; flex: none; display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; }
  .title { border: 0; background: none; padding: 0; cursor: default; font-size: 13px; }
  .right { display: flex; align-items: center; gap: 10px; }
  .clock { font-weight: 600; font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--ink, #fff) 80%, transparent); font-size: 11.5px; }
  .wx { font-size: 11.5px; font-weight: 600; }
  .batt { font-size: 11px; font-weight: 600; }
  .batt.chg { color: #5fd38d; }
  .batt.low { color: #ff6b63; }
  .gear { border: 0; background: none; cursor: pointer; opacity: .5; font-size: 14px; padding: 0 2px; }
  .gear:hover { opacity: 1; }
  .banner { display: flex; align-items: center; gap: 14px; padding: 0 8px; }
  .bico { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .btxt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .btxt b { font-size: 14px; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .btxt small { font-size: 11.5px; color: rgba(255, 255, 255, .6); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .bact { border: 0; border-radius: 99px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: #fff; background: color-mix(in srgb, var(--accent) 90%, transparent); cursor: pointer; flex: none; transition: transform .12s; }
  .bact:active { transform: scale(.95); }
  .pg { position: absolute; left: 0; right: 0; top: 4px; bottom: 0; }
  .page { flex: 1; min-height: 0; padding-top: 4px; position: relative; overflow: hidden; }
</style>
