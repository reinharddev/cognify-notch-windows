<script lang="ts">
  import { features } from '../system.svelte';
  import { cmd, inTauri, pickFiles } from '../bridge';
  import { agenda } from '../agenda.svelte';
  import { hotkey, HOTKEYS } from '../hotkey.svelte';
  let ics = $state(agenda.url);
  import { L } from '../i18n';
  import { checkUpdate, installNow, update } from '../update.svelte';
  import { weather } from '../weather.svelte';
  let city = $state(weather.city);

  let autostart = $state(false);
  void cmd<boolean>('autostart_get').then((v) => (autostart = !!v));
  const setAuto = () => void cmd('autostart_set', { on: autostart });

  const toggles = [
    ['weather', L('Cuaca (kirim nama kota ke Open-Meteo)', 'Weather (sends city name to Open-Meteo)')],
    ['media', L('Musik dan sampul', 'Music and artwork')],
    ['lyrics', L('Lirik dari LRCLIB (kirim judul dan artis)', 'Lyrics from LRCLIB (sends title and artist)')],
    ['clipboard', L('Riwayat clipboard', 'Clipboard history')],
    ['charger', L('Kabar charger', 'Charger news')],
    ['devices', L('Kabar perangkat suara', 'Sound device news')],
    ['downloads', L('Kabar unduhan selesai', 'Finished downloads news')],
    ['keys', L('Kabar Caps Lock dan bahasa keyboard', 'Caps Lock and keyboard language news')],
    ['network', L('Kabar internet putus', 'Offline news')],
    ['updates', L('Periksa versi baru tiap hari', 'Check for new versions daily')],
    ['autoInstall', L('Pasang pembaruan otomatis', 'Install updates automatically')],
    ['hideFullscreen', L('Sembunyi saat layar penuh', 'Hide in fullscreen')],
  ] as const;
</script>

<div class="cols">
  <div class="grow tg">
    {#each toggles as [key, name]}
      <label class="row" style="cursor:pointer;align-items:flex-start"><input type="checkbox" bind:checked={features[key]} onchange={() => { features.persist(); if (key === 'weather') weather.restart(); }} /> {name}</label>
    {/each}
  </div>
  <div class="sep"></div>
  <div class="col" style="width:230px;overflow-y:auto;scrollbar-width:none">
    {#if features.weather}
      <input type="text" bind:value={city} placeholder={L('Nama kota', 'City name')} onchange={() => weather.setCity(city)} />
      {#if weather.problem}<span class="dim">{weather.problem}</span>{/if}
    {/if}
    {#if inTauri}
      <input type="text" bind:value={ics} placeholder={L('Tautan kalender ICS (https)', 'Calendar ICS link (https)')} onchange={() => agenda.setSource(ics)} />
      <button class="btn" onclick={async () => { const f = (await pickFiles())[0]; if (f) { ics = ''; agenda.setSource('', f); } }}>{agenda.file ? L('File kalender: ganti', 'Calendar file: change') : L('Pilih file .ics', 'Choose .ics file')}</button>
      {#if agenda.problem}<span class="dim">{agenda.problem}</span>{/if}
      <label class="row dim">{L('Pintasan buka', 'Open shortcut')}
        <select bind:value={hotkey.choice} onchange={() => hotkey.apply()}>{#each HOTKEYS as [id, label]}<option value={id}>{label}</option>{/each}</select></label>
    {/if}
    {#if inTauri}<label class="row" style="cursor:pointer"><input type="checkbox" bind:checked={autostart} onchange={setAuto} /> {L('Buka saat Windows dinyalakan', 'Open when Windows starts')}</label>{/if}
    <button class="btn" onclick={() => checkUpdate()}>{L('Cek pembaruan', 'Check for updates')}</button>
    {#if update.text}<span class="dim">{update.text}</span>{/if}
    {#if update.selfUpdate && (update.stage === 'found' || update.stage === 'ready')}<button class="btn on" onclick={installNow}>{L('Perbarui dan mulai ulang', 'Update and restart')}</button>{/if}
    {#if !update.selfUpdate && update.url}<button class="btn on" onclick={() => cmd('open_target', { target: update.url })}>{L('Buka halaman unduh', 'Open download page')}</button>{/if}
    <span class="dim" style="margin-top:auto">Cognify Notch {update.current}</span>
  </div>
</div>

<style>
  select { font: inherit; color: inherit; background: rgba(255, 255, 255, .12); border: 0; border-radius: 8px; padding: 3px 6px; }
  select option { color: #000; }
  .tg { display: grid; grid-template-columns: 1fr 1fr; gap: 9px 14px; align-content: start; font-size: 11.5px; }
  .tg input { margin-top: 1px; }
</style>
