<script lang="ts">
  // Dock: bilah di tepi bawah layar yang menggabungkan jendela aplikasi dan widget (cuaca, timer cepat, lirik,
  // tautan, riwayat salinan, pemutar, baterai, volume, dan lainnya). Susunan dan modulnya diatur di Pengaturan.
  // Dock hanya satu baris: lebar tiap modul pasti, dan modul dari ujung kanan gugur bila tidak muat di layar,
  // jadi tidak pernah terpotong dan tidak pernah turun baris.
  // Gayanya sama dengan notch: hitam, tepi kaca, aksen dan latar dari pengaturan Tampilan.
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { ChevronUp, LayoutGrid, Pin, PinOff, Plus, SlidersHorizontal, X, ArrowLeft, ArrowRight, Ellipsis } from '@lucide/svelte';
  import { cmd, emitPrefs, inTauri, on, openSettings } from './lib/bridge';
  import { MODULE_INFO } from './lib/dockModules';
  import { dock } from './lib/dock.svelte';
  import { features } from './lib/system.svelte';
  import { weather } from './lib/weather.svelte';
  import { ui } from './lib/ui.svelte';
  import { L } from './lib/i18n';
  import { clickTarget, keyOf, type DockItem } from './lib/dockItems';
  import {
    CELL_GAP, GAP, PAD, dockRadii, dropIndex, layoutWidth, magnifyExtraWidth, magnifyHeadroom, magnifyPeak, magnifyScales, moduleWidth, splitAppsByUse, type ModuleId,
  } from './lib/dockLayout';
  import { surface } from './lib/dockStyle';
  import './lib/dock/dock.css';
  import DockWeather from './lib/dock/DockWeather.svelte';
  import DockTimer from './lib/dock/DockTimer.svelte';
  import DockLyrics from './lib/dock/DockLyrics.svelte';
  import DockMedia from './lib/dock/DockMedia.svelte';
  import DockClipboard from './lib/dock/DockClipboard.svelte';
  import DockLinks from './lib/dock/DockLinks.svelte';
  import DockBattery from './lib/dock/DockBattery.svelte';
  import DockVolume from './lib/dock/DockVolume.svelte';

  let shellEl = $state<HTMLDivElement>();
  let menuEl = $state<HTMLDivElement>();
  let menuKey = $state<string | null>(null);
  let overflowOpen = $state(false);
  /** Menu klik kanan di dock (bukan di ikon aplikasi): modul yang diklik, atau null bila di latar. */
  let dockMenu = $state<{ mod: ModuleId | null } | null>(null);
  let now = $state(new Date());
  // Lebar layar untuk aturan muat. Di app: layar tempat dock. Di browser (npm run dev): lebar jendela browser, supaya tampilannya sama.
  const measure = () => (inTauri ? window.screen.availWidth : window.innerWidth);
  let screenW = $state(measure());
  let closeTimer = 0;

  // Susunan yang pasti muat, tempat untuk ikon aplikasi, dan ikon yang digambar atau masuk menu "+N".
  const layout = $derived<ModuleId[]>(dock.shown(screenW));
  const slots = $derived(dock.slots(screenW));
  const apps = $derived(splitAppsByUse(dock.items, slots, (i) => i.windows.length > 0));
  const W = (id: ModuleId) => moduleWidth(id, dock.cfg);
  const attached = $derived(dock.mode === 'attached');

  const menuItem = $derived(menuKey ? dock.items.find((i) => i.key === menuKey) ?? null : null);
  const menuOpen = $derived(!!menuItem || overflowOpen || !!dockMenu);
  const time = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const date = $derived(now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }));
  const cellH = $derived(dock.iconSize + 12);
  const rad = $derived(dockRadii(dock.round, cellH, dock.iconSize));
  const surf = $derived(surface(dock.style));

  /** Warna ikon pengganti (huruf pertama) dari nama, supaya tiap aplikasi punya warna yang tetap. */
  const tint = (name: string) => {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h} 55% 42%)`;
  };

  const SLACK = 14;
  let lastReport = '';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Goyang kiri kanan saat modul ditambah atau dihapus, atau aplikasi bertambah (modul baru muncul dengan membal di tempatnya,
   * lihat `in:scale` di bawah). Hanya transform, jadi tidak mengubah lebar dock yang dihitung.
   */
  let lastShape = -1;
  $effect(() => {
    const modules = layout.length;
    const apps_ = apps.shown.length + apps.rest.length;
    const shape = modules * 1000 + apps_;
    const grew = lastShape >= 0 && (Math.floor(lastShape / 1000) !== modules || apps_ > lastShape % 1000);
    lastShape = shape;
    if (grew && shellEl && !reduceMotion()) {
      shellEl.animate([
        { transform: 'translateX(0) scaleX(1)' },
        { transform: 'translateX(-8px) scaleX(.975)', offset: .22 },
        { transform: 'translateX(7px) scaleX(1.012)', offset: .45 },
        { transform: 'translateX(-4px) scaleX(.994)', offset: .67 },
        { transform: 'translateX(1.5px) scaleX(1)', offset: .85 },
        { transform: 'translateX(0) scaleX(1)' },
      ], { duration: 640, easing: 'cubic-bezier(.3, .6, .4, 1)' });
    }
  });

  function report() {
    if (!shellEl) return;
    // Ruang transparan di kiri dan kanan supaya dock bisa bergoyang (lihat jelly) tanpa terpotong tepi jendela.
    // Saat kursor di atas dock (dan pembesaran menyala) jendela dibesarkan ke atas dan ke samping supaya ikon yang membesar tidak terpotong.
    const grown = hovering && peak > 1.0001;
    const rest = hovering ? restWidth : shellEl.offsetWidth; // saat membesar, lebar yang diukur ikut tumbuh; pakai lebar saat diam
    const extra = grown ? magnifyExtraWidth(dock.iconSize + 12, peak) : 0;
    const w = Math.ceil(Math.max(rest + extra + SLACK * 2, menuOpen && menuEl ? menuEl.offsetWidth : 0));
    const h = Math.ceil(shellEl.offsetHeight + (menuOpen && menuEl ? menuEl.offsetHeight + 8 : 0) + (grown ? magnifyHeadroom(dock.iconSize, peak) : 0));
    // Ukuran yang sama tidak dikirim lagi: pengamat ukuran berbunyi di tiap gerakan kursor saat dock membesar.
    const key = `${w}x${h}/${dock.margin}/${attached}`;
    if (key === lastReport) return;
    lastReport = key;
    void cmd('taskdock_resize', { w, h, margin: dock.margin, attached });
  }

  // ---- Efek tetangga dan seret untuk mengurutkan ----

  const peak = $derived(magnifyPeak(dock.magnify));
  const appsDrawn = $derived(apps.shown.length + (apps.rest.length > 0 ? 1 : 0));
  /** Lebar dock saat diam (tanpa pembesaran) dan pusat tiap sel ikon darinya: Start, aplikasi, lalu tautan, sesuai urutan di baris. */
  const restWidth = $derived(layoutWidth(layout, dock.cfg, appsDrawn));
  const restCenters = $derived.by(() => {
    const c = dock.iconSize + 12;
    const out: number[] = [];
    let x = PAD;
    let first = true;
    for (const id of layout) {
      const w = moduleWidth(id, dock.cfg, appsDrawn);
      if (w <= 0) continue;
      if (!first) x += GAP;
      first = false;
      const n = id === 'start' ? 1 : id === 'apps' ? appsDrawn : id === 'links' ? Math.max(1, dock.links.length) : 0;
      for (let i = 0; i < n; i++) out.push(x + i * (c + CELL_GAP) + c / 2);
      x += w;
    }
    return out;
  });

  let hovering = $state(false);
  let hoverTimer = 0;
  let tip = $state<{ name: string; x: number; bottom: number } | null>(null);

  const clearMagnify = () => {
    shellEl?.querySelectorAll<HTMLElement>('.cell').forEach((c) => c.style.removeProperty('--s'));
    tip = null;
  };

  /** Pembesaran ala Dock macOS: skala tiap ikon (`--s`, dipakai CSS) menurut jarak kursor, dan nama ikon terdekat di atasnya. */
  function pointerMove(e: PointerEvent) {
    if (!shellEl) return;
    const cells = [...shellEl.querySelectorAll<HTMLElement>('.cell')];
    if (drag || !(peak > 1.0001) || reduceMotion() || cells.length !== restCenters.length) { clearMagnify(); return; }
    const c = dock.iconSize + 12;
    // Dock berpusat di jendela: kursor pada baris saat diam.
    const x = e.clientX - window.innerWidth / 2 + restWidth / 2;
    const fromBottom = window.innerHeight - e.clientY;
    const reach = fromBottom <= c + PAD * 2 + dock.iconSize * (peak - 1) * 0.9 + 8 && x > -c * 0.4 && x < restWidth + c * 0.4;
    const scales = magnifyScales(restCenters, reach ? x : null, c, peak);
    cells.forEach((cell, i) => cell.style.setProperty('--s', String(scales[i])));
    if (!reach) { tip = null; return; }
    let best = 0;
    scales.forEach((v, i) => { if (v > scales[best]) best = i; });
    const cell = cells[best];
    const name = cell.dataset.name;
    const icon = (cell.firstElementChild as HTMLElement | null) ?? cell;
    const ir = icon.getBoundingClientRect(); // sudah memperhitungkan skala
    const cr = cell.getBoundingClientRect();
    tip = name ? { name, x: cr.left + cr.width / 2, bottom: window.innerHeight - ir.top + 6 } : null;
  }

  function enterDock() {
    clearTimeout(closeTimer);
    clearTimeout(hoverTimer);
    hovering = true;
  }
  function leaveDock() {
    // Jendela dock tetap besar sebentar supaya ikon sempat mengecil tanpa terpotong, baru diperkecil.
    clearMagnify();
    clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => (hovering = false), 450);
    if (menuOpen) closeTimer = window.setTimeout(closeMenus, 1400);
  }

  let drag = $state<{ key: string; startX: number; dx: number; active: boolean } | null>(null);
  let suppressClick = false;

  function dragStart(e: PointerEvent, item: DockItem) {
    if (e.button !== 0 || !item.pinned) return;
    drag = { key: item.key, startX: e.clientX, dx: 0, active: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function dragMove(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (!drag.active && Math.abs(dx) < 6) return;
    drag.active = true;
    drag.dx = dx;
  }
  /** Dilepas di dekat ikon tersemat lain: sematan pindah ke sana. Yang tidak disematkan tidak bisa diurutkan. */
  function dragEnd(e: PointerEvent, item: DockItem) {
    const d = drag;
    drag = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!d?.active) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    const cells = [...(shellEl?.querySelectorAll<HTMLElement>('.cell.app[data-pinned="1"]') ?? [])];
    const me = cells.find((c) => c.dataset.key === item.key);
    if (!me) return;
    // Pusat saat diam (ikon yang diseret sudah bergeser sejauh dx, jadi dikembalikan); posisi jatuh = pusatnya yang sekarang.
    const centers = cells.map((c) => { const r = c.getBoundingClientRect(); return r.left + r.width / 2 - (c === me ? d.dx : 0); });
    const mine = me.getBoundingClientRect();
    const slot = dropIndex(mine.left + mine.width / 2, centers);
    const target = cells[slot]?.dataset.key;
    const to = dock.pins.findIndex((p) => keyOf(p.exe) === target);
    if (to >= 0) dock.movePinTo(item.exe, to);
  }

  function click(item: DockItem) {
    if (suppressClick) return;
    menuKey = null;
    overflowOpen = false;
    const t = clickTarget(item);
    if (t.kind === 'launch') void cmd('open_target', { target: item.exe });
    else if (t.kind === 'toggle') void cmd('taskdock_toggle', { id: t.id });
    else void cmd('taskdock_activate', { id: t.id });
  }

  function openMenu(item: DockItem, e: Event) {
    e.preventDefault();
    overflowOpen = false;
    dockMenu = null;
    menuKey = menuKey === item.key ? null : item.key;
  }

  const closeMenus = () => { menuKey = null; overflowOpen = false; dockMenu = null; };

  function openDockMenu(e: MouseEvent) {
    if (e.defaultPrevented) return; // ikon aplikasi punya menu sendiri
    e.preventDefault();
    const mod = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-mod]')?.dataset.mod as ModuleId | undefined;
    menuKey = null; overflowOpen = false;
    dockMenu = { mod: mod ?? null };
  }

  function removeModule(id: ModuleId) {
    dock.remove(id);
    void emitPrefs('dock');
    closeMenus();
  }

  /** Mematikan dock dari dock itu sendiri: taskbar Windows ikut kembali (taskdock_close). */
  function turnOff() {
    dock.enabled = false;
    dock.persist();
    void emitPrefs('dock');
    void cmd('taskdock_close');
  }
  // Jendela dock tidak bisa fokus, jadi tidak ada "klik di luar". Menu menutup sendiri sebentar setelah kursor pergi.

  $effect(() => {
    // Laporkan ukuran saat isi, menu, mode, atau jarak berubah.
    void layout.length; void apps.shown.length; void apps.rest.length; void dock.iconSize; void dock.hideTaskbar; void dock.margin; void attached;
    void hovering; void dock.magnify; void dock.presets.length; void dock.links.length; void menuItem?.windows.length; void menuKey; void overflowOpen; void features.weather;
    queueMicrotask(report);
  });

  // Cuaca hanya diminta (Open-Meteo) bila modulnya ada dan fiturnya menyala.
  $effect(() => { if (layout.includes('weather') && features.weather) weather.restart(); });

  /** Hanya di browser (npm run dev): isi dock dengan data contoh supaya tampilannya bisa dilihat tanpa Windows. */
  function demo() {
    const icon = (c1: string, c2: string, shape: 'c' | 'r' | 't') => {
      const c = document.createElement('canvas'); c.width = c.height = 48;
      const x = c.getContext('2d')!;
      const g = x.createLinearGradient(0, 0, 48, 48); g.addColorStop(0, c1); g.addColorStop(1, c2);
      x.fillStyle = g; x.beginPath(); x.roundRect(2, 2, 44, 44, 11); x.fill();
      x.fillStyle = 'rgb(var(--ink, 255 255 255) / .92)'; x.beginPath();
      if (shape === 'c') x.arc(24, 24, 10, 0, 7); else if (shape === 'r') x.roundRect(14, 14, 20, 20, 4); else { x.moveTo(14, 34); x.lineTo(24, 12); x.lineTo(34, 34); x.closePath(); }
      x.fill();
      return c.toDataURL();
    };
    const exe = (n: string) => `C:\\Demo\\${n}.exe`;
    if (dock.pins.length === 0) dock.pins = [{ exe: exe('files'), name: 'files' }, { exe: exe('browser'), name: 'browser' }, { exe: exe('editor'), name: 'editor' }];
    dock.windows = [
      { id: 1, title: 'Dokumen - Browser', exe: exe('browser'), name: 'browser', active: true },
      { id: 2, title: 'YouTube - Browser', exe: exe('browser'), name: 'browser', active: false },
      { id: 3, title: 'dock.svelte.ts - Editor', exe: exe('editor'), name: 'editor', active: false },
      { id: 4, title: 'Musik', exe: exe('music'), name: 'music', active: false },
      { id: 5, title: 'Catatan', exe: exe('notes'), name: 'notes', active: false },
      { id: 6, title: 'Terminal', exe: exe('term'), name: 'term', active: false },
      { id: 7, title: 'Kalkulator', exe: exe('calc'), name: 'calc', active: false },
    ];
    dock.icons[keyOf(exe('files'))] = icon('#f5c542', '#e08a00', 'r');
    dock.icons[keyOf(exe('browser'))] = icon('#ea4335', '#fbbc05', 'c');
    dock.icons[keyOf(exe('editor'))] = icon('#0a84ff', '#0050c8', 't');
    dock.icons[keyOf(exe('music'))] = icon('#1ed760', '#0a8f3c', 'c');
    dock.rebuild();
  }

  onMount(() => {
    void dock.start();
    if (!inTauri) demo();
    ui.applyAccent();
    on<string>('prefs-changed', (scope) => {
      if (scope === 'ui') { ui.reload(); ui.applyAccent(); }
      else if (scope === 'features') { features.reload(); weather.reload(); }
      else if (scope === 'weather') weather.reload();
    });
    const tick = window.setInterval(() => (now = new Date()), 15_000);
    const watch = shellEl ? new ResizeObserver(report) : null;
    if (shellEl) watch?.observe(shellEl);
    const resize = () => (screenW = measure());
    window.addEventListener('resize', resize);
    return () => { clearInterval(tick); watch?.disconnect(); window.removeEventListener('resize', resize); };
  });
</script>

<div class="stage" role="presentation" onpointerleave={leaveDock} onpointerenter={enterDock} onpointermove={pointerMove} style:--accent={ui.accentColor || undefined} style:--r="{rad.outer}px" style:--rc="{rad.cell}px" style:--rt="{rad.tile}px" style:--rp="{rad.pill}px" style:--ro="{rad.tool}px">
  {#if tip}<div class="tip" style:left="{tip.x}px" style:bottom="{tip.bottom}px">{tip.name}</div>{/if}
  {#if menuItem}
    <div class="menu" bind:this={menuEl} role="menu" aria-label={menuItem.name}>
      <div class="mhead">{menuItem.name}</div>
      <div class="mlist">
        {#each menuItem.windows as w (w.id)}
          <div class="mrow" class:on={w.active}>
            <button class="mmain" role="menuitem" title={w.title} onclick={() => { void cmd('taskdock_activate', { id: w.id }); closeMenus(); }}>{w.title}</button>
            <button class="mx" aria-label={L('Tutup jendela', 'Close window')} title={L('Tutup jendela', 'Close window')} onclick={() => void cmd('taskdock_close_window', { id: w.id })}><X size={13} /></button>
          </div>
        {/each}
      </div>
      {#if menuItem.windows.length > 0}<div class="msep"></div>{/if}
      <button class="mrow mact" role="menuitem" onclick={() => { void cmd('open_target', { target: menuItem.exe }); closeMenus(); }}><Plus size={14} />{L('Buka jendela baru', 'Open a new window')}</button>
      <button class="mrow mact" role="menuitem" onclick={() => { dock.togglePin(menuItem.exe, menuItem.name); }}>
        {#if menuItem.pinned}<PinOff size={14} />{L('Lepas dari dock', 'Unpin from dock')}{:else}<Pin size={14} />{L('Sematkan di dock', 'Pin to dock')}{/if}
      </button>
      {#if menuItem.pinned}
        <div class="mpair">
          <button class="mrow mact" role="menuitem" disabled={dock.pins.findIndex((p) => keyOf(p.exe) === menuItem.key) === 0} onclick={() => dock.nudgePin(menuItem.exe, -1)}><ArrowLeft size={14} />{L('Geser kiri', 'Move left')}</button>
          <button class="mrow mact" role="menuitem" disabled={dock.pins.findIndex((p) => keyOf(p.exe) === menuItem.key) === dock.pins.length - 1} onclick={() => dock.nudgePin(menuItem.exe, 1)}><ArrowRight size={14} />{L('Geser kanan', 'Move right')}</button>
        </div>
      {/if}
      {#if menuItem.windows.length > 1}
        <button class="mrow mact danger" role="menuitem" onclick={() => { menuItem.windows.forEach((w) => void cmd('taskdock_close_window', { id: w.id })); closeMenus(); }}><X size={14} />{L('Tutup semua jendela', 'Close all windows')}</button>
      {/if}
    </div>
  {:else if dockMenu}
    <div class="menu" bind:this={menuEl} role="menu" aria-label={L('Dock', 'Dock')}>
      {#if dockMenu.mod}
        <div class="mhead">{MODULE_INFO[dockMenu.mod].label()}</div>
        <button class="mrow mact" role="menuitem" onclick={() => removeModule(dockMenu!.mod!)}><X size={14} />{L('Hapus dari dock', 'Remove from the dock')}</button>
        <div class="msep"></div>
      {:else}
        <div class="mhead">{L('Dock', 'Dock')}</div>
      {/if}
      <button class="mrow mact" role="menuitem" onclick={() => { openSettings(); closeMenus(); }}><SlidersHorizontal size={14} />{L('Pengaturan dock…', 'Dock settings…')}</button>
      <button class="mrow mact danger" role="menuitem" onclick={turnOff}><X size={14} />{L('Matikan dock', 'Turn the dock off')}</button>
    </div>
  {:else if overflowOpen}
    <div class="menu" bind:this={menuEl} role="menu" aria-label={L('Aplikasi lainnya', 'More apps')}>
      <div class="mhead">{L('Aplikasi lainnya', 'More apps')}</div>
      <div class="mlist">
      {#each apps.rest as item (item.key)}
        <button class="mrow mact" class:on={item.active} role="menuitem" onclick={() => click(item)}>
          {#if dock.iconOf(item.exe)}<img class="mico" src={dock.iconOf(item.exe)} alt="" />{:else}<span class="mico letter" style:background={tint(item.name)}>{item.name.slice(0, 1).toUpperCase()}</span>{/if}
          <span class="mname">{item.name}</span>
          {#if item.windows.length}<span class="mcount">{item.windows.length}</span>{/if}
        </button>
      {/each}
      </div>
    </div>
  {/if}

  <div class="shell" role="presentation" oncontextmenu={openDockMenu} class:attached class:glass={dock.style.bgMode === 'glass'} bind:this={shellEl} style:background={surf.background} style:backdrop-filter={surf.backdrop || undefined} style:-webkit-backdrop-filter={surf.backdrop || undefined} style:--ink={surf.ink} style:--icon="{dock.iconSize}px" style:--cellh="{cellH}px">
    <div class="plate" aria-hidden="true">
    {#if surf.followsNotch && ui.bgCss}
      <div class="bglayer" aria-hidden="true" style:background={ui.bgCss.image ? ui.imageCss(5) : ui.bgCss.background} style:filter={ui.bgCss.image && ui.bgBlur > 0 ? `blur(${ui.bgBlur * 10}px)` : undefined}></div>
      <div class="bgdim" aria-hidden="true" style:opacity={ui.bgCss.image ? Math.max(ui.bgDim, 0.35) : 0}></div>
    {/if}
    </div>
    <div class="row">
      {#each layout as id (id)}
        <div class="mod" data-mod={id} in:scale={{ start: 0.5, duration: 460, easing: backOut }}>
        {#if id === 'start'}
          <button class="cell start" data-name={L('Menu Start', 'Start menu')} aria-label={L('Menu Start', 'Start menu')} title={peak > 1.0001 ? undefined : L('Menu Start', 'Start menu')} onclick={() => void cmd('taskdock_keys', { name: 'start' })}><LayoutGrid size={Math.round(dock.iconSize * 0.55)} /></button>
        {:else if id === 'apps'}
          {#if apps.shown.length + apps.rest.length > 0}
            <div class="apps">
              {#each apps.shown as item (item.key)}
                {@const icon = dock.iconOf(item.exe)}
                <button in:scale={{ start: 0.4, duration: 460, easing: backOut }} class="cell app" data-name={item.name} class:dragging={drag?.active && drag.key === item.key} data-key={item.key} data-pinned={item.pinned ? 1 : 0} style:transform={drag?.active && drag.key === item.key ? `translateX(${drag.dx}px)` : undefined} onpointerdown={(e) => dragStart(e, item)} onpointermove={dragMove} onpointerup={(e) => dragEnd(e, item)} onpointercancel={(e) => dragEnd(e, item)} class:active={item.active} class:running={item.windows.length > 0} class:open={menuKey === item.key}
                  aria-label={item.windows.length ? `${item.name}, ${item.windows.length} ${L('jendela', 'windows')}` : item.name}
                  title={peak > 1.0001 ? undefined : item.windows.length === 1 ? item.windows[0].title : item.name}
                  onclick={() => click(item)} oncontextmenu={(e) => openMenu(item, e)} onauxclick={(e) => { if (e.button === 1) void cmd('open_target', { target: item.exe }); }}>
                  {#if icon}
                    <img src={icon} alt="" draggable="false" />
                  {:else}
                    <span class="letter" style:background={tint(item.name)}>{item.name.slice(0, 1).toUpperCase()}</span>
                  {/if}
                  <span class="marks" aria-hidden="true">
                    {#each Array(Math.min(3, item.windows.length)) as _, i (i)}<i></i>{/each}
                  </span>
                </button>
              {/each}
              {#if apps.rest.length > 0}
                <button class="cell more" class:open={overflowOpen} data-name={L(`${apps.rest.length} aplikasi lainnya`, `${apps.rest.length} more apps`)} aria-label={L(`${apps.rest.length} aplikasi lainnya`, `${apps.rest.length} more apps`)} title={peak > 1.0001 ? undefined : L(`${apps.rest.length} aplikasi lainnya`, `${apps.rest.length} more apps`)}
                  onclick={() => { menuKey = null; overflowOpen = !overflowOpen; }}>
                  <Ellipsis size={Math.round(dock.iconSize * 0.5)} /><span class="count">{apps.rest.length}</span>
                </button>
              {/if}
            </div>
          {/if}
        {:else if id === 'media'}<DockMedia w={W('media')} />
        {:else if id === 'lyrics'}<DockLyrics w={W('lyrics')} />
        {:else if id === 'weather'}<DockWeather w={W('weather')} />
        {:else if id === 'timer'}<DockTimer w={W('timer')} presets={dock.presets} />
        {:else if id === 'clipboard'}<DockClipboard w={W('clipboard')} />
        {:else if id === 'links'}<DockLinks />
        {:else if id === 'battery'}<DockBattery w={W('battery')} />
        {:else if id === 'volume'}<DockVolume w={W('volume')} />
        {:else if id === 'quick'}
          <button class="tool" aria-label={L('Pengaturan cepat Windows', 'Windows quick settings')} title={L('Pengaturan cepat Windows', 'Windows quick settings')} onclick={() => void cmd('taskdock_keys', { name: 'quick' })}><SlidersHorizontal size={16} /></button>
        {:else if id === 'tray'}
          {#if dock.hideTaskbar}
            <button class="tool" aria-label={L('Ikon tersembunyi', 'Hidden icons')} title={L('Tampilkan taskbar Windows sebentar untuk ikon tersembunyi', 'Show the Windows taskbar briefly for hidden icons')} onclick={() => void cmd('taskbar_peek')}><ChevronUp size={16} /></button>
          {/if}
        {:else if id === 'clock'}
          <button class="clock" aria-label={L('Notifikasi dan kalender', 'Notifications and calendar')} title={L('Notifikasi dan kalender', 'Notifications and calendar')} onclick={() => void cmd('taskdock_keys', { name: 'notifications' })}>
            <b>{time}</b><small>{date}</small>
          </button>
        {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .stage { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 6px; }
  .shell {
    /* Gerak: satu kurva dan satu durasi untuk semua yang interaktif. Tanpa pantulan (overshoot): gerakannya berhenti halus. */
    --ease: cubic-bezier(.22, 1, .36, 1); --t: .22s;
    position: relative; isolation: isolate; width: max-content; max-width: 100vw; /* tanpa overflow: ikon yang membesar tumbuh ke atas melewati dock */
    background: #000; border-radius: var(--r, 20px);
    box-shadow: inset 0 0 0 1px rgb(var(--ink, 255 255 255) / .1), inset 0 1px 0 rgb(var(--ink, 255 255 255) / .14);
  }
  /* Menempel di tepi bawah: hanya sudut atas yang bulat, seperti notch yang terbalik. */
  .shell.attached { border-radius: var(--r, 20px) var(--r, 20px) 0 0; box-shadow: inset 1px 0 0 rgb(var(--ink, 255 255 255) / .1), inset -1px 0 0 rgb(var(--ink, 255 255 255) / .1), inset 0 1px 0 rgb(var(--ink, 255 255 255) / .14); }
  /* Latar gambar dan gradien dipotong mengikuti bentuk dock oleh .plate, bukan oleh .shell. */
  .plate { position: absolute; inset: 0; z-index: -1; overflow: hidden; border-radius: inherit; pointer-events: none; }
  .bglayer { position: absolute; inset: -12px; z-index: -2; pointer-events: none; }
  .bgdim { position: absolute; inset: 0; z-index: -1; pointer-events: none; background: #000; }
  .tip {
    position: fixed; z-index: 20; transform: translateX(-50%); padding: 4px 10px; border-radius: 99px; white-space: nowrap; pointer-events: none;
    background: rgb(40 40 44 / .96); color: #fff; font-size: 12px; font-weight: 500; box-shadow: inset 0 0 0 .5px rgb(255 255 255 / .14);
  }
  /* Padding dan jarak antar modul sama dengan PAD dan GAP di dockLayout.ts: lebar dihitung dari angka itu. */
  .row { display: flex; align-items: center; gap: 6px; padding: 10px; }
  /* Jarak antar ikon = CELL_GAP di dockLayout.ts (2 px); tiap ikon sudah punya 6 px ruang di sekelilingnya. */
  /* Tiap modul dibungkus .mod: garis pemisah tipis di tengah jarak 6 px antar modul (tidak menambah lebar). */
  .mod { position: relative; display: flex; align-items: center; flex: none; }
  .mod:empty { display: none; }
  .mod + .mod::before { content: ''; position: absolute; left: -3.5px; top: 50%; width: 1px; height: 28px; transform: translateY(-50%); background: rgb(var(--ink, 255 255 255) / .12); pointer-events: none; }
  .apps { position: relative; display: flex; align-items: center; gap: 2px; }

  .cell {
    position: relative; display: grid; place-items: center; flex: none; box-sizing: content-box;
    /* Lebar ikut skala pembesaran (--s) supaya tetangga bergeser; tinggi tetap. */
    width: calc((var(--icon) + 12px) * var(--s, 1) - 12px); height: var(--icon); padding: 6px; border: 0; border-radius: var(--rc, 12px);
    background: transparent; color: rgb(var(--ink, 255 255 255)); cursor: default;
    transition: background-color var(--t) var(--ease), transform var(--t) var(--ease), width .09s ease-out;
    will-change: transform;
  }
  /* Hover: hanya ikonnya yang membesar (tanpa latar yang menyala). Dock cukup tinggi untuk ikon 1.3 kali. */
  .cell > img, .cell > .letter, .cell > :global(svg) { transform: scale(var(--s, 1)); transition: transform .09s ease-out; transform-origin: center bottom; }
  .cell.dragging { z-index: 3; transition: none; }
  .cell.dragging > img, .cell.dragging > .letter { transform: scale(1.3); }
  
  .cell.open { background: rgb(var(--ink, 255 255 255) / .14); }
  .cell.active { background: rgb(var(--ink, 255 255 255) / .09); }
  .cell:focus-visible, .tool:focus-visible, .clock:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .start { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .cell img { width: var(--icon); height: var(--icon); object-fit: contain; pointer-events: none; }
  .letter { display: grid; place-items: center; width: var(--icon); height: var(--icon); border-radius: var(--rt, 10px); font-weight: 700; font-size: calc(var(--icon) * .45); color: #fff; }
  .more { color: rgb(var(--ink, 255 255 255) / .85); }
  .more .count { position: absolute; right: 4px; top: 3px; min-width: 15px; padding: 0 4px; border-radius: 99px; background: var(--accent); color: #0b0a1a; font-size: 9.5px; font-weight: 700; line-height: 15px; text-align: center; }

  /* Penanda aplikasi terbuka: titik per jendela (maksimal tiga); yang aktif memanjang dan berwarna aksen. */
  .marks { position: absolute; left: 0; right: 0; bottom: 1px; display: flex; justify-content: center; gap: 3px; pointer-events: none; }
  .marks i { width: 4px; height: 4px; border-radius: 99px; background: rgb(var(--ink, 255 255 255) / .55); transition: width var(--t) var(--ease), background-color var(--t) var(--ease); }
  .active .marks i { background: var(--accent); }
  .active .marks i:first-child { width: 14px; }

  .tool { display: grid; place-items: center; flex: none; width: 32px; height: 32px; padding: 0; border: 0; border-radius: var(--ro, 16px); background: transparent; color: rgb(var(--ink, 255 255 255) / .7); cursor: default; transition: background-color var(--t) var(--ease), color var(--t) var(--ease); }
  .tool { transition: transform .26s cubic-bezier(.2, .9, .3, 1.25), color var(--t) var(--ease); }
  .tool:hover { transform: scale(1.18); color: rgb(var(--ink, 255 255 255)); }
  .clock { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 1px; flex: none; box-sizing: border-box; width: 92px; height: var(--cellh); padding: 0 12px; border: 0; border-radius: var(--rc, 12px); background: transparent; color: rgb(var(--ink, 255 255 255)); cursor: default; line-height: 1.15; transition: background-color var(--t) var(--ease); }
  .clock { transition: transform .26s cubic-bezier(.2, .9, .3, 1.25); }
  .clock:hover { transform: scale(1.08); }
  .clock b { font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
  .clock small { font-size: 10.5px; color: rgb(var(--ink, 255 255 255) / .55); white-space: nowrap; }

  .menu {
    --mr: min(var(--r, 22px), 22px); --mpad: 6px; --ease: cubic-bezier(.22, 1, .36, 1);
    transform-origin: 50% 100%; animation: menu-in .16s var(--ease);
    width: 260px; padding: var(--mpad); border-radius: var(--mr); background: #0b0b0e; color: rgb(var(--ink, 255 255 255));
    box-shadow: inset 0 0 0 1px rgb(var(--ink, 255 255 255) / .12), 0 8px 24px rgba(0, 0, 0, .35);
  }
  /* Baris jendela: jarak tetap 2 px, supaya sorotan bersudut bulat tidak saling menempel (celah sempit yang tidak rata). */
  .mlist { display: flex; flex-direction: column; gap: 2px; }
  .mhead { padding: 6px 10px 4px; font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: rgb(var(--ink, 255 255 255) / .45); }
  .mrow { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 32px; padding: 0 4px 0 10px; border: 0; border-radius: calc(var(--mr) - var(--mpad)); background: transparent; color: rgb(var(--ink, 255 255 255)); text-align: left; font-size: 12px; cursor: default; }
  .mrow.on { background: color-mix(in srgb, var(--accent) 20%, transparent); }
  .mact { padding: 0 10px; }
  .mrow { transition: background-color .14s var(--ease), opacity .14s var(--ease); }
  .mrow:hover:not(:disabled) { background: rgb(var(--ink, 255 255 255) / .1); }
  .mrow.on:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 30%, transparent); }
  .mact:disabled { opacity: .35; }
  .mrow:has(.mmain:focus-visible), .mact:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .mact.danger { color: #ff6b7d; }
  .mmain { flex: 1; min-width: 0; height: 32px; border: 0; border-radius: calc(var(--mr) - var(--mpad)); background: transparent; color: inherit; text-align: left; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 6px; cursor: default; }
  .mx { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 8px; background: transparent; color: rgb(var(--ink, 255 255 255) / .5); cursor: default; transition: background-color .14s var(--ease), color .14s var(--ease); }
  .mx { transition: transform .22s cubic-bezier(.2, .9, .3, 1.25), color var(--t) var(--ease); }
  .mx:hover { transform: scale(1.18); color: rgb(var(--ink, 255 255 255)); }
  .msep { height: 1px; margin: 4px 6px; background: rgb(var(--ink, 255 255 255) / .1); }
  .mpair { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
  .mico { width: 20px; height: 20px; flex: none; border-radius: 6px; object-fit: contain; }
  .mico.letter { display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff; }
  .mname { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mcount { font-size: 10.5px; color: rgb(var(--ink, 255 255 255) / .55); }

  @keyframes menu-in { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .cell, .marks i, .tool, .clock, .mrow, .mx { transition: none; } .tool:hover, .clock:hover, .mx:hover { transform: none; } .menu { animation: none; } }
</style>
