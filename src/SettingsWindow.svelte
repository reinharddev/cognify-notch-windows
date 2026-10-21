<script lang="ts">
  import { features } from './lib/system.svelte';
  import { cmd, emitPrefs, inTauri, pickFiles } from './lib/bridge';
  import { agenda } from './lib/agenda.svelte';
  import { hotkey, HOTKEYS } from './lib/hotkey.svelte';
  import { L } from './lib/i18n';
  import { checkUpdate, initUpdate, installNow, update } from './lib/update.svelte';
  import { weather } from './lib/weather.svelte';
  import { ui, CLOSED_MIN, CLOSED_MAX, CLOSED_DEFAULT } from './lib/ui.svelte';

  let ics = $state(agenda.url);
  let city = $state(weather.city);
  let autostart = $state(false);
  void cmd<boolean>('autostart_get').then((v) => (autostart = !!v));
  void initUpdate();

  const toggles = [
    ['media', L('Musik dan sampul', 'Music and artwork'), L('Tampilkan lagu yang diputar di sayap notch.', 'Show the playing song on the notch wings.')],
    ['lyrics', L('Lirik', 'Lyrics'), L('Diambil dari LRCLIB; mengirim judul dan nama artis.', 'Fetched from LRCLIB; sends the title and artist.')],
    ['weather', L('Cuaca', 'Weather'), L('Mengirim nama kotamu ke Open-Meteo.', 'Sends your city name to Open-Meteo.')],
    ['clipboard', L('Riwayat clipboard', 'Clipboard history'), L('Menyimpan salinan di PC ini saja.', 'Kept on this PC only.')],
    ['charger', L('Kabar charger', 'Charger news'), ''],
    ['devices', L('Kabar perangkat suara', 'Sound device news'), L('Volume, kecerahan, dan pindah output suara.', 'Volume, brightness, and output changes.')],
    ['downloads', L('Kabar unduhan selesai', 'Finished downloads news'), ''],
    ['keys', L('Kabar Caps Lock dan bahasa keyboard', 'Caps Lock and keyboard language news'), ''],
    ['network', L('Kabar internet putus', 'Offline news'), ''],
    ['hideFullscreen', L('Sembunyi saat layar penuh', 'Hide in fullscreen'), L('Notch menyingkir saat video atau game layar penuh.', 'The notch steps aside for fullscreen video or games.')],
    ['updates', L('Periksa versi baru tiap hari', 'Check for new versions daily'), ''],
    ['autoInstall', L('Pasang pembaruan otomatis', 'Install updates automatically'), L('Dipasang saat notch tidak dipakai.', 'Installed when the notch is idle.')],
  ] as const;

  const changedFeature = (key: string) => { features.persist(); if (key === 'weather') weather.restart(); void emitPrefs('features'); };
  const setWidth = () => { ui.persist(); void emitPrefs('ui'); };
  const resetWidth = () => { ui.closedWidth = CLOSED_DEFAULT; setWidth(); };
</script>

<main class="sw">
  <header>
    <h1>{L('Pengaturan', 'Settings')}</h1>
    <span class="dim">Cognify Notch {update.current}</span>
  </header>

  <section>
    <h2>{L('Tampilan', 'Appearance')}</h2>
    <div class="card">
      <div class="row between">
        <label for="w">{L('Lebar notch saat tertutup', 'Closed notch width')}</label>
        <span class="val">{ui.closedWidth} px</span>
      </div>
      <input id="w" type="range" min={CLOSED_MIN} max={CLOSED_MAX} step="2" bind:value={ui.closedWidth} oninput={setWidth} />
      <div class="preview"><span class="pill" style:width="{ui.closedWidth}px"><i></i><i></i></span></div>
      <div class="row between">
        <span class="dim">{L('Lebih sempit tidak menutupi tab browser. Panel yang terbuka tidak berubah.', 'Narrower won\'t cover browser tabs. The open panel is unchanged.')}</span>
        <button class="btn" onclick={resetWidth} disabled={ui.closedWidth === CLOSED_DEFAULT}>{L('Atur ulang', 'Reset')}</button>
      </div>
    </div>
  </section>

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
    </div>
  </section>

  <section>
    <h2>{L('Fitur', 'Features')}</h2>
    <div class="card list">
      {#each toggles as [key, name, hint]}
        <label class="opt"><input type="checkbox" bind:checked={features[key]} onchange={() => changedFeature(key)} />
          <span><b>{name}</b>{#if hint}<small class="dim">{hint}</small>{/if}</span></label>
      {/each}
    </div>
  </section>

  {#if inTauri}
    <section>
      <h2>{L('Kota dan kalender', 'City and calendar')}</h2>
      <div class="card col">
        {#if features.weather}
          <input type="text" bind:value={city} placeholder={L('Nama kota', 'City name')} onchange={() => { weather.setCity(city); void emitPrefs('weather'); }} />
          {#if weather.problem}<span class="dim">{weather.problem}</span>{/if}
        {/if}
        <input type="text" bind:value={ics} placeholder={L('Tautan kalender ICS (https)', 'Calendar ICS link (https)')} onchange={() => { agenda.setSource(ics); void emitPrefs('agenda'); }} />
        <div class="row">
          <button class="btn" onclick={async () => { const f = (await pickFiles())[0]; if (f) { ics = ''; agenda.setSource('', f); void emitPrefs('agenda'); } }}>{agenda.file ? L('File kalender: ganti', 'Calendar file: change') : L('Pilih file .ics', 'Choose .ics file')}</button>
        </div>
        {#if agenda.problem}<span class="dim">{agenda.problem}</span>{/if}
      </div>
    </section>
  {/if}

  <section>
    <h2>{L('Pembaruan', 'Updates')}</h2>
    <div class="card col">
      <div class="row">
        <button class="btn" onclick={() => checkUpdate()}>{L('Cek pembaruan', 'Check for updates')}</button>
        {#if update.selfUpdate && (update.stage === 'found' || update.stage === 'ready')}<button class="btn on" onclick={installNow}>{L('Perbarui dan mulai ulang', 'Update and restart')}</button>{/if}
        {#if !update.selfUpdate && update.url}<button class="btn on" onclick={() => cmd('open_target', { target: update.url })}>{L('Buka halaman unduh', 'Open download page')}</button>{/if}
      </div>
      {#if update.text}<span class="dim">{update.text}</span>{/if}
    </div>
  </section>
</main>

<style>
  .sw { height: 100vh; overflow-y: auto; padding: 22px 26px 30px; background: #17171b; color: #f2f2f5; font-size: 13px; user-select: none; }
  .sw::-webkit-scrollbar { width: 8px; }
  .sw::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, .14); border-radius: 8px; }
  header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
  h1 { font-size: 22px; margin: 0; }
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
  select { font: inherit; color: inherit; background: rgba(255, 255, 255, .12); border: 0; border-radius: 8px; padding: 4px 8px; }
  select option { color: #000; }
  input[type=range] { width: 100%; accent-color: var(--accent); }
  .preview { height: 54px; border-radius: 10px; background: #2b2a33; display: flex; justify-content: center; align-items: flex-start; overflow: hidden; }
  .pill { height: 36px; background: #000; border-radius: 0 0 12px 12px; display: flex; align-items: center; justify-content: center; gap: 9px; }
  .pill i { width: 7px; height: 11px; background: #fff; border-radius: 50%; }
</style>
