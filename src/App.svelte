<script lang="ts">
  import { notch, SIZES, HEAD, LYRIC_ROW, type LiveItem } from './lib/notch.svelte';
  import { Spring, springEase } from './lib/spring';
  import { onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';
  import { Bell, Brain, Coffee, Download, Hourglass, Leaf, Timer , Settings } from '@lucide/svelte';
  const LIVE_ICONS = { download: Download, brain: Brain, coffee: Coffee, hourglass: Hourglass, bell: Bell, stopwatch: Timer } as const;
  import { cmd, cmdTry, emitPrefs, inTauri, on, openSettings } from './lib/bridge';
  import { ui } from './lib/ui.svelte';
  import { L } from './lib/i18n';
  import { news } from './lib/news.svelte';
  import { TINT } from './lib/icons';
  import { device, features } from './lib/system.svelte';
  import { ticker } from './lib/store.svelte';
  import { dock } from './lib/dock.svelte';
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
  import Cognify from './lib/pages/Cognify.svelte';
  import { hub } from './lib/hub.svelte';
  import Equalizer from './lib/Equalizer.svelte';
  import NoticeCard from './lib/NoticeCard.svelte';
  import Hud from './lib/Hud.svelte';
  import { notchPath } from './lib/geometry';
  import FaceExtras from './lib/FaceExtras.svelte';
  import Eyes from './lib/Eyes.svelte';
  import { skinBridge } from './lib/skinBridge.svelte';
  import PageDock from './lib/PageDock.svelte';
  import { weather } from './lib/weather.svelte';
  import { skyInk } from './lib/sky';
  import { artColors } from './lib/artColor.svelte';
  import { ICONS } from './lib/icons';
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
  $effect.root(() => { $effect(() => { void cmd('set_panel_scale', { percent: Math.round(ui.scale * 100) }); }); });
  // Timer cepat di dock selesai: kartu di notch (bunyinya sudah dimainkan oleh dock).
  on<number>('dock-timer-done', (minutes) => news.device(L('Timer selesai', 'Timer done'), L(`${minutes} menit sudah habis`, `${minutes} minutes are up`), 'timer', TINT.accent));
  on<string>('prefs-changed', (scope) => {
    if (scope === 'features') { features.reload(); weather.reload(); syncEyes(); hotkey.apply(); }
    else if (scope === 'weather') weather.reload();
    else if (scope === 'agenda') agenda.reload();
    else if (scope === 'hotkey') hotkey.reload();
    else if (scope === 'ui') { const r = ui.roundness; ui.reload(); syncEyes(); if (ui.roundness !== r) notch.previewShape(); }
    else if (scope === 'dock') { dock.reload(); void dock.apply(); }
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
  // Lirik di bawah: sayap hanya sampul dan equalizer.
  const wingLabel = $derived(notch.lyricRow ? '' : wingLine || device.media?.title || '');
  let wingView = $state<HTMLSpanElement>();
  let wingText = $state<HTMLSpanElement>();
  let wingOverflow = $state(0);
  $effect(() => {
    void wingLabel;
    const view = wingView, text = wingText;
    if (!view || !text) { wingOverflow = 0; return; }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { wingOverflow = Math.max(0, text.scrollWidth - view.clientWidth); });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(view);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  });
    const pages = $derived(ui.pages);
  const page = $derived(pages[Math.min(notch.page, pages.length - 1)]);
  // Berdampingan: yang tampil di sayap kanan bergantian tiap 4 detik bila lebih dari satu.
  const pairItem = $derived(notch.pairRight[Math.floor(ticker.now / 4000) % Math.max(1, notch.pairRight.length)] ?? notch.pairRight[0]);
  void skinBridge; // pemasangan efek jembatan ke skin desktop (hanya aktif bila ada skin yang menyala)
  const date = $derived(new Date(ticker.now).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', ''));
  const hhmm = $derived(new Date(ticker.now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  async function togglePowerSaver() {
    const power = device.power;
    if (!power?.power_saver_available) return;
    const enabled = !power.power_saver;
    const result = await cmdTry<boolean>('set_power_saver', { enabled });
    if (result.ok && device.power) device.power = { ...device.power, power_saver: result.value ?? enabled };
    else if (!result.ok) news.device(L('Mode hemat daya gagal diganti', 'Couldn\'t switch power mode'), result.error, 'battery-warning', '#ff9f0a');
  }
  $effect(() => { artColors.update(device.media?.thumb ?? undefined); });
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
    hub.start();
    void dock.apply();
    const p0 = notch.pos;
    spring = new Spring({ x: p0.x, y: p0.y, w: p0.w, h: p0.h, r: p0.r }, (v) => {
      const r = Math.max(0, v.r);
      // Gaya Notch: kotak sedikit lebih lebar, lalu dipotong supaya sudut atasnya melengkung halus ke tepi layar.
      const notched = notch.pill ? null : notchPath(v.w, v.h, r);
      const ear = notched?.ear ?? 0;
      shellEl.style.left = `${v.x - ear}px`;
      shellEl.style.top = `${v.y}px`;
      shellEl.style.width = `${v.w + ear * 2}px`;
      shellEl.style.height = `${v.h}px`;
      shellEl.style.borderRadius = notched ? '0' : `${r}px`;
      shellEl.style.clipPath = notched ? `path('${notched.path}')` : 'none';
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

{#snippet chip(it: LiveItem)}
  {@const CI = LIVE_ICONS[it.icon]}
  <span class="chip" style:--tint={it.tint}>
    <span class="lic"><CI size={13} strokeWidth={2.4} /></span>
    {#if it.laps}<span class="lap">L{it.laps}</span>{/if}
    <span class="dlb" class:dim={it.paused}>{it.text}</span>
  </span>
{/snippet}

<!-- Di browser biasa hover memakai pointer; di Tauri hover datang dari Rust. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<main
  style:width="100%"
  style:opacity={device.hidden ? 0 : 1}
  onclick={() => notch.click()}
  onpointerdown={(e) => { if (e.altKey && e.button === 0 && notch.startDrag()) { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); } }}
  onpointermove={(e) => { if (notch.dragging) notch.moveDrag(e.clientX, e.clientY); }}
  onpointerup={() => { if (notch.endDrag()) { ui.persist(); void emitPrefs('ui'); } }}
  onpointercancel={() => { if (notch.endDrag()) { ui.persist(); void emitPrefs('ui'); } }}
  onpointerenter={() => { if (!inTauri) notch.enter(); }}
  onpointerleave={() => { if (!inTauri) notch.leave(); }}
>
  <div class="shell" class:open={notch.open} class:pillmode={notch.pill} class:ax-left={notch.geo.ax === 'left'} class:ax-right={notch.geo.ax === 'right'} bind:this={shellEl}>
    {#if ui.bgCss && (notch.open || notch.pill || ui.idleThemed)}
      <div class="bglayer" aria-hidden="true" style:background={ui.bgCss.background} style:filter={ui.bgCss.image && ui.bgBlur > 0 ? `blur(${ui.bgBlur * 16}px)` : undefined} style:inset={ui.bgCss.image && ui.bgBlur > 0 ? '-24px' : '0'}></div>
      <div class="bgdim" aria-hidden="true" style:opacity={ui.bgMode === 'color' ? 0 : ui.bgDim}></div>
    {/if}
    {#if notch.open && page.id === 'sky'}<SkyBackground />{/if}
    {#if notch.open}
      <div class="layer openl" style:--lw="{SIZES.open.w}px" style:--lh="{SIZES.open.h}px" style:--sc={ui.scale} style:--ink={ink} style:color={ink} in:enter out:leave>
        <header>
          <span class="title"><b>{page.title()}</b></span>
          <span class="right">
            {#if features.weather && weather.now}<span class="wx" title={weather.now.place}>{weather.now.icon} {weather.now.temp}°</span>{/if}
            {#if device.power}
              <span class="batt" class:chg={device.power.charging} class:low={device.power.percent <= 20 && !device.power.charging} role="img"
                aria-label={L(`Baterai ${device.power.percent}%`, `Battery ${device.power.percent}%`)} title={L(`Baterai ${device.power.percent}%`, `Battery ${device.power.percent}%`) + (device.power.charging ? ' ⚡' : '')}>
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="2.5" />
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="37.7" stroke-dashoffset={37.7 * (1 - device.power.percent / 100)} transform="rotate(-90 8 8)" /></svg>
              </span>
              {#if device.power.power_saver_available}
                <button class="power-saver" class:on={device.power.power_saver} aria-label={L('Mode hemat daya', 'Power saver mode')}
                  title={(device.power.power_saver ? L('Efisiensi daya aktif · klik buat mematikan', 'Power efficiency is on · click to turn off') : L('Nyalakan efisiensi daya', 'Turn on power efficiency')) + (device.power.plugged ? L(' (saat tersambung charger)', ' (while plugged in)') : L(' (saat memakai baterai)', ' (on battery)'))}
                  aria-pressed={device.power.power_saver}
                  onclick={(event) => { event.stopPropagation(); void togglePowerSaver(); }}><Leaf size={13} /></button>
              {/if}
            {/if}
            <span class="date">{date}</span>
            <span class="clock">{hhmm}</span>
            <button class="gear" aria-label={L('Pengaturan', 'Settings')} onclick={openSettings}><Settings size={14} /></button>
            {#if device.media?.playing}<Equalizer />{/if}
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
        <section class="page" class:bleed={page.id === 'music'}>
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
              {:else if page.id === 'shortcuts'}<Shortcuts />
              {:else if page.id === 'cognify'}<Cognify />{/if}
            </div>
          {/key}
        </section>

        <PageDock />
        {/if}

      </div>
    {:else if notch.headMode}
      <div class="layer center" style:--lw="{HEAD}px" style:--lh="{HEAD}px" in:enter out:leave>
        <Eyes head />
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
    {:else if notch.wings && device.media}
      <div class="layer center" style:--lw="{notch.lyricRow && !notch.pill ? Math.max((notch.paired ? notch.closed.pair : notch.closed.media).w, LYRIC_ROW.w) : (notch.paired ? notch.closed.pair : notch.closed.media).w}px" style:--lh="{notch.closed.media.h}px" in:enter out:leave>
        <div class="wings">
          <span class="art">{#if device.media.thumb}<img src={device.media.thumb} alt="" />{:else}♪{/if}</span>
          <span class="song" class:scrolling={wingOverflow > 0} bind:this={wingView} title={wingLabel}
            style:--scroll-x="-{wingOverflow}px" style:--scroll-time="{Math.max(5, wingOverflow / 18)}s"
            style:color={wingLine ? (ui.lyricAuto ? artColors.on : null) || ui.lyricActive || undefined : undefined}>
            <span bind:this={wingText}>{wingLabel}</span>
          </span>
          {#if notch.paired}{@render chip(pairItem)}{#if notch.pairRight.length > 1}<span class="more">+{notch.pairRight.length - 1}</span>{/if}{:else}<Equalizer />{/if}
        </div>
      </div>
    {:else if notch.live}
      {@const lv = notch.live}
      {@const LIcon = LIVE_ICONS[lv.icon]}
      <div class="layer center" style:--lw="{(notch.paired ? notch.closed.pair : notch.closed.media).w}px" style:--lh="{notch.closed.media.h}px" in:enter out:leave>
        <div class="wings live" style:--tint={lv.tint}>
          <span class="lic"><LIcon size={13} strokeWidth={2.4} /></span>
          {#if lv.title}<span class="song">{lv.title || L('Mengunduh', 'Downloading')}</span>{:else}<span class="grow"></span>{/if}
          {#if notch.paired}
            <span class="dlb">{lv.text}</span>
            <span class="vsep"></span>
            {@render chip(pairItem)}
            {#if notch.pairRight.length > 1}<span class="more">+{notch.pairRight.length - 1}</span>{/if}
          {:else}
            {#if lv.icon === 'stopwatch' && lv.laps}<span class="lap">L{lv.laps}</span>{/if}
            <span class="dlb" class:dim={lv.paused}>{lv.text}</span>
          {/if}
        </div>
      </div>
    {:else}
      <div class="layer center" style:--lw="{notch.closed.idle.w}px" style:--lh="{notch.closed.idle.h}px" in:enter out:leave>
        {#if features.companion}<Eyes />{/if}
      </div>
    {/if}
  </div>
  {#if notch.headMode && !notch.autoHidden}<FaceExtras line={wingLine} />{/if}
  {#if notch.lyricRow && !notch.autoHidden}
    <!-- Gaya Notch: baris kedua di dalam bentuk. Kapsul: kapsul kecil terpisah di bawahnya. -->
    <div class="lyricrow" class:chip={notch.pill} class:gone={notch.lyricHidden} style:left="{notch.pos.x + notch.pos.w / 2}px" style:top="{notch.pos.y + notch.closed.media.h + (notch.pill ? 6 : 0)}px"
      style:max-width="{notch.pill ? 232 : Math.max(notch.pos.w - 24, 0)}px">{wingLine || '♪'}</div>
  {/if}
</main>

<style>
  main { position: relative; height: 100vh; transition: opacity .2s; overflow: hidden; }
  .shell { position: absolute; background: #000; overflow: hidden; will-change: left, top, width, height; box-sizing: border-box; isolation: isolate; }
  /* Latar kustom: di bawah semua isi (z-index negatif di dalam .shell), diredam supaya tulisan tetap terbaca. */
  .bglayer { position: absolute; z-index: -2; pointer-events: none; }
  .bgdim { position: absolute; inset: 0; z-index: -1; pointer-events: none; background: #000; }
  /* Mode pill tetap bersih tanpa garis atau bayangan di sekeliling lingkaran. */
  /* Pill di dekat tepi: isi menempel ke sisi pill, bukan ke tengah, supaya bentuk tumbuh ke sisi yang masih punya ruang. */
  .shell.ax-left .layer { left: 0; margin-left: 0; }
  .shell.ax-right .layer { left: auto; right: 0; margin-left: 0; }
  .shell.ax-left .layer.openl { transform-origin: 0 0; }
  .shell.ax-right .layer.openl { transform-origin: 100% 0; }
  /* Tiap bentuk punya lapisan berukuran tetap, menempel di atas tengah; notch yang membesar hanya memotongnya. */
  .layer { position: absolute; top: 0; left: 50%; width: var(--lw); height: var(--lh); margin-left: calc(var(--lw) / -2); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
  .layer.openl { transform: scale(var(--sc, 1)); transform-origin: 50% 0; flex-direction: column; align-items: stretch; justify-content: flex-start; padding: 0; }
  .wings { width: 100%; display: flex; align-items: center; gap: 9px; padding: 0 12px; }
  .art { width: 22px; height: 22px; border-radius: 6px; background: rgba(255, 255, 255, .12); overflow: hidden; flex: none; display: grid; place-items: center; font-size: 12px; }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  .wings.live { gap: 8px; }
  .lic { display: grid; place-items: center; flex: none; color: var(--tint); }
  .grow { flex: 1; }
  .chip { display: inline-flex; align-items: center; gap: 5px; flex: none; }
  .lap { font-size: 9.5px; font-weight: 800; line-height: 1; padding: 2px 5px; border-radius: 99px; background: var(--tint, #ff9f0a); color: #000; font-variant-numeric: tabular-nums; }
  .dlb.dim { opacity: .55; }
  .more { flex: none; padding: 0 5px; border-radius: 99px; background: rgba(255, 255, 255, .18); font-size: 9px; font-weight: 700; line-height: 14px; }
  .lyricrow { position: absolute; z-index: 2; transform: translateX(-50%); box-sizing: border-box; height: 26px; padding: 0 12px; line-height: 26px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; font-size: 12px; font-weight: 600; pointer-events: none; transition: opacity .2s; }
  .lyricrow.chip { height: 22px; line-height: 22px; border-radius: 99px; background: rgba(0, 0, 0, .9); }
  .lyricrow.gone { opacity: 0; }
  .vsep { width: 1px; height: 12px; background: rgba(255, 255, 255, .16); flex: none; }
  .dlb { font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; color: rgba(255, 255, 255, .75); flex: none; }
  .song { flex: 1; min-width: 0; padding-inline: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; color: rgba(255, 255, 255, .85); }
  .song > span { display: block; width: max-content; min-width: 100%; white-space: nowrap; }
  .song.scrolling > span { animation: lyric-scroll var(--scroll-time) linear infinite; }
  @keyframes lyric-scroll { 0%, 10% { transform: translateX(0); } 90%, 100% { transform: translateX(var(--scroll-x)); } }
  @media (prefers-reduced-motion: reduce) {
    .song.scrolling { overflow-x: auto; scrollbar-width: none; }
    .song.scrolling::-webkit-scrollbar { display: none; }
    .song.scrolling > span { animation: none; }
  }
  /* Susunan panel 244 = pita atas 40 + isi 164 + pita titik 40. Judul sejajar dengan label di dalam kartu (12 + 16). */
  header { white-space: nowrap; height: 40px; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; }
  .title { font-size: 13px; }
  .right { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: color-mix(in srgb, var(--ink, #fff) 62%, transparent); }
  .clock { color: var(--ink, #fff); font-variant-numeric: tabular-nums; }
  .batt { display: grid; place-items: center; }
  .batt.chg { color: #30d158; }
  .batt.low { color: #ff453a; }
  .power-saver { display: grid; place-items: center; width: 18px; height: 18px; padding: 0; flex: none; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
  .power-saver:hover { background: rgba(255,255,255,.1); }
  .power-saver.on { color: #30d158; }
  .gear { display: grid; place-items: center; border: 0; background: none; color: inherit; cursor: pointer; padding: 0; }
  .gear:hover { color: var(--ink, #fff); }
  .banner { height: 100%; display: flex; align-items: center; gap: 14px; padding: 0 8px; }
  .bico { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; flex: none; color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .btxt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .btxt b { font-size: 14px; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .btxt small { font-size: 11.5px; color: rgba(255, 255, 255, .6); display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .bact { border: 0; border-radius: 99px; padding: 7px 14px; font-size: 12px; font-weight: 600; color: #fff; background: color-mix(in srgb, var(--accent) 90%, transparent); cursor: pointer; flex: none; transition: transform .12s; }
  .bact:active { transform: scale(.95); }
  .pg { position: absolute; left: 12px; right: 12px; top: 0; bottom: 0; }
  /* Musik: glow sampul boleh melewati tepi area konten (dipotong bentuk notch), supaya tidak ada sisi persegi yang tajam. */
  .page.bleed { overflow: visible; }
  .page { flex: 1; min-height: 0; position: relative; overflow: hidden; }
  /* Tepi tipis terang dan pendar warna aksen di sudut kiri bawah, seperti di mockup. */
  .shell.open.pillmode::after { content: ''; position: absolute; inset: 0; border-radius: inherit; border: 1px solid rgba(255, 255, 255, .08); pointer-events: none; }
  .shell.open::before { content: ''; position: absolute; z-index: -1; left: -60px; bottom: -140px; width: 380px; height: 240px; background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent); pointer-events: none; }
  .shell.open:has(:global(.sky))::before { display: none; }
</style>
