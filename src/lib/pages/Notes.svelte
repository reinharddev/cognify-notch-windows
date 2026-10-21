<script lang="ts">
  import { notes } from '../state.svelte';
  import { evaluate } from '../calc';
  import { L } from '../i18n';
  import { ticker } from '../store.svelte';
  let { compact = false }: { compact?: boolean } = $props();
  let text = $state('');
  const result = $derived(evaluate(text));
  const save = () => { notes.add(result ? `${text.trim()} = ${result}` : text); text = ''; };
  const copy = (s: string) => void navigator.clipboard?.writeText(s);
  const ago = (t: number) => {
    const m = Math.floor((ticker.now - t) / 60000);
    return m < 1 ? L('baru saja', 'just now') : m < 60 ? L(`${m} mnt lalu`, `${m} min ago`) : m < 1440 ? L(`${Math.floor(m / 60)} jam lalu`, `${Math.floor(m / 60)} h ago`) : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
  };
</script>

<div class="col" style="height:100%">
  <span class="label">{L('Catatan cepat', 'Quick note')}</span>
  <textarea rows={compact ? 2 : 3} bind:value={text} placeholder={L('Tulis catatan, atau hitungan seperti 12*3 dan 5 km ke mil', 'Write a note, or a sum like 12*3 or 5 km to mi')}
    onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) save(); } }}></textarea>
  <div class="row" style="min-height:26px">
    {#if result}<b style="font-size:15px">= {result}</b><button class="btn" onclick={() => copy(result)}>{L('Salin', 'Copy')}</button>{/if}
    <button class="btn on" style="margin-left:auto" disabled={!text.trim()} onclick={save}>{L('Simpan', 'Save')}</button>
  </div>
  {#if !compact}
    <div class="list grow">
      {#each notes.items as n (n.id)}
        <div class="item">
          <span class="grow txt">{n.text}</span><span class="dim" style="font-size:10px">{ago(n.t)}</span>
          <button class="x" aria-label={L('Salin', 'Copy')} onclick={() => copy(n.text)}>⧉</button>
          <button class="x" aria-label={L('Hapus', 'Delete')} onclick={() => notes.remove(n.id)}>×</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>.txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }</style>
