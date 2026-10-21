<script lang="ts">
  import { todo } from '../state.svelte';
  import { L } from '../i18n';
  import { ticker } from '../store.svelte';
  let text = $state('');
  const add = () => { todo.add(text); text = ''; };
  const when = (t: number) => {
    const d = new Date(t), now = new Date(ticker.now);
    const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dayDiff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 864e5);
    return dayDiff === 0 ? hm : dayDiff === 1 ? `${L('Besok', 'Tomorrow')} ${hm}` : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${hm}`;
  };
</script>

<div class="col" style="height:100%">
  <div class="row">
    <input type="text" bind:value={text} placeholder={L('Tambah tugas, mis. "rapat jam 14.00"', 'Add a task, e.g. "meeting at 2pm"')}
      onkeydown={(e) => e.key === 'Enter' && add()} />
    <button class="btn on" onclick={add}>{L('Tambah', 'Add')}</button>
  </div>
  <div class="list grow">
    {#if todo.items.length === 0}
      <div class="empty">{L('Belum ada tugas. Sebut jamnya di teks supaya kamu diingatkan.', 'No tasks yet. Mention a time in the text to get a reminder.')}</div>
    {/if}
    {#each todo.sorted as t (t.id)}
      <div class="item" class:done={t.done}>
        <input type="checkbox" checked={t.done} onchange={() => todo.toggle(t.id)} />
        <span class="grow txt">{t.text}</span>
        {#if t.due}<span class="dim" class:late={!t.done && t.due < ticker.now}>{when(t.due)}</span>{/if}
        <button class="x" aria-label={L('Hapus', 'Delete')} onclick={() => todo.remove(t.id)}>×</button>
      </div>
    {/each}
  </div>
</div>

<style>
  .done .txt { text-decoration: line-through; opacity: .45; }
  .late { color: #ff8c85; }
  .txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
