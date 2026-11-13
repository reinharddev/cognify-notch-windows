<script lang="ts">
  import { features } from './lib/system.svelte';
  import { clipboard } from './lib/shelf.svelte';
  import { cmd, emitPrefs, inTauri, pickFiles } from './lib/bridge';
  import { agenda } from './lib/agenda.svelte';
  import { hotkey, HOTKEYS } from './lib/hotkey.svelte';
  import { L } from './lib/i18n';
  import { checkUpdate, initUpdate, installNow, update } from './lib/update.svelte';
  import { weather } from './lib/weather.svelte';
  import { ui, THEME_PRESETS, CLOSED_MIN, CLOSED_MAX, CLOSED_DEFAULT, CLOSED_H_MIN, CLOSED_H_MAX, CLOSED_H_DEFAULT, EDGE_MARGIN } from './lib/ui.svelte';
  import { pillLimits } from './lib/geometry';
  import { EMOTIONS, MODES, SITUATIONS, emotionLabel, situationLabel } from './lib/companion';
  import { Settings, Palette, MousePointer2, Smile, ToggleRight, CloudSun, ListOrdered, Archive, ArrowUp, ArrowDown, RotateCcw, Search } from '@lucide/svelte';
  import CropPicker from './lib/settings/CropPicker.svelte';
  import PreviewStage from './lib/settings/PreviewStage.svelte';
  import { tick, onMount } from 'svelte';
  import Setting from './lib/settings/Setting.svelte';
  import Group from './lib/settings/Group.svelte';
  import Segmented from './lib/settings/Segmented.svelte';

  type PaneId = 'general' | 'appearance' | 'behavior' | 'companion' | 'features' | 'weather' | 'tabs' | 'data';
  const panes: { id: PaneId; group: 0 | 1 | 2; label: () => string; desc: () => string; icon: typeof Settings }[] = [
    { id: 'general', group: 2, icon: Settings, label: () => L('Umum', 'General'), desc: () => L('Buka otomatis, bahasa, pintasan, dan pembaruan.', 'Launch at startup, language, shortcut, and updates.') },
    { id: 'appearance', group: 0, icon: Palette, label: () => L('Tampilan', 'Appearance'), desc: () => L('Bentuk, ukuran, dan warna notch.', 'Shape, size, and colors of the notch.') },
    { id: 'behavior', group: 0, icon: MousePointer2, label: () => L('Perilaku', 'Behavior'), desc: () => L('Cara notch terbuka dan tertutup, serta layar yang dipakai.', 'How the notch opens and closes, and which screen it uses.') },
    { id: 'companion', group: 0, icon: Smile, label: () => L('Teman kecil', 'Companion'), desc: () => L('Wajah di notch: ekspresi, kedipan, dan reaksi.', 'The face in the notch: expressions, blinking, and reactions.') },
    { id: 'features', group: 1, icon: ToggleRight, label: () => L('Fitur', 'Features'), desc: () => L('Pilih fitur notch yang ingin dipakai.', 'Choose which notch features to use.') },
    { id: 'weather', group: 1, icon: CloudSun, label: () => L('Cuaca & kalender', 'Weather & calendar'), desc: () => L('Kota untuk cuaca dan sumber agenda.', 'The city for weather and the agenda sources.') },
    { id: 'tabs', group: 1, icon: ListOrdered, label: () => L('Urutan tab', 'Tab order'), desc: () => L('Atur urutan halaman di notch.', 'Arrange the pages in the notch.') },
    { id: 'data', group: 2, icon: Archive, label: () => L('Data', 'Data'), desc: () => L('Cadangkan atau pulihkan catatan, tugas, dan pengaturan.', 'Back up or restore notes, tasks, and settings.') },
  ];

  const GROUPS = [() => 'Notch', () => L('Fitur', 'Features'), () => L('App', 'App')];
  const order: PaneId[] = ['appearance', 'behavior', 'companion', 'features', 'weather', 'tabs', 'general', 'data'];
  const sidebar = $derived(order.map((id) => panes.find((p) => p.id === id)!).filter((p) => p.id !== 'data' || inTauri));
  let pane = $state<PaneId>('appearance');
  let query = $state('');
  let found = $state(0);
  let innerEl: HTMLDivElement | undefined = $state();
  const searching = $derived(query.trim().length > 0);
  const show = (id: PaneId) => (searching ? id !== 'tabs' && (id !== 'data' || inTauri) : pane === id);

  /** Pencarian menyaring baris yang sudah tampil: semua bagian dirender saat mencari, lalu baris dan kelompok yang tidak cocok disembunyikan. */
  function applyFilter() {
    if (!innerEl) return;
    const q = query.trim().toLowerCase();
    const rows = [...innerEl.querySelectorAll<HTMLElement>('.set')];
    let n = 0;
    for (const r of rows) {
      const hit = !q || (r.textContent ?? '').toLowerCase().includes(q);
      r.hidden = !hit;
      if (hit) n++;
    }
    for (const g of innerEl.querySelectorAll<HTMLElement>('.grp')) {
      const own = g.querySelectorAll('.set');
      g.hidden = !!q && (own.length ? !g.querySelector('.set:not([hidden])') : !(g.textContent ?? '').toLowerCase().includes(q));
    }
    found = n;
  }
  /** Isi biru (aksen) di sisi kiri slider: variabel --p di tiap input. */
  function paintRanges() {
    for (const r of innerEl?.querySelectorAll<HTMLInputElement>('input[type=range]') ?? []) r.style.setProperty('--p', ((Number(r.value) - Number(r.min)) / (Number(r.max) - Number(r.min))) * 100 + '%');
  }
  $effect(() => {
    void query; void pane; void ui.closedWidth; void ui.closedHeight; void ui.bgPosX; void ui.bgPosY; void ui.bgZoom; void ui.pillWidth; void ui.roundness; void ui.hoverDelay; void ui.closeDelay; void ui.bgAngle; void ui.bgBlur; void ui.bgDim; void ui.style; void ui.bgMode;
    void tick().then(() => { applyFilter(); paintRanges(); });
    if (!innerEl || !searching) return;
    const mo = new MutationObserver(() => { applyFilter(); paintRanges(); });
    mo.observe(innerEl, { childList: true, subtree: true });
    return () => mo.disconnect();
  });

  let ics = $state(agenda.url);
  let city = $state(weather.city);
  let detecting = $state(false);
  let locErr = $state('');
  let autostart = $state(false);
  void cmd<boolean>('autostart_get').then((v) => (autostart = !!v));
  void initUpdate();

  // Daftar dan urutan fitur sama dengan Pengaturan di Mac; yang khusus Windows ada di bagian akhir.
  const toggles = [
    ['media', L('Lagu & video yang diputar', 'Now playing'), L('Lagu yang diputar tampil di sayap notch.', 'The playing song shows on the notch wings.')],
    ['spectrum', L('Equalizer mengikuti suara', 'Equalizer follows the audio'), L('Suara hanya diubah jadi tinggi batang, tidak direkam.', 'Audio only drives the bars; nothing is recorded.')],
    ['camera', L('Cermin kamera', 'Camera mirror'), L('Kamera hanya menyala selama tab Cermin dibuka.', 'The camera is only on while the Mirror tab is open.')],
    ['shortcuts', L('Pintasan', 'Shortcuts'), L('Jalankan app, folder, atau tautan dengan satu klik.', 'Open apps, folders, or links with one click.')],
    ['clipboard', L('Riwayat clipboard', 'Clipboard history'), L('Tersimpan di PC ini saja.', 'Stored on this PC only.')],
    ['hud', L('Volume & kecerahan', 'Volume & brightness'), L('Perubahan ditampilkan di notch.', 'Changes show up in the notch.')],
    ['charger', L('Baterai & charger', 'Battery & charger'), L('Charger dicolok/dicabut, baterai 20% dan 10%.', 'Charger plugged in or out, battery at 20% and 10%.')],
    ['devices', L('Headphone & perangkat suara', 'Headphones & sound devices'), L('Nama perangkat saat output suara berpindah.', 'The device name when the sound output changes.')],
    ['downloads', L('Progress download', 'Download progress'), L('File yang sedang diunduh ke folder Downloads.', 'Files downloading to your Downloads folder.')],
    ['lyrics', L('Lirik lagu', 'Synced lyrics'), L('Butuh internet: judul, artis, dan durasi lagu dikirim ke LRCLIB (lrclib.net) saat halaman Musik dibuka.', 'Needs internet: the title, artist, and length are sent to LRCLIB (lrclib.net) when the Music page opens.')],
    ['water', L('Pengingat minum', 'Water reminder'), L('Target harian, grafik per jam, dan pengingat di jam aktif.', 'Daily goal, hourly chart and reminders during your hours.')],
    ['todo', L('Daftar tugas', 'To-do list'), L('Tugas dengan pengingat; tulis "jam 7" untuk mengatur waktunya.', 'Tasks with reminders; type "at 7pm" to set a time.')],
    ['companion', L('Teman kecil di notch', 'Little companion in the notch'), L('Wajah yang berkedip, tertidur, dan ekspresinya menyesuaikan keadaan. Atur caranya di bawah.', 'A face that blinks, dozes off, and changes expression with what is going on. Set how below.')],
    ['keys', L('Caps Lock & bahasa keyboard', 'Caps Lock & keyboard language'), L('Kabar singkat saat Caps Lock nyala atau bahasa keyboard berganti.', 'A nudge when Caps Lock turns on or the keyboard language changes.')],
    ['network', L('Internet putus/tersambung', 'Connection changes'), L('Kabar saat koneksi internet hilang atau pulih.', 'A nudge when you go offline or come back online.')],
    ['hideFullscreen', L('Sembunyi saat layar penuh', 'Hide in full-screen apps'), L('Notch menyingkir saat video, game, atau presentasi memenuhi layar.', 'Steps aside for full-screen video, games and presentations.')],
    ['lyricsWing', L('Lirik di notch tertutup', 'Lyrics in the closed notch'), L('Baris yang sedang dinyanyikan tampil di sisi kiri notch saat lagu diputar.', 'The line being sung shows beside the notch while music plays.')],
    ['clockTools', L('Stopwatch & hitung mundur', 'Stopwatch & countdowns'), L('Halaman stopwatch dengan lap dan beberapa hitung mundur sekaligus.', 'A stopwatch with laps and several countdowns at once.')],
    ['calculator', L('Kalkulator di catatan cepat', 'Calculator in quick note'), L('Ketik 12*3, 15% dari 200, atau 5 km ke mil; hasilnya langsung muncul.', 'Type 12*3, 15% of 200 or 5 km to mi; the answer shows up right away.')],
    ['weather', L('Cuaca di header', 'Weather in the header'), L('Butuh internet dan nama kota (di bawah): kota dikirim ke Open-Meteo tiap 30 menit.', 'Needs internet and a city (below): the city is sent to Open-Meteo every 30 minutes.')],
    ['hotkey', L('Buka dengan shortcut keyboard', 'Open with a keyboard shortcut'), L('Esc atau klik di luar notch menutupnya.', 'Esc or a click outside closes it.')],
    ['updates', L('Periksa versi baru tiap hari', 'Check for new versions daily'), ''],
    ['autoInstall', L('Pasang pembaruan otomatis', 'Install updates automatically'), L('Dipasang saat notch tidak dipakai.', 'Installed when the notch is idle.')],
  ] as const;

  const setUi = () => { ui.persist(); ui.applyAccent(); void emitPrefs('ui'); };
  ui.applyAccent();
  let backupMsg = $state('');
  let confirmImport = $state<string | null>(null);

  // Cadangan data seperti di Mac: catatan, tugas, riwayat minum, clipboard (teks), timer, pengaturan, dan pilihan fitur.
  const BACKUP_KEYS = ['notes', 'todo', 'water', 'clip', 'timer', 'countdowns', 'features', 'hotkey', 'lang', 'city', 'shortcuts'];
  const isBackupKey = (k: string) => k.startsWith('cn.') && (BACKUP_KEYS.includes(k.slice(3)) || k.startsWith('cn.ui.'));
  async function exportData() {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: L('Cadangan Cognify Notch.json', 'Cognify Notch Backup.json'), filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!path) return;
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!isBackupKey(k)) continue;
      let v: unknown = JSON.parse(localStorage.getItem(k) ?? 'null');
      if (k === 'cn.clip' && Array.isArray(v)) v = v.filter((c: { kind?: string }) => c.kind !== 'image'); // gambar tidak ikut
      data[k] = v;
    }
    await cmd('write_text_file', { path, text: JSON.stringify({ cognifyNotch: 1, data }) });
    backupMsg = L('Cadangan disimpan.', 'Backup saved.');
  }
  async function pickImport() {
    backupMsg = '';
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (typeof path !== 'string') return;
    const text = await cmd<string>('read_text_file', { path });
    try {
      const root = JSON.parse(text ?? '');
      if (!root?.cognifyNotch || typeof root.data !== 'object') throw new Error('bad');
      confirmImport = text!;
    } catch {
      backupMsg = L('File ini bukan cadangan Cognify Notch', "This file isn't a Cognify Notch backup");
    }
  }
  function doImport() {
    const root = JSON.parse(confirmImport ?? '{}');
    for (const [k, v] of Object.entries(root.data as Record<string, unknown>)) if (isBackupKey(k)) localStorage.setItem(k, JSON.stringify(v));
    confirmImport = null;
    void emitPrefs('reload');
    setTimeout(() => location.reload(), 150);
  }
  const changedFeature = (key: string) => { features.persist(); if (key === 'weather') weather.restart(); void emitPrefs('features'); };
  const setClipboardUnlimited = (unlimited: boolean) => { features.unlimitedClipboard = unlimited; clipboard.applyLimit(); changedFeature('unlimitedClipboard'); };
  const setClipboardLimit = (raw: string) => { const n = Number(raw); if (!Number.isFinite(n)) return; features.clipboardLimit = Math.max(1, Math.min(100_000, Math.trunc(n))); clipboard.applyLimit(); changedFeature('clipboardLimit'); };
  const setWidth = () => { ui.persist(); void emitPrefs('ui'); };
  const setEyes = (m: 'blink' | 'follow') => { ui.eyesMode = m; ui.persist(); void emitPrefs('ui'); };
  const setChoice = (id: string, v: string) => {
    if (v === 'auto') delete ui.companionMap[id]; else ui.companionMap[id] = v;
    setUi();
  };
  const resetWidth = () => { ui.closedWidth = CLOSED_DEFAULT; setWidth(); };
  const resetHeight = () => { ui.closedHeight = CLOSED_H_DEFAULT; setWidth(); };

  // Peta posisi pill: layar kecil dengan titik pill. Titik hanya bisa digeser di sini, dalam batas aman dari tepi layar.
  const sw = screen.width || 1920, sh = screen.height || 1080;
  const PILL_H = 36;
  const lim = $derived(pillLimits(sw, sh, ui.pillWidth, PILL_H, EDGE_MARGIN));
  const clampPill = () => {
    ui.pillX = Math.min(lim.maxX, Math.max(lim.minX, ui.pillX));
    ui.pillY = Math.min(lim.maxY, Math.max(lim.minY, ui.pillY));
  };
  let mapEl: HTMLDivElement | undefined = $state();
  const dragPill = (e: PointerEvent) => {
    if (!mapEl || e.buttons !== 1) return;
    const r = mapEl.getBoundingClientRect();
    ui.pillX = (e.clientX - r.left) / r.width;
    ui.pillY = (e.clientY - r.top) / r.height;
    clampPill();
    setUi();
  };
  const setStyle = (st: 'notch' | 'pill') => { ui.style = st; if (st === 'pill') ui.autoHide = false; clampPill(); setUi(); }; // pill mengambang tidak bisa disembunyikan di tepi
  const pct = (v: number) => Math.round(v * 100);
  const setPct = (axis: 'x' | 'y', v: number) => { if (axis === 'x') ui.pillX = v / 100; else ui.pillY = v / 100; clampPill(); setUi(); };
  const curPane = $derived(panes.find((p) => p.id === pane)!);
  const allOff = (keys: (keyof typeof features)[]) => { for (const k of keys) (features as unknown as Record<string, boolean>)[k] = false; features.persist(); void emitPrefs('features'); };
  const reloadLang = (l: 'auto' | 'id' | 'en') => { ui.lang = l; setUi(); void emitPrefs('reload'); setTimeout(() => location.reload(), 150); };
  // Paket tema dan latar panel
  let bgError = $state('');
  const applyPreset = (p: (typeof THEME_PRESETS)[number]) => { ui.accentColor = p.accent; ui.bgMode = p.mode; ui.bgColor = p.c1; ui.bgColor2 = p.c2; ui.bgAngle = p.angle; setUi(); };
  const presetCss = (p: (typeof THEME_PRESETS)[number]) => p.mode === 'none' ? '#000' : p.mode === 'color' ? p.c1 : `linear-gradient(${p.angle + 90}deg, ${p.c1}, ${p.c2})`;
  /** Gambar dipilih lalu diperkecil (paling panjang 1280 px) dan disimpan sebagai JPEG di penyimpanan app; tidak dikirim ke mana pun. */
  async function pickImage(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    bgError = '';
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      ui.bgImage = c.toDataURL('image/jpeg', 0.82);
      ui.bgAspect = c.width / c.height; ui.bgPosX = 50; ui.bgPosY = 50; ui.bgZoom = 1;
      ui.bgMode = 'image';
      setUi();
      if (localStorage.getItem('cn.ui.bgImage') === null) bgError = L('Gambar terlalu besar untuk disimpan. Coba gambar yang lebih kecil.', 'The image is too large to store. Try a smaller one.');
    } catch {
      bgError = L('Gambar ini tidak bisa dibuka.', 'This image could not be opened.');
    }
  }
  // Latar jendela Pengaturan mengikuti tema yang dipilih (warna, gradien, atau gambar); hitam bawaan memakai latar ungu lama.
  const themed = $derived(ui.bgMode !== 'none' && !!ui.bgCss && (ui.bgMode !== 'image' || ui.bgSettings));
  const themedBg = $derived(ui.bgMode === 'image' ? ui.imageCss(window.innerWidth / Math.max(1, window.innerHeight)) : (ui.bgCss?.background ?? ''));
  const SWATCH = ['#8f87ff', '#0a84ff', '#30d158', '#ff375f', '#ff9f0a', '#ffd60a', '#bf5af2', '#ffffff'];
  const LYRIC_SWATCH = ['#ffffff', '#ffd60a', '#30d158', '#0a84ff', '#ff375f', '#ff9f0a', '#bf5af2', '#8e8e93'];
  const EQ_SWATCH = ['#ffffff', '#30d158', '#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#ffd60a'];
  const NEED_COMPANION = () => L('Nyalakan Teman kecil dulu.', 'Turn on Little companion first.');
</script>

{#snippet tog(key: (typeof toggles)[number][0], opts: { disabled?: boolean; why?: string; sub?: boolean } = {})}
  {@const t = toggles.find((x) => x[0] === key)!}
  <Setting toggle title={t[1]} desc={t[2]} disabled={opts.disabled} why={opts.why} sub={opts.sub} bind:checked={features[key]} onchange={() => changedFeature(key)} />
{/snippet}

{#snippet swatches(list: string[], current: string, set: (c: string) => void, fallback: string)}
  <span class="swatches">
    {#each list as c}
      <button class="chip" class:sel={(current || fallback).toLowerCase() === c} style:background={c} aria-label={c} onclick={() => set(c)}></button>
    {/each}
    <input type="color" value={current || fallback} aria-label={L('Warna sendiri', 'Custom color')} oninput={(e) => set(e.currentTarget.value)} />
    <button class="btn ghost" disabled={!current} onclick={() => set('')}>{L('Bawaan', 'Default')}</button>
  </span>
{/snippet}

<div class="shell" style:--accent={ui.accentColor || undefined}>
  {#if themed}
    <div class="tbg" aria-hidden="true" style:background={themedBg} style:filter={ui.bgMode === 'image' && ui.bgBlur > 0 ? `blur(${ui.bgBlur * 16}px)` : undefined} style:inset={ui.bgMode === 'image' && ui.bgBlur > 0 ? '-24px' : '0'}></div>
    <div class="tdim" aria-hidden="true" style:opacity={ui.bgMode === 'color' ? 0 : Math.max(ui.bgDim, 0.45)}></div>
  {/if}
  <nav aria-label={L('Bagian pengaturan', 'Settings sections')}>
    <div class="brand"><i class="mark"></i><div><h1>{L('Pengaturan', 'Settings')}</h1><span class="ver">Cognify Notch {update.current}</span></div></div>
    <label class="search"><Search size={14} /><input type="search" bind:value={query} placeholder={L('Cari pengaturan', 'Search settings')} aria-label={L('Cari pengaturan', 'Search settings')} autocomplete="off" /></label>
    {#each GROUPS as g, gi}
      <div class="grpname">{g()}</div>
      {#each sidebar.filter((p) => p.group === gi) as p}
        <button class="tab" class:sel={!searching && pane === p.id} aria-current={!searching && pane === p.id ? 'page' : undefined} title={p.label()} onclick={() => { query = ''; pane = p.id; innerEl?.parentElement?.scrollTo(0, 0); }}>
          <p.icon size={17} /><span>{p.label()}</span>
        </button>
      {/each}
    {/each}
  </nav>

  <main class="pane">
   <div class="inner" bind:this={innerEl} oninput={paintRanges} role="presentation">
    <header class="head">
      <h2>{searching ? L('Hasil pencarian', 'Search results') : curPane.label()}</h2>
      <p>{searching ? L(`${found} pengaturan`, `${found} settings`) : curPane.desc()}</p>
    </header>
    {#if searching && found === 0}<p class="empty">{L('Tidak ada pengaturan yang cocok.', 'No settings match.')}</p>{/if}

  {#if show('general')}
    <Group title={L('Umum', 'General')}>
      {#if inTauri}
        <Setting toggle title={L('Buka saat Windows dinyalakan', 'Open when Windows starts')} bind:checked={autostart} onchange={() => void cmd('autostart_set', { on: autostart })} />
      {/if}
      <Setting title={L('Bahasa tampilan', 'Display language')}>
        <Segmented label={L('Bahasa tampilan', 'Display language')} value={ui.lang} onchange={reloadLang}
          options={[{ value: 'auto', label: L('Ikuti Windows', 'Follow Windows') }, { value: 'id', label: 'Indonesia' }, { value: 'en', label: 'English' }]} />
      </Setting>
    </Group>

    <Group title={L('Pintasan keyboard', 'Keyboard shortcut')} hint={L('Esc atau klik di luar notch menutupnya. Notch juga bisa disembunyikan atau ditampilkan lewat ikon Cognify Notch di area ikon tersembunyi taskbar (klik kiri).', 'Esc or a click outside closes the notch. You can also hide or show it from the Cognify Notch icon in the taskbar\'s hidden icons (left click).')}>
      <Setting toggle title={L('Buka dengan pintasan keyboard', 'Open with a keyboard shortcut')} bind:checked={features.hotkey} onchange={() => changedFeature('hotkey')} />
      {#if inTauri}
        <Setting sub title={L('Kombinasi tombol', 'Key combination')} disabled={!features.hotkey} why={L('Nyalakan pintasan di atas dulu.', 'Turn on the shortcut above first.')}>
          <select bind:value={hotkey.choice} onchange={() => { hotkey.apply(); void emitPrefs('hotkey'); }} aria-label={L('Kombinasi tombol', 'Key combination')}>
            {#each HOTKEYS.filter((h) => h[0] !== 'off') as [id, label]}<option value={id}>{label}</option>{/each}
          </select>
        </Setting>
      {/if}
    </Group>

    <Group title={L('Pembaruan', 'Updates')}>
      {@render tog('updates')}
      {@render tog('autoInstall', { sub: true, disabled: !features.updates, why: L('Nyalakan pemeriksaan versi dulu.', 'Turn on the version check first.') })}
      <Setting title={L('Versi terpasang', 'Installed version')} desc={update.text || `Cognify Notch ${update.current}`}>
        <button class="btn" onclick={() => checkUpdate()}>{L('Cek pembaruan', 'Check for updates')}</button>
        {#if update.selfUpdate && (update.stage === 'found' || update.stage === 'ready')}<button class="btn on" onclick={installNow}>{L('Perbarui dan mulai ulang', 'Update and restart')}</button>{/if}
        {#if !update.selfUpdate && update.url}<button class="btn on" onclick={() => cmd('open_target', { target: update.url })}>{L('Buka halaman unduh', 'Open download page')}</button>{/if}
      </Setting>
    </Group>

  {/if}
  {#if show('appearance')}
    {#if !searching}<PreviewStage />{/if}
    <Group title={L('Bentuk', 'Shape')}>
      <Setting title={L('Bentuk notch', 'Notch shape')}>
        <Segmented label={L('Bentuk notch', 'Notch shape')} value={ui.style} onchange={setStyle}
          options={[{ value: 'notch', label: L('Notch (menempel)', 'Notch (attached)') }, { value: 'pill', label: L('Pill (mengambang)', 'Pill (floating)') }]} />
      </Setting>
      <Setting toggle title={L('Sembunyikan otomatis di tepi layar', 'Auto-hide at the screen edge')}
        desc={L('Notch menghilang saat tidak dipakai dan muncul lagi saat kursor menyentuh tepi layar di dekat posisinya. Pengingat tetap muncul sendiri.', 'The notch disappears when idle and slides back when the cursor touches the screen edge near it. Reminders still appear on their own.')}
        disabled={ui.style === 'pill'} why={L('Tidak tersedia untuk Pill: ia mengambang, tidak menempel di tepi layar. Pilih Notch (menempel) untuk memakainya.', 'Not available for Pill: it floats and is not attached to a screen edge. Choose Notch (attached) to use it.')}
        bind:checked={ui.autoHide} onchange={setUi} />
    </Group>

    {#if ui.style === 'pill'}
      <Group title={L('Pill', 'Pill')} hint={L('Tahan Alt lalu seret pill langsung di layar, atau geser titik di peta atau isi angka. Pill selalu tetap di dalam layar; bila dekat tepi, panelnya tumbuh ke sisi yang masih punya ruang.', 'Hold Alt and drag the pill right on screen, or drag the dot on the map or type numbers. The pill always stays on screen; near an edge, its panel grows toward the side with room.')}>
        <Setting stack title={L('Lebar pill saat tertutup', 'Closed pill width')}>
          <div class="slider"><input type="range" min={CLOSED_MIN} max={CLOSED_MAX} step="2" bind:value={ui.pillWidth} oninput={() => { clampPill(); setUi(); }} aria-label={L('Lebar pill', 'Pill width')} /><span class="val">{ui.pillWidth} px</span></div>
        </Setting>
        <Setting stack title={L('Posisi pill', 'Pill position')}>
          <div class="map" bind:this={mapEl} style:aspect-ratio="{sw} / {sh}" role="presentation"
            onpointerdown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); dragPill(e); }} onpointermove={dragPill}>
            <i class="zone" style:inset="{(EDGE_MARGIN / sh) * 100}% {(EDGE_MARGIN / sw) * 100}%"></i>
            <i class="dot" style:left="{ui.pillX * 100}%" style:top="{ui.pillY * 100}%" style:width="{(ui.pillWidth / sw) * 100}%" style:height="{(PILL_H / sh) * 100}%"></i>
          </div>
          <div class="nums">
            <label>X <input class="num" type="number" min={pct(lim.minX)} max={pct(lim.maxX)} value={pct(ui.pillX)} onchange={(e) => setPct('x', Number(e.currentTarget.value))} /> %</label>
            <label>Y <input class="num" type="number" min={pct(lim.minY)} max={pct(lim.maxY)} value={pct(ui.pillY)} onchange={(e) => setPct('y', Number(e.currentTarget.value))} /> %</label>
          </div>
        </Setting>
      </Group>
    {/if}

    <Group title={L('Ukuran', 'Size')}>
      {#if ui.style === 'notch'}
        <Setting stack title={L('Lebar notch saat tertutup', 'Closed notch width')} desc={L('Lebih sempit tidak menutupi tab browser. Panel yang terbuka tidak berubah.', 'Narrower won\'t cover browser tabs. The open panel is unchanged.')}>
          <div class="slider"><input id="w" type="range" min={CLOSED_MIN} max={CLOSED_MAX} step="2" bind:value={ui.closedWidth} oninput={setWidth} aria-label={L('Lebar notch', 'Notch width')} /><span class="val">{ui.closedWidth} px</span>
            <button class="btn ghost" onclick={resetWidth} disabled={ui.closedWidth === CLOSED_DEFAULT} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
        </Setting>
        <Setting stack title={L('Tinggi notch saat tertutup', 'Closed notch height')} desc={L('Lebar dan tinggi diatur terpisah, seperti ukuran notch di Mac.', 'Width and height are set separately, like the notch size on Mac.')}>
          <div class="slider"><input type="range" min={CLOSED_H_MIN} max={CLOSED_H_MAX} step="1" bind:value={ui.closedHeight} oninput={setWidth} aria-label={L('Tinggi notch', 'Notch height')} /><span class="val">{ui.closedHeight} px</span>
            <button class="btn ghost" onclick={resetHeight} disabled={ui.closedHeight === CLOSED_H_DEFAULT} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
        </Setting>
      {/if}
      <Setting title={L('Ukuran panel', 'Panel size')}>
        <Segmented label={L('Ukuran panel', 'Panel size')} value={ui.scale} onchange={(v) => { ui.scale = v; setUi(); }}
          options={[{ value: 1, label: L('Normal', 'Normal') }, { value: 1.12, label: L('Besar', 'Large') }]} />
      </Setting>
      <Setting stack title={L('Lengkung sudut bawah', 'Bottom corner roundness')}>
        <div class="slider"><input type="range" min="0" max="48" step="1" bind:value={ui.roundness} oninput={setUi} aria-label={L('Lengkung sudut bawah', 'Bottom corner roundness')} /><span class="val">{ui.roundness} px</span></div>
      </Setting>
    </Group>

    <Group title={L('Paket tema', 'Theme packs')} hint={L('Satu klik mengatur warna aksen dan latar sekaligus.', 'One click sets the accent color and the background together.')}>
      <div class="presets">
        {#each THEME_PRESETS as p (p.id)}
          <button type="button" class="preset" onclick={() => applyPreset(p)} aria-label={p.name()}>
            <span class="sample" style:background={presetCss(p)}><i style:background={p.accent || '#8f87ff'}></i></span>
            <span>{p.name()}</span>
          </button>
        {/each}
      </div>
    </Group>

    <Group title={L('Latar panel', 'Panel background')} hint={L('Notch tertutup yang menempel di atas tetap hitam; latar tampil di panel terbuka dan pill melayang. Gambar diperkecil dan disimpan di app ini saja.', 'The attached closed notch stays black; the background shows in the open panel and the floating pill. The image is downsized and stored in this app only.')}>
      <Setting title={L('Latar', 'Background')}>
        <Segmented label={L('Latar', 'Background')} value={ui.bgMode} onchange={(v) => { ui.bgMode = v; setUi(); }}
          options={[{ value: 'none', label: L('Hitam', 'Black') }, { value: 'color', label: L('Warna', 'Color') }, { value: 'gradient', label: L('Gradien', 'Gradient') }, { value: 'image', label: L('Gambar', 'Image') }]} />
      </Setting>
      {#if ui.bgMode === 'color' || ui.bgMode === 'gradient'}
        <Setting title={ui.bgMode === 'gradient' ? L('Warna awal', 'Start color') : L('Warna', 'Color')}>
          <input type="color" value={ui.bgColor} aria-label={L('Warna', 'Color')} oninput={(e) => { ui.bgColor = e.currentTarget.value; setUi(); }} />
        </Setting>
      {/if}
      {#if ui.bgMode === 'gradient'}
        <Setting title={L('Warna akhir', 'End color')}>
          <input type="color" value={ui.bgColor2} aria-label={L('Warna akhir', 'End color')} oninput={(e) => { ui.bgColor2 = e.currentTarget.value; setUi(); }} />
        </Setting>
        <Setting stack title={L('Arah', 'Direction')}>
          <div class="slider"><input type="range" min="0" max="360" step="5" bind:value={ui.bgAngle} oninput={setUi} aria-label={L('Arah gradien', 'Gradient direction')} /><span class="val">{ui.bgAngle}°</span></div>
        </Setting>
      {/if}
      {#if ui.bgMode === 'image'}
        <Setting title={L('Gambar', 'Image')} desc={bgError || undefined}>
          {#if ui.bgImage}<img class="thumb" src={ui.bgImage} alt="" />{/if}
          <label class="btn pick">{ui.bgImage ? L('Ganti gambar…', 'Change image…') : L('Pilih gambar…', 'Choose image…')}<input type="file" accept="image/*" hidden onchange={pickImage} /></label>
          {#if ui.bgImage}<button class="btn ghost" onclick={() => { ui.bgImage = ''; ui.bgMode = 'none'; setUi(); }}>{L('Hapus', 'Remove')}</button>{/if}
        </Setting>
        {#if ui.bgImage}
          <Setting stack title={L('Potong gambar', 'Crop image')}>
            <CropPicker onchange={setUi} />
          </Setting>
        {/if}
        <Setting toggle title={L('Pakai juga di Pengaturan', 'Also use in Settings')} desc={L('Gambar ini jadi latar jendela Pengaturan ini juga.', 'This image also becomes the background of this Settings window.')} bind:checked={ui.bgSettings} onchange={setUi} />
        <Setting stack title={L('Buram', 'Blur')}>
          <div class="slider"><input type="range" min="0" max="1" step="0.05" bind:value={ui.bgBlur} oninput={setUi} aria-label={L('Buram', 'Blur')} /><span class="val">{Math.round(ui.bgBlur * 100)}%</span></div>
        </Setting>
      {/if}
      {#if ui.bgMode === 'image' || ui.bgMode === 'gradient'}
        <Setting stack title={L('Peredam gelap', 'Dim')} desc={L('Supaya tulisan tetap terbaca di atas gambar atau warna terang.', 'Keeps the text readable over a bright image or color.')}>
          <div class="slider"><input type="range" min="0" max="0.8" step="0.05" bind:value={ui.bgDim} oninput={setUi} aria-label={L('Peredam gelap', 'Dim')} /><span class="val">{Math.round(ui.bgDim * 100)}%</span></div>
        </Setting>
      {/if}
    </Group>

    <Group title={L('Warna', 'Colors')}>
      <Setting title={L('Warna aksen', 'Accent color')}>
        {@render swatches(SWATCH, ui.accentColor, (c) => { ui.accentColor = c === '#8f87ff' ? '' : c; setUi(); }, '#8f87ff')}
      </Setting>
      <Setting toggle title={L('Warna equalizer dari sampul', 'Equalizer color from the album cover')} bind:checked={ui.equalizerAuto} onchange={setUi} />
      {#if !ui.equalizerAuto}
        <Setting title={L('Warna equalizer', 'Equalizer color')}>
          {@render swatches(EQ_SWATCH, ui.equalizerColor, (c) => { ui.equalizerColor = c; setUi(); }, '#8f87ff')}
        </Setting>
      {/if}
      <Setting toggle title={L('Warna lirik dari sampul', 'Lyric colors from the album cover')} disabled={!features.lyrics}
        why={L('Nyalakan Lirik lagu di Fitur dulu.', 'Turn on Synced lyrics in Features first.')} bind:checked={ui.lyricAuto} onchange={setUi} />
      {#if !ui.lyricAuto && features.lyrics}
        <Setting title={L('Warna lirik aktif', 'Active lyric color')}>
          {@render swatches(LYRIC_SWATCH, ui.lyricActive, (c) => { ui.lyricActive = c; setUi(); }, '#ffffff')}
        </Setting>
        <Setting title={L('Warna lirik lainnya', 'Other lyrics color')}>
          {@render swatches(LYRIC_SWATCH, ui.lyricIdle, (c) => { ui.lyricIdle = c; setUi(); }, '#ffffff')}
        </Setting>
      {/if}
    </Group>

  {/if}
  {#if show('behavior')}
    <Group title={L('Membuka dan menutup', 'Opening and closing')}>
      <Setting title={L('Buka notch dengan', 'Open the notch by')}>
        <Segmented label={L('Buka notch dengan', 'Open the notch by')} value={ui.openOnClick} onchange={(v) => { ui.openOnClick = v; setUi(); }}
          options={[{ value: false, label: L('Mengarahkan kursor', 'Hovering') }, { value: true, label: L('Klik', 'Clicking') }]} />
      </Setting>
      <Setting stack title={L('Jeda sebelum terbuka', 'Delay before opening')} disabled={ui.openOnClick} why={L('Tidak dipakai saat notch dibuka dengan klik.', 'Not used when the notch opens by clicking.')}>
        <div class="slider"><input type="range" min="0" max="600" step="50" bind:value={ui.hoverDelay} oninput={setUi} aria-label={L('Jeda sebelum terbuka', 'Delay before opening')} disabled={ui.openOnClick} /><span class="val">{ui.hoverDelay} ms</span></div>
      </Setting>
      <Setting stack title={L('Jeda sebelum menutup', 'Delay before closing')}>
        <div class="slider"><input type="range" min="100" max="1500" step="50" bind:value={ui.closeDelay} oninput={setUi} aria-label={L('Jeda sebelum menutup', 'Delay before closing')} /><span class="val">{ui.closeDelay} ms</span></div>
      </Setting>
    </Group>
    {#if inTauri}
      <Group title={L('Layar', 'Screen')}>
        <Setting title={L('Tampil di', 'Show on')}>
          <Segmented label={L('Tampil di', 'Show on')} value={ui.display} onchange={(v) => { ui.display = v; setUi(); void cmd('set_display', { mode: v }); }}
            options={[{ value: 'main', label: L('Layar utama', 'Main screen') }, { value: 'active', label: L('Layar yang dipakai', 'Screen in use') }]} />
        </Setting>
      </Group>
    {/if}

  {/if}
  {#if show('companion')}
    {#if !searching}<PreviewStage height={110} />{/if}
    <Group>
      {@render tog('companion')}
    </Group>
    <Group title={L('Gerak', 'Movement')} hint={L('Mengikuti kursor sedikit lebih boros daya karena arah pandang ikut dihitung.', 'Following the cursor uses slightly more power because the gaze is calculated too.')}>
      <Setting title={L('Arah pandang', 'Gaze')} disabled={!features.companion} why={NEED_COMPANION()}>
        <Segmented label={L('Arah pandang', 'Gaze')} value={ui.eyesMode} onchange={setEyes} disabled={!features.companion}
          options={[{ value: 'blink', label: L('Diam di tempat', 'Stay in place') }, { value: 'follow', label: L('Ikuti kursor', 'Follow cursor') }]} />
      </Setting>
      <Setting toggle title={L('Berkedip berkala', 'Blink now and then')} disabled={!features.companion} why={NEED_COMPANION()} bind:checked={ui.companionBlink} onchange={setUi} />
    </Group>
    <Group title={L('Ekspresi', 'Expression')} hint={MODES.find((m) => m.id === ui.companionMode)?.hint()}>
      <Setting title={L('Cara kerja', 'How it works')} disabled={!features.companion} why={NEED_COMPANION()}>
        <Segmented label={L('Cara kerja', 'How it works')} value={ui.companionMode} onchange={(v) => { ui.companionMode = v; setUi(); }} disabled={!features.companion}
          options={MODES.map((m) => ({ value: m.id, label: m.label() }))} />
      </Setting>
      {#if ui.companionMode === 'fixed'}
        <Setting title={L('Ekspresi tetap', 'Fixed expression')} disabled={!features.companion} why={NEED_COMPANION()}>
          <select bind:value={ui.companionFixed} onchange={setUi} disabled={!features.companion}>{#each EMOTIONS as e}<option value={e}>{emotionLabel(e)}</option>{/each}</select>
        </Setting>
      {/if}
    </Group>
    {#if ui.companionMode === 'custom'}
      {#each [false, true] as ev}
        <Group title={ev ? L('Kejadian', 'Events') : L('Keadaan', 'Situations')}>
          {#each SITUATIONS.filter((x) => x.event === ev) as sit}
            <Setting title={situationLabel(sit)} disabled={!features.companion} why={NEED_COMPANION()}>
              <select value={ui.companionMap[sit.id] ?? 'auto'} onchange={(e) => setChoice(sit.id, e.currentTarget.value)} disabled={!features.companion}>
                <option value="auto">{L('Bawaan', 'Default')} ({emotionLabel(sit.emotion)})</option>
                {#if sit.event}<option value="none">{L('Tidak bereaksi', 'No reaction')}</option>{/if}
                {#each EMOTIONS as e}<option value={e}>{emotionLabel(e)}</option>{/each}
              </select>
            </Setting>
          {/each}
        </Group>
      {/each}
      <p class="foot">{L('Perubahan langsung terlihat di notch.', 'Changes show up in the notch right away.')}
        <button class="btn ghost" onclick={() => { ui.companionMap = {}; setUi(); }} disabled={Object.keys(ui.companionMap).length === 0}>{L('Kembalikan ke bawaan', 'Reset to default')}</button></p>
    {/if}

  {/if}
  {#if show('features')}
    <Group title={L('Musik', 'Music')} action={L('Matikan semua', 'Turn all off')} onaction={() => allOff(['media', 'spectrum', 'lyrics', 'lyricsWing'])}>
      {@render tog('media')}
      {@render tog('spectrum', { sub: true, disabled: !features.media, why: L('Nyalakan Lagu & video yang diputar dulu.', 'Turn on Now playing first.') })}
      {@render tog('lyrics', { sub: true, disabled: !features.media, why: L('Nyalakan Lagu & video yang diputar dulu.', 'Turn on Now playing first.') })}
      {@render tog('lyricsWing', { sub: true, disabled: !features.media || !features.lyrics, why: !features.media ? L('Nyalakan Lagu & video yang diputar dulu.', 'Turn on Now playing first.') : L('Nyalakan Lirik lagu dulu.', 'Turn on Synced lyrics first.') })}
    </Group>
    <Group title={L('Produktivitas', 'Productivity')} action={L('Matikan semua', 'Turn all off')} onaction={() => allOff(['shortcuts', 'clipboard', 'water', 'todo', 'clockTools', 'calculator', 'camera'])}>
      {@render tog('shortcuts')}
      {@render tog('clipboard')}
      {#if features.clipboard}
        <Setting title={L('Batas riwayat clipboard', 'Clipboard history limit')} desc={L('Bawaan tanpa batas. Item tersemat tidak ikut dihitung; gambar hanya ada selama app berjalan.', 'Unlimited by default. Pinned items do not count; images stay only while the app is running.')}>
          <select value={features.unlimitedClipboard ? 'unlimited' : 'custom'} onchange={(e) => setClipboardUnlimited(e.currentTarget.value === 'unlimited')} aria-label={L('Batas riwayat clipboard', 'Clipboard history limit')}><option value="unlimited">{L('Tanpa batas', 'Unlimited')}</option><option value="custom">{L('Kustom', 'Custom')}</option></select>
        </Setting>
        {#if !features.unlimitedClipboard}
          <Setting title={L('Jumlah item', 'Item count')} desc={L('Item tersemat tetap dipertahankan.', 'Pinned items are preserved.')}>
            <input class="num" type="number" min="1" max="100000" step="1" value={features.clipboardLimit} onchange={(e) => setClipboardLimit(e.currentTarget.value)} aria-label={L('Jumlah item riwayat clipboard', 'Clipboard history item count')} />
          </Setting>
        {/if}
      {/if}
      {@render tog('water')}{@render tog('todo')}{@render tog('clockTools')}{@render tog('calculator')}{@render tog('camera')}
    </Group>
    <Group title={L('Sistem', 'System')} action={L('Matikan semua', 'Turn all off')} onaction={() => allOff(['hud', 'charger', 'devices', 'downloads', 'keys', 'network', 'hideFullscreen'])}>
      {@render tog('hud')}{@render tog('charger')}{@render tog('devices')}{@render tog('downloads')}{@render tog('keys')}{@render tog('network')}{@render tog('hideFullscreen')}
    </Group>

  {/if}
  {#if show('weather')}
    <Group title={L('Cuaca', 'Weather')}>
      {@render tog('weather')}
      {#if inTauri}
        <Setting stack title={L('Kota', 'City')} disabled={!features.weather} why={L('Nyalakan Cuaca di header dulu.', 'Turn on Weather in the header first.')}>
          <input type="text" bind:value={city} disabled={!features.weather} placeholder={L('Nama kota', 'City name')} aria-label={L('Nama kota', 'City name')} onchange={() => { weather.setCity(city); locErr = ''; void emitPrefs('weather'); }} />
          <button class="btn" disabled={!features.weather || detecting} onclick={async () => { detecting = true; locErr = ''; try { await weather.detect(); city = weather.city; void emitPrefs('weather'); } catch (e) { locErr = (e as Error).message; } detecting = false; }}>{detecting ? L('Mendeteksi…', 'Detecting…') : L('Deteksi lokasi saat ini', 'Detect current location')}</button>
          {#if weather.coords}<span class="dim">{L('Memakai lokasi terdeteksi', 'Using detected location')}</span>{/if}
        </Setting>
        {#if locErr || weather.problem}<p class="inline-err">{locErr || weather.problem}</p>{/if}
      {/if}
    </Group>
    {#if inTauri}
      <Group title={L('Kalender', 'Calendar')}>
        <Setting stack title={L('Tautan kalender ICS', 'Calendar ICS link')} desc={L('Alamat https dari Google Calendar, iCloud, atau lainnya.', 'An https address from Google Calendar, iCloud, or similar.')}>
          <input type="text" bind:value={ics} placeholder="https://…" aria-label={L('Tautan kalender ICS', 'Calendar ICS link')} onchange={() => { agenda.setSource(ics); void emitPrefs('agenda'); }} />
        </Setting>
        <Setting title={L('Berkas .ics', 'An .ics file')} desc={agenda.file ? L('Berkas dipakai.', 'A file is in use.') : ''}>
          <button class="btn" onclick={async () => { const f = (await pickFiles())[0]; if (f) { ics = ''; agenda.setSource('', f); void emitPrefs('agenda'); } }}>{agenda.file ? L('Ganti berkas', 'Change file') : L('Pilih berkas', 'Choose file')}</button>
        </Setting>
        <Setting toggle title={L('Pakai kalender Cognify', 'Use the Cognify calendar')} desc={L('Perlu Cognify terhubung ke Notch.', 'Cognify must be connected to Notch.')} checked={agenda.cognify} onchange={(v) => { agenda.setCognify(v); void emitPrefs('agenda'); }} />
        {#if agenda.problem}<p class="inline-err">{agenda.problem}</p>{/if}
      </Group>
    {/if}

  {/if}
  {#if pane === 'tabs' && !searching}
    <Group>
      {#each ui.allOrdered as p, i (p.id)}
        <Setting title={p.title()}>
          <button class="btn ghost" aria-label={L('Naik', 'Move up')} disabled={i === 0} onclick={() => { ui.move(p.id, -1); setUi(); }}><ArrowUp size={14} /></button>
          <button class="btn ghost" aria-label={L('Turun', 'Move down')} disabled={i === ui.allOrdered.length - 1} onclick={() => { ui.move(p.id, 1); setUi(); }}><ArrowDown size={14} /></button>
        </Setting>
      {/each}
    </Group>

  {/if}
  {#if show('data') && inTauri}
    <Group title={L('Cadangan', 'Backup')} hint={L('Catatan, tugas, riwayat minum, clipboard, timer, dan pengaturan.', 'Notes, tasks, water log, clipboard, timers and settings.')}>
      <Setting title={L('Ekspor', 'Export')} desc={L('Simpan semuanya ke satu berkas JSON.', 'Save everything to one JSON file.')}><button class="btn" onclick={exportData}>{L('Ekspor…', 'Export…')}</button></Setting>
      <Setting title={L('Impor', 'Import')} desc={L('Pulihkan dari berkas cadangan.', 'Restore from a backup file.')}><button class="btn" onclick={pickImport}>{L('Impor…', 'Import…')}</button></Setting>
    </Group>
    {#if confirmImport}
      <div class="warn" role="alertdialog">
        <p>{L('Ganti data di PC ini dengan isi cadangan? Catatan, tugas, riwayat minum, clipboard, timer, dan pengaturan sekarang akan diganti. Cognify Notch lalu dimuat ulang.', "Replace this PC's data with the backup? Current notes, tasks, water log, clipboard, timers and settings will be replaced. Cognify Notch will then reload.")}</p>
        <div class="row"><button class="btn on" onclick={doImport}>{L('Ganti', 'Replace')}</button><button class="btn" onclick={() => (confirmImport = null)}>{L('Batal', 'Cancel')}</button></div>
      </div>
    {/if}
    {#if backupMsg}<p class="foot">{backupMsg}</p>{/if}
  {/if}
   </div>
  </main>
</div>

<style>
  .shell {
    --card: rgba(255, 255, 255, .05); --line: rgba(255, 255, 255, .08); --dim: rgba(243, 242, 248, .58); --faint: rgba(243, 242, 248, .42); --warn: #ffc666;
    --accent: #8f87ff;
    position: relative; isolation: isolate; overflow: hidden; display: flex; height: 100vh; color: #f3f2f8; font-size: 13px; user-select: none; color-scheme: dark;
    background: radial-gradient(900px 500px at 15% -10%, #3b2a86 0%, transparent 60%), radial-gradient(700px 420px at 100% 110%, #a8478e 0%, transparent 55%), #14121f;
  }
  .tbg { position: absolute; z-index: -2; pointer-events: none; }
  .tdim { position: absolute; inset: 0; z-index: -1; pointer-events: none; background: #000; }
  nav { width: 232px; flex: none; display: flex; flex-direction: column; gap: 2px; padding: 18px 10px; background: rgba(0, 0, 0, .34); border-right: 1px solid rgba(255, 255, 255, .07); overflow-y: auto; scrollbar-width: none; }
  nav::-webkit-scrollbar, .pane::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .brand { display: flex; align-items: center; gap: 10px; padding: 2px 8px 14px; }
  .mark { position: relative; width: 22px; height: 15px; flex: none; background: #000; border-radius: 0 0 8px 8px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .2); }
  .mark::after { content: ''; position: absolute; left: 6px; top: 3px; width: 3px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 7px 0 0 var(--accent); }
  nav h1 { font-size: 15px; font-weight: 600; margin: 0; }
  .ver { display: block; font-size: 11px; color: var(--dim); }
  .search { position: relative; display: block; margin: 0 4px 6px; color: var(--dim); }
  .search :global(svg) { position: absolute; left: 11px; top: 8px; opacity: .6; pointer-events: none; }
  .search input { width: 100%; box-sizing: border-box; border: 0; border-radius: 99px; padding: 7px 12px 7px 32px; background: rgba(255, 255, 255, .07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08); color: inherit; font: inherit; outline: none; user-select: text; }
  .search input:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
  .search input::-webkit-search-cancel-button { display: none; }
  .grpname { color: var(--faint); text-transform: uppercase; letter-spacing: .09em; font-size: 10px; font-weight: 600; padding: 14px 10px 4px; }
  .tab { position: relative; display: flex; align-items: center; gap: 9px; border: 0; background: none; color: var(--dim); font: inherit; text-align: left; padding: 7px 10px; border-radius: 12px; cursor: pointer; transition: background .15s, color .15s; }
  .tab span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tab:hover { background: rgba(255, 255, 255, .06); color: #fff; }
  .tab.sel { background: color-mix(in srgb, var(--accent) 20%, transparent); color: #fff; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent); }
  .tab.sel :global(svg) { color: var(--accent); }
  .tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .pane { flex: 1; min-width: 0; overflow-y: auto; scrollbar-width: none; }
  .inner { max-width: 660px; margin: 0 auto; padding: 24px 28px 40px; }
  .head h2 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -.01em; }
  .head p { margin: 4px 0 14px; color: var(--dim); font-size: 13px; }
  .empty { padding: 40px 10px; text-align: center; color: var(--dim); }
  :global(.set[hidden]), :global(.grp[hidden]) { display: none !important; }
  .inner > :global(.stage) + :global(.grp) { margin-top: 18px; }
  .foot { margin: 14px 4px 0; font-size: 12px; color: var(--dim); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .inline-err { margin: 0; padding: 10px 16px; font-size: 12px; color: var(--warn); border-top: 1px solid var(--line); }
  .warn { margin-top: 14px; padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(255, 198, 102, .3); background: rgba(255, 198, 102, .08); }
  .warn p { margin: 0 0 12px; line-height: 1.45; }
  .dim { color: var(--dim); font-size: 12px; }
  .row { display: flex; gap: 8px; }

  .slider { display: flex; align-items: center; gap: 12px; width: 100%; }
  .slider input[type=range] { flex: 1; min-width: 0; }
  .val { min-width: 56px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  input[type=range] { -webkit-appearance: none; appearance: none; height: 20px; background: transparent; cursor: pointer; --p: 50%; }
  input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 99px; background: linear-gradient(to right, var(--accent) var(--p), rgba(255, 255, 255, .16) var(--p)); }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%; background: #f3f2f8; border: 0; box-shadow: 0 0 0 1px rgba(0, 0, 0, .35), 0 1px 2px rgba(0, 0, 0, .4); }
  input[type=range]:active::-webkit-slider-thumb { transform: scale(1.12); }
  input[type=range]:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
  input[type=range]:disabled { opacity: .5; }
  select { font: inherit; color: inherit; background: rgba(255, 255, 255, .08); border: 0; border-radius: 99px; padding: 5px 12px; min-width: 130px; color-scheme: dark; }
  select:disabled { opacity: .5; }
  select option { color: #000; }
  .num { width: 72px; font: inherit; color: inherit; background: rgba(255, 255, 255, .08); border: 0; border-radius: 10px; padding: 5px 10px; user-select: text; }
  .nums { display: flex; gap: 16px; align-items: center; }
  .nums label { display: flex; align-items: center; gap: 6px; }
  .btn.ghost { background: transparent; border: 1px solid var(--line); border-radius: 99px; padding: 5px 9px; display: inline-flex; align-items: center; }
  .btn { border-radius: 99px; padding: 5px 14px; }
  .btn.on { color: #0b0a1a; }
  .map { position: relative; width: 100%; max-width: 360px; border-radius: 8px; background: #2b2a33; border: 1px solid rgba(255, 255, 255, .12); cursor: crosshair; overflow: hidden; touch-action: none; }
  .map .zone { position: absolute; border: 1px dashed rgba(255, 255, 255, .22); border-radius: 4px; pointer-events: none; }
  .map .dot { position: absolute; transform: translate(-50%, -50%); min-width: 6px; min-height: 4px; border-radius: 99px; background: var(--accent); pointer-events: none; box-shadow: 0 0 0 1px rgba(0, 0, 0, .4); }
  .presets { display: flex; flex-wrap: wrap; gap: 12px; padding: 14px 16px; }
  .preset { display: grid; gap: 6px; justify-items: center; border: 0; background: none; color: var(--dim); font: inherit; font-size: 11.5px; cursor: pointer; }
  .preset:hover { color: #fff; }
  .sample { position: relative; width: 64px; height: 40px; border-radius: 10px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
  .sample i { position: absolute; right: 5px; bottom: 5px; width: 12px; height: 12px; border-radius: 50%; }
  .thumb { width: 52px; height: 32px; object-fit: cover; border-radius: 6px; }
  .pick { cursor: pointer; }
  .swatches { display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
  .chip { width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(128, 128, 128, .35); padding: 0; cursor: pointer; }
  .chip.sel { outline: 2px solid #fff; outline-offset: 2px; }
  .swatches input[type='color'] { width: 26px; height: 24px; padding: 0; border: 0; background: none; cursor: pointer; }

  /* Jendela sempit: menu samping hanya ikon; judul grup jadi garis tipis dan pencarian jadi ikon. */
  @media (max-width: 700px) {
    nav { width: 60px; padding: 14px 8px; align-items: stretch; }
    .brand { justify-content: center; padding: 2px 0 10px; }
    .brand div, .tab span { display: none; }
    .search { margin: 0 0 4px; }
    .search input { padding: 0; height: 34px; color: transparent; cursor: pointer; }
    .search input::placeholder { color: transparent; }
    .search input:focus { position: fixed; left: 8px; top: 8px; width: 200px; height: auto; padding: 7px 12px 7px 32px; color: inherit; z-index: 5; background: #24212f; cursor: text; }
    .search input:focus::placeholder { color: var(--dim); }
    .search :global(svg) { left: 50%; margin-left: -7px; z-index: 6; }
    .search:focus-within :global(svg) { left: 20px; margin-left: 0; top: 16px; }
    .grpname { font-size: 0; height: 1px; padding: 0; margin: 10px 8px 6px; background: var(--line); }
    .tab { justify-content: center; padding: 9px 0; }
    .inner { padding: 20px 16px 32px; }
  }
</style>
