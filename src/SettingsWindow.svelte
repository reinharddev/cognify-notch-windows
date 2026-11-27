<script lang="ts">
  import Select from './lib/ui/Select.svelte';
  import Input from './lib/ui/Input.svelte';
  import { features } from './lib/system.svelte';
  import { clipboard } from './lib/shelf.svelte';
  import { cmd, emitPrefs, inTauri, pickFiles } from './lib/bridge';
  import { agenda } from './lib/agenda.svelte';
  import { hotkey, HOTKEYS } from './lib/hotkey.svelte';
  import { L } from './lib/i18n';
  import { checkUpdate, initUpdate, installNow, update } from './lib/update.svelte';
  import { weather } from './lib/weather.svelte';
  import { dock, ICON_MIN, ICON_MAX, MARGIN_MAX, MAX_LINKS, MAX_PRESETS } from './lib/dock.svelte';
  import { MODULE_IDS, MIN_APP_SLOTS, type DockMode, type ModuleId } from './lib/dockLayout';
  import { MODULE_INFO } from './lib/dockModules';
  import { GLASS_OPACITY_MAX, GLASS_OPACITY_MIN, isHex, type DockBg } from './lib/dockStyle';
  import { ui, THEME_PRESETS, CLOSED_MIN, CLOSED_MAX, CLOSED_DEFAULT, CLOSED_H_MIN, CLOSED_H_MAX, CLOSED_H_DEFAULT, EDGE_MARGIN, snapCenter } from './lib/ui.svelte';
  import { pillLimits } from './lib/geometry';
  import { EMOTIONS, MODES, SITUATIONS, emotionLabel, situationLabel } from './lib/companion';
  import { Settings, Palette, MousePointer2, Smile, ToggleRight, ListOrdered, ArrowUp, ArrowDown, RotateCcw, Search, PanelBottom, Layers, X, GripVertical } from '@lucide/svelte';
  import CropPicker from './lib/settings/CropPicker.svelte';
  import PreviewStage from './lib/settings/PreviewStage.svelte';
  import { tick, onMount } from 'svelte';
  import Setting from './lib/settings/Setting.svelte';
  import Group from './lib/settings/Group.svelte';
  import Segmented from './lib/settings/Segmented.svelte';
  import ColorPicker from './lib/settings/ColorPicker.svelte';
  import SkinsPane from './lib/settings/SkinsPane.svelte';

  type PaneId = 'general' | 'appearance' | 'behavior' | 'companion' | 'features' | 'skins' | 'dock' | 'tabs';
  const panes: { id: PaneId; label: () => string; desc: () => string; icon: typeof Settings }[] = [
    { id: 'general', icon: Settings, label: () => L('Umum', 'General'), desc: () => L('Buka otomatis, pintasan, pembaruan, dan cadangan.', 'Startup, shortcut, updates, and your data.') },
    { id: 'appearance', icon: Palette, label: () => L('Tampilan', 'Appearance'), desc: () => L('Bentuk, ukuran, dan warna notch.', 'The notch\'s shape, size, and colors.') },
    { id: 'behavior', icon: MousePointer2, label: () => L('Perilaku', 'Behavior'), desc: () => L('Cara notch dibuka dan ditutup, plus layar yang dipakai.', 'How the notch opens and closes, and which screen it\'s on.') },
    { id: 'companion', icon: Smile, label: () => L('CogniFace', 'CogniFace'), desc: () => L('Wajah di notch: ekspresi, kedipan, dan reaksinya.', 'The face in the notch: expressions, blinking, and reactions.') },
    { id: 'features', icon: ToggleRight, label: () => L('Fitur', 'Features'), desc: () => L('Pilih fitur yang mau kamu pakai di notch.', 'Pick the features you want in your notch.') },
    { id: 'skins', icon: Layers, label: () => L('Widget desktop', 'Desktop widgets'), desc: () => L('Widget desktop ala Rainmeter: CogniFace, lirik, dan lainnya.', 'Rainmeter-style widgets for your desktop: CogniFace, lyrics, and more.') },
    { id: 'dock', icon: PanelBottom, label: () => L('Dock & taskbar', 'Dock & taskbar'), desc: () => L('Beta. Taskbar sendiri di bawah layar: aplikasi, jam, dan tombol cepat.', 'Beta. Your own taskbar along the bottom: apps, clock, and quick buttons.') },
    { id: 'tabs', icon: ListOrdered, label: () => L('Tab', 'Tabs'), desc: () => L('Susun urutan halaman di notch.', 'Put the notch pages in the order you like.') },
  ];

  const order: PaneId[] = ['general', 'appearance', 'companion', 'behavior', 'features', 'tabs', 'skins', 'dock'];
  const sidebar = order.map((id) => panes.find((p) => p.id === id)!);
  let pane = $state<PaneId>('appearance');
  let query = $state('');
  let found = $state(0);
  let innerEl: HTMLDivElement | undefined = $state();
  const searching = $derived(query.trim().length > 0);
  const show = (id: PaneId) => (searching ? id !== 'tabs' : pane === id);

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
    ['media', L('Lagu & video yang diputar', 'Now playing'), L('Lagu yang diputar muncul di sisi notch.', 'See what\'s playing on the sides of the notch.')],
    ['spectrum', L('Equalizer ikut suara', 'Equalizer moves with the sound'), L('Suaranya cuma dipakai buat tinggi batang, tidak direkam.', 'Sound only moves the bars. Nothing is recorded.')],
    ['camera', L('Kamera', 'Camera'), L('Kamera cuma nyala selama tab Kamera dibuka.', 'The camera is only on while the Camera tab is open.')],
    ['micTest', L('Tes mic', 'Test mic'), L('Cek mikrofon di halaman Camera & Mic. Tidak ada yang disimpan.', 'Check your microphone on the Camera & Mic page. Nothing is saved.')],
    ['shortcuts', L('Pintasan', 'Shortcuts'), L('Buka app, folder, atau tautan sekali klik.', 'Open apps, folders, or links in one click.')],
    ['clipboard', L('Riwayat clipboard', 'Clipboard history'), L('Cuma disimpan di PC ini.', 'Stays on this PC.')],
    ['hud', L('Volume & kecerahan', 'Volume & brightness'), L('Perubahannya muncul di notch.', 'See changes right in the notch.')],
    ['charger', L('Baterai & charger', 'Battery & charger'), L('Kabar saat charger dicolok atau dicabut, dan baterai tinggal 20% atau 10%.', 'A heads-up when you plug in or unplug, and at 20% and 10% battery.')],
    ['devices', L('Headphone & perangkat suara', 'Headphones & sound devices'), L('Nama perangkat muncul saat output suara pindah.', 'Shows the device name when sound switches to it.')],
    ['downloads', L('Progres unduhan', 'Download progress'), L('Pantau file yang lagi diunduh ke folder Unduhan.', 'Keep an eye on files downloading to your Downloads folder.')],
    ['lyrics', L('Lirik lagu', 'Synced lyrics'), L('Butuh internet: judul, artis, dan durasi lagu dikirim ke LRCLIB (lrclib.net) saat halaman Musik dibuka.', 'Needs internet: the song\'s title, artist and length go to LRCLIB (lrclib.net) when you open the Music page.')],
    ['water', L('Pengingat minum', 'Water reminder'), L('Target harian, grafik per jam, dan diingatkan selama jam aktifmu.', 'A daily goal, an hourly chart, and reminders during your active hours.')],
    ['todo', L('Daftar tugas', 'To-do list'), L('Tugas lengkap dengan pengingat; tulis "jam 7" buat atur waktunya.', 'Tasks with reminders. Type "at 7pm" to set the time.')],
    ['companion', L('Ekspresi CogniFace di notch', 'CogniFace expressions in the notch'), L('CogniFace bisa berkedip, ketiduran, dan ganti ekspresi sesuai suasana. Atur di bawah.', 'CogniFace blinks, dozes off, and reacts to what\'s happening. Tweak it below.')],
    ['keys', L('Caps Lock & bahasa keyboard', 'Caps Lock & keyboard language'), L('Kasih tahu sebentar saat Caps Lock nyala atau bahasa keyboard ganti.', 'A quick heads-up when Caps Lock is on or the keyboard language changes.')],
    ['network', L('Internet putus & nyambung', 'Connection changes'), L('Kasih tahu saat internet putus atau balik lagi.', 'A heads-up when you go offline or get back online.')],
    ['hideFullscreen', L('Ngumpet saat layar penuh', 'Hide in full screen'), L('Notch minggir kalau video, game, atau presentasi lagi layar penuh.', 'Gets out of the way during full-screen videos, games and presentations.')],
    ['lyricsWing', L('Lirik di notch tertutup', 'Lyrics in the closed notch'), L('Baris yang lagi dinyanyikan muncul di sisi kiri notch selama lagu diputar.', 'The current line shows next to the notch while music plays.')],
    ['clockTools', L('Stopwatch & hitung mundur', 'Stopwatch & countdowns'), L('Halaman stopwatch lengkap dengan lap dan beberapa hitung mundur sekaligus.', 'A stopwatch with laps, plus several countdowns at once.')],
    ['calculator', L('Kalkulator di catatan cepat', 'Calculator in quick note'), L('Ketik 12*3, 15% dari 200, atau 5 km ke mil; hasilnya langsung keluar.', 'Type 12*3, 15% of 200, or 5 km to mi and get the answer right away.')],
    ['weather', L('Cuaca di header', 'Weather in the header'), L('Butuh internet dan nama kota (di bawah): nama kota dikirim ke Open-Meteo tiap 30 menit.', 'Needs internet and a city (below): the city goes to Open-Meteo every 30 minutes.')],
    ['hotkey', L('Buka pakai pintasan keyboard', 'Open with a keyboard shortcut'), L('Tutup lagi dengan Esc atau klik di luar notch.', 'Press Esc or click outside to close it.')],
    ['updates', L('Cek versi baru tiap hari', 'Check for new versions daily'), ''],
    ['autoInstall', L('Pasang pembaruan otomatis', 'Install updates automatically'), L('Dipasang saat notch lagi nganggur.', 'Installs while the notch is idle.')],
  ] as const;

  const setUi = () => { ui.persist(); ui.applyAccent(); void emitPrefs('ui'); };
  const setDock = () => { dock.persist(); void emitPrefs('dock'); };
  const restoreTaskbar = async () => { await cmd('taskbar_hide', { hidden: false }); dock.hideTaskbar = false; setDock(); };
  // Lebar layar tempat dock tampil (piksel CSS). Dock hanya satu baris dan tidak boleh melewatinya.
  const screenW = window.screen.availWidth;
  const dockUse = $derived(dock.usage(screenW));
  const addable = $derived(MODULE_IDS.filter((id) => !dock.layout.includes(id)));
  /** Fitur lain yang dibutuhkan modul dock, bila belum menyala; null bila siap dipakai. */
  function dockNeed(id: string): string | null {
    if (id === 'media' && !features.media) return L('Nyalakan dulu "Lagu & video yang diputar" di Fitur.', 'First turn on "Now playing" in Features.');
    if (id === 'lyrics' && !features.lyrics) return L('Nyalakan dulu Lirik di Fitur.', 'First turn on Lyrics in Features.');
    if (id === 'weather' && !features.weather) return L('Nyalakan dulu Cuaca di Fitur, lalu isi kotanya.', 'First turn on Weather in Features, then set a city there.');
    if (id === 'clipboard' && !features.clipboard) return L('Nyalakan dulu Clipboard di Fitur.', 'First turn on Clipboard in Features.');
    return null;
  }
  // Modul yang sudah tersimpan tetapi tidak muat di layar ini (layar lebih kecil, ikon dibesarkan): tidak digambar, tapi tidak dihapus.
  const overflowing = $derived(new Set(dock.layout.filter((id) => !dock.shown(screenW).includes(id))));
  let newPreset = $state('');
  let presetError = $state('');
  let linkLabel = $state('');
  let linkUrl = $state('');
  let linkError = $state('');
  const addPreset = () => {
    const m = Number(newPreset);
    if (!dock.addPreset(m)) presetError = dock.presets.length >= MAX_PRESETS ? L(`Maksimal ${MAX_PRESETS} tombol.`, `Up to ${MAX_PRESETS} buttons.`) : L('Isi angka 1 sampai 180 yang belum ada.', 'Enter a new number from 1 to 180.');
    else { presetError = ''; newPreset = ''; changeDockShape(); }
  };
  const addLink = () => {
    const r = dock.addLink(linkLabel, linkUrl);
    if (r === 'invalid') linkError = L('Alamatnya tidak valid. Pakai alamat situs, mis. youtube.com.', 'That address doesn\'t work. Use a website, e.g. youtube.com.');
    else if (r === 'full') linkError = L(`Maksimal ${MAX_LINKS} tautan.`, `Up to ${MAX_LINKS} links.`);
    else { linkError = ''; linkLabel = ''; linkUrl = ''; changeDockShape(); }
  };
  /** Setelah ukuran atau jumlah tombol berubah: pastikan susunan masih muat di layar, lalu simpan dan beri tahu dock. */
  const changeDockShape = () => { dock.refit(screenW); setDock(); };
  const needs = (id: ModuleId) => dock.layout.includes(id);
  const BG_SWATCH = ['#000000', '#1b1b26', '#14213d', '#2d1b3d', '#1b3b2f', '#3a1c71', '#7c2d3f', '#f5f5f7'];
  const setBgColor = (key: 'bgColor' | 'bgColor2', v: string) => { if (isHex(v)) { dock.style[key] = v; setDock(); } };
  ui.applyAccent();
  let backupMsg = $state('');
  let confirmImport = $state<string | null>(null);

  // Cadangan data seperti di Mac: catatan, tugas, riwayat minum, clipboard (teks), timer, pengaturan, dan pilihan fitur.
  const BACKUP_KEYS = ['notes', 'todo', 'water', 'clip', 'timer', 'countdowns', 'features', 'hotkey', 'city', 'shortcuts'];
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
    backupMsg = L('Cadangan sudah disimpan.', 'Backup saved.');
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
      backupMsg = L('File ini bukan cadangan Cognify Notch', "That's not a Cognify Notch backup");
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
    ui.pillX = snapCenter((e.clientX - r.left) / r.width, sw);
    ui.pillY = (e.clientY - r.top) / r.height;
    clampPill();
    setUi();
  };
  const setStyle = (id: 'notch' | 'pill' | 'face') => {
    ui.style = id === 'notch' ? 'notch' : 'pill';
    if (id !== 'notch') { ui.face = id === 'face'; ui.autoHide = false; } // yang mengambang tidak bisa disembunyikan di tepi
    clampPill(); setUi();
  };
  const chosenStyle = $derived(ui.style === 'notch' ? 'notch' : ui.face ? 'face' : 'pill');
  const resetPill = () => { ui.pillX = 0.5; ui.pillY = 0; clampPill(); setUi(); };
  const STYLES = [
    { id: 'notch', label: () => L('Notch', 'Notch'), hint: () => L('Menempel di tepi atas', 'Attached to the top edge') },
    { id: 'pill', label: () => L('Kapsul melayang', 'Floating pill'), hint: () => L('Bisa dipindah ke mana saja', 'Move it anywhere') },
    { id: 'face', label: () => L('Wajah melayang', 'Floating face'), hint: () => L('CogniFace bulat saat diam', 'A round CogniFace when idle') },
  ] as const;
  const presetId = $derived(THEME_PRESETS.find((p) => p.accent === ui.accentColor && p.mode === ui.bgMode)?.id ?? '');
  let dragTab = $state('');
  function dragOver(e: PointerEvent) {
    if (!dragTab) return;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-tab]')?.dataset.tab;
    if (!over || over === dragTab) return;
    const ids = ui.allOrdered.map((p) => p.id as string);
    const by = ids.indexOf(over) - ids.indexOf(dragTab);
    for (let i = 0; i < Math.abs(by); i++) ui.move(dragTab, Math.sign(by));
    setUi();
  }
  const curPane = $derived(panes.find((p) => p.id === pane)!);
  const allOff = (keys: (keyof typeof features)[]) => { for (const k of keys) (features as unknown as Record<string, boolean>)[k] = false; features.persist(); void emitPrefs('features'); };
  // Paket tema dan latar panel
  let bgError = $state('');
  const applyPreset = (p: (typeof THEME_PRESETS)[number]) => { ui.accentColor = p.accent; ui.bgMode = p.mode; ui.bgColor = p.c1; ui.bgColor2 = p.c2; ui.bgAngle = p.angle; setUi(); };
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
      if (localStorage.getItem('cn.ui.bgImage') === null) bgError = L('Gambarnya kebesaran. Coba yang lebih kecil.', 'That image is too big. Try a smaller one.');
    } catch {
      bgError = L('Gambar ini tidak bisa dibuka.', 'Couldn\'t open that image.');
    }
  }
  // Latar jendela Pengaturan mengikuti tema yang dipilih (warna, gradien, atau gambar); hitam bawaan memakai latar ungu lama.
  const themed = $derived(ui.bgMode !== 'none' && !!ui.bgCss && (ui.bgMode !== 'image' || ui.bgSettings));
  const themedBg = $derived(ui.bgMode === 'image' ? ui.imageCss(window.innerWidth / Math.max(1, window.innerHeight)) : (ui.bgCss?.background ?? ''));
  const SWATCH = ['#8f87ff', '#0a84ff', '#30d158', '#ff375f', '#ff9f0a', '#ffd60a', '#bf5af2', '#ffffff'];
  const LYRIC_SWATCH = ['#ffffff', '#ffd60a', '#30d158', '#0a84ff', '#ff375f', '#ff9f0a', '#bf5af2', '#8e8e93'];
  const EQ_SWATCH = ['#ffffff', '#30d158', '#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#ffd60a'];
  const NEED_COMPANION = () => L('Nyalakan dulu Ekspresi CogniFace.', 'Turn on CogniFace expressions first.');
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
    <ColorPicker value={current || fallback} label={L('Warna sendiri', 'Custom color')} onchange={set} />
    <button class="btn ghost" disabled={!current} onclick={() => set('')}>{L('Bawaan', 'Default')}</button>
  </span>
{/snippet}

<svelte:window onpointermove={dragOver} onpointerup={() => (dragTab = '')} onpointercancel={() => (dragTab = '')} />

<div class="shell" style:--accent={ui.accentColor || undefined}>
  {#if themed}
    <div class="tbg" aria-hidden="true" style:background={themedBg} style:filter={ui.bgMode === 'image' && ui.bgBlur > 0 ? `blur(${ui.bgBlur * 16}px)` : undefined} style:inset={ui.bgMode === 'image' && ui.bgBlur > 0 ? '-24px' : '0'}></div>
    <div class="tdim" aria-hidden="true" style:opacity={ui.bgMode === 'color' ? 0 : Math.max(ui.bgDim, 0.45)}></div>
  {/if}
  <nav aria-label={L('Bagian pengaturan', 'Settings sections')}>
    <div class="brand"><i class="mark"></i><div><h1>{L('Pengaturan', 'Settings')}</h1><span class="ver">Cognify Notch {update.current}</span></div></div>
    <label class="search"><Search size={14} /><Input type="search" bind:value={query} placeholder={L('Cari pengaturan', 'Search settings')} aria-label={L('Cari pengaturan', 'Search settings')} autocomplete="off" /></label>
    {#each sidebar as p}
      <button class="tab" class:sel={!searching && pane === p.id} aria-current={!searching && pane === p.id ? 'page' : undefined} title={p.label()} onclick={() => { query = ''; pane = p.id; innerEl?.parentElement?.scrollTo(0, 0); }}>
        <p.icon size={15} /><span>{p.label()}</span>
      </button>
    {/each}
  </nav>

  <main class="pane">
   <div class="inner" bind:this={innerEl} oninput={paintRanges} role="presentation">
    <header class="head">
      <h2>{searching ? L('Hasil pencarian', 'Search results') : curPane.label()}</h2>
      <p>{searching ? L(`${found} pengaturan`, `${found} settings`) : curPane.desc()}</p>
    </header>
    {#if searching && found === 0}<p class="empty">{L('Tidak ada pengaturan yang cocok.', 'No matching settings.')}</p>{/if}

  {#if show('general')}
    {#if inTauri}
    <Group title={L('Umum', 'General')}>
        <Setting toggle title={L('Buka saat Windows dinyalakan', 'Open when Windows starts')} bind:checked={autostart} onchange={() => void cmd('autostart_set', { on: autostart })} />
    </Group>
    {/if}

    <Group title={L('Pembaruan', 'Updates')}>
      {@render tog('updates')}
      {@render tog('autoInstall', { sub: true, disabled: !features.updates, why: L('Nyalakan dulu cek versi.', 'Turn on the version check first.') })}
      <Setting title={L('Versi terpasang', 'Installed version')} desc={update.text || `Cognify Notch ${update.current}`}>
        <button class="btn" onclick={() => checkUpdate()}>{L('Cek pembaruan', 'Check for updates')}</button>
        {#if update.selfUpdate && (update.stage === 'found' || update.stage === 'ready')}<button class="btn on" onclick={installNow}>{L('Perbarui dan mulai ulang', 'Update and restart')}</button>{/if}
        {#if !update.selfUpdate && update.url}<button class="btn on" onclick={() => cmd('open_target', { target: update.url })}>{L('Buka halaman unduh', 'Open download page')}</button>{/if}
      </Setting>
    </Group>

  {#if inTauri}
    <Group title={L('Data', 'Data')} hint={L('Catatan, tugas, riwayat minum, clipboard, timer, dan pengaturan.', 'Notes, tasks, water log, clipboard, timers and settings.')}>
      <Setting title={L('Ekspor', 'Export')} desc={L('Simpan semuanya jadi satu berkas JSON.', 'Save everything into one JSON file.')}><button class="btn" onclick={exportData}>{L('Ekspor…', 'Export…')}</button></Setting>
      <Setting title={L('Impor', 'Import')} desc={L('Pulihkan dari file cadangan.', 'Restore from a backup file.')}><button class="btn" onclick={pickImport}>{L('Impor…', 'Import…')}</button></Setting>
      {#if features.clipboard}
        <Setting title={L('Batas riwayat clipboard', 'Clipboard history limit')} desc={L('Bawaannya tanpa batas. Item tersemat tidak dihitung; gambar cuma ada selama app berjalan.', 'No limit by default. Pinned items don\'t count, and images only last while the app is running.')}>
          <Select value={features.unlimitedClipboard ? 'unlimited' : 'custom'} onchange={(v) => setClipboardUnlimited(v === 'unlimited')} label={L('Batas riwayat clipboard', 'Clipboard history limit')}
            options={[{ value: 'unlimited', label: L('Tanpa batas', 'Unlimited') }, { value: 'custom', label: L('Kustom', 'Custom') }]} />
        </Setting>
        {#if !features.unlimitedClipboard}
          <Setting title={L('Jumlah item', 'Item count')} desc={L('Item yang disematkan tetap disimpan.', 'Pinned items are kept.')}>
            <Input width="90px" type="number" min="1" max="100000" step="1" value={features.clipboardLimit} onchange={(e) => setClipboardLimit(e.currentTarget.value)} aria-label={L('Jumlah item riwayat clipboard', 'Clipboard history item count')} />
          </Setting>
        {/if}
      {/if}
    </Group>
    {#if confirmImport}
      <div class="warn" role="alertdialog">
        <p>{L('Timpa data di PC ini dengan isi cadangan? Catatan, tugas, riwayat minum, clipboard, timer, dan pengaturan yang sekarang bakal diganti. Setelah itu Cognify Notch dimuat ulang.', "Replace the data on this PC with this backup? Your current notes, tasks, water log, clipboard, timers and settings will be replaced, then Cognify Notch reloads.")}</p>
        <div class="row"><button class="btn on" onclick={doImport}>{L('Ganti', 'Replace')}</button><button class="btn" onclick={() => (confirmImport = null)}>{L('Batal', 'Cancel')}</button></div>
      </div>
    {/if}
    {#if backupMsg}<p class="foot">{backupMsg}</p>{/if}
  {/if}
  {/if}
  {#if show('appearance')}
    <section class="grp">
      <h3 class="lbl">{L('Gaya', 'Style')}</h3>
      <div class="set choose" role="radiogroup" aria-label={L('Bentuk notch', 'Notch shape')}>
        <span class="sr">{L('Bentuk notch', 'Notch shape')}</span>
        {#each STYLES as st (st.id)}
          <button type="button" role="radio" aria-checked={chosenStyle === st.id} class:sel={chosenStyle === st.id} onclick={() => setStyle(st.id)}>
            <span class="desk" class:float={st.id !== 'notch'} class:round={st.id === 'face'}><i><b></b><b></b></i></span>
            <strong>{st.label()}</strong><small>{st.hint()}</small>
          </button>
        {/each}
      </div>
    </section>
    {#if !searching}<PreviewStage height={104} />{/if}
    {#if ui.style === 'pill'}
      <Group title={L('Posisi', 'Position')} hint={L('Geser penandanya, atau tahan Alt lalu seret kapsul di layar. Menempel ke tengah bila sudah dekat.', 'Drag the marker, or hold Alt and drag the capsule on screen. It snaps to the center.')}>
        <div class="set mapwrap">
          <span class="sr">{L('Posisi kapsul', 'Capsule position')}</span>
          <div class="map" bind:this={mapEl} style:aspect-ratio="{sw} / {sh}" role="presentation"
            onpointerdown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); dragPill(e); }} onpointermove={dragPill}>
            <i class="menubar"></i>
            <i class="axis" class:on={ui.pillX === 0.5}></i>
            <i class="dot" style:left="clamp(18px, {ui.pillX * 100}%, calc(100% - 18px))" style:top="clamp(7px, {ui.pillY * 100}%, calc(100% - 7px))"></i>
          </div>
        </div>
        <Setting title={L('Kembali ke atas tengah', 'Back to top center')}>
          <button class="btn" onclick={resetPill} disabled={ui.pillX === 0.5 && ui.pillY <= lim.minY}>{L('Atur ulang', 'Reset')}</button>
        </Setting>
      </Group>
    {/if}

    <Group title={L('Tema', 'Theme')}>
      <Setting title={L('Paket tema', 'Theme pack')}>
        <Select value={presetId} onchange={(v) => { const p = THEME_PRESETS.find((x) => x.id === v); if (p) applyPreset(p); }} label={L('Paket tema', 'Theme pack')}
          options={[{ value: '', label: L('Pilih paket', 'Choose a pack') }, ...THEME_PRESETS.map((p) => ({ value: p.id, label: p.name() }))]} />
      </Setting>
    </Group>

    <Group title={L('Latar panel', 'Panel background')} hint={ui.idleThemed
      ? L('Latar tampil di notch diam, panel terbuka, dan kapsul melayang. Mode Gambar memakai gambarmu di notch diam. Gambarnya diperkecil dan cuma disimpan di app ini.', 'The background shows on the idle notch, the open panel, and the floating capsule. Image mode uses your picture on the idle notch. The image is shrunk and stays inside this app.')
      : L('Notch tertutup yang menempel di atas tetap hitam; latar tampil di panel terbuka dan kapsul melayang. Gambarnya diperkecil dan cuma disimpan di app ini.', 'The attached notch stays black when closed. The background shows on the open panel and the floating capsule. The image is shrunk and stays inside this app.')}>
      <Setting title={L('Latar', 'Background')}>
        <Segmented label={L('Latar', 'Background')} value={ui.bgMode} onchange={(v) => { ui.bgMode = v; setUi(); }}
          options={[{ value: 'none', label: L('Hitam', 'Black') }, { value: 'color', label: L('Warna', 'Color') }, { value: 'gradient', label: L('Gradien', 'Gradient') }, { value: 'image', label: L('Gambar', 'Image') }]} />
      </Setting>
      {#if ui.bgMode !== 'none'}
        <Setting toggle title={L('Notch diam ikut latar', 'Idle notch follows the background')} desc={L('Notch tertutup pakai warna, gradien, atau gambar yang sama. Kalau dimatikan, notch tertutup tetap hitam.', 'The closed notch uses the same color, gradient, or image. When off, it stays black.')} bind:checked={ui.idleThemed} onchange={setUi} />
      {/if}
      {#if ui.bgMode === 'color' || ui.bgMode === 'gradient'}
        <Setting title={ui.bgMode === 'gradient' ? L('Warna awal', 'Start color') : L('Warna', 'Color')}>
          <ColorPicker value={ui.bgColor} label={L('Warna', 'Color')} onchange={(v) => { ui.bgColor = v; setUi(); }} />
        </Setting>
      {/if}
      {#if ui.bgMode === 'gradient'}
        <Setting title={L('Warna akhir', 'End color')}>
          <ColorPicker value={ui.bgColor2} label={L('Warna akhir', 'End color')} onchange={(v) => { ui.bgColor2 = v; setUi(); }} />
        </Setting>
        <Setting title={L('Arah', 'Direction')}>
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
        <Setting toggle title={L('Pakai juga di Pengaturan', 'Also use in Settings')} desc={L('Gambar ini jadi latar jendela Pengaturan juga.', 'Use this image behind the Settings window too.')} bind:checked={ui.bgSettings} onchange={setUi} />
        <Setting title={L('Buram', 'Blur')}>
          <div class="slider"><input type="range" min="0" max="1" step="0.05" bind:value={ui.bgBlur} oninput={setUi} aria-label={L('Buram', 'Blur')} /><span class="val">{Math.round(ui.bgBlur * 100)}%</span></div>
        </Setting>
      {/if}
      {#if ui.bgMode === 'image' || ui.bgMode === 'gradient'}
        <Setting title={L('Peredam gelap', 'Dim')} desc={L('Biar tulisan tetap terbaca di atas gambar atau warna terang.', 'Keeps text readable over bright images or colors.')}>
          <div class="slider"><input type="range" min="0" max="0.8" step="0.05" bind:value={ui.bgDim} oninput={setUi} aria-label={L('Peredam gelap', 'Dim')} /><span class="val">{Math.round(ui.bgDim * 100)}%</span></div>
        </Setting>
      {/if}
    </Group>

    <Group title={L('Bentuk dan ukuran', 'Shape and size')}>
      {#if ui.style === 'pill'}
        <Setting title={L('Lebar kapsul saat tertutup', 'Closed capsule width')}>
          <div class="slider"><input type="range" min={CLOSED_MIN} max={CLOSED_MAX} step="2" bind:value={ui.pillWidth} oninput={() => { clampPill(); setUi(); }} aria-label={L('Lebar kapsul', 'Capsule width')} /><span class="val">{ui.pillWidth} px</span></div>
        </Setting>
      {:else}
        <Setting title={L('Lebar notch saat tertutup', 'Closed notch width')} desc={L('Kalau lebih sempit, tab browser tidak ketutupan. Ukuran panel terbuka tidak berubah.', 'A narrower notch won\'t cover browser tabs. The open panel stays the same.')}>
          <div class="slider"><input id="w" type="range" min={CLOSED_MIN} max={CLOSED_MAX} step="2" bind:value={ui.closedWidth} oninput={setWidth} aria-label={L('Lebar notch', 'Notch width')} /><span class="val">{ui.closedWidth} px</span>
            <button class="btn ghost" onclick={resetWidth} disabled={ui.closedWidth === CLOSED_DEFAULT} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
        </Setting>
        <Setting title={L('Tinggi notch saat tertutup', 'Closed notch height')} desc={L('Lebar dan tinggi diatur sendiri-sendiri, seperti ukuran notch di Mac.', 'Set width and height separately, just like on the Mac.')}>
          <div class="slider"><input type="range" min={CLOSED_H_MIN} max={CLOSED_H_MAX} step="1" bind:value={ui.closedHeight} oninput={setWidth} aria-label={L('Tinggi notch', 'Notch height')} /><span class="val">{ui.closedHeight} px</span>
            <button class="btn ghost" onclick={resetHeight} disabled={ui.closedHeight === CLOSED_H_DEFAULT} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
        </Setting>
      {/if}
      <Setting title={L('Ukuran panel', 'Panel size')} desc={L('Geser buat mengecilkan atau membesarkan panel.', 'Drag to make the open panel smaller or bigger.')}>
        <div class="slider"><input type="range" min="70" max="150" step="5" value={Math.round(ui.scale * 100)} oninput={(e) => { ui.scale = Number(e.currentTarget.value) / 100; setUi(); }} aria-label={L('Ukuran panel', 'Panel size')} /><span class="val">{Math.round(ui.scale * 100)}%</span>
          <button class="btn ghost" onclick={() => { ui.scale = 1; setUi(); }} disabled={Math.round(ui.scale * 100) === 100} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
      </Setting>
      <Setting title={L('Lengkung sudut bawah', 'Bottom corner roundness')}>
        <div class="slider"><input type="range" min="0" max="48" step="1" bind:value={ui.roundness} oninput={setUi} aria-label={L('Lengkung sudut bawah', 'Bottom corner roundness')} /><span class="val">{ui.roundness} px</span>
          <button class="btn ghost" onclick={() => { ui.roundness = 30; setUi(); }} disabled={ui.roundness === 30} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
      </Setting>
      <Setting title={L('Warna aksen', 'Accent color')}>
        {@render swatches(SWATCH, ui.accentColor, (c) => { ui.accentColor = c === '#8f87ff' ? '' : c; setUi(); }, '#8f87ff')}
      </Setting>
    </Group>

    <Group title={L('Lirik dan equalizer', 'Lyrics and equalizer')}>
      <Setting toggle title={L('Warna equalizer dari sampul', 'Equalizer color from the album cover')} bind:checked={ui.equalizerAuto} onchange={setUi} />
      {#if !ui.equalizerAuto}
        <Setting title={L('Warna equalizer', 'Equalizer color')}>
          {@render swatches(EQ_SWATCH, ui.equalizerColor, (c) => { ui.equalizerColor = c; setUi(); }, '#8f87ff')}
        </Setting>
      {/if}
      <Setting toggle title={L('Warna lirik dari sampul', 'Lyric colors from the album cover')} disabled={!features.lyrics}
        why={L('Nyalakan dulu Lirik lagu di Fitur.', 'First turn on Synced lyrics in Features.')} bind:checked={ui.lyricAuto} onchange={setUi} />
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
          options={[{ value: false, label: L('Arahkan', 'Hover') }, { value: true, label: L('Klik', 'Click') }]} />
      </Setting>
      <Setting title={L('Jeda sebelum terbuka', 'Delay before opening')} disabled={ui.openOnClick} why={L('Tidak berlaku kalau notch dibuka dengan klik.', 'Doesn\'t apply when you open the notch by clicking.')}>
        <div class="slider"><input type="range" min="0" max="600" step="50" bind:value={ui.hoverDelay} oninput={setUi} aria-label={L('Jeda sebelum terbuka', 'Delay before opening')} disabled={ui.openOnClick} /><span class="val">{ui.hoverDelay} ms</span></div>
      </Setting>
      <Setting title={L('Jeda sebelum menutup', 'Delay before closing')}>
        <div class="slider"><input type="range" min="100" max="1500" step="50" bind:value={ui.closeDelay} oninput={setUi} aria-label={L('Jeda sebelum menutup', 'Delay before closing')} /><span class="val">{ui.closeDelay} ms</span></div>
      </Setting>
      <Setting toggle title={L('Sembunyikan otomatis di tepi layar', 'Auto-hide at the screen edge')}
        desc={L('Notch ngumpet kalau tidak dipakai, lalu muncul lagi saat kursor menyentuh tepi layar di dekatnya. Pengingat tetap muncul sendiri.', 'The notch tucks away when idle and slides back when your cursor touches the edge near it. Reminders still pop up on their own.')}
        disabled={ui.style === 'pill'} why={L('Tidak bisa dipakai buat Kapsul karena ia melayang, tidak menempel di tepi. Pilih Notch (menempel) kalau mau memakainya.', 'Not for Capsule, since it floats instead of sitting on an edge. Choose Notch (attached) to use this.')}
        bind:checked={ui.autoHide} onchange={setUi} />
    </Group>
    {#if inTauri}
      <Group title={L('Layar', 'Screen')}>
        <Setting title={L('Tampil di', 'Show on')}>
          <Segmented label={L('Tampil di', 'Show on')} value={ui.display} onchange={(v) => { ui.display = v; setUi(); void cmd('set_display', { mode: v }); }}
            options={[{ value: 'main', label: L('Layar utama', 'Main screen') }, { value: 'active', label: L('Layar yang dipakai', 'Screen in use') }]} />
        </Setting>
      </Group>
    {/if}

    <Group title={L('Pintasan keyboard', 'Keyboard shortcut')} hint={L('Tutup dengan Esc atau klik di luar notch. Notch juga bisa disembunyikan atau dimunculkan lewat ikon Cognify Notch di ikon tersembunyi taskbar (klik kiri).', 'Press Esc or click outside to close the notch. You can also hide or show it by left-clicking the Cognify Notch icon among the taskbar\'s hidden icons.')}>
      <Setting toggle title={L('Buka pakai pintasan keyboard', 'Open with a keyboard shortcut')} bind:checked={features.hotkey} onchange={() => changedFeature('hotkey')} />
      {#if inTauri}
        <Setting sub title={L('Kombinasi tombol', 'Key combination')} disabled={!features.hotkey} why={L('Nyalakan dulu pintasan di atas.', 'Turn on the shortcut above first.')}>
          <Select value={hotkey.choice} onchange={(v) => { hotkey.choice = v; hotkey.apply(); void emitPrefs('hotkey'); }} label={L('Kombinasi tombol', 'Key combination')}
            options={HOTKEYS.filter((h) => h[0] !== 'off').map(([value, label]) => ({ value, label }))} />
        </Setting>
      {/if}
    </Group>

  {/if}
  {#if show('companion')}
    {#if !searching}<PreviewStage height={110} />{/if}
    <Group>
      {@render tog('companion')}
    </Group>
    <Group title={L('Gerak', 'Movement')} hint={L('Ikut kursor sedikit lebih boros daya karena arah pandangnya harus dihitung.', 'Following the cursor uses a bit more power, since it has to keep working out where to look.')}>
      <Setting toggle title={L('Menoleh ke kursor', 'Turn toward the cursor')} disabled={!features.companion} why={NEED_COMPANION()} checked={ui.eyesMode === 'follow'} onchange={(v) => setEyes(v ? 'follow' : 'blink')} />
      <Setting toggle title={L('Sesekali berkedip', 'Blink now and then')} disabled={!features.companion} why={NEED_COMPANION()} bind:checked={ui.companionBlink} onchange={setUi} />
    </Group>
    <Group title={L('Ekspresi', 'Expression')} hint={MODES.find((m) => m.id === ui.companionMode)?.hint()}>
      <Setting title={L('Cara kerja', 'How it works')} disabled={!features.companion} why={NEED_COMPANION()}>
        <Segmented label={L('Cara kerja', 'How it works')} value={ui.companionMode} onchange={(v) => { ui.companionMode = v; setUi(); }} disabled={!features.companion}
          options={MODES.map((m) => ({ value: m.id, label: m.label() }))} />
      </Setting>
      {#if ui.companionMode === 'fixed'}
        <Setting title={L('Ekspresi tetap', 'Fixed expression')} disabled={!features.companion} why={NEED_COMPANION()}>
          <Select value={ui.companionFixed} onchange={(v) => { ui.companionFixed = v; setUi(); }} disabled={!features.companion} label={L('Ekspresi tetap', 'Fixed expression')}
            options={EMOTIONS.map((e) => ({ value: e, label: emotionLabel(e) }))} />
        </Setting>
      {/if}
    </Group>
    {#if ui.companionMode === 'custom'}
      {#each [false, true] as ev}
        <Group title={ev ? L('Momen', 'Moments') : L('Situasi', 'Situations')}>
          {#each SITUATIONS.filter((x) => x.event === ev) as sit}
            <Setting title={situationLabel(sit)} disabled={!features.companion} why={NEED_COMPANION()}>
              <Select value={ui.companionMap[sit.id] ?? 'auto'} onchange={(v) => setChoice(sit.id, v)} disabled={!features.companion} label={situationLabel(sit)} width="220px"
                options={[
                  { value: 'auto', label: `${L('Bawaan', 'Default')} (${emotionLabel(sit.emotion)})` },
                  ...(sit.event ? [{ value: 'none', label: L('Tidak bereaksi', 'No reaction') }] : []),
                  ...EMOTIONS.map((e) => ({ value: e as string, label: emotionLabel(e) })),
                ]} />
            </Setting>
          {/each}
        </Group>
      {/each}
      <p class="foot">{L('Perubahannya langsung kelihatan di notch.', 'Changes show up in the notch right away.')}
        <button class="btn ghost" onclick={() => { ui.companionMap = {}; setUi(); }} disabled={Object.keys(ui.companionMap).length === 0}>{L('Kembalikan ke bawaan', 'Reset to default')}</button></p>
    {/if}

  {/if}
  {#if show('features')}
    <div class="two">
     <div>
    <Group title={L('Media', 'Media')} action={L('Matikan semua', 'Turn all off')} onaction={() => allOff(['media', 'spectrum', 'lyrics', 'lyricsWing'])}>
      {@render tog('media')}
      {@render tog('spectrum', { sub: true, disabled: !features.media, why: L('Nyalakan dulu Lagu & video yang diputar.', 'Turn on Now playing first.') })}
      {@render tog('lyrics', { sub: true, disabled: !features.media, why: L('Nyalakan dulu Lagu & video yang diputar.', 'Turn on Now playing first.') })}
      {@render tog('lyricsWing', { sub: true, disabled: !features.media || !features.lyrics, why: !features.media ? L('Nyalakan dulu Lagu & video yang diputar.', 'Turn on Now playing first.') : L('Nyalakan dulu Lirik lagu.', 'Turn on Synced lyrics first.') })}
    </Group>
    <Group title={L('Belajar', 'Study')} action={L('Matikan semua', 'Turn all off')} onaction={() => allOff(['water', 'todo', 'clockTools', 'calculator'])}>
      {@render tog('water')}{@render tog('todo')}{@render tog('clockTools')}{@render tog('calculator')}
    </Group>
    <Group title={L('Alat', 'Tools')} action={L('Matikan semua', 'Turn all off')} onaction={() => allOff(['clipboard', 'camera', 'micTest', 'shortcuts'])}>
      {@render tog('clipboard')}{@render tog('camera')}{@render tog('micTest')}{@render tog('shortcuts')}
    </Group>
     </div>
     <div>
    <Group title={L('Sistem', 'System')} action={L('Matikan semua', 'Turn all off')} onaction={() => allOff(['hud', 'charger', 'devices', 'downloads', 'keys', 'network', 'hideFullscreen'])}>
      {@render tog('hud')}{@render tog('charger')}{@render tog('devices')}{@render tog('downloads')}{@render tog('keys')}{@render tog('network')}{@render tog('hideFullscreen')}
    </Group>
    <Group title={L('Cuaca', 'Weather')}>
      {@render tog('weather')}
      {#if inTauri}
        <Setting stack title={L('Kota', 'City')} disabled={!features.weather} why={L('Nyalakan dulu Cuaca di header.', 'Turn on Weather in the header first.')}>
          <Input bind:value={city} disabled={!features.weather} placeholder={L('Nama kota', 'City name')} aria-label={L('Nama kota', 'City name')} onchange={() => { weather.setCity(city); locErr = ''; void emitPrefs('weather'); }} />
          <button class="btn" disabled={!features.weather || detecting} onclick={async () => { detecting = true; locErr = ''; try { await weather.detect(); city = weather.city; void emitPrefs('weather'); } catch (e) { locErr = (e as Error).message; } detecting = false; }}>{detecting ? L('Mendeteksi…', 'Detecting…') : L('Deteksi lokasi saat ini', 'Detect current location')}</button>
          {#if weather.coords}<span class="dim">{L('Memakai lokasi terdeteksi', 'Using detected location')}</span>{/if}
        </Setting>
        {#if locErr || weather.problem}<p class="inline-err">{locErr || weather.problem}</p>{/if}
      {/if}
    </Group>
     </div>
    </div>
    {#if inTauri}
      <Group title={L('Kalender', 'Calendar')}>
        <Setting stack title={L('Tautan kalender ICS', 'Calendar ICS link')} desc={L('Alamat https dari Google Calendar, iCloud, atau sejenisnya.', 'An https link from Google Calendar, iCloud, and the like.')}>
          <Input bind:value={ics} placeholder="https://…" aria-label={L('Tautan kalender ICS', 'Calendar ICS link')} onchange={() => { agenda.setSource(ics); void emitPrefs('agenda'); }} />
        </Setting>
        <Setting title={L('Berkas .ics', 'An .ics file')} desc={agenda.file ? L('Lagi pakai berkas.', 'Using a file.') : ''}>
          <button class="btn" onclick={async () => { const f = (await pickFiles())[0]; if (f) { ics = ''; agenda.setSource('', f); void emitPrefs('agenda'); } }}>{agenda.file ? L('Ganti berkas', 'Change file') : L('Pilih berkas', 'Choose file')}</button>
        </Setting>
        <Setting toggle title={L('Pakai kalender Cognify', 'Use the Cognify calendar')} desc={L('Cognify harus sudah terhubung ke Notch.', 'Needs Cognify connected to Notch.')} checked={agenda.cognify} onchange={(v) => { agenda.setCognify(v); void emitPrefs('agenda'); }} />
        {#if agenda.problem}<p class="inline-err">{agenda.problem}</p>{/if}
      </Group>
    {/if}

  {/if}
  {#if show('skins')}
    <SkinsPane />
  {/if}

  {#if show('dock')}
    <Group title={L('Dock', 'Dock')}>
      <Setting toggle title={L('Dock di tepi bawah layar', 'Dock along the bottom')} desc={L('Satu bilah berisi aplikasi dan widget, dengan gaya notch. Isinya diatur di bawah.', 'One bar for apps and widgets, styled like the notch. Choose what goes in it below.')} bind:checked={dock.enabled} onchange={setDock} />
      <Setting toggle sub title={L('Sembunyikan taskbar Windows', 'Hide the Windows taskbar')} desc={L('Jendela lain jadi bisa pakai layar penuh. Taskbar muncul lagi kalau dock dimatikan atau Cognify Notch ditutup. Ikon tray bisa dibuka lewat modul Ikon tersembunyi.', 'Other windows get the full screen height. The taskbar comes back when you turn off the dock or quit Cognify Notch. Reach tray icons through the Hidden icons module.')}
        disabled={!dock.enabled} why={L('Nyalakan dulu dock-nya.', 'Turn on the dock first.')} bind:checked={dock.hideTaskbar} onchange={changeDockShape} />
      {#if dock.taskbarError}<p class="empty">{dock.taskbarError}</p>{/if}
      <Setting title={L('Posisi dock', 'Dock position')} desc={L('Berjarak dari tepi: bulat penuh dan ada celah di bawahnya. Rata dengan tepi: menempel di bawah layar, cuma sudut atas yang bulat. (Terpisah dari bentuk notch di Tampilan.)', 'Gap from edge: fully rounded, floating a little above the bottom. Flush: sits right on the bottom with only the top corners rounded. (This is separate from the notch shape in Appearance.)')}>
        <Segmented label={L('Posisi dock', 'Dock position')} value={dock.mode} onchange={(v: DockMode) => { dock.mode = v; setDock(); }}
          options={[{ value: 'floating', label: L('Berjarak dari tepi', 'Gap from edge') }, { value: 'attached', label: L('Rata dengan tepi', 'Flush') }]} />
      </Setting>
    </Group>

    <div class="dockrest" class:off={!dock.enabled} inert={!dock.enabled}>
    <Group title={L('Latar dock', 'Dock background')}>
      <Setting title={L('Latar', 'Background')} desc={L('Ikut notch pakai latar dari Tampilan. Kaca tembus pandang. Warna dan gradien pakai warna pilihanmu; warna tulisan otomatis menyesuaikan biar tetap terbaca.', 'Follow the notch uses the background from Appearance. Glass is see-through. Color and gradient use your own colors, and text color adjusts itself so it stays readable.')}>
        <Segmented label={L('Latar dock', 'Dock background')} value={dock.style.bgMode} onchange={(v: DockBg) => { dock.style.bgMode = v; setDock(); }}
          options={[{ value: 'notch', label: L('Ikut notch', 'Follow notch') }, { value: 'glass', label: L('Kaca', 'Glass') }, { value: 'color', label: L('Warna', 'Color') }, { value: 'gradient', label: L('Gradien', 'Gradient') }]} />
      </Setting>
      {#if dock.style.bgMode === 'notch'}
        <!-- Memakai latar dari Tampilan > Latar panel; penjelasannya sudah ada di deskripsi di atas. -->
      {:else if dock.style.bgMode === 'glass'}
        <Setting title={L('Kepekatan kaca', 'Glass opacity')} desc={L('Makin kecil, makin tembus pandang. Desktop di baliknya kelihatan apa adanya (belum diburamkan).', 'Lower means more see-through. The desktop behind it isn\'t blurred yet.')}>
          <div class="slider"><input type="range" min={Math.round(GLASS_OPACITY_MIN * 100)} max={Math.round(GLASS_OPACITY_MAX * 100)} step="1" value={Math.round(dock.style.glassOpacity * 100)}
            oninput={(e) => { dock.style.glassOpacity = Number(e.currentTarget.value) / 100; setDock(); }} aria-label={L('Kepekatan kaca', 'Glass opacity')} /><span class="val">{Math.round(dock.style.glassOpacity * 100)}%</span></div>
        </Setting>
      {:else}
        <Setting title={dock.style.bgMode === 'gradient' ? L('Warna awal', 'Start color') : L('Warna', 'Color')}>
          <span class="swatches">
            {#each BG_SWATCH as c}<button class="chip" class:sel={dock.style.bgColor.toLowerCase() === c} style:background={c} aria-label={c} onclick={() => setBgColor('bgColor', c)}></button>{/each}
            <ColorPicker value={dock.style.bgColor} label={L('Warna sendiri', 'Custom color')} onchange={(v) => setBgColor('bgColor', v)} />
          </span>
        </Setting>
        {#if dock.style.bgMode === 'gradient'}
          <Setting title={L('Warna akhir', 'End color')}>
            <span class="swatches">
              {#each BG_SWATCH as c}<button class="chip" class:sel={dock.style.bgColor2.toLowerCase() === c} style:background={c} aria-label={c} onclick={() => setBgColor('bgColor2', c)}></button>{/each}
              <ColorPicker value={dock.style.bgColor2} label={L('Warna sendiri', 'Custom color')} onchange={(v) => setBgColor('bgColor2', v)} />
            </span>
          </Setting>
          <Setting title={L('Arah gradien', 'Gradient direction')}>
            <div class="slider"><input type="range" min="0" max="360" step="5" bind:value={dock.style.bgAngle} oninput={setDock} aria-label={L('Arah gradien', 'Gradient direction')} /><span class="val">{dock.style.bgAngle}°</span></div>
          </Setting>
        {/if}
      {/if}
    </Group>

    <Group title={L('Susunan dock', 'Dock layout')}>
      <Setting stack title={L('Lebar terpakai', 'Width used')} desc={L(`Dock selalu satu baris dan tidak akan lebih lebar dari layar. Minimal ada tempat buat ${MIN_APP_SLOTS} ikon aplikasi.`, `The dock is always a single row and never wider than the screen. There's always room for at least ${MIN_APP_SLOTS} app icons.`)}>
        <div class="meter" class:full={dockUse.ratio > 0.9} role="img" aria-label={L(`Terpakai ${dockUse.used} dari ${dockUse.max} piksel`, `${dockUse.used} of ${dockUse.max} pixels used`)}>
          <i style:width="{Math.round(dockUse.ratio * 100)}%"></i><span>{dockUse.used} / {dockUse.max} px</span>
        </div>
      </Setting>
      {#each dock.layout as id, i (id)}
        {@const info = MODULE_INFO[id]}
        <Setting title={info.label() + (overflowing.has(id) ? ' · ' + L('tidak muat, tidak ditampilkan', 'does not fit, not shown') : '')} desc={info.desc() + (dockNeed(id) ? ' ' + dockNeed(id) : '')}>
          <button class="btn ghost" aria-label={L('Geser ke kiri', 'Move left')} disabled={i === 0} onclick={() => { dock.move(id, -1); setDock(); }}><ArrowUp size={14} /></button>
          <button class="btn ghost" aria-label={L('Geser ke kanan', 'Move right')} disabled={i === dock.layout.length - 1} onclick={() => { dock.move(id, 1); setDock(); }}><ArrowDown size={14} /></button>
          <button class="btn ghost" aria-label={L('Hapus dari dock', 'Remove from the dock')} onclick={() => { dock.remove(id); setDock(); }}><X size={14} /></button>
        </Setting>
      {/each}
      {#if dock.layout.length === 0}<p class="empty">{L('Dock masih kosong. Tambah modul di bawah.', 'Your dock is empty. Add a module below.')}</p>{/if}
    </Group>

    {#if addable.length > 0}
      <Group title={L('Tambah modul', 'Add a module')}>
        {#each addable as id (id)}
          {@const info = MODULE_INFO[id]}
          {@const check = dock.check(id, screenW)}
          {@const need = dockNeed(id)}
          <Setting title={info.label()} desc={info.desc()} disabled={!check.ok || !!need} why={!check.ok ? L('Dock sudah selebar layar. Hapus modul lain atau kecilkan ikonnya dulu.', 'The dock already fills the screen. Remove a module or shrink the icons first.') : (need ?? '')}>
            <button class="btn" disabled={!check.ok || !!need} onclick={() => { dock.add(id, screenW); setDock(); }}>{L('Tambah', 'Add')}</button>
          </Setting>
        {/each}
      </Group>
    {/if}

    <Group title={L('Ukuran', 'Size')}>
      <Setting title={L('Ukuran ikon', 'Icon size')}>
        <div class="slider"><input type="range" min={ICON_MIN} max={ICON_MAX} step="2" bind:value={dock.iconSize} oninput={changeDockShape} aria-label={L('Ukuran ikon', 'Icon size')} /><span class="val">{dock.iconSize} px</span>
          <button class="btn ghost" onclick={() => { dock.iconSize = 40; changeDockShape(); }} disabled={dock.iconSize === 40} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
      </Setting>
      <Setting title={L('Pembesaran', 'Magnification')} desc={L('Ikon di bawah kursor membesar seperti Dock macOS: naik, tetangganya ikut membesar, dan dock melebar. Biar efeknya terasa, pakai ikon kecil dan pembesaran besar.', 'Icons under your pointer grow like on the macOS Dock: they rise, their neighbors grow too, and the dock widens. For the full effect, use small icons with high magnification.')}>
        <div class="slider"><input type="range" min="0" max="100" step="5" bind:value={dock.magnify} oninput={setDock} aria-label={L('Pembesaran', 'Magnification')} /><span class="val">{dock.magnify < 1 ? L('Mati', 'Off') : dock.magnify}</span>
          <button class="btn ghost" onclick={() => { dock.magnify = 65; setDock(); }} disabled={dock.magnify === 65} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
      </Setting>
      <Setting title={L('Kebulatan dock', 'Dock roundness')} desc={L('100 = kapsul penuh. Sel, ikon, dan tombol di dalamnya ikut membulat (radius dock dikurangi jaraknya ke tepi).', '100 = a full capsule. Everything inside rounds to match (dock radius minus its distance to the edge).')}>
        <div class="slider"><input type="range" min="0" max="100" step="5" bind:value={dock.round} oninput={setDock} aria-label={L('Kebulatan dock', 'Dock roundness')} /><span class="val">{dock.round}%</span>
          <button class="btn ghost" onclick={() => { dock.round = 100; setDock(); }} disabled={dock.round === 100} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
      </Setting>
      <Setting title={L('Jarak dari tepi bawah', 'Distance from the bottom')} disabled={dock.mode === 'attached'} why={L('Tidak berlaku kalau dock menempel.', 'Doesn\'t apply while the dock is attached.')}>
        <div class="slider"><input type="range" min="0" max={MARGIN_MAX} step="2" bind:value={dock.margin} oninput={setDock} aria-label={L('Jarak dari tepi bawah', 'Distance from the bottom')} disabled={dock.mode === 'attached'} /><span class="val">{dock.margin} px</span>
          <button class="btn ghost" onclick={() => { dock.margin = 10; setDock(); }} disabled={dock.margin === 10} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button></div>
      </Setting>
    </Group>

    {#if needs('timer')}
      <Group title={L('Timer cepat', 'Quick timer')}>
        {#each dock.presets as m (m)}
          <Setting title={L(`${m} menit`, `${m} minutes`)}>
            <button class="btn ghost" aria-label={L('Hapus preset', 'Remove preset')} disabled={dock.presets.length <= 1} onclick={() => { dock.removePreset(m); changeDockShape(); }}><X size={14} /></button>
          </Setting>
        {/each}
        {#if dock.presets.length < MAX_PRESETS}
          <Setting title={L('Tambah preset', 'Add a preset')} desc={L('Menit, 1 sampai 180.', 'Minutes, 1 to 180.')}>
            <Input width="72px" type="number" min="1" max="180" bind:value={newPreset} aria-label={L('Menit', 'Minutes')} onkeydown={(e) => e.key === 'Enter' && addPreset()} />
            <button class="btn" onclick={addPreset}>{L('Tambah', 'Add')}</button>
          </Setting>
        {/if}
        {#if presetError}<p class="empty">{presetError}</p>{/if}
      </Group>
    {/if}

    {#if needs('links')}
      <Group title={L('Pintasan tautan', 'Link shortcuts')}>
        {#each dock.links as l (l.id)}
          <Setting title={l.label} desc={l.url}>
            <button class="btn ghost" aria-label={L('Hapus tautan', 'Remove link')} onclick={() => { dock.removeLink(l.id); changeDockShape(); }}><X size={14} /></button>
          </Setting>
        {/each}
        {#if dock.links.length < MAX_LINKS}
          <Setting stack title={L('Tambah tautan', 'Add a link')} desc={L('Cuma alamat web (http atau https). Ikon situs tidak diunduh.', 'Web addresses only (http or https). Site icons aren\'t downloaded.')}>
            <div class="linkform">
              <Input placeholder={L('Nama (boleh kosong)', 'Name (optional)')} bind:value={linkLabel} maxlength={24} aria-label={L('Nama tautan', 'Link name')} />
              <Input placeholder="youtube.com" bind:value={linkUrl} aria-label={L('Alamat tautan', 'Link address')} onkeydown={(e) => e.key === 'Enter' && addLink()} />
              <button class="btn" onclick={addLink}>{L('Tambah', 'Add')}</button>
            </div>
          </Setting>
        {/if}
        {#if linkError}<p class="empty">{linkError}</p>{/if}
      </Group>
    {/if}

    {#if (needs('weather') && !features.weather) || (needs('lyrics') && !features.lyrics) || (needs('clipboard') && !features.clipboard)}
      <Group title={L('Perlu dinyalakan dulu', 'Turn it on first')}>
        {#if needs('weather') && !features.weather}<p class="empty">{L('Cuaca masih mati. Nyalakan di Fitur, lalu isi kotanya.', 'Weather is off. Turn it on in Features, then set a city there.')}</p>{/if}
        {#if needs('lyrics') && !features.lyrics}<p class="empty">{L('Lirik masih mati. Nyalakan di Fitur > Musik.', 'Lyrics are off. Turn them on in Features > Media.')}</p>{/if}
        {#if needs('clipboard') && !features.clipboard}<p class="empty">{L('Riwayat clipboard masih mati. Nyalakan di Fitur > Produktivitas.', 'Clipboard history is off. Turn it on in Features > Tools.')}</p>{/if}
      </Group>
    {/if}

    <Group title={L('Aplikasi yang disematkan', 'Pinned apps')}>
      {#each dock.pins as p, i (p.exe)}
        <Setting title={p.name} desc={p.exe}>
          <button class="btn ghost" aria-label={L('Naik (lebih ke kiri di dock)', 'Move up (further left in the dock)')} disabled={i === 0} onclick={() => dock.nudgePin(p.exe, -1)}><ArrowUp size={14} /></button>
          <button class="btn ghost" aria-label={L('Turun (lebih ke kanan di dock)', 'Move down (further right in the dock)')} disabled={i === dock.pins.length - 1} onclick={() => dock.nudgePin(p.exe, 1)}><ArrowDown size={14} /></button>
          <button class="btn ghost" aria-label={L('Lepas sematan', 'Unpin')} onclick={() => dock.togglePin(p.exe, p.name)}><X size={14} /></button>
        </Setting>
      {/each}
      {#if dock.pins.length === 0}<p class="empty">{L('Belum ada. Klik kanan ikon app di dock, lalu pilih Sematkan.', 'Nothing pinned yet. Right-click an app in the dock and choose Pin.')}</p>{/if}
    </Group>
    </div>
    {#if inTauri}
      <Group title={L('Taskbar hilang?', 'Missing your taskbar?')}>
        <Setting title={L('Pulihkan taskbar Windows', 'Restore the Windows taskbar')} desc={L('Balikin taskbar Windows seperti semula. Ada juga di menu ikon tray Cognify Notch.', 'Brings the Windows taskbar back. You\'ll also find this in the Cognify Notch tray menu.')}>
          <button class="btn" onclick={restoreTaskbar}>{L('Pulihkan', 'Restore')}</button>
        </Setting>
      </Group>
    {/if}

  {/if}
  {#if pane === 'tabs' && !searching}
    <Group title={L('Saat notch dibuka', 'When the notch opens')}>
      <Setting title={L('Tampilkan', 'Show')}>
        <Select value={ui.startTab} onchange={(v) => { ui.startTab = v; setUi(); }} label={L('Halaman awal', 'Start page')} width="200px"
          options={[{ value: '', label: L('Halaman terakhir', 'The last page') }, ...ui.allOrdered.map((p) => ({ value: p.id as string, label: p.title() }))]} />
      </Setting>
    </Group>
    <div class="strip" aria-hidden="true">{#each ui.allOrdered as p, i (p.id)}<i class:on={i === 0}></i>{/each}</div>
    <Group hint={L('Geser untuk mengubah urutan, atau pilih satu lalu tekan panah kiri dan kanan.', 'Drag to reorder, or focus a tab and press the left and right arrow keys.')}>
      <div class="tabgrid">
        {#each ui.allOrdered as p, i (p.id)}
          <button type="button" class="tb" class:drag={dragTab === p.id} data-tab={p.id} onpointerdown={() => (dragTab = p.id)}
            onkeydown={(e) => { const by = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (by) { e.preventDefault(); ui.move(p.id, by); setUi(); } }}>
            <em>{i + 1}</em><span>{p.title()}</span><GripVertical size={13} />
          </button>
        {/each}
      </div>
    </Group>

  {/if}
   </div>
  </main>
</div>

<style>
  .shell {
    /* Sama dengan Theme.swift di Mac. */
    --card: linear-gradient(rgba(255, 255, 255, .08), rgba(255, 255, 255, .05)); --line: rgba(255, 255, 255, .09); --dim: rgba(255, 255, 255, .55); --faint: rgba(255, 255, 255, .42); --warn: #ff9f0a;
    --accent: #8f87ff;
    position: relative; isolation: isolate; overflow: hidden; display: flex; height: 100vh; color: #fff; font-size: 13px; user-select: none; color-scheme: dark;
    background: #000;
  }
  .tbg { position: absolute; z-index: -2; pointer-events: none; }
  .tdim { position: absolute; inset: 0; z-index: -1; pointer-events: none; background: #000; }
  nav { width: 180px; flex: none; display: flex; flex-direction: column; gap: 2px; padding: 18px 10px; background: rgba(255, 255, 255, .03); border-right: 1px solid rgba(255, 255, 255, .07); overflow-y: auto; scrollbar-width: none; }
  nav::-webkit-scrollbar, .pane::-webkit-scrollbar { display: none; width: 0; height: 0; }
  .brand { display: flex; align-items: center; gap: 10px; padding: 2px 8px 14px; }
  .mark { position: relative; width: 22px; height: 15px; flex: none; background: #000; border-radius: 0 0 8px 8px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .2); }
  .mark::after { content: ''; position: absolute; left: 6px; top: 3px; width: 3px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 7px 0 0 var(--accent); }
  nav h1 { font-size: 15px; font-weight: 600; margin: 0; }
  .ver { display: block; font-size: 11px; color: var(--dim); }
  .search { position: relative; display: block; margin: 0 4px 6px; color: var(--dim); }
  .search :global(svg) { position: absolute; left: 11px; top: 8px; opacity: .6; pointer-events: none; }
  .search :global(input) { width: 100%; box-sizing: border-box; border: 0; border-radius: 99px; padding: 7px 12px 7px 32px; background: rgba(255, 255, 255, .07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .08); color: inherit; font: inherit; outline: none; user-select: text; }
  .search :global(input:focus-visible) { box-shadow: inset 0 0 0 2px var(--accent); }
  .tab { position: relative; display: flex; align-items: center; gap: 9px; border: 0; background: none; color: var(--dim); font: inherit; text-align: left; padding: 7px 10px; border-radius: 99px; font-weight: 600; cursor: pointer; transition: background .15s, color .15s; }
  .tab span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tab:hover { background: rgba(255, 255, 255, .06); color: #fff; }
  .tab.sel { background: color-mix(in srgb, var(--accent) 28%, transparent); color: #fff; }
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

  .slider { display: flex; align-items: center; gap: 6px; }
  .slider input[type=range] { width: 130px; }
  .val { min-width: 48px; text-align: right; font-variant-numeric: tabular-nums; color: var(--dim); }
  input[type=range] { -webkit-appearance: none; appearance: none; height: 20px; background: transparent; cursor: pointer; --p: 50%; }
  input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 99px; background: linear-gradient(to right, var(--accent) var(--p), rgba(255, 255, 255, .16) var(--p)); }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%; background: #fff; border: 0; box-shadow: 0 0 0 1px rgba(0, 0, 0, .35), 0 1px 2px rgba(0, 0, 0, .4); }
  input[type=range]:active::-webkit-slider-thumb { transform: scale(1.12); }
  input[type=range]:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
  input[type=range]:disabled { opacity: .5; }
  .btn.ghost { background: transparent; border: 1px solid var(--line); border-radius: 99px; padding: 5px 9px; display: inline-flex; align-items: center; }
  .btn { border-radius: 99px; padding: 5px 14px; }
  .btn.on { color: #0b0a1a; }
  /* Miniatur layar, sama dengan FloatPositionPad di Mac. */
  .set.mapwrap { display: flex; justify-content: center; padding: 4px 8px; }
  .map { position: relative; width: 280px; max-width: 100%; border-radius: 12px; background: rgba(255, 255, 255, .1); cursor: pointer; overflow: hidden; touch-action: none; }
  .map i { position: absolute; pointer-events: none; }
  .map .menubar { inset: 0 0 auto 0; height: 9px; background: rgba(255, 255, 255, .1); }
  .map .axis { top: 0; bottom: 0; left: calc(50% - .5px); width: 1px; background: var(--line); }
  .map .axis.on { background: var(--accent); }
  .map .dot { transform: translate(-50%, -50%); box-sizing: border-box; width: 36px; height: 14px; border-radius: 99px; background: #000; border: 1.5px solid var(--accent); }
  .lbl { margin: 0 8px 6px; font-size: 12px; font-weight: 600; color: var(--dim); }
  .set.choose { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
  .choose button { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 6px 10px; border: 0; border-radius: 20px; background: rgba(255, 255, 255, .06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .09); color: inherit; font: inherit; cursor: pointer; }
  .choose button.sel { background: color-mix(in srgb, var(--accent) 14%, transparent); box-shadow: inset 0 0 0 2px var(--accent); }
  .choose button:focus-visible, .tb:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .choose strong { font-weight: 600; }
  .choose small { font-size: 11px; color: var(--dim); }
  .desk { display: flex; justify-content: center; align-items: flex-start; width: 100%; height: 56px; margin-bottom: 4px; border-radius: 14px; background: linear-gradient(135deg, #7d8aa8, #a58ba8 60%, #c99a8c); }
  .desk i { display: flex; align-items: center; justify-content: center; gap: 8px; width: 96px; height: 22px; background: #000; border-radius: 0 0 12px 12px; }
  .desk.float i { margin-top: 16px; width: 76px; height: 24px; border-radius: 99px; }
  .desk.round i { margin-top: 10px; width: 36px; height: 36px; gap: 6px; }
  .desk b { width: 5px; height: 9px; border-radius: 99px; background: #fff; }
  .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0 8px; align-items: start; }
  .strip { display: flex; justify-content: center; gap: 5px; padding: 10px; border-radius: 20px; background: rgba(255, 255, 255, .04); }
  .strip i { width: 5px; height: 5px; border-radius: 99px; background: rgba(255, 255, 255, .2); }
  .strip i.on { width: 18px; background: var(--accent); }
  .tabgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
  .tb { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px 0 6px; border: 0; border-radius: 99px; background: rgba(255, 255, 255, .07); color: inherit; font: inherit; text-align: left; cursor: grab; touch-action: none; }
  .tb.drag { background: color-mix(in srgb, var(--accent) 28%, transparent); cursor: grabbing; }
  .tb em { flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: rgba(255, 255, 255, .08); font-style: normal; font-size: 10px; }
  .tb span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tb :global(svg) { color: var(--dim); }
  .dockrest.off { opacity: .35; }
  .thumb { width: 52px; height: 32px; object-fit: cover; border-radius: 6px; }
  .pick { cursor: pointer; }
  .swatches { display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
  .chip { width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(128, 128, 128, .35); padding: 0; cursor: pointer; }
  .chip.sel { outline: 2px solid #fff; outline-offset: 2px; }

  /* Jendela sempit: menu samping hanya ikon; judul grup jadi garis tipis dan pencarian jadi ikon. */
  @media (max-width: 700px) {
    nav { width: 60px; padding: 14px 8px; align-items: stretch; }
    .brand { justify-content: center; padding: 2px 0 10px; }
    .brand div, .tab span { display: none; }
    .search { margin: 0 0 4px; }
    .search :global(input) { padding: 0; height: 34px; color: transparent; cursor: pointer; }
    .search :global(input::placeholder) { color: transparent; }
    .search :global(input:focus) { position: fixed; left: 8px; top: 8px; width: 200px; height: auto; padding: 7px 12px 7px 32px; color: inherit; z-index: 5; background: #1e1e1e; cursor: text; }
    .search :global(input:focus::placeholder) { color: var(--dim); }
    .search :global(svg) { left: 50%; margin-left: -7px; z-index: 6; }
    .search:focus-within :global(svg) { left: 20px; margin-left: 0; top: 16px; }
    .tab { justify-content: center; padding: 9px 0; }
    .inner { padding: 20px 16px 32px; }
  }
.meter { position: relative; height: 22px; border-radius: 99px; background: rgba(255, 255, 255, .08); overflow: hidden; width: 100%; }
  .meter i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: color-mix(in srgb, var(--accent) 55%, transparent); transition: width .2s; }
  .meter.full i { background: color-mix(in srgb, #ff9f0a 65%, transparent); }
  .meter span { position: relative; display: block; text-align: center; font-size: 11px; font-weight: 650; line-height: 22px; font-variant-numeric: tabular-nums; }
  .linkform { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
  .linkform :global(input) { flex: 1 1 120px; }
</style>
