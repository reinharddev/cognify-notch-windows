<script lang="ts">
  import { features } from './lib/system.svelte';
  import { cmd, emitPrefs, inTauri, pickFiles } from './lib/bridge';
  import { agenda } from './lib/agenda.svelte';
  import { hotkey, HOTKEYS } from './lib/hotkey.svelte';
  import { L } from './lib/i18n';
  import { checkUpdate, initUpdate, installNow, update } from './lib/update.svelte';
  import { weather } from './lib/weather.svelte';
  import { ui, CLOSED_MIN, CLOSED_MAX, CLOSED_DEFAULT, EDGE_MARGIN } from './lib/ui.svelte';
  import { pillLimits } from './lib/geometry';
  import { EMOTIONS, MODES, SITUATIONS, emotionLabel, situationLabel } from './lib/companion';

  type PaneId = 'general' | 'appearance' | 'behavior' | 'companion' | 'features' | 'weather' | 'tabs' | 'data';
  let pane = $state<PaneId>('general');
  const panes: [PaneId, () => string][] = [
    ['general', () => L('Umum', 'General')],
    ['appearance', () => L('Tampilan', 'Appearance')],
    ['behavior', () => L('Perilaku', 'Behavior')],
    ['companion', () => L('Pendamping', 'Companion')],
    ['features', () => L('Fitur', 'Features')],
    ['weather', () => L('Cuaca & kalender', 'Weather & calendar')],
    ['tabs', () => L('Tab', 'Tabs')],
    ['data', () => L('Data', 'Data')],
  ];

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
    ['companion', L('Teman kecil di notch', 'Little companion in the notch'), L('Wajah yang berkedip, tertidur, dan ekspresinya menyesuaikan keadaan. Atur caranya di bagian Teman kecil.', 'A face that blinks, dozes off, and changes expression with what is going on. Set how in the Little companion section.')],
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
  const setWidth = () => { ui.persist(); void emitPrefs('ui'); };
  const setEyes = (m: 'blink' | 'follow') => { ui.eyesMode = m; ui.persist(); void emitPrefs('ui'); };
  const setChoice = (id: string, v: string) => {
    if (v === 'auto') delete ui.companionMap[id]; else ui.companionMap[id] = v;
    setUi();
  };
  const resetWidth = () => { ui.closedWidth = CLOSED_DEFAULT; setWidth(); };

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
  const setStyle = (st: 'notch' | 'pill') => { ui.style = st; clampPill(); setUi(); };
  const pct = (v: number) => Math.round(v * 100);
  const setPct = (axis: 'x' | 'y', v: number) => { if (axis === 'x') ui.pillX = v / 100; else ui.pillY = v / 100; clampPill(); setUi(); };
</script>


{#snippet tog(key: (typeof toggles)[number][0])}
  {@const t = toggles.find((x) => x[0] === key)!}
  <label class="opt"><input type="checkbox" bind:checked={features[key]} onchange={() => changedFeature(key)} />
    <span><b>{t[1]}</b>{#if t[2]}<small class="dim">{t[2]}</small>{/if}</span></label>
{/snippet}

<div class="shell">
  <nav>
    <h1>{L('Pengaturan', 'Settings')}</h1>
    <span class="dim ver">Cognify Notch {update.current}</span>
    {#each panes as p}
      {#if p[0] !== 'data' || inTauri}
        <button class="tab" class:sel={pane === p[0]} onclick={() => (pane = p[0])}>{p[1]()}</button>
      {/if}
    {/each}
  </nav>

  <main class="pane">
  {#if pane === 'general'}
    <section>
      <h2>{L('Umum', 'General')}</h2>
      <div class="card list">
      {#if inTauri}
        <label class="opt"><input type="checkbox" bind:checked={autostart} onchange={() => void cmd('autostart_set', { on: autostart })} />
          <span><b>{L('Buka saat Windows dinyalakan', 'Open when Windows starts')}</b></span></label>
        <label class="opt sel"><span><b>{L('Pintasan membuka notch', 'Shortcut to open the notch')}</b></span>
          <select bind:value={hotkey.choice} onchange={() => { hotkey.apply(); void emitPrefs('hotkey'); }}>{#each HOTKEYS as [id, label]}<option value={id}>{label}</option>{/each}</select></label>
      {/if}
      <p class="dim note">{L('Sembunyikan atau tampilkan notch lewat ikon Cognify Notch di area ikon tersembunyi taskbar (klik kiri).', 'Hide or show the notch from the Cognify Notch icon in the taskbar\'s hidden icons (left click).')}</p>
        {@render tog('hotkey')}
      <div class="row between"><b>{L('Bahasa tampilan', 'Display language')}</b>
        <div class="seg2" role="group">
          <button class:sel={ui.lang === 'auto'} onclick={() => { ui.lang = 'auto'; setUi(); void emitPrefs('reload'); setTimeout(() => location.reload(), 150); }}>{L('Ikuti Windows', 'Follow Windows')}</button>
          <button class:sel={ui.lang === 'id'} onclick={() => { ui.lang = 'id'; setUi(); void emitPrefs('reload'); setTimeout(() => location.reload(), 150); }}>Bahasa Indonesia</button>
          <button class:sel={ui.lang === 'en'} onclick={() => { ui.lang = 'en'; setUi(); void emitPrefs('reload'); setTimeout(() => location.reload(), 150); }}>English</button>
        </div></div>
      </div>
    </section>
    <section>
      <h2>{L('Pembaruan', 'Updates')}</h2>
      <div class="card col">
        {@render tog('updates')}
        {@render tog('autoInstall')}
      <div class="row">
        <button class="btn" onclick={() => checkUpdate()}>{L('Cek pembaruan', 'Check for updates')}</button>
        {#if update.selfUpdate && (update.stage === 'found' || update.stage === 'ready')}<button class="btn on" onclick={installNow}>{L('Perbarui dan mulai ulang', 'Update and restart')}</button>{/if}
        {#if !update.selfUpdate && update.url}<button class="btn on" onclick={() => cmd('open_target', { target: update.url })}>{L('Buka halaman unduh', 'Open download page')}</button>{/if}
      </div>
      {#if update.text}<span class="dim">{update.text}</span>{/if}
      </div>
    </section>

  {:else if pane === 'appearance'}
    <section>
      <h2>{L('Bentuk', 'Shape')}</h2>
      <div class="card list">
      <div class="row between"><b>{L('Bentuk', 'Shape')}</b>
        <div class="seg2" role="group">
          <button class:sel={ui.style === 'notch'} onclick={() => setStyle('notch')}>{L('Notch (menempel di atas)', 'Notch (attached to the top)')}</button>
          <button class:sel={ui.style === 'pill'} onclick={() => setStyle('pill')}>{L('Pill (mengambang)', 'Pill (floating)')}</button>
        </div></div>
      <label class="opt"><input type="checkbox" bind:checked={ui.autoHide} onchange={setUi} />
        <span><b>{L('Sembunyikan otomatis di tepi layar', 'Auto-hide at the screen edge')}</b>
          <small class="dim">{L('Notch menghilang saat tidak dipakai dan muncul lagi saat kursor menyentuh tepi layar di dekat posisinya. Pengingat tetap muncul sendiri.', 'The notch disappears when idle and slides back when the cursor touches the screen edge near it. Reminders still appear on their own.')}</small></span></label>
      {#if ui.style === 'pill'}
        <div class="row between"><b>{L('Lebar pill saat tertutup', 'Closed pill width')}</b><span class="val">{ui.pillWidth} px</span></div>
        <input type="range" min={CLOSED_MIN} max={CLOSED_MAX} step="2" bind:value={ui.pillWidth} oninput={() => { clampPill(); setUi(); }} aria-label={L('Lebar pill', 'Pill width')} />
        <b>{L('Posisi pill', 'Pill position')}</b>
        <div class="map" bind:this={mapEl} style:aspect-ratio="{sw} / {sh}" role="presentation"
          onpointerdown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); dragPill(e); }} onpointermove={dragPill}>
          <i class="zone" style:inset="{(EDGE_MARGIN / sh) * 100}% {(EDGE_MARGIN / sw) * 100}%"></i>
          <i class="dot" style:left="{ui.pillX * 100}%" style:top="{ui.pillY * 100}%" style:width="{(ui.pillWidth / sw) * 100}%" style:height="{(PILL_H / sh) * 100}%"></i>
        </div>
        <div class="row">
          <label class="row">X <input class="num" type="number" min={pct(lim.minX)} max={pct(lim.maxX)} value={pct(ui.pillX)} onchange={(e) => setPct('x', Number(e.currentTarget.value))} /> %</label>
          <label class="row">Y <input class="num" type="number" min={pct(lim.minY)} max={pct(lim.maxY)} value={pct(ui.pillY)} onchange={(e) => setPct('y', Number(e.currentTarget.value))} /> %</label>
        </div>
        <span class="dim">{L('Geser titik di peta atau isi angka. Pill selalu tetap di dalam layar; bila dekat tepi, panelnya tumbuh ke sisi yang masih punya ruang.', 'Drag the dot on the map or type numbers. The pill always stays on screen; near an edge, its panel grows toward the side with room.')}</span>
      {/if}
      </div>
    </section>
    <section>
      <h2>{L('Ukuran', 'Size')}</h2>
      <div class="card list">
      {#if ui.style === 'notch'}
      <div class="row between">
        <label for="w">{L('Lebar notch saat tertutup', 'Closed notch width')}</label>
        <span class="val">{ui.closedWidth} px</span>
      </div>
      <input id="w" type="range" min={CLOSED_MIN} max={CLOSED_MAX} step="2" bind:value={ui.closedWidth} oninput={setWidth} />
      <div class="preview"><span class="pill" style:width="{ui.closedWidth}px"><i></i><i></i></span></div>
      {/if}
      {#if ui.style === 'notch'}
      <div class="row between">
        <span class="dim">{L('Lebih sempit tidak menutupi tab browser. Panel yang terbuka tidak berubah.', 'Narrower won\'t cover browser tabs. The open panel is unchanged.')}</span>
        <button class="btn" onclick={resetWidth} disabled={ui.closedWidth === CLOSED_DEFAULT}>{L('Atur ulang', 'Reset')}</button>
      </div>
      {/if}
      <div class="row between"><b>{L('Ukuran panel', 'Panel size')}</b>
        <div class="seg2" role="group">
          <button class:sel={ui.scale === 1} onclick={() => { ui.scale = 1; setUi(); }}>{L('Normal', 'Normal')}</button>
          <button class:sel={ui.scale === 1.12} onclick={() => { ui.scale = 1.12; setUi(); }}>{L('Besar', 'Large')}</button>
        </div></div>
      <div class="row between"><b>{L('Lengkung sudut bawah', 'Bottom corner roundness')}</b><span class="val">{ui.roundness} px</span></div>
      <input type="range" min="0" max="48" step="1" bind:value={ui.roundness} oninput={setUi} aria-label={L('Lengkung sudut bawah', 'Bottom corner roundness')} />
      </div>
    </section>
    <section>
      <h2>{L('Warna', 'Colors')}</h2>
      <div class="card list">
      <div class="row between"><b>{L('Warna aksen', 'Accent color')}</b>
        <span class="eqc">
          {#each ['#8f87ff', '#0a84ff', '#30d158', '#ff375f', '#ff9f0a', '#ffd60a', '#bf5af2', '#ffffff'] as c}
            <button class="chip" class:sel={(ui.accentColor || '#8f87ff').toLowerCase() === c} style:background={c} aria-label={c} onclick={() => { ui.accentColor = c === '#8f87ff' ? '' : c; setUi(); }}></button>
          {/each}
          <input type="color" value={ui.accentColor || '#8f87ff'} aria-label={L('Warna sendiri', 'Custom color')} oninput={(e) => { ui.accentColor = e.currentTarget.value; setUi(); }} />
          <button class="mini" disabled={!ui.accentColor} onclick={() => { ui.accentColor = ''; setUi(); }}>{L('Bawaan', 'Default')}</button>
        </span></div>
      <label class="row between"><b>{L('Warna lirik otomatis dari sampul', 'Lyric colors from the album cover')}</b>
        <input type="checkbox" checked={ui.lyricAuto} onchange={(e) => { ui.lyricAuto = e.currentTarget.checked; setUi(); }} /></label>
      {#if !ui.lyricAuto}
      <div class="row between"><b>{L('Warna lirik aktif', 'Active lyric color')}</b>
        <span class="eqc">
          {#each ['#ffffff', '#ffd60a', '#30d158', '#0a84ff', '#ff375f', '#ff9f0a', '#bf5af2', '#8e8e93'] as c}
            <button class="chip" class:sel={ui.lyricActive.toLowerCase() === c} style:background={c} aria-label={c} onclick={() => { ui.lyricActive = c; setUi(); }}></button>
          {/each}
          <input type="color" value={ui.lyricActive || '#ffffff'} aria-label={L('Warna sendiri', 'Custom color')} oninput={(e) => { ui.lyricActive = e.currentTarget.value; setUi(); }} />
          <button class="mini" disabled={!ui.lyricActive} onclick={() => { ui.lyricActive = ''; setUi(); }}>{L('Bawaan', 'Default')}</button>
        </span></div>
      <div class="row between"><b>{L('Warna lirik lainnya', 'Other lyrics color')}</b>
        <span class="eqc">
          {#each ['#ffffff', '#ffd60a', '#30d158', '#0a84ff', '#ff375f', '#ff9f0a', '#bf5af2', '#8e8e93'] as c}
            <button class="chip" class:sel={ui.lyricIdle.toLowerCase() === c} style:background={c} aria-label={c} onclick={() => { ui.lyricIdle = c; setUi(); }}></button>
          {/each}
          <input type="color" value={ui.lyricIdle || '#ffffff'} aria-label={L('Warna sendiri', 'Custom color')} oninput={(e) => { ui.lyricIdle = e.currentTarget.value; setUi(); }} />
          <button class="mini" disabled={!ui.lyricIdle} onclick={() => { ui.lyricIdle = ''; setUi(); }}>{L('Bawaan', 'Default')}</button>
        </span></div>
      {/if}
      <label class="row between"><b>{L('Warna equalizer otomatis dari sampul', 'Equalizer color from the album cover')}</b>
        <input type="checkbox" checked={ui.equalizerAuto} onchange={(e) => { ui.equalizerAuto = e.currentTarget.checked; setUi(); }} /></label>
      {#if !ui.equalizerAuto}
      <div class="row between"><b>{L('Warna equalizer', 'Equalizer color')}</b>
        <span class="eqc">
          {#each ['#ffffff', '#30d158', '#0a84ff', '#bf5af2', '#ff375f', '#ff9f0a', '#ffd60a'] as c}
            <button class="chip" class:sel={ui.equalizerColor.toLowerCase() === c} style:background={c} aria-label={c} onclick={() => { ui.equalizerColor = c; setUi(); }}></button>
          {/each}
          <input type="color" value={ui.equalizerColor || '#8f87ff'} aria-label={L('Warna sendiri', 'Custom color')} oninput={(e) => { ui.equalizerColor = e.currentTarget.value; setUi(); }} />
          <button class="mini" disabled={!ui.equalizerColor} onclick={() => { ui.equalizerColor = ''; setUi(); }}>{L('Bawaan', 'Default')}</button>
        </span></div>
      {/if}
      </div>
    </section>

  {:else if pane === 'behavior'}
    <section>
      <h2>{L('Perilaku', 'Behavior')}</h2>
      <div class="card list">
      <div class="row between"><b>{L('Buka notch dengan', 'Open the notch by')}</b>
        <div class="seg2" role="group">
          <button class:sel={!ui.openOnClick} onclick={() => { ui.openOnClick = false; setUi(); }}>{L('Mengarahkan kursor', 'Hovering')}</button>
          <button class:sel={ui.openOnClick} onclick={() => { ui.openOnClick = true; setUi(); }}>{L('Klik', 'Clicking')}</button>
        </div></div>
      {#if inTauri}
        <div class="row between"><b>{L('Tampil di', 'Show on')}</b>
          <div class="seg2" role="group">
            <button class:sel={ui.display === 'main'} onclick={() => { ui.display = 'main'; setUi(); void cmd('set_display', { mode: 'main' }); }}>{L('Layar utama', 'Main screen')}</button>
            <button class:sel={ui.display === 'active'} onclick={() => { ui.display = 'active'; setUi(); void cmd('set_display', { mode: 'active' }); }}>{L('Layar yang sedang dipakai', "Screen you're using")}</button>
          </div></div>
      {/if}
      <div class="row between"><b>{L('Jeda sebelum terbuka', 'Delay before opening')}</b><span class="val">{ui.hoverDelay} ms</span></div>
      <input type="range" min="0" max="600" step="50" bind:value={ui.hoverDelay} oninput={setUi} aria-label={L('Jeda sebelum terbuka', 'Delay before opening')} disabled={ui.openOnClick} />
      <div class="row between"><b>{L('Jeda sebelum menutup', 'Delay before closing')}</b><span class="val">{ui.closeDelay} ms</span></div>
      <input type="range" min="100" max="1500" step="50" bind:value={ui.closeDelay} oninput={setUi} aria-label={L('Jeda sebelum menutup', 'Delay before closing')} />
      </div>
    </section>

  {:else if pane === 'companion'}
    <section>
      <h2>{L('Teman kecil', 'Little companion')}</h2>
      <div class="card col">
        {@render tog('companion')}
      <div class="row between eyesrow">
        <label for="em">{L('Gerak mata', 'Eye movement')}</label>
        <div class="seg2" role="group" id="em">
          <button class:sel={ui.eyesMode === 'blink'} onclick={() => setEyes('blink')} disabled={!features.companion}>{L('Berkedip', 'Blink')}</button>
          <button class:sel={ui.eyesMode === 'follow'} onclick={() => setEyes('follow')} disabled={!features.companion}>{L('Ikuti kursor', 'Follow cursor')}</button>
        </div>
      </div>
      <span class="dim">{L('Mengikuti kursor sedikit lebih boros daya karena arah pandang ikut dihitung.', 'Following the cursor uses slightly more power because the gaze is calculated too.')}</span>
      <div class="row between">
        <label for="cm">{L('Cara kerja', 'How it works')}</label>
        <div class="seg2" role="group" id="cm">
          {#each MODES as m}
            <button class:sel={ui.companionMode === m.id} onclick={() => { ui.companionMode = m.id; setUi(); }} disabled={!features.companion}>{m.label()}</button>
          {/each}
        </div>
      </div>
      <span class="dim">{MODES.find((m) => m.id === ui.companionMode)?.hint()}</span>
      {#if ui.companionMode === 'fixed'}
        <label class="opt sel"><span><b>{L('Ekspresi', 'Expression')}</b></span>
          <select bind:value={ui.companionFixed} onchange={setUi}>{#each EMOTIONS as e}<option value={e}>{emotionLabel(e)}</option>{/each}</select></label>
      {/if}
      <label class="opt"><input type="checkbox" bind:checked={ui.companionBlink} onchange={setUi} />
        <span><b>{L('Berkedip', 'Blink')}</b></span></label>
      {#if ui.companionMode === 'custom'}
        {#each [false, true] as ev}
          <b class="grp">{ev ? L('Kejadian', 'Events') : L('Keadaan', 'Situations')}</b>
          {#each SITUATIONS.filter((x) => x.event === ev) as sit}
            <label class="opt sel"><span>{situationLabel(sit)}</span>
              <select value={ui.companionMap[sit.id] ?? 'auto'} onchange={(e) => setChoice(sit.id, e.currentTarget.value)}>
                <option value="auto">{L('Bawaan', 'Default')} ({emotionLabel(sit.emotion)})</option>
                {#if sit.event}<option value="none">{L('Tidak bereaksi', 'No reaction')}</option>{/if}
                {#each EMOTIONS as e}<option value={e}>{emotionLabel(e)}</option>{/each}
              </select></label>
          {/each}
        {/each}
        <div class="row between">
          <span class="dim">{L('Perubahan langsung terlihat di notch.', 'Changes show up in the notch right away.')}</span>
          <button class="btn" onclick={() => { ui.companionMap = {}; setUi(); }} disabled={Object.keys(ui.companionMap).length === 0}>{L('Kembalikan ke bawaan', 'Reset to default')}</button>
        </div>
      {/if}
      </div>
    </section>

  {:else if pane === 'features'}
    <section>
    <h2>{L('Musik', 'Music')}</h2>
    <div class="card list">{@render tog('media')}{@render tog('spectrum')}{@render tog('lyrics')}{@render tog('lyricsWing')}</div>
    <h2>{L('Produktivitas', 'Productivity')}</h2>
    <div class="card list">{@render tog('shortcuts')}{@render tog('clipboard')}{@render tog('water')}{@render tog('todo')}{@render tog('clockTools')}{@render tog('calculator')}{@render tog('camera')}</div>
    <h2>{L('Sistem', 'System')}</h2>
    <div class="card list">{@render tog('hud')}{@render tog('charger')}{@render tog('devices')}{@render tog('downloads')}{@render tog('keys')}{@render tog('network')}{@render tog('hideFullscreen')}{@render tog('hotkey')}</div>
    </section>

  {:else if pane === 'weather'}
    <section>
      <h2>{L('Cuaca', 'Weather')}</h2>
      <div class="card col">
        {@render tog('weather')}
        {#if inTauri}
        {#if features.weather}
          <input type="text" bind:value={city} placeholder={L('Nama kota', 'City name')} onchange={() => { weather.setCity(city); locErr = ''; void emitPrefs('weather'); }} />
          <span class="eqc">
            <button class="mini" disabled={detecting} onclick={async () => { detecting = true; locErr = ''; try { await weather.detect(); city = weather.city; void emitPrefs('weather'); } catch (e) { locErr = (e as Error).message; } detecting = false; }}>{detecting ? L('Mendeteksi…', 'Detecting…') : L('Deteksi lokasi saat ini', 'Detect current location')}</button>
            {#if weather.coords}<span class="dim">{L('Memakai lokasi terdeteksi', 'Using detected location')}</span>{/if}
          </span>
          {#if locErr}<span class="dim">{locErr}</span>{/if}
          {#if weather.problem}<span class="dim">{weather.problem}</span>{/if}
        {/if}
        {/if}
      </div>
    </section>
    {#if inTauri}
      <section>
        <h2>{L('Kalender', 'Calendar')}</h2>
        <div class="card col">
        <input type="text" bind:value={ics} placeholder={L('Tautan kalender ICS (https)', 'Calendar ICS link (https)')} onchange={() => { agenda.setSource(ics); void emitPrefs('agenda'); }} />
        <div class="row">
          <button class="btn" onclick={async () => { const f = (await pickFiles())[0]; if (f) { ics = ''; agenda.setSource('', f); void emitPrefs('agenda'); } }}>{agenda.file ? L('File kalender: ganti', 'Calendar file: change') : L('Pilih file .ics', 'Choose .ics file')}</button>
        </div>
        <label class="row">
          <input type="checkbox" checked={agenda.cognify} onchange={(e) => { agenda.setCognify(e.currentTarget.checked); void emitPrefs('agenda'); }} />
          <span>{L('Pakai kalender Cognify (perlu Cognify terhubung ke Notch)', 'Use the Cognify calendar (Cognify must be connected to Notch)')}</span>
        </label>
        {#if agenda.problem}<span class="dim">{agenda.problem}</span>{/if}
        </div>
      </section>
    {/if}

  {:else if pane === 'tabs'}
  <section>
    <h2>{L('Urutan tab', 'Tab order')}</h2>
    <div class="card list">
      {#each ui.allOrdered as p, i (p.id)}
        <div class="row between">
          <span>{p.title()}</span>
          <span class="row">
            <button class="btn" aria-label={L('Naik', 'Move up')} disabled={i === 0} onclick={() => { ui.move(p.id, -1); setUi(); }}>↑</button>
            <button class="btn" aria-label={L('Turun', 'Move down')} disabled={i === ui.allOrdered.length - 1} onclick={() => { ui.move(p.id, 1); setUi(); }}>↓</button>
          </span>
        </div>
      {/each}
    </div>
  </section>

  {:else if pane === 'data' && inTauri}
    <section>
      <h2>{L('Data', 'Data')}</h2>
      <div class="card col">
        <span class="dim">{L('Catatan, tugas, riwayat minum, clipboard, timer, dan pengaturan', 'Notes, tasks, water log, clipboard, timers and settings')}</span>
        <div class="row">
          <button class="btn" onclick={exportData}>{L('Ekspor…', 'Export…')}</button>
          <button class="btn" onclick={pickImport}>{L('Impor…', 'Import…')}</button>
        </div>
        {#if confirmImport}
          <span class="dim">{L('Ganti data di PC ini dengan isi cadangan? Catatan, tugas, riwayat minum, clipboard, timer, dan pengaturan sekarang akan diganti. Cognify Notch lalu dimuat ulang.', "Replace this PC's data with the backup? Current notes, tasks, water log, clipboard, timers and settings will be replaced. Cognify Notch will then reload.")}</span>
          <div class="row"><button class="btn on" onclick={doImport}>{L('Ganti', 'Replace')}</button><button class="btn" onclick={() => (confirmImport = null)}>{L('Batal', 'Cancel')}</button></div>
        {/if}
        {#if backupMsg}<span class="dim">{backupMsg}</span>{/if}
      </div>
    </section>
  {/if}
  </main>
</div>

<style>
  .shell { display: flex; height: 100vh; background: #17171b; color: #f2f2f5; font-size: 13px; user-select: none; }
  nav { width: 176px; flex: none; display: flex; flex-direction: column; gap: 2px; padding: 22px 12px; border-right: 1px solid rgba(255, 255, 255, .08); }
  nav h1 { font-size: 20px; margin: 0 6px; }
  .ver { margin: 2px 6px 14px; font-size: 11.5px; }
  .tab { border: 0; background: none; color: rgba(255, 255, 255, .7); font: inherit; font-weight: 600; text-align: left; padding: 7px 10px; border-radius: 9px; cursor: pointer; }
  .tab:hover { background: rgba(255, 255, 255, .06); }
  .tab.sel { background: var(--accent); color: #fff; }
  .pane { flex: 1; overflow-y: auto; padding: 4px 26px 30px; }
  .pane::-webkit-scrollbar { width: 8px; }
  .pane::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, .14); border-radius: 8px; }
  h2 { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: rgba(255, 255, 255, .45); margin: 22px 0 8px; }
  .card { background: rgba(255, 255, 255, .06); border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .card.list { gap: 12px; }
  .row { display: flex; align-items: center; gap: 8px; }
  .between { justify-content: space-between; }
  .val { font-variant-numeric: tabular-nums; font-weight: 700; }
  .opt { display: flex; gap: 12px; align-items: flex-start; cursor: pointer; }
  .opt input { margin-top: 2px; }
  .opt span { display: flex; flex-direction: column; gap: 2px; }
  .opt small { font-size: 11.5px; }
  .opt.sel { justify-content: space-between; align-items: center; cursor: default; }
  .note { margin: 2px 0 0; font-size: 12px; }
  .grp { margin-top: 6px; }
  select { font: inherit; color: inherit; background: rgba(255, 255, 255, .12); border: 0; border-radius: 8px; padding: 4px 8px; }
  select option { color: #000; }
  input[type=range] { width: 100%; accent-color: var(--accent); }
  .eyesrow { margin-top: 4px; }
  .seg2 { display: flex; padding: 2px; border-radius: 99px; background: rgba(255, 255, 255, .08); }
  .seg2 button { border: 0; background: none; color: rgba(255, 255, 255, .6); font: inherit; font-weight: 600; font-size: 12px; padding: 4px 12px; border-radius: 99px; cursor: pointer; }
  .seg2 button.sel { background: var(--accent); color: #fff; }
  .seg2 button:disabled { opacity: .4; cursor: default; }
  .map { position: relative; width: 100%; max-width: 360px; border-radius: 8px; background: #2b2a33; border: 1px solid rgba(255, 255, 255, .12); cursor: crosshair; overflow: hidden; touch-action: none; }
  .map .zone { position: absolute; border: 1px dashed rgba(255, 255, 255, .22); border-radius: 4px; pointer-events: none; }
  .map .dot { position: absolute; transform: translate(-50%, -50%); min-width: 6px; min-height: 4px; border-radius: 99px; background: var(--accent); pointer-events: none; box-shadow: 0 0 0 1px rgba(0, 0, 0, .4); }
  .num { width: 64px; }
  .preview { height: 54px; border-radius: 10px; background: #2b2a33; display: flex; justify-content: center; align-items: flex-start; overflow: hidden; }
  .pill { height: 36px; background: #000; border-radius: 0 0 12px 12px; display: flex; align-items: center; justify-content: center; gap: 9px; }
  .pill i { width: 7px; height: 11px; background: #fff; border-radius: 50%; }
  .eqc { display: inline-flex; align-items: center; gap: 7px; }
  .chip { width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(128, 128, 128, .35); padding: 0; cursor: pointer; }
  .chip.sel { outline: 2px solid currentColor; outline-offset: 1px; }
  .eqc input[type='color'] { width: 24px; height: 22px; padding: 0; border: 0; background: none; cursor: pointer; }
  .mini { border: 0; border-radius: 99px; padding: 3px 9px; font-size: 11px; cursor: pointer; background: rgba(128, 128, 128, .2); }
  .mini:disabled { opacity: .45; cursor: default; }
</style>
