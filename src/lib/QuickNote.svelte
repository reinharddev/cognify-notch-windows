<script lang="ts">
  import { Inbox } from '@lucide/svelte';
  import { notes } from './state.svelte';
  import { annotated, preview } from './calc';
  import { features } from './system.svelte';
  import { news } from './news.svelte';
  import { L } from './i18n';

  // Sama dengan QuickNote di Mac: kolom 66 px, hasil hitungan (bisa diklik untuk menyalin) atau petunjuk seret file,
  // dan tombol Simpan berbentuk pil.
  let text = $state('');
  let focused = $state(false);
  const result = $derived(features.calculator ? preview(text) : null);
  const save = () => {
    if (!text.trim()) return;
    notes.add(features.calculator ? annotated(text.trim()) : text);
    text = '';
  };
  const copyResult = () => {
    if (!result) return;
    void navigator.clipboard?.writeText(result);
    news.device(L('Hasil disalin', 'Result copied'), undefined, 'circle-check', '#30d158');
  };
</script>

<div class="qn">
  <span class="label">{L('Catatan cepat', 'Quick note')}</span>
  <textarea class:focus={focused} bind:value={text} onfocus={() => (focused = true)} onblur={() => (focused = false)}
    placeholder={L('Tulis sesuatu, tekan Enter…', 'Type something, press Enter…')} aria-label={L('Catatan cepat', 'Quick note')}
    onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } }}></textarea>
  <div class="foot">
    {#if result}
      <button class="res" title={L('Klik untuk menyalin hasil', 'Click to copy the result')} onclick={copyResult}>= {result}</button>
    {:else}
      <span class="hint"><Inbox size={11} /> {L('Seret file ke notch → tray', 'Drop files on the notch → tray')}</span>
    {/if}
    <span class="grow"></span>
    <button class="save" disabled={!text.trim()} onclick={save}>{L('Simpan', 'Save')}</button>
  </div>
</div>

<style>
  .qn { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1; }
  .label { padding-left: 6px; font-size: 9.5px; letter-spacing: .06em; font-weight: 600; text-transform: uppercase; color: rgba(255, 255, 255, .42); }
  textarea { height: 66px; resize: none; box-sizing: border-box; padding: 8px; border: 1px solid transparent; border-radius: 10px; background: rgba(255, 255, 255, .07); color: #fff; font: inherit; font-size: 12px; outline: none; }
  textarea.focus { background: rgba(255, 255, 255, .1); border-color: color-mix(in srgb, var(--accent) 70%, transparent); }
  textarea::placeholder { color: rgba(255, 255, 255, .4); }
  .foot { display: flex; align-items: center; gap: 5px; color: rgba(255, 255, 255, .5); }
  .hint { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; }
  .res { border: 0; background: none; padding: 0; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--accent); cursor: pointer; }
  .grow { flex: 1; }
  .save { border: 0; border-radius: 99px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: #fff; background: color-mix(in srgb, var(--accent) 90%, transparent); cursor: pointer; }
  .save:disabled { background: color-mix(in srgb, var(--accent) 35%, transparent); color: rgba(255, 255, 255, .5); cursor: default; }
</style>
