<script lang="ts">
  import { RotateCcw } from '@lucide/svelte';
  import Group from './Group.svelte';
  import Setting from './Setting.svelte';
  import Segmented from './Segmented.svelte';
  import { L } from '../i18n';
  import { skins } from '../skins.svelte';
  import { MOODS, PRESETS, REACTIONS, SHAPES, defaultMimik, mimikConfig, randomPalette } from '../mimik';

  // Pengaturan > Skin: sama dengan SkinsPane dan MimikPlayground di Mac (Skins.swift, SkinPlayground.swift): daftar skin,
  // playground wajah Mimik (preset, warna, bentuk, opsi, suasana, efek, reaksi, gaya tersimpan), Atur posisi, dan tampilan.
  // Pratinjau memakai halaman skin yang sama lewat skema skin:// (di iframe), jadi identik dengan yang di desktop.

  const mimikInfo = $derived(skins.skins.find((s) => s.id === 'mimik'));
  const showPlayground = $derived(!!mimikInfo && skins.isOn('mimik'));
  const previewSrc = (navigator.userAgent.includes('Windows') ? 'http://skin.localhost/' : 'skin://localhost/') + 'mimik/index.html?preview=1';
  let frame: HTMLIFrameElement | undefined = $state();
  let presetName = $state('');

  // Konfigurasi ke pratinjau tiap gaya atau reaksi berubah (dan saat iframe selesai dimuat).
  const send = () => frame?.contentWindow?.postMessage({ cognifyCfg: mimikConfig($state.snapshot(skins.mimik), $state.snapshot(skins.reaction)) }, '*');
  $effect(() => { void [JSON.stringify(skins.mimik), skins.reaction.n]; send(); });

  const style = $derived(skins.mimik);
  const custom = () => ({ preset: 'custom' });
  const savePreset = () => { skins.savePreset(presetName); presetName = ''; };
  const isDefault = $derived(JSON.stringify(style) === JSON.stringify(defaultMimik()));

  const toggles: { key: 'mouth' | 'pupils' | 'follow' | 'blink' | 'wander'; id: string; en: string }[] = [
    { key: 'mouth', id: 'Gambar mulut', en: 'Draw a mouth' }, { key: 'pupils', id: 'Pupil dalam', en: 'Inner pupils' },
    { key: 'follow', id: 'Ikuti kursor', en: 'Follow cursor' }, { key: 'blink', id: 'Berkedip', en: 'Blink' },
    { key: 'wander', id: 'Melirik sendiri', en: 'Idle wander' },
  ];
  const effects: { key: 'gloss' | 'rim' | 'glow' | 'scan' | 'hue'; id: string; en: string }[] = [
    { key: 'gloss', id: 'Kilap', en: 'Gloss' }, { key: 'rim', id: 'Tepi terang', en: 'Rim light' }, { key: 'glow', id: 'Pendar', en: 'Glow' },
    { key: 'scan', id: 'Garis scan', en: 'Scanlines' }, { key: 'hue', id: 'Pelangi', en: 'Rainbow' },
  ];
</script>

{#if showPlayground}
  <Group title={L('Mimik: atur wajahmu', 'Mimik: make a face you like')}>
    <div class="play">
      <div class="top">
        <iframe bind:this={frame} class="preview" title={L('Pratinjau Mimik', 'Mimik preview')} src={previewSrc} onload={send}></iframe>
        <div class="side">
          <div class="cap">{L('Preset', 'Preset')}</div>
          <div class="chips">
            {#each PRESETS as p}
              <button class="chip" class:on={style.preset === p.id} onclick={() => skins.patch({ preset: p.id, skin: p.skin, ink: p.ink, ring: p.ring })}>{p.name}</button>
            {/each}
            <button class="chip" class:on={style.preset === 'surprise'} onclick={() => { const c = randomPalette(); skins.patch({ preset: 'surprise', skin: c.skin, ink: c.ink, ring: c.ring }); }}>{L('Acak', 'Surprise me')}</button>
            {#each skins.presets as saved (saved.id)}
              <button class="chip" class:on={style.preset === 'saved:' + saved.id} onclick={() => skins.applyPreset(saved)}
                oncontextmenu={(e) => { e.preventDefault(); skins.deletePreset(saved.id); }} title={L('Klik kanan untuk menghapus', 'Right-click to delete')}>{saved.name}</button>
            {/each}
          </div>
          <div class="savebox">
            <div class="cap2">{L('Simpan gaya ini', 'Save this style')}</div>
            <div class="row">
              <input type="text" class="name" bind:value={presetName} maxlength="24" placeholder={L('Nama gaya', 'Style name')} aria-label={L('Nama gaya', 'Style name')} onkeydown={(e) => e.key === 'Enter' && savePreset()} />
              <button class="btn" onclick={savePreset} disabled={!presetName.trim()}>{L('Simpan', 'Save')}</button>
            </div>
            {#if skins.presets.length}<div class="note">{L('Klik kanan gaya buatanmu untuk menghapusnya.', 'Right-click one of your styles to delete it.')}</div>{/if}
          </div>
          <div class="cap">{L('Warna', 'Colour')}</div>
          <div class="swatches">
            <label><input type="color" value={style.skin} oninput={(e) => skins.patch({ skin: e.currentTarget.value, ...custom() })} /><span>{L('Kepala', 'Head')}</span></label>
            <label><input type="color" value={style.ink} oninput={(e) => skins.patch({ ink: e.currentTarget.value, ...custom() })} /><span>{L('Mata', 'Eyes')}</span></label>
            <label><input type="color" value={style.ring} oninput={(e) => skins.patch({ ring: e.currentTarget.value, ...custom() })} /><span>{L('Cincin', 'Ring')}</span></label>
          </div>
          <div class="cap">{L('Bentuk', 'Shape')}</div>
          <div class="chips">
            {#each SHAPES as sh}<button class="chip" class:on={style.type === sh.id} onclick={() => skins.patch({ type: sh.id })}>{L(sh.id_, sh.en)}</button>{/each}
          </div>
        </div>
      </div>

      <div class="cap">{L('Opsi', 'Options')}</div>
      <div class="chips">
        {#each toggles as t}<button class="chip" class:on={style[t.key]} onclick={() => skins.patch({ [t.key]: !style[t.key] })}>{L(t.id, t.en)}</button>{/each}
      </div>

      <div class="cap">{L('Suasana', 'Mood')}</div>
      <div class="chips">
        <button class="chip" class:on={style.mood === 'auto'} onclick={() => skins.patch({ mood: 'auto' })}>{L('Otomatis', 'Auto')}</button>
        {#each MOODS as m}<button class="chip" class:on={style.mood === m} onclick={() => skins.patch({ mood: m })}>{m}</button>{/each}
      </div>
      <div class="note">{L('Otomatis: wajah mengikuti harimu (musik, jam, tugas). Pilih satu untuk menetapkannya.', 'Auto: the face follows your day (music, time, tasks). Pick one to lock it.')}</div>

      <div class="cap">{L('Efek', 'Effects')}</div>
      <div class="chips">
        {#each effects as e}<button class="chip" class:on={style[e.key]} onclick={() => skins.patch({ [e.key]: !style[e.key] })}>{L(e.id, e.en)}</button>{/each}
      </div>

      <div class="cap">{L('Coba reaksi', 'Try a reaction')}</div>
      <div class="chips">
        {#each REACTIONS as r}<button class="chip" onclick={() => skins.react(r)}>{r}</button>{/each}
      </div>

      <div class="foot"><button class="btn" onclick={() => skins.resetMimik()} disabled={isDefault}>{L('Kembalikan ke bawaan', 'Reset to default')}</button></div>
    </div>
  </Group>
{/if}

<Group hint={L('Pindahkan skin dengan mode Atur posisi di bawah, atau tahan Alt lalu seret. Skin tidak punya akses internet dan hanya membaca folder skinnya sendiri.',
  'Move skins with Arrange positions below, or hold Alt and drag. Skins have no internet access and only read their own folder.')}>
  {#if skins.skins.length === 0}
    <Setting title={L('Belum ada skin. Letakkan folder skin di folder skin lalu tekan Muat ulang.', 'No skins yet. Put a skin folder in the skins folder, then press Reload.')} />
  {/if}
  {#each skins.skins as skin (skin.id)}
    <Setting toggle title={skin.name} desc={skin.desc} checked={skins.isOn(skin.id)} onchange={(v) => skins.setOn(skin.id, v)} />
  {/each}
</Group>

<Group>
  <Setting toggle title={L('Atur posisi', 'Arrange positions')} checked={skins.arranging} onchange={(v) => skins.setArranging(v)}
    desc={L('Skin berbingkai dan bisa diseret bebas ke mana saja. Matikan setelah selesai; posisinya tersimpan.', 'Skins get an outline and can be dragged anywhere. Turn it off when done; positions are saved.')} />
  <Setting title={L('Kembalikan ke posisi awal', 'Reset positions')}>
    <button class="btn" onclick={() => skins.resetPositions()}>{L('Kembalikan ke posisi awal', 'Reset positions')}</button>
  </Setting>
</Group>

<Group title={L('Tampilan', 'Display')}>
  <Setting title={L('Posisi jendela', 'Window level')}>
    <Segmented label={L('Posisi jendela', 'Window level')} value={skins.onTop ? 'top' : 'desk'} onchange={(v) => skins.setOnTop(v === 'top')}
      options={[{ value: 'desk', label: L('Di desktop (di bawah jendela lain)', 'On the desktop (below other windows)') }, { value: 'top', label: L('Selalu di atas', 'Always on top') }]} />
  </Setting>
  <Setting stack title={L('Ukuran', 'Size')}>
    <div class="slider">
      <input type="range" min="0.5" max="2.5" step="0.1" value={skins.scale} oninput={(e) => skins.setScale(Number(e.currentTarget.value))} aria-label={L('Ukuran', 'Size')} />
      <span class="val">{Math.round(skins.scale * 100)}%</span>
      <button class="btn ghost" onclick={() => skins.setScale(1)} disabled={Math.round(skins.scale * 100) === 100} aria-label={L('Atur ulang', 'Reset')} title={L('Atur ulang', 'Reset')}><RotateCcw size={13} /></button>
    </div>
  </Setting>
</Group>

<Group>
  <Setting title={L('Folder skin', 'Skins folder')}>
    <div class="btns">
      <button class="btn" onclick={() => skins.reveal()}>{L('Buka folder skin', 'Open skins folder')}</button>
      <button class="btn" onclick={() => skins.reload()}>{L('Muat ulang', 'Reload')}</button>
    </div>
  </Setting>
</Group>

<style>
  .play { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .top { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
  /* color-scheme: normal supaya halaman skin di dalamnya tetap transparan di atas kartu gelap (tanpa ini iframe menjadi putih). */
  .preview { width: 190px; height: 190px; flex: none; border: 1px solid var(--line); border-radius: 16px; background: #0d0d0f; color-scheme: normal; }
  .side { flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: 10px; }
  .cap { font-size: 10px; font-weight: 600; letter-spacing: .8px; text-transform: uppercase; color: var(--faint); }
  .cap2 { font-size: 12px; color: var(--dim); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 0; cursor: pointer; font: inherit; font-size: 12px; padding: 5px 11px; border-radius: 99px; background: rgba(255, 255, 255, .08); color: inherit; }
  .chip:hover { background: rgba(255, 255, 255, .14); }
  .chip.on { background: #f2f2f4; color: #121214; }
  .savebox { display: flex; flex-direction: column; gap: 4px; }
  .row { display: flex; gap: 8px; align-items: center; }
  .name { min-width: 110px; max-width: 220px; flex: 1; padding: 5px 8px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255, 255, 255, .05); color: inherit; font: inherit; font-size: 12px; }
  .note { font-size: 12px; color: var(--dim); }
  .swatches { display: flex; gap: 18px; }
  .swatches label { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; color: var(--dim); }
  .swatches input[type=color] { width: 44px; height: 24px; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: none; cursor: pointer; }
  .foot { display: flex; justify-content: flex-end; }
  .btn { border: 1px solid var(--line); background: rgba(255, 255, 255, .07); color: inherit; font: inherit; font-size: 12px; padding: 5px 14px; border-radius: 99px; cursor: pointer; }
  .btn:disabled { opacity: .45; cursor: default; }
  .btn.ghost { background: transparent; padding: 5px 9px; display: inline-flex; align-items: center; }
  .btns { display: flex; gap: 8px; }
  .slider { display: flex; align-items: center; gap: 12px; width: 100%; }
  .slider input[type=range] { flex: 1; min-width: 0; }
  .val { min-width: 56px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
</style>
