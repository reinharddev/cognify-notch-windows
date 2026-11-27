<script lang="ts">
  import Input from './ui/Input.svelte';
  import { CornerDownLeft } from '@lucide/svelte';
  import { notes } from './state.svelte';
  import { annotated, currencyPair, formatCurrency, preview } from './calc';
  import { cmdTry } from './bridge';
  import { features } from './system.svelte';
  import { news } from './news.svelte';
  import { hub } from './hub.svelte';
  import { L } from './i18n';

  // Sama dengan QuickNote di Mac: kolom 66 px, hasil hitungan (bisa diklik untuk menyalin) atau petunjuk seret file,
  // dan tombol Simpan berbentuk pil.
  let text = $state('');
  let focused = $state(false);
  const currency = $derived(features.calculator ? currencyPair(text) : null);
  let rateResult = $state('');
  let rateLoading = $state(false);
  let rateError = $state(false);
  let requestId = 0;
  const result = $derived(currency ? rateResult : features.calculator ? preview(text) : null);

  $effect(() => {
    const pair = currency;
    const request = ++requestId;
    rateResult = '';
    rateError = false;
    if (!pair) { rateLoading = false; return; }
    rateLoading = true;
    const timer = window.setTimeout(async () => {
      const response = await cmdTry<number>('currency_rate', { from: pair.from, to: pair.to });
      if (request !== requestId) return;
      if (response.ok && typeof response.value === 'number' && Number.isFinite(response.value)) {
        rateResult = formatCurrency(pair.amount, pair.from, pair.to, response.value);
      } else rateError = true;
      rateLoading = false;
    }, 450);
    return () => window.clearTimeout(timer);
  });
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
  <div class="lb">{L('Catatan cepat', 'Quick note')}</div>
  <div class="field" class:focus={focused}>
    <Input bare multiline bind:value={text} onfocus={() => (focused = true)} onblur={() => (focused = false)}
      placeholder={L('Tulis apa saja…', 'Write anything…')} aria-label={L('Catatan cepat', 'Quick note')}
      onkeydown={(e) => {
        if (e.ctrlKey || e.metaKey) e.stopPropagation(); // biarkan pintasan edit ditangani textarea
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
      }} />
    <button class="round" disabled={!text.trim()} aria-label={L('Simpan', 'Save')} title={L('Simpan', 'Save')} onclick={save}><CornerDownLeft size={14} /></button>
  </div>
  <div class="foot">
    {#if result}
      <button class="res" title={currency ? L('Kurs Yahoo Finance · klik buat salin', 'Yahoo Finance rate · click to copy') : L('Klik buat salin hasilnya', 'Click to copy the result')} onclick={copyResult}>{currency ? '' : '= '}{result}</button>
    {:else if currency && rateLoading}
      <span>{L('Ambil kurs dari Yahoo…', 'Getting the rate from Yahoo…')}</span>
    {:else if currency && rateError}
      <span>{L('Kurs tidak bisa diambil', 'Rate unavailable')}</span>
    {:else}
      <span class="one">{L('Tekan Enter untuk menyimpan ke Catatan', 'Press Enter to save to Notes')}</span>
    {/if}
    <span class="grow"></span>
    {#if hub.connected && text.trim()}
      <button class="btn" title={L('Kirim ke Cognify jadi dokumen baru', 'Send to Cognify as a new doc')}
        onclick={async () => { if (await hub.noteToDoc(text)) text = ''; }}>{L('Jadikan dokumen', 'Make doc')}</button>
    {/if}
  </div>
</div>

<style>
  .qn { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .field { display: flex; align-items: center; gap: 6px; height: 44px; padding: 0 6px 0 12px; border-radius: 12px; background: rgba(0, 0, 0, .6); border: 1px solid rgba(255, 255, 255, .09); }
  .field.focus { border-color: var(--accent); }
  .field :global(textarea) { flex: 1; min-width: 0; height: 18px; resize: none; color: var(--ink, #fff); font-size: 12.5px; }
  .field .round { width: 32px; height: 32px; }
  .foot { display: flex; align-items: center; gap: 6px; min-height: 26px; margin: 6px 8px 0; font-size: 11px; color: var(--muted); }
  .res { border: 0; background: none; padding: 0; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--hi); cursor: pointer; }
</style>
